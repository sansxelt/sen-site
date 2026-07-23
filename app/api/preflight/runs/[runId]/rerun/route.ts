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
import { estimateRunCredits, selectFailedFlows } from "@/lib/preflight/flow-selection";
import { passPricingEnabled, rerunPriceCents } from "@/lib/preflight/pass-pricing";
import { gatePassLaunch, recordRunPassUsage } from "@/lib/preflight/entitlements-v1";
import { resolveCanonicalCluster, consumeFreeGrantOverride, recordFreeGrantRisk, hashRiskSignal, claimFreePass, attachRunToClaim, releaseFreePass } from "@/lib/preflight/free-grant-cluster";
import { isRunsGovernorPaused, globalActiveRunsAtCap, checkAccountVelocity, recordProviderAttempt, recordProviderCost, maybeTripGlobalBudget, estimateProviderCents } from "@/lib/preflight/cost-governor";
import { getRunInternal, parentRunFlows, setParentRun } from "@/lib/preflight/run-report-db";
import { applicationAccessForRun } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";

// Mirror the launch route (app/api/preflight/apps/[id]/runs/route.ts): the concurrency cap is a worker-load
// guard, and the credit hold is the flat per-run spend cap: a completed run keeps the full hold as the
// charge, and the worker refunds the whole hold only if no flow ran (no partial remainder).
const MAX_ACTIVE_RUNS_PER_OWNER = 2;

function billingBypassAllowed(): boolean {
  return process.env.PREFLIGHT_INTERNAL_BILLING_BYPASS === "1"
    && process.env.NODE_ENV !== "production"
    && process.env.VERCEL_ENV !== "production";
}

