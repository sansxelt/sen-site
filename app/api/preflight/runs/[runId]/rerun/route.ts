// POST /api/preflight/runs/[runId]/rerun — queue a NEW immutable run that re-runs a parent run's flows.
//
// A rerun is never a mutation of the parent: the parent stays immutable, and this inserts a fresh QUEUED run
// (same app, same contract version the parent used, re-targeting the parent's deployment) that the Railway
// worker claims and drives. NO Playwright, NO provider secret, NO signed URL is ever touched here. Everything
// is owner-scoped; the signed-in email is the only owner; nothing from the client body is trusted as an owner,
// and the client can only pick flows the PARENT run actually executed (never arbitrary ids).
//
// Issue resolution is worker-side: an issue resolves only when its flow's rerun passes. This route resolves
// nothing.
//
// Gates, in order: preflight flag (404) -> kill switch (503) -> auth (401) -> DB migrated (503) -> parent
// run owned (404) -> app owned (404) -> parent has a contract (400) -> safe https deployment URL (400) ->
// flow selection non-empty (400) -> per-owner concurrency cap (429) -> per-owner DAILY cap (429) -> credit
// hold (402). Only after the hold do we insert; a unique-submission collision returns the existing run (409)
// and releases this attempt's hold. Billing mirrors the launch route exactly
// (app/api/preflight/apps/[id]/runs/route.ts).

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { preflightEnabled, runsDisabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication, listFlows } from "@/lib/v-applications";
import { unsafeHttpsUrlReason } from "@/lib/safe-fetch";
import { hold, refund } from "@/lib/v-credits";
import { createRun, ownerActiveRunCount, ownerRunsToday } from "@/lib/preflight/runs-db";
import { getRunInternal, parentRunFlows, setParentRun } from "@/lib/preflight/run-report-db";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

// Mirror the launch route (app/api/preflight/apps/[id]/runs/route.ts): the concurrency cap is a worker-load
// guard, and the credit hold is the flat per-run spend cap: a completed run keeps the full hold as the
// charge, and the worker refunds the whole hold only if no flow ran (no partial remainder).
const MAX_ACTIVE_RUNS_PER_OWNER = 2;
const RUN_CREDITS_PER_FLOW = 1;
const MIN_RUN_CREDITS = 1;
const FAILED_STATES = new Set(["failed", "blocked"]);

function billingBypassAllowed(): boolean {
  return process.env.PREFLIGHT_INTERNAL_BILLING_BYPASS === "1"
    && process.env.NODE_ENV !== "production"
    && process.env.VERCEL_ENV !== "production";
}

