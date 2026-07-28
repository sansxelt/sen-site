// THE ACCEPTANCE SERVICE: the one place a verification run is admitted, paid for, and queued.
//
// WHY IT EXISTS. Run creation lived inside two route handlers, so every new entrance had to remember the
// same eleven gates in the same order, and the public API's coverage gate sat ABOVE the shared handler
// rather than below every entrance. scripts/preflight-acceptance-boundary-verify.ts has been holding that
// line and naming this module as the fix. A third entrance (verify-this-guarantee) could not be added
// without either duplicating the money path or importing a route handler, and the ratchet refused both.
//
// WHAT MOVED, AND WHAT DID NOT. This is a faithful relocation: the same steps in the same order, with HTTP
// lifted out. It takes plain arguments and returns a discriminated union, so it can be called from a route,
// from another service, or from a script without a Request existing. Every refusal code and message below is
// the one that shipped, byte for byte, because a refactor that quietly renames an error is a refactor that
// breaks somebody's CI.
//
// ORDER IS THE CONTRACT. Every cap and refusal that preceded the credit hold still precedes it, and every
// path that takes a hold releases it on the failures that follow. That ordering is the only thing standing
// between a transient error and stranded customer money, which is why it is stated here rather than left to
// be re-derived by the next caller.
import { randomUUID } from "node:crypto";
import { createRun, ownerActiveRunCount, ownerRunsToday, runWithSameKeyDifferentPayload, type GuaranteeBinding } from "../runs-db";
import { estimateRunCredits, keyFingerprint, payloadFingerprint, buildSubmissionId } from "../flow-selection";
import { keyCeilingRefusal } from "../key-spend";
import { MAX_ACTIVE_RUNS_PER_OWNER, maxRunsPerDay } from "../limits";
import { hold, refund } from "../../v-credits";
import { passPricingEnabled, passPriceCents } from "../pass-pricing";
import { gatePassLaunch, recordRunPassUsage } from "../entitlements-v1";
import { resolveCanonicalCluster, claimFreePass, releaseFreePass, attachRunToClaim, consumeFreeGrantOverride, recordFreeGrantRisk, hashRiskSignal } from "../free-grant-cluster";
import { recordProviderAttempt, recordProviderCost, estimateProviderCents, maybeTripGlobalBudget } from "../cost-governor";
import { logKeyUsage, type Principal } from "../api-principal";
import { logEvent } from "../../v-events";

// The internal billing bypass is only ever honored OUTSIDE production, and even then must be set explicitly.
// A live production deployment can never skip the hold, regardless of the env var. It moved here with the
// billing it guards: leaving it behind in one route while the money moved into this module is how a bypass
// ends up honored on a path nobody re-checked.
function billingBypassAllowed(): boolean {
  return process.env.PREFLIGHT_INTERNAL_BILLING_BYPASS === "1"
    && process.env.NODE_ENV !== "production"
    && process.env.VERCEL_ENV !== "production";
}

/** A refusal, shaped so a route can render it without knowing which gate produced it. Every code here is a
 *  code that already existed; nothing was renamed in the move. */
export type AcceptanceRefusal = {
  ok: false;
  error: string;
  message: string;
  status: number;
  /** Set only where the route set a Retry-After header. */
  retryAfterSec?: number;
  /** Set on 409 run_exists and 409 idempotency_key_reused, exactly as before. */
  runId?: string;
};

export type AcceptanceAccepted = { ok: true; runId: string; flowCount: number; creditsHeld: number };
export type AcceptanceOutcome = AcceptanceAccepted | AcceptanceRefusal;

export type AcceptRunInput = {
  /** The application OWNER. Every quota, hold and read below is keyed to this, never to the caller. */
  owner: string;
  applicationId: string;
  contract: { id: string; version: number | null };
  deploymentUrl: string;
  flowIds: string[];
  /** Already resolved by the entrance; used for the per-key ceiling and the key audit trail. */
  principal: Principal;
  /** The caller's idempotency key, already read from the header or body by the entrance. */
  clientKey: string;
  /** The standing promise this run proves, or an explicit null. Resolved SERVER-SIDE by the entrance and
   *  never accepted from a request body: a caller-supplied guarantee id is a false-Verified primitive. */
  guarantee: GuaranteeBinding | null;
  /** The run this one re-verifies, when it is a repair. */
  parentRunId?: string | null;
  /** Who actually pressed the button, when that is not the owner. Audit only. */
  actor?: { email: string; level: string; role: string } | null;
  /** Hashed at the boundary, never stored raw. Used only for the free-pass abuse signal. */
  risk?: { ip: string | null; userAgent: string | null };
  /** The label this launch appears under in the per-key audit and on the Usage page. Defaults to the run
   *  endpoint, because that is where every launch came from when this moved out of the route. An entrance
   *  that does not say which one it is makes the Usage page quietly wrong about where a key's spend went. */
  endpoint?: string;
};

