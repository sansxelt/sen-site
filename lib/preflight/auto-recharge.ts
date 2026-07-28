// AUTO RECHARGE: the only thing in this product that moves money with nobody present.
//
// Everything else charges because someone clicked. This charges because a number fell. That difference is
// the whole design: every rule below exists to make sure a customer is never surprised, and the decision is
// a PURE FUNCTION so the rules can be exercised without a card, a customer, or a network.
//
// THE RULES, AND WHAT EACH ONE PREVENTS.
//
//   Off by default, with no default amounts. A trigger, a target and a cap we chose would be a charge
//   nobody agreed to. Until a customer sets three numbers, this does nothing.
//
//   A monthly ceiling that REFUSES rather than partially charging. A trigger and a target alone describe a
//   loop bounded only by how fast spend empties the balance, which on a runaway integration is not bounded
//   at all. A customer who set a limit meant it as a stop.
//
//   Explicit consent, recorded with a timestamp. A saved payment method is not consent. Stripe requires
//   off-session charges to be traceable to an agreement, and so does anyone reading a dispute.
//
//   Three consecutive failures disables it. Retrying forever against a declining card is how a bank starts
//   treating the merchant as fraudulent, and it is how a customer discovers the feature by finding six
//   declines on a statement.
//
//   Idempotency on a time bucket. Two settlements finishing together both see a low balance and both decide
//   to top up. The unique index on the event log makes the second one lose.
//
// WHAT THIS FILE CANNOT DO YET, STATED PLAINLY: charge anything. The top-up PaymentIntent in
// app/api/v/checkout/intent/route.ts sets `customer` but not `setup_future_usage`, so no payment method is
// stored for off-session reuse and no existing customer has one. enrol() is the missing half, and until a
// customer has completed it, decide() returns "no_payment_method" and nothing is ever attempted.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";

// THE UNIT, WRITTEN DOWN, BECAUSE GETTING IT WRONG CHARGES PEOPLE WHO DID NOT NEED TOPPING UP.
//
// balance() returns CREDITS. Every threshold in this file is CENTS. Vraelis sells 10 credits per dollar
// (app/api/v/checkout/intent/route.ts, and the /credits page shows the same rate), so one credit is ten
// cents. Passing a credit balance straight in as cents under-reads it by 10x, and an under-read balance
// looks like an empty one: it would fire a top-up at $50 for someone who set their trigger at $5.
//
// Note lib/credits.ts also exports CREDITS_PER_DOLLAR = 100. That is the retired chatbot product's
// economics and nothing in Vraelis uses it. The checkout route shadows it with its own 10 deliberately.
// auto-recharge-verify.ts asserts this constant still agrees with the rate the checkout route charges.
export const CENTS_PER_CREDIT = 10;

/** Credits, as the ledger stores them, into the cents every rule here is written in. */
export function creditsToCents(credits: number): number {
  return Math.round(credits * CENTS_PER_CREDIT);
}

/** Cents. Deliberately narrow: a top-up is a small number of dollars, not an arbitrary one. */
export const MIN_TRIGGER_CENTS = 100;        // $1
export const MAX_TRIGGER_CENTS = 50_000;     // $500
export const MIN_TARGET_CENTS = 500;         // $5
export const MAX_TARGET_CENTS = 200_000;     // $2,000
export const MAX_MONTHLY_CAP_CENTS = 500_000; // $5,000
export const MAX_CONSECUTIVE_FAILURES = 3;

export type AutoRechargeSettings = {
  enabled: boolean;
  triggerCents: number | null;
  targetCents: number | null;
  monthlyCapCents: number | null;
  stripeCustomerId: string | null;
  stripePaymentMethod: string | null;
  consentAt: string | null;
  consecutiveFailures: number;
  disabledReason: string | null;
  lastChargeAt: string | null;
};

export type RechargeRefusal =
  | "disabled"
  | "not_configured"
  | "no_payment_method"
  | "no_consent"
  | "balance_above_trigger"
  | "monthly_cap_reached"
  | "too_many_failures"
  | "cooling_off";

