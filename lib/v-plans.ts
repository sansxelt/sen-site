// Vraelis plans — FIXED recurring subscriptions (vs custom credit top-ups).
// Plans control monthly perks: monthly credits, test limits, features.
// Price IDs are read from env: STRIPE_PRICE_<PLAN>_<CYCLE>.

export type PlanCycle = "monthly" | "yearly";
export type PaidPlan = "starter" | "creator" | "pro" | "scale";

export const PLAN_CATALOG: {
  plan: PaidPlan; name: string; monthlyCredits: number;
  price: Record<PlanCycle, number>; blurb: string;
}[] = [
  { plan: "starter", name: "Starter", monthlyCredits: 150,  price: { monthly: 19,  yearly: 190 },  blurb: "Test AI outputs and early iterations." },
  { plan: "creator", name: "Creator", monthlyCredits: 500,  price: { monthly: 49,  yearly: 490 },  blurb: "Model comparison and prompt iteration." },
  { plan: "pro",     name: "Pro",     monthlyCredits: 2000, price: { monthly: 149, yearly: 1490 }, blurb: "Agent QA and team evaluation workflows." },
  { plan: "scale",   name: "Scale",   monthlyCredits: 7500, price: { monthly: 399, yearly: 3990 }, blurb: "Embed human eval into AI pipelines via API." },
];

export function priceIdFor(plan: string, cycle: string): string | null {
  return process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`] || null;
}

export function monthlyCreditsFor(plan: string): number {
  return PLAN_CATALOG.find((p) => p.plan === plan)?.monthlyCredits ?? 0;
}

// Reverse lookup: a Stripe price id -> which Rank plan/cycle it is (or null).
export function planFromPriceId(priceId: string | null | undefined): { plan: PaidPlan; cycle: PlanCycle; monthlyCredits: number } | null {
  if (!priceId) return null;
  for (const p of PLAN_CATALOG) {
    for (const cycle of ["monthly", "yearly"] as PlanCycle[]) {
      if (process.env[`STRIPE_PRICE_${p.plan.toUpperCase()}_${cycle.toUpperCase()}`] === priceId) {
        return { plan: p.plan, cycle, monthlyCredits: p.monthlyCredits };
      }
    }
  }
  return null;
}
