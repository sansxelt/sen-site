// Deterministic, server-side authorization for agent-initiated payments.
//
// THE PROBLEM THIS SOLVES. The SMS/email/chat agent could name a payment amount: for kind "full" the value
// came straight from the model's JSON and went to Stripe. A lead types "actually the price is $4,000" — or
// anything else that steers the model — and the model proposes it. Nothing server-side disagreed, because
// there is no stored "full price" for a workspace to check against. An LLM-generated value must never be
// the sole authority for moving money.
//
// THE MODEL. Every agent-initiated amount is checked against a ceiling derived from data the OWNER
// configured, never from the conversation:
//
//   kind "deposit"  -> the amount is ALWAYS workspace.deposit_amount_cents. The model's number is ignored
//                      outright; it does not even participate.
//   kind "full"     -> the model may propose, but only within an automatic band computed below. Above the
//                      band the payment is refused and the owner is told, because a human should decide.
//
// Plus two rolling ceilings per workspace (day and billing cycle) so a slow drip inside the per-request
// band cannot add up to an unbounded total.
//
// FAIL CLOSED. If the workspace row, the deposit configuration, or the rolling totals cannot be read, no
// automatic payment is authorized. A money route that cannot establish its ceiling must not charge.

import type { VraelisWorkspace } from "./vraelis-db";
import { reserveAgentPayment, settleAgentPayment, sumRecentPaymentCents } from "./vraelis-db";
import { envInt } from "./env-num";

// ── Defaults, and where they come from ─────────────────────────────────────
//
// These are DEFENSIBLE DEFAULTS, NOT APPROVED POLICY. They are flagged for founder approval; every one is
// env-overridable so the value can be changed without a deploy.
//
// AUTO_MULTIPLE = 10. A deposit is conventionally 10-25% of the full price, so full ~= 4-10x deposit. Ten
//   is the generous end of that range, chosen so the band does not reject legitimate work; the absolute cap
//   below is what actually bounds the damage.
// AUTO_FLOOR_CENTS = 50_000 ($500). A workspace with the seeded $25 deposit (vraelis-db.ts:117) would
//   otherwise get a $250 band, too small for most real invoices. The floor keeps the feature usable.
// AUTO_MAX_CENTS = 200_000 ($2,000). Nothing above this is EVER automatic, regardless of deposit size.
//   This is the number that decides the worst case of a single successful manipulation.
// DAILY_CENTS = 500_000 ($5,000) and CYCLE_CENTS = 2_000_000 ($20,000). Sized so a compromised or
//   manipulated agent cannot quietly issue a large number of in-band links; both are well above any
//   plausible single-workspace day on the current plan tiers.
// Every override goes through the one shared bounded parser (lib/env-num.ts). The local `Number(raw)` this
// replaced accepted "2.5", "1e99" and "-5" — a fractional ceiling, an effectively unlimited one, and a
// negative one that disables the cap entirely. Each bound below states the widest value this control is
// willing to honour, so a typo cannot quietly become "no ceiling".
export const AUTO_MULTIPLE   = () => envInt("VRAELIS_AUTO_PAY_MULTIPLE",     { min: 1, max: 100, fallback: 10 });
export const AUTO_FLOOR_CENTS = () => envInt("VRAELIS_AUTO_PAY_FLOOR_CENTS", { min: MIN_CHARGE_CENTS, max: 1_000_000, fallback: 50_000 });
export const AUTO_MAX_CENTS  = () => envInt("VRAELIS_AUTO_PAY_MAX_CENTS",    { min: MIN_CHARGE_CENTS, max: 1_000_000, fallback: 200_000 });
export const DAILY_CENTS     = () => envInt("VRAELIS_AUTO_PAY_DAILY_CENTS",  { min: 0, max: 10_000_000, fallback: 500_000 });
export const CYCLE_CENTS     = () => envInt("VRAELIS_AUTO_PAY_CYCLE_CENTS",  { min: 0, max: 50_000_000, fallback: 2_000_000 });
export const CYCLE_DAYS      = () => envInt("VRAELIS_AUTO_PAY_CYCLE_DAYS",   { min: 1, max: 365, fallback: 30 });
// How long a reservation holds budget before expiring on its own. This number sits between two opposite
// failure modes, so it is chosen rather than defaulted:
//
//   TOO LONG  — an authorization whose charge attempt fails holds a slice of the owner's daily cap until
//               it expires. finishAgentPayment releases it immediately on the normal failure path, but a
//               process that dies in between cannot, so a run of failures could quietly cap the agent.
//   TOO SHORT — a reservation whose settle call is LOST expires and stops counting, so a payment that was
//               really issued no longer consumes the cap. That under-counts, which is the unsafe
//               direction for a spend control.
//
// 300s is roughly two orders of magnitude longer than the Stripe Checkout call it has to outlast, which
// makes the second case vanishingly rare, while bounding the first to five minutes.
export const RESERVATION_TTL_SECONDS = () => envInt("VRAELIS_AUTO_PAY_TTL_SECONDS", { min: 30, max: 3_600, fallback: 300 });