export async function POST(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Kill switch: pauses NEW runs only. Reports, history, and the worker's already-claimed work are untouched.
  if (runsDisabled()) {
    return NextResponse.json({ error: "runs_paused", message: "New Production Passes are temporarily paused. Existing reports remain available." }, { status: 503 });
  }
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const owner = email.toLowerCase();
  const { runId: parentRunId } = await params;

  if (!(await preflightDbReady())) {
    return NextResponse.json({ error: "setup_required", message: "Preflight is not fully set up yet." }, { status: 503 });
  }

  // Ownership: the PARENT run must be owned. getRunInternal is user-scoped, so a run that is not this owner's
  // (or does not exist) returns null and we 404 without leaking existence.
  const parent = await getRunInternal(owner, parentRunId);
  if (!parent) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const app = await getApplication(owner, parent.applicationId);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Rerun against the SAME contract version the parent used — it was approved when the parent ran, so the
  // rerun needs no re-approval and cannot be blocked by an in-progress draft revision.
  if (!parent.contractId) {
    return NextResponse.json({ error: "no_contract", message: "This run has no contract to re-run against." }, { status: 400 });
  }

  // Re-target the parent's deployment (fall back to the connected app URL). Cheap pre-navigation SSRF guard;
  // the browser layer re-validates + DNS-pins before any navigation.
  const deploymentUrl = ((parent.deploymentUrl || app.app_url) || "").trim();
  if (unsafeHttpsUrlReason(deploymentUrl)) {
    return NextResponse.json({ error: "invalid_url", message: "This run has no public https deployment target." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const scope: unknown = body?.scope;

  // Resolve the flow selection from the flows the PARENT actually ran. The client is trusted only as far as
  // its ids intersect the parent's flows; createRun then re-intersects with what is enabled+approved right now.
  const pf = await parentRunFlows(owner, parentRunId);
  let flowIds: string[];
  if (scope === "all") {
    flowIds = pf.map((f) => f.testFlowId);
    if (!flowIds.length) {
      // The parent produced no flow runs (e.g. it failed before the browser started), so "Run again" falls
      // back to the contract's currently eligible flows — relaunching the whole contract rather than nothing.
      const flows = await listFlows(owner, parent.contractId);
      flowIds = flows.filter((f) => f.enabled && (((f as { review_state?: string }).review_state ?? "approved") === "approved")).map((f) => f.id);
    }
  } else if (Array.isArray(scope)) {
    const requested = new Set((scope as unknown[]).filter((x): x is string => typeof x === "string"));
    flowIds = pf.filter((f) => requested.has(f.testFlowId)).map((f) => f.testFlowId);
  } else {
    // default: 'failed' — re-run only the flows that failed or were blocked.
    flowIds = pf.filter((f) => FAILED_STATES.has(f.state)).map((f) => f.testFlowId);
  }
  flowIds = Array.from(new Set(flowIds));
  if (!flowIds.length) {
    return NextResponse.json({ error: "nothing_to_rerun", message: "There are no matching flows from this run to re-run." }, { status: 400 });
  }

  // Per-owner concurrency cap.
  if ((await ownerActiveRunCount(owner)) >= MAX_ACTIVE_RUNS_PER_OWNER) {
    return NextResponse.json({ error: "too_many_active_runs", message: "You already have preflight runs in progress. Wait for them to finish." }, { status: 429 });
  }

  // Per-owner DAILY cap (runs created since UTC midnight), checked BEFORE the credit hold so no hold is
  // ever taken for a run the cap would refuse.
  if ((await ownerRunsToday(owner)) >= Number(process.env.PREFLIGHT_MAX_RUNS_PER_DAY || 20)) {
    return NextResponse.json({ error: "daily_limit", message: "Daily run limit reached. Try again tomorrow or contact support." }, { status: 429 });
  }

  // Idempotency: an Idempotency-Key header or a submission_id in the body dedupes an accidental double POST;
  // otherwise each rerun is a distinct run, so mint a fresh id.
  const submissionId = (req.headers.get("idempotency-key") || (typeof body?.submission_id === "string" ? body.submission_id : "") || randomUUID()).slice(0, 100);

  // Billing reservation, keyed by a FRESH id per attempt so an idempotent replay / lost unique-submission race
  // can be refunded in isolation without colliding with the winning run's own reservation.
  const estCredits = Math.max(MIN_RUN_CREDITS, flowIds.length * RUN_CREDITS_PER_FLOW);
  const reservationId = randomUUID();
  let creditsHeld = 0;
  let heldReservationId: string | null = null;

  if (billingBypassAllowed()) {
    console.warn(`[preflight] BILLING BYPASS active (PREFLIGHT_INTERNAL_BILLING_BYPASS=1); rerun for ${owner} of run ${parentRunId} will NOT be charged.`);
  } else {
    const ok = await hold(owner, reservationId, estCredits);
    if (!ok) {
      return NextResponse.json({ error: "insufficient_credits", message: "You do not have enough credits to launch this preflight run." }, { status: 402 });
    }
    creditsHeld = estCredits;
    heldReservationId = reservationId;
  }

  // Queue the run (insert only; NO execution). createRun re-reads the approved flows before inserting.
  const created = await createRun(owner, {
    applicationId: parent.applicationId, contractId: parent.contractId, contractVersion: parent.contractVersion,
    deploymentUrl, submissionId, flowIds, creditsHeld, reservationId: heldReservationId,
  });

  if (!created) {
    if (heldReservationId) await refund(owner, reservationId, estCredits);
    return NextResponse.json({ error: "unavailable", message: "Could not queue the rerun. Try again." }, { status: 503 });
  }
  if ("conflict" in created) {
    if (heldReservationId) await refund(owner, reservationId, estCredits);
    return NextResponse.json({ error: "run_exists", runId: created.runId, status: "queued" }, { status: 409 });
  }

  // Best-effort provenance: link the new run back to its parent (see setParentRun).
  await setParentRun(owner, created.runId, parentRunId);

  await logEvent({
    userId: owner, eventType: "preflight_run_rerun", actorType: "owner", source: "app",
    route: `/api/preflight/runs/${parentRunId}/rerun`,
    metadata: { application_id: parent.applicationId, parent_run_id: parentRunId, run_id: created.runId, flow_count: created.flowCount, credits_held: creditsHeld },
  });
  return NextResponse.json({ runId: created.runId, status: "queued", flowCount: created.flowCount });
}
