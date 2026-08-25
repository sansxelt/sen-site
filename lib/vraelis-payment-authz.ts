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
import { sumRecentPaymentCents } from "./vraelis-db";

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
const num = (name: string, fallback: number): number => {
  const raw = (process.env[name] ?? "").trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export const AUTO_MULTIPLE = () => num("VRAELIS_AUTO_PAY_MULTIPLE", 10);
export const AUTO_FLOOR_CENTS = () => num("VRAELIS_AUTO_PAY_FLOOR_CENTS", 50_000);
export const AUTO_MAX_CENTS = () => num("VRAELIS_AUTO_PAY_MAX_CENTS", 200_000);
export const DAILY_CENTS = () => num("VRAELIS_AUTO_PAY_DAILY_CENTS", 500_000);
export const CYCLE_CENTS = () => num("VRAELIS_AUTO_PAY_CYCLE_CENTS", 2_000_000);
export const CYCLE_DAYS = () => num("VRAELIS_AUTO_PAY_CYCLE_DAYS", 30);

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
  | { ok: true; amountCents: number; ceilingCents: number; source: "owner_configured_deposit" | "within_auto_ceiling" }
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
    if (rolling !== true) return rolling;
    return { ok: true, amountCents: configured, ceilingCents: configured, source: "owner_configured_deposit" };
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
  if (rolling !== true) return rolling;

  return { ok: true, amountCents: proposed, ceilingCents: ceiling, source: "within_auto_ceiling" };
}

// Rolling day and billing-cycle ceilings. Returns true, or the denial to hand back.
async function withinRollingCaps(ownerEmail: string, addCents: number): Promise<true | PaymentAuthz> {
  const dayMs = 24 * 60 * 60 * 1000;
  const [day, cycle] = await Promise.all([
    sumRecentPaymentCents(ownerEmail, new Date(Date.now() - dayMs).toISOString()),
    sumRecentPaymentCents(ownerEmail, new Date(Date.now() - CYCLE_DAYS() * dayMs).toISOString()),
  ]);
  // sumRecentPaymentCents returns null when it cannot read. Fail closed rather than assume zero spent.
  if (day === null || cycle === null) {
    return { ok: false, reason: "ceiling_unavailable", ceilingCents: null, proposedCents: addCents };
  }
  if (day + addCents > DAILY_CENTS()) {
    return { ok: false, reason: "daily_cap_reached", ceilingCents: DAILY_CENTS(), proposedCents: addCents };
  }
  if (cycle + addCents > CYCLE_CENTS()) {
    return { ok: false, reason: "cycle_cap_reached", ceilingCents: CYCLE_CENTS(), proposedCents: addCents };
  }
  return true;
}

// What the lead is told when a payment is not automatically authorized. Deliberately says nothing about
// limits, ceilings or why — that would teach a manipulator exactly what to aim under.
export function leadFacingRefusal(): string {
  return "I'll have someone from the team confirm the details and send that through shortly.";
}