export type RechargeDecision =
  | { charge: true; amountCents: number; idempotencyKey: string }
  | { charge: false; reason: RechargeRefusal; detail?: string };

/**
 * Validation of the three numbers a customer sets. Returned as a list of problems rather than a boolean so
 * the form can say which field is wrong.
 *
 * The target must exceed the trigger by a real margin. Equal values, or a target a cent above the trigger,
 * produce a top-up that lands the balance right back at the threshold and charges again on the next run:
 * a loop that empties a card in small increments and looks, from the outside, exactly like a bug.
 */
export const MIN_TOPUP_MARGIN_CENTS = 500; // $5 of headroom after a top-up

export function validateSettings(s: { triggerCents: number; targetCents: number; monthlyCapCents: number }): string[] {
  const problems: string[] = [];
  const int = (v: number) => Number.isInteger(v) && v >= 0;
  if (!int(s.triggerCents) || s.triggerCents < MIN_TRIGGER_CENTS || s.triggerCents > MAX_TRIGGER_CENTS) {
    problems.push(`Trigger must be between $${MIN_TRIGGER_CENTS / 100} and $${MAX_TRIGGER_CENTS / 100}.`);
  }
  if (!int(s.targetCents) || s.targetCents < MIN_TARGET_CENTS || s.targetCents > MAX_TARGET_CENTS) {
    problems.push(`Top-up target must be between $${MIN_TARGET_CENTS / 100} and $${MAX_TARGET_CENTS / 100}.`);
  }
  if (int(s.triggerCents) && int(s.targetCents) && s.targetCents - s.triggerCents < MIN_TOPUP_MARGIN_CENTS) {
    problems.push(`The target must be at least $${MIN_TOPUP_MARGIN_CENTS / 100} above the trigger, or a top-up lands back at the trigger and charges again.`);
  }
  if (!int(s.monthlyCapCents) || s.monthlyCapCents <= 0 || s.monthlyCapCents > MAX_MONTHLY_CAP_CENTS) {
    problems.push(`Monthly limit must be between $0.01 and $${MAX_MONTHLY_CAP_CENTS / 100}.`);
  }
  // A cap below one top-up means the first charge is refused and the feature never does anything. Better to
  // refuse the SETTING than to accept it and silently never fire.
  if (int(s.monthlyCapCents) && int(s.targetCents) && int(s.triggerCents)
      && s.monthlyCapCents < s.targetCents - s.triggerCents) {
    problems.push("The monthly limit is smaller than a single top-up, so nothing would ever be charged.");
  }
  return problems;
}

/**
 * THE DECISION. Pure, so every branch is testable without money.
 *
 * `nowMs` and `chargedThisMonthCents` are passed in rather than read, for the same reason
 * summarizeKeyRuns takes spentToday: a figure that only a live database can produce is a figure nobody
 * tests, and this one decides whether to charge a card.
 */