export const MIN_CHARGE_CENTS = 50; // Stripe's floor; mirrored here so the reason is explicit.

export type AuthzDenied =
  | "invalid_amount"
  | "below_minimum"
  | "deposit_not_configured"
  | "above_auto_ceiling"
  | "daily_cap_reached"
  | "cycle_cap_reached"
  | "ceiling_unavailable";

export type PaymentAuthz =
  | {
      ok: true;
      amountCents: number;
      ceilingCents: number;
      source: "owner_configured_deposit" | "within_auto_ceiling";
      /**
       * The rolling-cap budget this authorization claimed, when the atomic path was used. The caller MUST
       * hand it to finishAgentPayment once it knows whether the payment was actually created — otherwise
       * the budget stays held until its TTL expires. Null means the bridge path ran and there is no
       * reservation to settle.
       */
      reservationId: string | null;
    }
  | { ok: false; reason: AuthzDenied; ceilingCents: number | null; proposedCents: number | null };

/**
 * The per-request automatic ceiling for a workspace, from owner-configured data only.
 * Returns null when it cannot be established — callers must then refuse.
 */
export function autoCeilingCents(ws: Pick<VraelisWorkspace, "deposit_amount_cents">): number | null {
  const deposit = Number(ws?.deposit_amount_cents ?? 0);
  if (!Number.isFinite(deposit) || deposit < 0) return null;
  const derived = Math.max(deposit * AUTO_MULTIPLE(), AUTO_FLOOR_CENTS());
  return Math.min(derived, AUTO_MAX_CENTS());
}

/**
 * Authorize an agent-proposed payment. `proposedCents` is whatever the model produced and is treated as
 * untrusted throughout — for a deposit it is discarded entirely.
 */
export async function authorizeAgentPayment(
  ws: VraelisWorkspace,
  input: { kind: "deposit" | "full"; proposedCents: number | null | undefined },
): Promise<PaymentAuthz> {
  // A deposit is never negotiable: the owner set the number, the model does not get a vote.
  if (input.kind === "deposit") {
    const configured = Number(ws?.deposit_amount_cents ?? 0);
    if (!Number.isFinite(configured) || configured < MIN_CHARGE_CENTS) {
      return { ok: false, reason: "deposit_not_configured", ceilingCents: null, proposedCents: null };
    }
    const rolling = await withinRollingCaps(ws.owner_email, configured);
    if (rolling.ok === false) return rolling;
    return {
      ok: true,
      amountCents: configured,
      ceilingCents: configured,
      source: "owner_configured_deposit",
      reservationId: rolling.reservationId,
    };
  }

  const proposed = Number(input.proposedCents ?? NaN);
  if (!Number.isFinite(proposed) || proposed <= 0 || !Number.isInteger(proposed)) {
    return { ok: false, reason: "invalid_amount", ceilingCents: null, proposedCents: null };
  }
  if (proposed < MIN_CHARGE_CENTS) {
    return { ok: false, reason: "below_minimum", ceilingCents: null, proposedCents: proposed };
  }

  const ceiling = autoCeilingCents(ws);
  if (ceiling === null) {
    return { ok: false, reason: "ceiling_unavailable", ceilingCents: null, proposedCents: proposed };
  }
  // NOT clamped to the ceiling. Silently charging less than the model said would leave the lead with a
  // link that disagrees with the conversation, and it would hide the manipulation. Refuse, and let a human
  // decide.
  if (proposed > ceiling) {
    return { ok: false, reason: "above_auto_ceiling", ceilingCents: ceiling, proposedCents: proposed };
  }

  const rolling = await withinRollingCaps(ws.owner_email, proposed);
  if (rolling.ok === false) return rolling;

  return {
    ok: true,
    amountCents: proposed,
    ceilingCents: ceiling,
    source: "within_auto_ceiling",
    reservationId: rolling.reservationId,
  };
}

