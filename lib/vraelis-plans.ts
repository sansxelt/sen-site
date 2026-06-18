// Vraelis plan IDs created in LIVE Stripe + PayPal (scripts/setup-payments.mjs).
// Price IDs / plan IDs are NOT secrets — safe to keep in source.

export type PlanKey = "solo" | "growth";
export type Cycle = "monthly" | "yearly" | "lifetime";

export const STRIPE_PRICES: Record<PlanKey, Record<Cycle, string>> = {
  solo: {
    monthly: "price_1TdjlxIHI0UhMM0RR20TWrrU",
    yearly: "price_1TdjlxIHI0UhMM0R3A1gJw1G",
    lifetime: "price_1TdjlxIHI0UhMM0R7MGxlVu9",
  },
  growth: {
    monthly: "price_1TdjlyIHI0UhMM0RrOMJryG7",
    yearly: "price_1TdjlyIHI0UhMM0RFlcAwfe6",
    lifetime: "price_1TdjlyIHI0UhMM0RBOk7NxTv",
  },
};

export const STRIPE_ADDON_PRICES = {
  workspace: "price_1TdjlyIHI0UhMM0Rajo25dCc",
  whitelabel: "price_1TdjlyIHI0UhMM0R8HrTFZeP",
  priority: "price_1TdjlzIHI0UhMM0RxSUyjsXO",
};

// PayPal subscription plans (monthly/yearly). Lifetime on PayPal is a
// one-time order handled at checkout, not a billing plan.
export const PAYPAL_PLANS: Record<PlanKey, { monthly: string; yearly: string }> = {
  solo: {
    monthly: "P-8D4470953F530660SNIPFS4A",
    yearly: "P-6U79672180797523LNIPFS4A",
  },
  growth: {
    monthly: "P-42Y69929TU754453JNIPFS4A",
    yearly: "P-7M373810RB987364JNIPFS4A",
  },
};

// Numeric cut rates (fraction of booked revenue) by plan + cycle, kept
// in sync with the pricing page copy. Used to compute the fee owed.
export const CUT_RATES: Record<string, Record<Cycle, number>> = {
  starter: { monthly: 0.2, yearly: 0.2, lifetime: 0.2 },
  solo: { monthly: 0.07, yearly: 0.07, lifetime: 0.1 },
  growth: { monthly: 0.05, yearly: 0.05, lifetime: 0.08 },
  agency: { monthly: 0.02, yearly: 0.02, lifetime: 0.03 },
};

export function cutRateFor(plan: string | null, cycle: string | null): number {
  const p = plan && CUT_RATES[plan] ? plan : "starter";
  const c: Cycle = cycle === "yearly" || cycle === "lifetime" ? cycle : "monthly";
  return CUT_RATES[p][c];
}

export function isPlanKey(v: string): v is PlanKey {
  return v === "solo" || v === "growth";
}

// Paid = an actual subscription plan that is currently active. "starter"/null
// is the free tier. Used to decide whether a workspace gets an assigned agent
// phone number (paid perk only).
const PAID_PLANS = new Set(["solo", "growth", "agency"]);
export function isPaidPlan(plan: string | null, status: string | null): boolean {
  return Boolean(plan && PAID_PLANS.has(plan) && status === "active");
}
export function isCycle(v: string): v is Cycle {
  return v === "monthly" || v === "yearly" || v === "lifetime";
}

// The three plan_status values a workspace can hold (see sql/vraelis.sql).
export type PlanStatus = "active" | "past_due" | "canceled";

// past_due is a SHORT grace window (a failed renewal, still recoverable) — NOT a
// free pass until the period ends. After this many days unfixed, the plan is
// treated as lapsed: paid features gate off and the agent number is reaped.
// Applies to subscriptions only (one-time/lifetime never goes past_due).
export const PAST_DUE_GRACE_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

// Grace-aware FEATURE entitlement. Paid features stay ON while the plan is
// active, and during the short past_due grace window measured from
// plan_updated_at (the moment it went past_due). Canceled — or past_due beyond
// the grace window — is NOT entitled. Use this (not isPaidPlan) anywhere a
// lapsed-but-recoverable customer should keep working briefly.
export function isEntitled(
  plan: string | null,
  status: string | null,
  planUpdatedAt?: string | null,
): boolean {
  if (!plan || !PAID_PLANS.has(plan)) return false;
  if (status === "active") return true;
  if (status === "past_due") {
    if (!planUpdatedAt) return true; // no grace clock yet → give the benefit of grace
    const since = new Date(planUpdatedAt).getTime();
    if (!Number.isFinite(since)) return true;
    return Date.now() - since <= PAST_DUE_GRACE_DAYS * DAY_MS;
  }
  return false; // canceled (or any unknown status)
}

// True once a past_due plan has burned through its grace window — i.e. it's time
// to gate features off and reap the agent number. Canceled is handled directly;
// this isolates the past_due clock so the reap/reconcile crons can act on it.
export function isPastDueExpired(status: string | null, planUpdatedAt?: string | null): boolean {
  if (status !== "past_due") return false;
  if (!planUpdatedAt) return false;
  const since = new Date(planUpdatedAt).getTime();
  if (!Number.isFinite(since)) return false;
  return Date.now() - since > PAST_DUE_GRACE_DAYS * DAY_MS;
}