export function decide(input: {
  settings: AutoRechargeSettings;
  balanceCents: number;
  chargedThisMonthCents: number;
  nowMs: number;
  lastAttemptAtMs?: number | null;
}): RechargeDecision {
  const s = input.settings;

  if (!s.enabled) return { charge: false, reason: "disabled" };
  if (s.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    return { charge: false, reason: "too_many_failures", detail: s.disabledReason ?? undefined };
  }
  if (s.triggerCents == null || s.targetCents == null || s.monthlyCapCents == null) {
    return { charge: false, reason: "not_configured" };
  }
  // Consent is checked BEFORE the payment method, so a stored card with no recorded agreement can never be
  // used. The two are written together by enrol(), and checking both means a partial write cannot charge.
  if (!s.consentAt) return { charge: false, reason: "no_consent" };
  if (!s.stripePaymentMethod || !s.stripeCustomerId) return { charge: false, reason: "no_payment_method" };

  // STRICTLY ABOVE. A balance exactly at the trigger has reached it, and "top up when I get to $5" means at
  // $5, not below it.
  if (input.balanceCents > s.triggerCents) return { charge: false, reason: "balance_above_trigger" };

  // A short cooling-off after any attempt. Two runs settling in the same second both see a low balance;
  // the idempotency key is the hard stop and this is the cheap one that avoids the race in the first place.
  const COOLING_OFF_MS = 60_000;
  if (input.lastAttemptAtMs != null && input.nowMs - input.lastAttemptAtMs < COOLING_OFF_MS) {
    return { charge: false, reason: "cooling_off" };
  }

  const amount = s.targetCents - Math.max(0, input.balanceCents);
  if (amount <= 0) return { charge: false, reason: "balance_above_trigger" };

  // REFUSES RATHER THAN CHARGING A PARTIAL AMOUNT. A cap is a stop. Topping up by whatever is left under it
  // would land the balance somewhere the customer did not choose, and would do it again immediately.
  if (input.chargedThisMonthCents + amount > s.monthlyCapCents) {
    return {
      charge: false, reason: "monthly_cap_reached",
      detail: `$${(input.chargedThisMonthCents / 100).toFixed(2)} of $${(s.monthlyCapCents / 100).toFixed(2)} used this month`,
    };
  }

  // One key per owner per minute. Two concurrent settlements produce the same key, the unique index on
  // v_auto_recharge_events rejects the second, and only one charge happens.
  const bucket = Math.floor(input.nowMs / COOLING_OFF_MS);
  return { charge: true, amountCents: amount, idempotencyKey: `ar_${bucket}` };
}

/** Human wording for a refusal, for the settings page and the event log. */
export const REFUSAL_TEXT: Record<RechargeRefusal, string> = {
  disabled: "Automatic top-up is off.",
  not_configured: "Automatic top-up has no amounts set yet.",
  no_payment_method: "No saved card. Add one to turn automatic top-up on.",
  no_consent: "Automatic top-up needs your explicit agreement before a card can be charged.",
  balance_above_trigger: "Balance is above the trigger, so nothing was needed.",
  monthly_cap_reached: "Your monthly limit for automatic top-ups has been reached.",
  too_many_failures: "Automatic top-up was switched off after repeated card failures.",
  cooling_off: "A top-up was attempted moments ago.",
};

// ── Storage ───────────────────────────────────────────────────────────────────────────────────────────

const EMPTY: AutoRechargeSettings = {
  enabled: false, triggerCents: null, targetCents: null, monthlyCapCents: null,
  stripeCustomerId: null, stripePaymentMethod: null, consentAt: null,
  consecutiveFailures: 0, disabledReason: null, lastChargeAt: null,
};

type Row = {
  enabled: boolean; trigger_cents: number | null; target_cents: number | null; monthly_cap_cents: number | null;
  stripe_customer_id: string | null; stripe_payment_method: string | null; consent_at: string | null;
  consecutive_failures: number | null; disabled_reason: string | null; last_charge_at: string | null;
  last_attempt_at: string | null;
};

/**
 * Settings for an owner. Returns the OFF state rather than null when the table is absent, so every caller
 * behaves as if the feature is switched off before migration 25 is applied. A feature that moves money
 * must fail closed, and "the table is missing" has to mean off rather than unknown.
 */
export async function getSettings(owner: string): Promise<AutoRechargeSettings & { lastAttemptAt: string | null }> {
  const off = { ...EMPTY, lastAttemptAt: null };
  if (!isDatabaseConfigured() || !owner) return off;
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_auto_recharge" as never)
      .select("enabled, trigger_cents, target_cents, monthly_cap_cents, stripe_customer_id, stripe_payment_method, consent_at, consecutive_failures, disabled_reason, last_charge_at, last_attempt_at")
      .eq("user_id", owner.trim().toLowerCase()).maybeSingle();
    if (error || !data) return off;
    const r = data as unknown as Row;
    return {
      enabled: !!r.enabled,
      triggerCents: r.trigger_cents, targetCents: r.target_cents, monthlyCapCents: r.monthly_cap_cents,
      stripeCustomerId: r.stripe_customer_id, stripePaymentMethod: r.stripe_payment_method,
      consentAt: r.consent_at,
      consecutiveFailures: Number(r.consecutive_failures ?? 0),
      disabledReason: r.disabled_reason,
      lastChargeAt: r.last_charge_at,
      lastAttemptAt: r.last_attempt_at,
    };
  } catch { return off; }
}