export async function acceptVerificationRun(input: AcceptRunInput): Promise<AcceptanceOutcome> {
  const { owner, applicationId: id, contract, deploymentUrl, flowIds, principal, guarantee } = input;
  const endpoint = input.endpoint ?? "POST /api/preflight/apps/{id}/runs";

  // Per-owner concurrency cap.
  if ((await ownerActiveRunCount(owner)) >= MAX_ACTIVE_RUNS_PER_OWNER) {
    return { ok: false, error: "too_many_active_runs", message: "You already have preflight runs in progress. Wait for them to finish.", status: 429 };
  }

  // Per-owner DAILY cap, checked BEFORE the credit hold so no hold is ever taken for a run the cap refuses.
  if ((await ownerRunsToday(owner)) >= maxRunsPerDay()) {
    return { ok: false, error: "daily_limit", message: "Daily run limit reached. Try again tomorrow or contact support.", status: 429 };
  }

  if (!input.clientKey) {
    return { ok: false, error: "submission_id_required", message: "Send an Idempotency-Key header or a submission_id.", status: 400 };
  }

  // PAYLOAD BINDING. The stored id carries a fingerprint of WHAT was requested alongside the caller's key, so
  // a genuine retry matches exactly and a key reused for a different request is refused rather than answered
  // with an earlier run's result.
  const keyFp = keyFingerprint(owner, id, input.clientKey);
  const submissionId = buildSubmissionId(keyFp, payloadFingerprint({ applicationId: id, deploymentUrl, flowIds }));
  const conflicting = await runWithSameKeyDifferentPayload(owner, keyFp, submissionId);
  if (conflicting) {
    await logKeyUsage(principal, { endpoint, status: 409, applicationId: id, runId: conflicting, creditsReserved: 0, creditsCharged: 0 });
    return {
      ok: false, error: "idempotency_key_reused",
      message: "That Idempotency-Key was already used for a different request. Use a new key, or resend the original request exactly.",
      status: 409, runId: conflicting,
    };
  }

  // Billing reservation, keyed by a FRESH id per attempt so a replay or a lost race is refundable in
  // isolation and never collides with the winning run's reservation.
  const estCredits = estimateRunCredits(flowIds.length);
  const reservationId = randomUUID();
  let creditsHeld = 0;
  let heldReservationId: string | null = null;

  // PER-KEY DAILY CEILING, before any hold so a refusal never leaves money reserved. It only ever NARROWS:
  // it runs in addition to every owner-level gate, never instead of one.
  {
    const refusal = await keyCeilingRefusal(
      { id: principal.keyId, dailyCeilingCents: principal.dailyCeilingCents },
      passPricingEnabled() ? passPriceCents(flowIds.length) : estCredits,
    );
    if (refusal) {
      await logKeyUsage(principal, { endpoint, status: refusal.status, applicationId: id, creditsReserved: 0, creditsCharged: 0 });
      return { ok: false, error: refusal.error, message: refusal.message, status: refusal.status, retryAfterSec: refusal.retryAfterSec };
    }
  }

  let paygHeldCents: number | null = null;
  let usedFreePass = false;
  let freeClaimCanonical: string | null = null;

  if (passPricingEnabled()) {
    if (billingBypassAllowed()) {
      console.warn(`[preflight] BILLING BYPASS active (PREFLIGHT_INTERNAL_BILLING_BYPASS=1); run for ${owner} on app ${id} will NOT be charged.`);
    } else {
      const gate = await gatePassLaunch(owner, flowIds.length);
      if (!gate.ok) return { ok: false, error: gate.error, message: gate.message, status: gate.status };

      // Free mode must WIN the atomic cluster claim before it is honored, closing the concurrent
      // double-spend race. A lost claim re-prices to PAYG.
      let effectiveMode: typeof gate.mode = gate.mode;
      let repricedCents = 0;
      if (gate.mode === "free") {
        const cluster = await resolveCanonicalCluster(owner);
        const claim = await claimFreePass(owner, cluster.canonical);
        if (claim === "already_claimed") {
          effectiveMode = "payg";
          repricedCents = passPriceCents(flowIds.length);
        } else {
          if (claim === "won") freeClaimCanonical = cluster.canonical;
          effectiveMode = "free";
        }
      }
      if (effectiveMode === "payg") {
        const cents = gate.mode === "payg" ? gate.cents : repricedCents;
        const ok = await hold(owner, reservationId, cents, "cent");
        if (!ok) {
          return { ok: false, error: "insufficient_balance", message: `This verification costs $${(cents / 100).toFixed(2)}. Add balance to run it.`, status: 402 };
        }
        creditsHeld = cents;
        heldReservationId = reservationId;
        paygHeldCents = cents;
      } else if (effectiveMode === "free") {
        usedFreePass = true;
      }
    }
  } else if (billingBypassAllowed()) {
    console.warn(`[preflight] BILLING BYPASS active (PREFLIGHT_INTERNAL_BILLING_BYPASS=1); run for ${owner} on app ${id} will NOT be charged.`);
  } else {
    const ok = await hold(owner, reservationId, estCredits);
    if (!ok) {
      return { ok: false, error: "insufficient_credits", message: "You do not have enough credits to launch this preflight run.", status: 402 };
    }
    creditsHeld = estCredits;
    heldReservationId = reservationId;
  }

  // Queue the run (insert only; NO execution). createRun re-reads the approved flows before inserting.
  const created = await createRun(owner, {
    applicationId: id, contractId: contract.id, contractVersion: contract.version,
    deploymentUrl, submissionId, flowIds, creditsHeld, reservationId: heldReservationId,
    apiKeyId: principal.keyId,
    guarantee,
    parentRunId: input.parentRunId ?? null,
  });

  if (!created) {
    // Nothing eligible at re-read, or a transient insert failure. Release any hold so the owner is never
    // left with escrow for a run that does not exist, and release a won free claim so a queue error never
    // permanently costs them their legitimate free pass.
    if (heldReservationId) await refund(owner, reservationId, creditsHeld);
    if (freeClaimCanonical) await releaseFreePass(owner, freeClaimCanonical);
    return { ok: false, error: "unavailable", message: "Could not queue the run. Try again.", status: 503 };
  }
  if ("conflict" in created) {
    if (heldReservationId) await refund(owner, reservationId, creditsHeld);
    if (freeClaimCanonical) await releaseFreePass(owner, freeClaimCanonical);
    await logKeyUsage(principal, { endpoint, status: 409, applicationId: id, runId: created.runId, creditsReserved: 0, creditsCharged: 0 });
    return { ok: false, error: "run_exists", message: "A run for this submission already exists.", status: 409, runId: created.runId ?? undefined };
  }

  if (passPricingEnabled()) {
    await recordRunPassUsage(owner, created.runId, { flowUnits: created.flowCount, heldCents: paygHeldCents });

    // ── AUTOMATIC TOP-UP, AFTER THE MONEY HAS MOVED AND NEVER IN FRONT OF IT ─────────────────────────
    //
    // This run is already accepted and already charged. Topping the balance back up is for the NEXT one,
    // so nothing here may delay, block or fail this one. It is deliberately:
    //
    //   AWAITED, not fired and forgotten. This runs in a serverless function that can be frozen the
    //   moment the response is returned, and a Stripe call abandoned midway is the one thing worse than a
    //   slow one: the charge may land with no log of it. The cost is bounded, because maybeTopUp exits
    //   after a single indexed read for the accounts that have never switched it on, which is all of them
    //   until someone does.
    //
    //   WRAPPED, so a billing outage cannot turn a successful verification into a failed request. If this
    //   throws, the customer still gets the run they paid for and the top-up is simply not attempted.
    //
    // The balance is passed in rather than re-read: this code path just changed it, and re-reading would
    // race with its own write.
    try {
      const { maybeTopUp } = await import("../auto-recharge-execute");
      const { creditsToCents } = await import("../auto-recharge");
      const { balance } = await import("../../v-credits");
      // CONVERTED, NOT PASSED THROUGH. balance() is in credits and every threshold is in cents. Handing
      // credits straight over under-reads the balance tenfold, and an under-read balance looks like an
      // empty one, so it would top up an account that was nowhere near its trigger.
      await maybeTopUp(owner, creditsToCents(await balance(owner)));
    } catch (e) {
      console.warn("[auto-recharge] skipped after run acceptance:", e);
    }
    if (usedFreePass) {
      const canonical = freeClaimCanonical ?? (await resolveCanonicalCluster(owner)).canonical;
      if (freeClaimCanonical) await attachRunToClaim(freeClaimCanonical, created.runId);
      await consumeFreeGrantOverride(owner, canonical);
      await recordFreeGrantRisk({
        owner, canonical, runId: created.runId,
        ipHash: hashRiskSignal(input.risk?.ip ?? null),
        deviceHash: hashRiskSignal(input.risk?.userAgent ?? null),
        signal: "free_launch",
      });
    }
  }

  await logEvent({
    userId: owner, eventType: "preflight_run_queued", actorType: "owner", source: "app",
    route: `/api/preflight/apps/${id}/runs`,
    metadata: {
      application_id: id, run_id: created.runId, flow_count: created.flowCount, credits_held: creditsHeld,
      ...(input.actor && input.actor.level === "workspace" ? { actor: input.actor.email.toLowerCase(), actor_role: input.actor.role } : {}),
    },
  });

  // Cost governor: record the launch as a provider ATTEMPT (per-account velocity) and a conservative
  // launch-time cost estimate (global ceiling), counting the commit as it happens so the ceiling trips
  // before a burst finishes burning. Best-effort; the run is already queued.
  await recordProviderAttempt(owner, created.runId, "session");
  await recordProviderCost({ owner, runId: created.runId, browserbaseSeconds: created.flowCount * 60, estimatedCents: estimateProviderCents({ browserbaseSeconds: created.flowCount * 60 }) });
  await maybeTripGlobalBudget();

  await logKeyUsage(principal, {
    endpoint, status: 200, applicationId: id, runId: created.runId,
    creditsReserved: creditsHeld, creditsCharged: 0,
  });

  return { ok: true, runId: created.runId, flowCount: created.flowCount, creditsHeld };
}
