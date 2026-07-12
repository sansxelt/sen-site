// POST /api/preflight/apps/[id]/runs; enqueue a Preflight RUN for a connected application.
//
// This route ONLY reserves credits and inserts a QUEUED job. It NEVER executes a browser: the Railway
// worker claims the queued run (v_preflight_claim) and drives Playwright in an isolated Browserbase session.
// No Playwright, no provider secrets, no signed URLs are ever touched here. Everything is owner-scoped; the
// signed-in email is the only owner; nothing from the client body is trusted as an owner.
//
// Gates, in order: preflight flag (404) -> kill switch (503) -> auth (401) -> ownership (404) -> DB migrated
// (503) -> contract APPROVED (400) -> >=1 selected flow (400) -> every selected flow enabled+approved (400)
// -> safe https deployment URL (400) -> per-owner concurrency cap (429) -> per-owner DAILY cap (429) ->
// submission id / idempotency key (400) -> credit hold (402). Only after the hold succeeds do we insert the
// queued run; a unique-submission collision returns the existing run (409) and releases this attempt's hold.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { preflightEnabled, runsDisabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication, getApprovedContract, listFlows } from "@/lib/v-applications";
import { unsafeHttpsUrlReason } from "@/lib/safe-fetch";
import { hold, refund } from "@/lib/v-credits";
import { createRun, ownerActiveRunCount, ownerRunsToday } from "@/lib/preflight/runs-db";
import { estimateRunCredits } from "@/lib/preflight/flow-selection";
import { passPricingEnabled } from "@/lib/preflight/pass-pricing";
import { gatePassLaunch, recordRunPassUsage } from "@/lib/preflight/entitlements-v1";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

// At most this many of an owner's runs may be in flight at once (worker-load guard; the credit hold is the
// hard spend limit). Credits held per requested flow (estimateRunCredits); pricing is flat per run, so a
// completed run keeps the full hold as the charge and the worker refunds the whole hold only if no flow ran
// (no partial remainder).
const MAX_ACTIVE_RUNS_PER_OWNER = 2;