/**
 * What this owner has been charged automatically in the current UTC calendar month.
 *
 * DERIVED FROM THE EVENT LOG, never from a counter on the settings row. A counter has to be reset on a
 * month boundary by something, and whatever does the resetting is a second place the cap can be wrong. The
 * log is the record; the total is a question asked of it.
 */
export async function chargedThisMonthCents(owner: string, nowMs = Date.now()): Promise<number> {
  if (!isDatabaseConfigured() || !owner) return 0;
  try {
    const now = new Date(nowMs);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_auto_recharge_events" as never)
      .select("amount_cents")
      .eq("user_id", owner.trim().toLowerCase()).eq("kind", "charged")
      .gte("created_at", monthStart).limit(1000);
    if (error) return Number.MAX_SAFE_INTEGER;  // unreadable log: refuse rather than charge blind
    return ((data as { amount_cents: number | null }[] | null) ?? []).reduce((t, r) => t + (Number(r.amount_cents) || 0), 0);
  } catch {
    return Number.MAX_SAFE_INTEGER;             // same: a cap that cannot be read is a cap that has been hit
  }
}

/** Append to the log. Best effort for refusals, load-bearing for charges (the unique index dedupes). */
export async function record(owner: string, e: {
  kind: "charged" | "refused" | "failed";
  amountCents?: number | null; balanceBeforeCents?: number | null;
  reason?: string | null; stripePaymentIntent?: string | null; idempotencyKey?: string | null;
}): Promise<{ ok: boolean; duplicate: boolean }> {
  if (!isDatabaseConfigured() || !owner) return { ok: false, duplicate: false };
  try {
    const s = getSupabaseAdminClient();
    const { error } = await s.from("v_auto_recharge_events" as never).insert({
      user_id: owner.trim().toLowerCase(), kind: e.kind,
      amount_cents: e.amountCents ?? null, balance_before_cents: e.balanceBeforeCents ?? null,
      reason: e.reason ?? null, stripe_payment_intent: e.stripePaymentIntent ?? null,
      idempotency_key: e.idempotencyKey ?? null,
    } as never);
    // 23505 is the unique violation: another settlement got there first, which is the mechanism working.
    if (error) return { ok: false, duplicate: String((error as { code?: string }).code) === "23505" };
    return { ok: true, duplicate: false };
  } catch { return { ok: false, duplicate: false }; }
}

export async function saveSettings(owner: string, patch: Partial<{
  enabled: boolean; triggerCents: number; targetCents: number; monthlyCapCents: number;
  stripeCustomerId: string; stripePaymentMethod: string; consentAt: string;
  consecutiveFailures: number; disabledReason: string | null; lastChargeAt: string; lastAttemptAt: string;
}>): Promise<boolean> {
  if (!isDatabaseConfigured() || !owner) return false;
  const row: Record<string, unknown> = { user_id: owner.trim().toLowerCase(), updated_at: new Date().toISOString() };
  const map: Record<string, string> = {
    enabled: "enabled", triggerCents: "trigger_cents", targetCents: "target_cents",
    monthlyCapCents: "monthly_cap_cents", stripeCustomerId: "stripe_customer_id",
    stripePaymentMethod: "stripe_payment_method", consentAt: "consent_at",
    consecutiveFailures: "consecutive_failures", disabledReason: "disabled_reason",
    lastChargeAt: "last_charge_at", lastAttemptAt: "last_attempt_at",
  };
  for (const [k, col] of Object.entries(map)) {
    if (k in patch) row[col] = (patch as Record<string, unknown>)[k];
  }
  try {
    const s = getSupabaseAdminClient();
    const { error } = await s.from("v_auto_recharge" as never).upsert(row as never, { onConflict: "user_id" } as never);
    return !error;
  } catch { return false; }
}
