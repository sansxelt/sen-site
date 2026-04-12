import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return stripeClient;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// ---------------------------------------------------------------------------
// Plan × billing cycle → Stripe price ID
// Each paid plan needs two products/prices in your Stripe dashboard:
//   one for monthly, one for yearly.
// Teams is per-seat — Stripe handles quantity at checkout.
// Enterprise goes to /contact, no Stripe price needed.
// ---------------------------------------------------------------------------

export type BillingCycle = "monthly" | "yearly";

// Teams and Enterprise go via /contact — no Stripe prices needed for them.
export const STRIPE_PRICES: Record<string, Partial<Record<BillingCycle, string | undefined>>> = {
  apprentice: {
    monthly: process.env.STRIPE_PRICE_APPRENTICE_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_APPRENTICE_YEARLY,
  },
  studio: {
    monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_STUDIO_YEARLY,
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_PRO_YEARLY,
  },
};

export function getPriceId(planKey: string, cycle: BillingCycle): string | null {
  return STRIPE_PRICES[planKey]?.[cycle] ?? null;
}

export const APP_URL =
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "https://sansxel.app";
