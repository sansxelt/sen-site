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
import { applicationAccess } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";
import { getSetupExtras } from "@/lib/preflight/setup-read";
import { evaluateAuthReadiness, anyAuthenticated, type PreviewFlow } from "@/lib/preflight/auth-preflight";
import { unsafeHttpsUrlReason } from "@/lib/safe-fetch";
import { linkedVercelDeploymentUrl } from "@/lib/preflight/oauth/vercel-deploy";
import { hold, refund } from "@/lib/v-credits";
import { createRun, ownerActiveRunCount, ownerRunsToday } from "@/lib/preflight/runs-db";
import { estimateRunCredits } from "@/lib/preflight/flow-selection";
import { passPricingEnabled, passPriceCents } from "@/lib/preflight/pass-pricing";
import { gatePassLaunch, recordRunPassUsage } from "@/lib/preflight/entitlements-v1";
import { resolveCanonicalCluster, consumeFreeGrantOverride, recordFreeGrantRisk, hashRiskSignal, claimFreePass, attachRunToClaim, releaseFreePass } from "@/lib/preflight/free-grant-cluster";
import { isRunsGovernorPaused, globalActiveRunsAtCap, checkAccountVelocity, recordProviderAttempt, recordProviderCost, maybeTripGlobalBudget, estimateProviderCents } from "@/lib/preflight/cost-governor";
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
  // Cost governor auto-pause (blocker 3): DB-durable, survives redeploys. Trips when the global provider
  // -cost ceiling ($/hour or $/day) is reached; reset is operator-only. Same customer-facing behavior as
  // the env kill switch: NEW runs paused, reports/history untouched. Checked BEFORE billing.
  if (await isRunsGovernorPaused()) {
    return NextResponse.json({ error: "runs_paused", message: "New Production Passes are temporarily paused. Existing reports remain available." }, { status: 503 });
  }
  // Global in-flight brake (blocker 3, Finding 2): bounds how far a burst can outrun the cost auto-pause.
  if (await globalActiveRunsAtCap()) {
    return NextResponse.json({ error: "runs_busy", message: "Vraelis is at capacity right now. Please try again in a moment." }, { status: 503 });
  }
  const email = (await auth())?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const { id } = await params;

  // TEAM ACCESS: resolve the caller to the app's OWNER (the data-plane key) + the caller's role. Access is
  // granted to the owner or an active workspace member; anyone else gets a uniform 404 (indistinguishable
  // from "does not exist"). `owner` is the app owner from here on — every owner-scoped read/write, credit
  // hold, cap, and the velocity guard are keyed to the OWNER, so a member launching a run spends the OWNER's
  // credits and counts against the OWNER's quotas (owner-anchored billing). Degrades to owner-only when the
  // app has no workspace (single-user, unchanged).
  const access = await applicationAccess(email, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const owner = access.owner;
  // Launching a paid run is an EDITOR+ action. A viewer/client_viewer is a real member but read-only, so a
  // forbidden here is honest (they already know the app exists). Non-members never reach this — they 404 above.
  if (!hasAtLeastRole(access.role, "editor")) {
    return NextResponse.json({ error: "forbidden", message: "You have view-only access to this application. Ask an editor or the owner to launch a Production Pass." }, { status: 403 });
  }

  // Per-account velocity cap + circuit breaker (blocker 3): stops the refund/infra loop (a fast
  // fail-then-refund churn) before any billing. Keyed to the app OWNER (whose account bears the cost). Fails
  // open on a read blip (velocity is a guard, not the hard spend limit — the billing hold + global governor
  // are).
  {
    const v = await checkAccountVelocity(owner);
    if (v) return NextResponse.json({ error: v.reason, message: v.message }, { status: 429, headers: { "Retry-After": String(v.retryAfterSec) } });
  }

  // The app is already resolved + access-checked above; re-read it in the OWNER's scope for the full row
  // (deployment URL, etc.). This is the owner's own app, so getApplication(owner, id) always returns it.
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

  // Deployment target, in priority: an explicit preview URL from the request; else the LIVE Vercel
  // production URL when the app is linked to a Vercel account connection (the first place an OAuth token
  // changes what a run does — no stale hand-entered URL); else the stored connected app URL. The Vercel
  // resolution is fail-soft: any gap returns null and we fall through to app.app_url.
  const explicitUrl = typeof body?.deployment_url === "string" ? body.deployment_url : (typeof body?.deploymentUrl === "string" ? body.deploymentUrl : "");
  let rawUrl = explicitUrl.trim();
  if (!rawUrl) {
    const liveVercel = await linkedVercelDeploymentUrl(owner, id).catch(() => null);
    rawUrl = liveVercel || app.app_url || "";
  }
  const deploymentUrl = (rawUrl || "").trim();
  if (unsafeHttpsUrlReason(deploymentUrl)) {
    return NextResponse.json({ error: "invalid_url", message: "Provide a public https deployment URL." }, { status: 400 });
  }

  // AUTH PREFLIGHT (S6 slice of S9): if any selected flow is authenticated, verify — worker-independent,
  // BEFORE any hold/charge — that every required role has an active, environment-matching, DECRYPTABLE test
  // credential and the worker vault is configured. This safe check opens each credential server-side only to
  // learn a boolean "decryptable"; the plaintext is never logged, returned, or retained. If anything is not
  // ready the launch is DISABLED with a specific reason and NO hold is taken. A non-authenticated run skips
  // this entirely and is unaffected (backward compatible). (Full pass-preview UI is deferred to S9.)
  const selectedFlows: PreviewFlow[] = flows
    .filter((f) => flowIds.includes(f.id))
    .map((f) => ({ flowId: f.id, name: f.name, steps: Array.isArray(f.steps) ? (f.steps as { action: string; target?: string }[]) : [] }));
  if (anyAuthenticated(selectedFlows)) {
    const extras = await getSetupExtras(owner, id);
    const runEnvironment = extras.environment ?? null;
    const readiness = await evaluateAuthReadiness(owner, id, selectedFlows, runEnvironment, extras.boundaries);
    if (!readiness.ok) {
      return NextResponse.json({
        error: "auth_not_ready",
        message: readiness.reasons[0] ?? "This run needs a signed-in role that is not ready. Add or re-add the test account under Connections, then run again.",
        reasons: readiness.reasons,
        roles: readiness.roles.map((r) => ({ role: r.role, ok: r.ok, credentialState: r.credentialState, environmentMatch: r.environmentMatch })),
      }, { status: 400 });
    }
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
  let usedFreePass = false; // true when this launch consumed the lifetime free pass (gate mode 'free')
  let freeClaimCanonical: string | null = null; // set when we WON the atomic free-pass claim (release on insert failure)

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
      // Free mode must WIN the atomic cluster claim before it is honored — this closes the concurrent
      // double-spend race (two simultaneous free launches from one inbox). A lost claim ('already_claimed')
      // means the cluster's one free pass is already taken, so this launch RE-PRICES to PAYG. 'unavailable'
      // (claims table not migrated yet) proceeds free on the gate's decision — no worse than the pre-table
      // status quo. Done here, inside the gate branch, so the effective mode may flip free -> payg below.
      let effectiveMode: typeof gate.mode = gate.mode;
      let repricedCents = 0;
      if (gate.mode === "free") {
        const cluster = await resolveCanonicalCluster(owner);
        const claim = await claimFreePass(owner, cluster.canonical);
        if (claim === "already_claimed") {
          effectiveMode = "payg";
          repricedCents = passPriceCents(flowIds.length);
        } else {
          if (claim === "won") freeClaimCanonical = cluster.canonical; // release if the run insert fails
          effectiveMode = "free";
        }
      }
      if (effectiveMode === "payg") {
        const cents = gate.mode === "payg" ? gate.cents : repricedCents;
        const ok = await hold(owner, reservationId, cents, "cent");
        if (!ok) {
          // The free pass was lost to a concurrent launch and the owner cannot cover the paid price. No
          // claim was won here (only 'already_claimed' reaches this with gate.mode==='free'), so nothing
          // to release.
          return NextResponse.json({ error: "insufficient_balance", message: `This Production Pass costs $${(cents / 100).toFixed(2)}. Add balance to launch it.` }, { status: 402 });
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
    // amount in its own unit (legacy credits, or cents on the flag-on PAYG branch). Also release a won free
    // claim so a queue error never permanently locks the owner out of their legitimate free pass.
    if (heldReservationId) await refund(owner, reservationId, creditsHeld);
    if (freeClaimCanonical) await releaseFreePass(owner, freeClaimCanonical);
    return NextResponse.json({ error: "unavailable", message: "Could not queue the run. Try again." }, { status: 503 });
  }
  if ("conflict" in created) {
    // A run for this submission already exists (idempotent replay / lost race). Release this attempt's hold
    // and its free claim (the existing run already owns the pass) and point the caller at the existing run.
    if (heldReservationId) await refund(owner, reservationId, creditsHeld);
    if (freeClaimCanonical) await releaseFreePass(owner, freeClaimCanonical);
    return NextResponse.json({ error: "run_exists", runId: created.runId, status: "queued" }, { status: 409 });
  }

  if (passPricingEnabled()) {
    // Record the selected-flow units this run consumes (subscription metering sums flow_units over the
    // anchor window) plus the PAYG cents escrow (audit mirror). Best-effort: the run is queued and billed
    // either way, and metering falls back to the stored flow_ids length.
    await recordRunPassUsage(owner, created.runId, { flowUnits: created.flowCount, heldCents: paygHeldCents });
    if (usedFreePass) {
      // This launch took the lifetime free pass. (0) Link the run to its atomic claim (audit). (1) Consume
      // any operator comp so it is single-use. (2) Capture a risk SIGNAL (hashed IP/device only) so an
      // operator can review clustered abuse — never a denial key. All best-effort; the run is queued.
      const canonical = freeClaimCanonical ?? (await resolveCanonicalCluster(owner)).canonical;
      if (freeClaimCanonical) await attachRunToClaim(freeClaimCanonical, created.runId);
      await consumeFreeGrantOverride(owner, canonical);
      await recordFreeGrantRisk({
        owner, canonical, runId: created.runId,
        ipHash: hashRiskSignal(req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip")),
        deviceHash: hashRiskSignal(req.headers.get("user-agent")),
        signal: "free_launch",
      });
    }
  }

  await logEvent({
    userId: owner, eventType: "preflight_run_queued", actorType: "owner", source: "app",
    route: `/api/preflight/apps/${id}/runs`,
    // userId stays the app OWNER (the dashboard queries runs by owner). When a workspace member launched the
    // run, record who actually did it (actor) for audit — the credits were still the owner's.
    metadata: { application_id: id, run_id: created.runId, flow_count: created.flowCount, credits_held: creditsHeld, ...(access.level === "workspace" ? { actor: email.toLowerCase(), actor_role: access.role } : {}) },
  });

  // Cost governor (blocker 3): record this launch as a provider-session ATTEMPT (drives the per-account
  // velocity cap) and a conservative LAUNCH-TIME cost estimate (drives the global $/hour + $/day ceiling —
  // counting the commit as it happens, so the ceiling trips BEFORE a burst finishes burning, not after).
  // Then evaluate the ceilings and auto-pause at 100%. All best-effort; the run is already queued.
  await recordProviderAttempt(owner, created.runId, "session");
  await recordProviderCost({ owner, runId: created.runId, browserbaseSeconds: created.flowCount * 60, estimatedCents: estimateProviderCents({ browserbaseSeconds: created.flowCount * 60 }) });
  await maybeTripGlobalBudget();

  return NextResponse.json({ runId: created.runId, status: "queued", flowCount: created.flowCount });
}
