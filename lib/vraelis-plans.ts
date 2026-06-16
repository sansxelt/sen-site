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
