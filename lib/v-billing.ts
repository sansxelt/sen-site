// Server-side Stripe READ layer for the native billing surfaces (V1.1 workstream S1): the /billing
// page, /billing/success, and /billing/portal-return render subscription state and payment history
// natively so the user never has to leave the app to see what they are paying for. Read-only: nothing
// here writes billing state (the webhook remains the only activation authority) and nothing here is
// reachable from a client body. All lookups are keyed by the signed-in owner's email.

import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "./stripe";
import { planV1 } from "./preflight/pass-pricing";

export type BillingInvoiceRow = {
  id: string;
  createdIso: string;
  amountCents: number;
  currency: string;
  status: string; // draft | open | paid | void | uncollectible
  hostedInvoiceUrl: string | null; // Stripe-hosted detail page: the fallback for line-item detail
  number: string | null;
};

export type LiveSubscription = {
  subscriptionId: string;
  customerId: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEndIso: string | null;
  planKey: string | null; // _v1 catalog key when this is a _v1 subscription
  cycle: "monthly" | "yearly" | null;
};

function periodEndIso(sub: Stripe.Subscription): string | null {
  // current_period_end moved under items in newer API shapes; accept either (same cast pattern as
  // lib/v-subscriptions.ts).
  const raw = (sub as unknown as { current_period_end?: number }).current_period_end
    ?? (sub as unknown as { items?: { data?: { current_period_end?: number }[] } }).items?.data?.[0]?.current_period_end;
  return typeof raw === "number" && raw > 0 ? new Date(raw * 1000).toISOString() : null;
}

// The customer record for an owner, by canonical email. Null when Stripe is unconfigured or the owner
// has never touched billing.
export async function stripeCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
  if (!email || !isStripeConfigured()) return null;
  try {
    const customers = await getStripe().customers.list({ email: email.trim().toLowerCase(), limit: 1 });
    return customers.data[0] ?? null;
  } catch {
    return null;
  }
}

// The owner's live _v1 subscription from Stripe (renewal date, cancellation status). v_profiles only
// stores plan_v1/anchor/cycle, so the subscription object itself is resolved here: by the locked
// metadata (type "v_plan" with a _v1 plan key) on the customer's subscriptions. Returns null on any
// failure; callers degrade to the stored plan state.
export async function liveV1Subscription(email: string, expectedPlanKey?: string | null): Promise<LiveSubscription | null> {
  if (!email || !isStripeConfigured()) return null;
  try {
    const customer = await stripeCustomerByEmail(email);
    if (!customer) return null;
    const subs = await getStripe().subscriptions.list({ customer: customer.id, status: "all", limit: 10 });
    // Prefer the states a user would call "current": active, then dunning, then anything else.
    const priority = ["active", "trialing", "past_due", "incomplete", "canceled"];
    const candidates = subs.data
      .filter((s) => {
        const meta = (s.metadata ?? {}) as Record<string, string>;
        const key = meta.type === "v_plan" && meta.plan && planV1(meta.plan) ? meta.plan : null;
        if (!key) return false;
        return expectedPlanKey ? key === expectedPlanKey : true;
      })
      .sort((a, b) => priority.indexOf(a.status) - priority.indexOf(b.status));
    const sub = candidates[0];
    if (!sub) return null;
    const meta = (sub.metadata ?? {}) as Record<string, string>;
    return {
      subscriptionId: sub.id,
      customerId: customer.id,
      status: sub.status,
      cancelAtPeriodEnd: Boolean((sub as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end),
      currentPeriodEndIso: periodEndIso(sub),
      planKey: meta.plan ?? null,
      cycle: meta.cycle === "yearly" ? "yearly" : meta.cycle === "monthly" ? "monthly" : null,
    };
  } catch {
    return null;
  }
}

// Native payment history: the owner's recent Stripe invoices (date, amount, status), rendered in-app
// with the hosted invoice page as the line-item detail fallback. Empty array on any failure so the
// billing page always renders.
export async function listCustomerInvoices(email: string, limit = 12): Promise<BillingInvoiceRow[]> {
  if (!email || !isStripeConfigured()) return [];
  try {
    const customer = await stripeCustomerByEmail(email);
    if (!customer) return [];
    const invoices = await getStripe().invoices.list({ customer: customer.id, limit });
    return invoices.data
      .filter((inv) => inv.status !== "draft")
      .map((inv) => ({
        id: inv.id ?? "",
        createdIso: new Date((inv.created ?? 0) * 1000).toISOString(),
        amountCents: inv.amount_paid || inv.amount_due || inv.total || 0,
        currency: (inv.currency || "usd").toUpperCase(),
        status: inv.status ?? "open",
        hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
        number: inv.number ?? null,
      }));
  } catch {
    return [];
  }
}
