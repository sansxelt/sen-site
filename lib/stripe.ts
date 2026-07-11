import Stripe from "stripe";
import type { BillingAddonKey, PricingPlanKey } from "./pricing";

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      // Pin the account's API version verbatim. The bumped SDK types a newer literal default; per Stripe's
      // own guidance for staying on a chosen version, suppress the literal mismatch. Behavior unchanged —
      // do NOT alter the payment API version here.
      // @ts-expect-error SDK pins a newer LatestApiVersion literal; we intentionally pin an older version.
      apiVersion: "2026-03-25.dahlia",
    });
  }
  return stripeClient;
}

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripePublishableKey(): string | null {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null;
}

// ---------------------------------------------------------------------------
// Plan × billing cycle → Stripe price ID
// Each paid plan needs two products/prices in your Stripe dashboard:
//   one for monthly, one for yearly.
// Teams is per-seat, Stripe handles quantity at checkout.
// Enterprise goes to /contact, no Stripe price needed.
// ---------------------------------------------------------------------------

export type BillingCycle = "monthly" | "yearly";

export type StripePricedItemKey = PricingPlanKey | BillingAddonKey;

export const STRIPE_PRICES: Record<StripePricedItemKey, Partial<Record<BillingCycle, string | undefined>>> = {
  free: {},
  student: {
    monthly: process.env.STRIPE_PRICE_STUDENT_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_STUDENT_YEARLY,
  },
  apprentice: {
    monthly: process.env.STRIPE_PRICE_APPRENTICE_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_APPRENTICE_YEARLY,
  },
  creator: {
    monthly: process.env.STRIPE_PRICE_CREATOR_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_CREATOR_YEARLY,
  },
  studio: {
    monthly: process.env.STRIPE_PRICE_STUDIO_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_STUDIO_YEARLY,
  },
  developer: {
    monthly: process.env.STRIPE_PRICE_DEVELOPER_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_DEVELOPER_YEARLY,
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_PRO_YEARLY,
  },
  teams: {},
  enterprise: {},
  // v0.1.12, memory_boost / api_boost / key_pack dropped (no Stripe
  // products created; entries removed from billingAddons + BillingAddonKey).
  // v0.1.4 monetization, recurring add-on packs (subscription items).
  // v0.1.9 dropped voice_pack + image_pack, replaced by credit ledger.
  copilot_pro_pack: {
    monthly: process.env.STRIPE_PRICE_COPILOT_PRO_PACK_MONTHLY,
    yearly: process.env.STRIPE_PRICE_COPILOT_PRO_PACK_YEARLY,
  },
  power_pack: {
    monthly: process.env.STRIPE_PRICE_POWER_PACK_MONTHLY,
    yearly: process.env.STRIPE_PRICE_POWER_PACK_YEARLY,
  },
  // v0.1.4 monetization, one-time boost top-ups (charged once).
  // The "monthly" slot here holds the one-time price id by convention;
  // the payment-intent route checks isOneTimeBoost() and charges with
  // PaymentIntent instead of attaching as a subscription item.
  // v0.1.9 dropped voice_minute_pack / image_credit_pack /
  // copilot_time_pack, those features burn credits now.
  session_boost: {
    monthly: process.env.STRIPE_PRICE_SESSION_BOOST,
  },
  weekly_boost: {
    monthly: process.env.STRIPE_PRICE_WEEKLY_BOOST,
  },
  // v0.2.x marketplace add-ons.
  voice_pack_standard: {
    monthly: process.env.STRIPE_PRICE_VOICE_PACK_STANDARD_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_VOICE_PACK_STANDARD_YEARLY,
  },
  storage_upgrade: {
    monthly: process.env.STRIPE_PRICE_STORAGE_UPGRADE_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_STORAGE_UPGRADE_YEARLY,
  },
  template_pack: {
    monthly: process.env.STRIPE_PRICE_TEMPLATE_PACK,
  },
  agent_pack: {
    monthly: process.env.STRIPE_PRICE_AGENT_PACK_MONTHLY,
    yearly:  process.env.STRIPE_PRICE_AGENT_PACK_YEARLY,
  },
  lifetime_deal: {
    monthly: process.env.STRIPE_PRICE_LIFETIME_DEAL,
  },
};

export function getPriceId(itemKey: string, cycle: BillingCycle): string | null {
  return STRIPE_PRICES[itemKey as StripePricedItemKey]?.[cycle] ?? null;
}

// ---------------------------------------------------------------------------
// Customer + subscription helpers used by the native checkout flow.
// ---------------------------------------------------------------------------

/**
 * Look up an existing Stripe customer by email, or create one.  Callers should
 * pass the user's canonical email (lowercased) so repeat lookups stay stable.
 */
export async function getOrCreateCustomer(email: string): Promise<Stripe.Customer> {
  const stripe = getStripe();
  const existing = await stripe.customers.list({ email, limit: 1 });
  if (existing.data[0]) return existing.data[0];
  return await stripe.customers.create({ email });
}

/**
 * Find the user's active/incomplete subscription (if any).  Prefers active
 * subscriptions so addon purchases attach to the existing plan.
 */
export async function findUsableSubscription(customerId: string): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();
  const list = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });
  const priority = ["active", "trialing", "past_due", "incomplete"];
  for (const status of priority) {
    const match = list.data.find((s) => s.status === status);
    if (match) return match;
  }
  return null;
}

export const APP_URL =
  process.env.AUTH_URL ??
  process.env.NEXTAUTH_URL ??
  "https://vraelis.com";