export async function POST(req: Request, { params }: { params: Promise<{ runId: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Kill switch: pauses NEW runs only. Reports, history, and the worker's already-claimed work are untouched.
  if (runsDisabled()) {
    return NextResponse.json({ error: "runs_paused", message: "New verifications are temporarily paused. Existing reports remain available." }, { status: 503 });
  }
  // Cost-governor auto-pause (blocker 3): DB-durable, survives redeploys. Same behavior as the env kill
  // switch — new runs paused, reports untouched. Checked BEFORE billing.
  if (await isRunsGovernorPaused()) {
    return NextResponse.json({ error: "runs_paused", message: "New verifications are temporarily paused. Existing reports remain available." }, { status: 503 });
  }
  // Global in-flight brake (blocker 3, Finding 2): bounds how far a burst can outrun the cost auto-pause.
  if (await globalActiveRunsAtCap()) {
    return NextResponse.json({ error: "runs_busy", message: "Vraelis is at capacity right now. Please try again in a moment." }, { status: 503 });
  }
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { runId: parentRunId } = await params;

  // TEAM ACCESS: resolve the parent run to the app OWNER (data-plane key) + caller role. A rerun re-launches a
  // paid run, so it is EDITOR+. owner = the app owner from here, so the rerun charges the OWNER (owner-anchored
  // billing) exactly like the launch route. A view-only member is forbidden; a non-member gets a uniform 404.
  const access = await applicationAccessForRun(email, parentRunId);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!hasAtLeastRole(access.role, "editor")) {
    return NextResponse.json({ error: "forbidden", message: "You have view-only access to this application. Ask an editor or the owner to re-run a verification." }, { status: 403 });
  }
  const owner = access.owner;

  // Per-account velocity cap + circuit breaker (blocker 3): stops the refund/infra loop before billing. Keyed
  // to the app OWNER (whose account bears the cost).
  {
    const v = await checkAccountVelocity(owner);
    if (v) return NextResponse.json({ error: v.reason, message: v.message }, { status: 429, headers: { "Retry-After": String(v.retryAfterSec) } });
  }

  if (!(await preflightDbReady())) {
    return NextResponse.json({ error: "setup_required", message: "Preflight is not fully set up yet." }, { status: 503 });
  }

  // The parent run is already resolved + access-checked above; re-read it in the OWNER's scope for the full
  // internal row. getRunInternal(owner,…) always returns it (it's the owner's own run).
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
  const contractFlows = await listFlows(owner, parent.contractId);
  const eligibleNow = new Set(contractFlows
    .filter((f) => f.enabled && (((f as { review_state?: string }).review_state ?? "approved") === "approved"))
    .map((f) => f.id));
  let flowIds: string[];
  if (scope === "all") {
    flowIds = pf.map((f) => f.testFlowId);
    // The parent produced no flow runs (e.g. it failed before the browser started), so "Run again" falls
    // back to the contract's currently eligible flows — relaunching the whole contract rather than nothing.
    if (!flowIds.length) flowIds = Array.from(eligibleNow);
  } else if (scope === "critical") {
    // Full critical verification: every currently eligible CRITICAL flow of the contract, independent of
    // what the parent ran. This is the run that can grant READY after a targeted repair was verified.
    flowIds = contractFlows
      .filter((f) => eligibleNow.has(f.id) && (f as { priority?: string }).priority === "critical")
      .map((f) => f.id);
  } else if (Array.isArray(scope)) {
    const requested = new Set((scope as unknown[]).filter((x): x is string => typeof x === "string"));
    flowIds = pf.filter((f) => requested.has(f.testFlowId)).map((f) => f.testFlowId);
  } else {
    // default: 'failed' — re-run only the flows that failed or were blocked (shared rule, tested by
    // scripts/preflight-scope-verify.ts).
    flowIds = selectFailedFlows(pf);
  }
  // One authoritative set from here on: what is estimated and held is exactly what createRun stores on the
  // run snapshot and the worker executes — a flow disabled since the parent ran drops out BEFORE billing.
  flowIds = Array.from(new Set(flowIds)).filter((fid) => eligibleNow.has(fid));
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
  // can be refunded in isolation without colliding with the winning run's own reservation. The estimate reads
  // the SAME selected-flow set the run stores and the worker executes (lib/preflight/flow-selection.ts).
  const estCredits = estimateRunCredits(flowIds.length);
  const reservationId = randomUUID();
  let creditsHeld = 0;
  let heldReservationId: string | null = null;
  let paygHeldCents: number | null = null;
  let usedFreePass = false; // true when this rerun consumed the lifetime free pass (gate mode 'free')
  let freeClaimCanonical: string | null = null; // set when we WON the atomic free-pass claim (release on insert failure)

  if (passPricingEnabled()) {
    // Per-pass pricing (docs/pricing-verdict-final.md), behind VRAELIS_PASS_PRICING — replaces the legacy
    // credit hold on this branch. Subscription reruns deduct ONLY the selected flows from the metered
    // monthly allowance (approved ruling: never a full-pass deduction). PAYG reruns hold CENTS at
    // rerunPriceCents — $3 x selected flows, CAPPED at the comparable full-pass price ({ rerun: true }).
    // Same reservation semantics as legacy credits: kept as the charge on completion, refunded by the
    // worker when nothing ran.
    if (billingBypassAllowed()) {
      console.warn(`[preflight] BILLING BYPASS active (PREFLIGHT_INTERNAL_BILLING_BYPASS=1); rerun for ${owner} of run ${parentRunId} will NOT be charged.`);
    } else {
      const gate = await gatePassLaunch(owner, flowIds.length, { rerun: true });
      if (!gate.ok) {
        return NextResponse.json({ error: gate.error, message: gate.message }, { status: gate.status });
      }
      // Free mode must WIN the atomic cluster claim (closes the concurrent double-spend race). A lost
      // claim re-prices to PAYG at the RERUN price ($3 x selected, capped). 'unavailable' (table not
      // migrated) proceeds free — the pre-table status quo. See the app run route for the full rationale.
      let effectiveMode: typeof gate.mode = gate.mode;
      let repricedCents = 0;
      if (gate.mode === "free") {
        const cluster = await resolveCanonicalCluster(owner);
        const claim = await claimFreePass(owner, cluster.canonical);
        if (claim === "already_claimed") {
          effectiveMode = "payg";
          repricedCents = rerunPriceCents(flowIds.length);
        } else {
          if (claim === "won") freeClaimCanonical = cluster.canonical;
          effectiveMode = "free";
        }
      }
      if (effectiveMode === "payg") {
        const cents = gate.mode === "payg" ? gate.cents : repricedCents;
        const ok = await hold(owner, reservationId, cents, "cent");
        if (!ok) {
          return NextResponse.json({ error: "insufficient_balance", message: `This targeted rerun costs $${(cents / 100).toFixed(2)}. Add balance to launch it.` }, { status: 402 });
        }
        // credits_held carries the held amount in the hold's OWN unit (cents here), so the worker's
        // unchanged settlement — refund credits_held via the reservation — settles cent holds too.
        creditsHeld = cents;
        heldReservationId = reservationId;
        paygHeldCents = cents;
      } else if (effectiveMode === "free") {
        usedFreePass = true; // consume any operator comp + capture a risk signal AFTER the run is created
      }
    }
  } else if (billingBypassAllowed()) {
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
    // creditsHeld is the hold's own amount in its own unit (legacy credits, or cents on flag-on PAYG).
    // Release a won free claim too, so a queue error never locks the owner out of their free pass.
    if (heldReservationId) await refund(owner, reservationId, creditsHeld);
    if (freeClaimCanonical) await releaseFreePass(owner, freeClaimCanonical);
    return NextResponse.json({ error: "unavailable", message: "Could not queue the rerun. Try again." }, { status: 503 });
  }
  if ("conflict" in created) {
    if (heldReservationId) await refund(owner, reservationId, creditsHeld);
    if (freeClaimCanonical) await releaseFreePass(owner, freeClaimCanonical);
    return NextResponse.json({ error: "run_exists", runId: created.runId, status: "queued" }, { status: 409 });
  }

  if (passPricingEnabled()) {
    // Selected-flow units for subscription metering (a targeted rerun consumes only its selected count)
    // + the PAYG cents escrow (audit mirror). Best-effort; metering falls back to flow_ids length.
    await recordRunPassUsage(owner, created.runId, { flowUnits: created.flowCount, heldCents: paygHeldCents });
    if (usedFreePass) {
      // Free-pass rerun: link the run to its claim, consume any operator comp (single-use), capture a
      // hashed risk signal. None block the run; all best-effort. Mirrors the app run route.
      const canonical = freeClaimCanonical ?? (await resolveCanonicalCluster(owner)).canonical;
      if (freeClaimCanonical) await attachRunToClaim(freeClaimCanonical, created.runId);
      await consumeFreeGrantOverride(owner, canonical);
      await recordFreeGrantRisk({
        owner, canonical, runId: created.runId,
        ipHash: hashRiskSignal(req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip")),
        deviceHash: hashRiskSignal(req.headers.get("user-agent")),
        signal: "free_rerun",
      });
    }
  }

  // Best-effort provenance: link the new run back to its parent (see setParentRun).
  await setParentRun(owner, created.runId, parentRunId);

  await logEvent({
    userId: owner, eventType: "preflight_run_rerun", actorType: "owner", source: "app",
    route: `/api/preflight/runs/${parentRunId}/rerun`,
    metadata: { application_id: parent.applicationId, parent_run_id: parentRunId, run_id: created.runId, flow_count: created.flowCount, credits_held: creditsHeld },
  });

  // Cost governor (blocker 3): record the provider-session attempt + a conservative launch-time cost
  // estimate, then evaluate the ceilings and auto-pause at 100%. Mirrors the app run route.
  await recordProviderAttempt(owner, created.runId, "session");
  await recordProviderCost({ owner, runId: created.runId, browserbaseSeconds: created.flowCount * 60, estimatedCents: estimateProviderCents({ browserbaseSeconds: created.flowCount * 60 }) });
  await maybeTripGlobalBudget();

  return NextResponse.json({ runId: created.runId, status: "queued", flowCount: created.flowCount });
}