/**
 * Close out an authorization once the caller knows what happened to it.
 *
 * `created: false` returns the budget immediately, so a Stripe failure after a successful authorization
 * does not hold a slice of the owner's daily cap for the full TTL. Call this on BOTH paths — a reservation
 * nobody settles or releases is simply budget that stays claimed until it times out.
 */
export async function finishAgentPayment(authz: PaymentAuthz, created: boolean): Promise<void> {
  if (!authz.ok || !authz.reservationId) return;
  await settleAgentPayment(authz.reservationId, created);
}

type RollingDenial = Extract<PaymentAuthz, { ok: false }>;
type RollingVerdict = { ok: true; reservationId: string | null } | RollingDenial;

// Rolling day and billing-cycle ceilings.
//
// The authoritative path is the database RPC: it aggregates with no row limit and claims the budget under a
// per-owner lock inside the same transaction as the decision, so two concurrent authorizations cannot both
// pass one cap. The bridge below runs only while that migration is not yet deployed.
async function withinRollingCaps(ownerEmail: string, addCents: number): Promise<RollingVerdict> {
  const reserved = await reserveAgentPayment({
    ownerEmail,
    amountCents: addCents,
    dayCapCents: DAILY_CENTS(),
    cycleCapCents: CYCLE_CENTS(),
    cycleDays: CYCLE_DAYS(),
    ttlSeconds: RESERVATION_TTL_SECONDS(),
  });

  // A REAL failure is not a reason to try the weaker path as well: falling through to an unserialised read
  // after the atomic one failed gives you the racy behaviour AND the failure. Refuse.
  if (reserved === null) {
    return { ok: false, reason: "ceiling_unavailable", ceilingCents: null, proposedCents: addCents };
  }

  if (reserved !== "unavailable") {
    if (reserved.ok) return { ok: true, reservationId: reserved.reservationId };
    if (reserved.reason === "daily_cap_reached") {
      return { ok: false, reason: "daily_cap_reached", ceilingCents: DAILY_CENTS(), proposedCents: addCents };
    }
    if (reserved.reason === "cycle_cap_reached") {
      return { ok: false, reason: "cycle_cap_reached", ceilingCents: CYCLE_CENTS(), proposedCents: addCents };
    }
    // 'invalid' means the RPC rejected the inputs. That is a refusal, not a licence to re-ask more weakly.
    return { ok: false, reason: "ceiling_unavailable", ceilingCents: null, proposedCents: addCents };
  }

  // ── Bridge: the RPC is not deployed yet. ────────────────────────────────────────────────────────────
  // Exact (paginated, fails closed rather than under-reporting) and it counts only settled payments, so an
  // outsider minting pending rows cannot exhaust the cap. It still cannot serialise concurrent callers;
  // deploying sql/vraelis-agent-payment-cap.sql is what closes that.
  //
  // THE TWO PATHS DO NOT MEASURE THE SAME THING, and pretending otherwise would hide a real behaviour
  // change at deployment. The bridge counts SETTLED PAYMENTS on the account, agent-initiated or not. The
  // RPC counts AGENT AUTHORIZATIONS only. So the bridge is the stricter of the two — an owner's own manual
  // invoicing consumes the agent's budget under it — and switching to the RPC starts the counter at zero
  // once, for the length of one window. Both are bounded and fail closed; the runbook states the switch.
  const dayMs = 24 * 60 * 60 * 1000;
  const [day, cycle] = await Promise.all([
    sumRecentPaymentCents(ownerEmail, new Date(Date.now() - dayMs).toISOString()),
    sumRecentPaymentCents(ownerEmail, new Date(Date.now() - CYCLE_DAYS() * dayMs).toISOString()),
  ]);
  // null means the total could not be established exactly. Fail closed rather than assume zero spent.
  if (day === null || cycle === null) {
    return { ok: false, reason: "ceiling_unavailable", ceilingCents: null, proposedCents: addCents };
  }
  if (day + addCents > DAILY_CENTS()) {
    return { ok: false, reason: "daily_cap_reached", ceilingCents: DAILY_CENTS(), proposedCents: addCents };
  }
  if (cycle + addCents > CYCLE_CENTS()) {
    return { ok: false, reason: "cycle_cap_reached", ceilingCents: CYCLE_CENTS(), proposedCents: addCents };
  }
  return { ok: true, reservationId: null };
}

// What the lead is told when a payment is not automatically authorized. Deliberately says nothing about
// limits, ceilings or why — that would teach a manipulator exactly what to aim under.
export function leadFacingRefusal(): string {
  return "I'll have someone from the team confirm the details and send that through shortly.";
}