// The internal billing bypass is only ever honored OUTSIDE production, and even then must be set explicitly.
// A live production deployment can never skip the hold, regardless of the env var.
function billingBypassAllowed(): boolean {
  return process.env.PREFLIGHT_INTERNAL_BILLING_BYPASS === "1"
    && process.env.NODE_ENV !== "production"
    && process.env.VERCEL_ENV !== "production";
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Kill switch: pauses NEW runs only. Reports, history, and the worker's already-claimed work are untouched.
  if (runsDisabled()) {
    return NextResponse.json({ error: "runs_paused", message: "New Production Passes are temporarily paused. Existing reports remain available." }, { status: 503 });
  }
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const owner = email.toLowerCase();
  const { id } = await params;

  // Ownership: the app must exist AND belong to this owner (getApplication is user-scoped).
  const app = await getApplication(owner, id);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // The run tables must be migrated, or there is nowhere to queue the job.
  if (!(await preflightDbReady())) {
    return NextResponse.json({ error: "setup_required", message: "Preflight is not fully set up yet." }, { status: 503 });
  }

  // The Production Contract must be APPROVED; approval is the gate before any paid run. The latest
  // APPROVED version is used, so an in-progress draft revision never blocks runs: the approved contract
  // remains what runs verify against until the draft is approved.
  const contract = await getApprovedContract(owner, id);
  if (!contract || contract.status !== "approved") {
    return NextResponse.json({ error: "contract_not_approved", message: "Approve the Production Contract before launching a preflight run." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  // At least one flow id, de-duplicated.
  const rawFlowIds: unknown = Array.isArray(body?.flow_ids) ? body.flow_ids : (Array.isArray(body?.flowIds) ? body.flowIds : []);
  const flowIds = Array.from(new Set((rawFlowIds as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)));
  if (!flowIds.length) {
    return NextResponse.json({ error: "flows_required", message: "Select at least one approved flow to run." }, { status: 400 });
  }

  // Every requested flow must be enabled + approved right now (mirrors the worker's claim() filter). The
  // client never picks flows we would not run.
  const flows = await listFlows(owner, contract.id);
  const eligible = new Set(
    flows.filter((f) => f.enabled && (((f as { review_state?: string }).review_state ?? "approved") === "approved")).map((f) => f.id),
  );
  if (flowIds.some((fid) => !eligible.has(fid))) {
    return NextResponse.json({ error: "flow_not_approved", message: "One or more selected flows are not enabled and approved." }, { status: 400 });
  }

  // Deployment target: an explicit preview URL, else the connected app URL. Cheap pre-navigation SSRF guard
  // (https, no private/loopback host); the browser layer re-validates + DNS-pins before any navigation.
  const rawUrl = typeof body?.deployment_url === "string" ? body.deployment_url : (typeof body?.deploymentUrl === "string" ? body.deploymentUrl : app.app_url);
  const deploymentUrl = (rawUrl || "").trim();
  if (unsafeHttpsUrlReason(deploymentUrl)) {
    return NextResponse.json({ error: "invalid_url", message: "Provide a public https deployment URL." }, { status: 400 });
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

  // Idempotency: an Idempotency-Key header or a submission_id in the body; one run per submission.
  const submissionId = (req.headers.get("idempotency-key") || (typeof body?.submission_id === "string" ? body.submission_id : "")).slice(0, 100);
  if (!submissionId) {
    return NextResponse.json({ error: "submission_id_required", message: "Send an Idempotency-Key header or a submission_id." }, { status: 400 });
  }

  // Billing reservation. Keyed by a FRESH id per attempt so an idempotent replay or a lost unique-submission
  // race can be refunded in isolation, never colliding with the winning run's own reservation. estCredits is
  // the flat per-run hold (the spend cap): kept in full as the charge on completion, refunded in full if no
  // flow ran.
  const estCredits = estimateRunCredits(flowIds.length);
  const reservationId = randomUUID();
  let creditsHeld = 0;
  let heldReservationId: string | null = null;
  let paygHeldCents: number | null = null;

  if (passPricingEnabled()) {
    // Per-pass pricing (docs/pricing-verdict-final.md), behind VRAELIS_PASS_PRICING — this branch fully
    // replaces the legacy credit hold. Subscription: the entitlement gate IS the billing decision (no
    // hold; the metered monthly flow-unit window is the spend limit). Free tier: one lifetime pass of up
    // to 3 flows (no hold). PAYG: hold CENTS via the same ledger reservation semantics as legacy credits
    // (kept as the charge on completion, refunded by the worker when nothing ran). Exhausted allowances
    // REFUSE — they never auto-spill into a paid charge.
    if (billingBypassAllowed()) {
      console.warn(`[preflight] BILLING BYPASS active (PREFLIGHT_INTERNAL_BILLING_BYPASS=1); run for ${owner} on app ${id} will NOT be charged.`);
    } else {
      const gate = await gatePassLaunch(owner, flowIds.length);
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error, message: gate.message }, { status: gate.status });
      }
      if (gate.mode === "payg") {
        const ok = await hold(owner, reservationId, gate.cents, "cent");
        if (!ok) {
          return NextResponse.json({ error: "insufficient_balance", message: `This Production Pass costs $${(gate.cents / 100).toFixed(2)}. Add balance to launch it.` }, { status: 402 });
        }
        // credits_held carries the held amount in the hold's OWN unit (cents here), so the worker's
        // unchanged settlement — refund credits_held via the reservation — settles cent holds too.
        creditsHeld = gate.cents;
        heldReservationId = reservationId;
        paygHeldCents = gate.cents;
      }
    }
  } else if (billingBypassAllowed()) {
    console.warn(`[preflight] BILLING BYPASS active (PREFLIGHT_INTERNAL_BILLING_BYPASS=1); run for ${owner} on app ${id} will NOT be charged.`);
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
    applicationId: id, contractId: contract.id, contractVersion: contract.version,
    deploymentUrl, submissionId, flowIds, creditsHeld, reservationId: heldReservationId,
  });

  if (!created) {
    // Nothing eligible at re-read, or a transient insert failure; release any hold we just made so the owner
    // is never left with stranded escrow for a run that does not exist. creditsHeld is the hold's own
    // amount in its own unit (legacy credits, or cents on the flag-on PAYG branch).
    if (heldReservationId) await refund(owner, reservationId, creditsHeld);
    return NextResponse.json({ error: "unavailable", message: "Could not queue the run. Try again." }, { status: 503 });
  }
  if ("conflict" in created) {
    // A run for this submission already exists (idempotent replay / lost race). Release this attempt's hold
    // and point the caller at the existing run.
    if (heldReservationId) await refund(owner, reservationId, creditsHeld);
    return NextResponse.json({ error: "run_exists", runId: created.runId, status: "queued" }, { status: 409 });
  }

  if (passPricingEnabled()) {
    // Record the selected-flow units this run consumes (subscription metering sums flow_units over the
    // anchor window) plus the PAYG cents escrow (audit mirror). Best-effort: the run is queued and billed
    // either way, and metering falls back to the stored flow_ids length.
    await recordRunPassUsage(owner, created.runId, { flowUnits: created.flowCount, heldCents: paygHeldCents });
  }

  await logEvent({
    userId: owner, eventType: "preflight_run_queued", actorType: "owner", source: "app",
    route: `/api/preflight/apps/${id}/runs`,
    metadata: { application_id: id, run_id: created.runId, flow_count: created.flowCount, credits_held: creditsHeld },
  });
  return NextResponse.json({ runId: created.runId, status: "queued", flowCount: created.flowCount });
}
