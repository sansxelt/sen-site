/* eslint-disable @typescript-eslint/no-explicit-any */
// Vraelis Rank subscription webhook logic (kept out of the shared webhook file).
// Credits are granted from `invoice.paid` (first cycle + renewals), deduped by
// invoice id. Subscription state changes flow through `customer.subscription.*`.
// Detection: the invoice's line price matches a Rank plan price env, or the
// subscription carries metadata.type === "v_plan".

import type Stripe from "stripe";
import { planFromPriceId } from "./v-plans";
import { setSubscription, recordInvoiceGrant } from "./v-db";
import { grantMonthly } from "./v-credits";

function linePriceId(invoice: Stripe.Invoice): string | null {
  const ls = (invoice as any).lines?.data?.[0];
  if (!ls) return null;
  return ls.price?.id ?? ls.pricing?.price_details?.price ?? ls.plan?.id ?? null;
}
function invoiceSubId(invoice: Stripe.Invoice): string | null {
  const i = invoice as any;
  if (typeof i.subscription === "string") return i.subscription;
  if (i.subscription?.id) return i.subscription.id;
  const p = i.parent?.subscription_details?.subscription;
  return typeof p === "string" ? p : p?.id ?? null;
}
function invoicePeriodEnd(invoice: Stripe.Invoice): string {
  const i = invoice as any;
  const pe = i.period_end ?? i.lines?.data?.[0]?.period?.end ?? Math.floor(Date.now() / 1000);
  return new Date(pe * 1000).toISOString();
}

// Returns true if this invoice was a Rank subscription invoice (handled here).
export async function handleRankInvoicePaid(invoice: Stripe.Invoice): Promise<boolean> {
  const rank = planFromPriceId(linePriceId(invoice));
  if (!rank) return false; // not a Rank invoice — let the existing handler run
  const userId = invoice.customer_email;
  if (!userId) return true; // Rank, but no email to attribute to
  const periodEnd = invoicePeriodEnd(invoice);
  // Grant once per invoice (covers subscription_create + subscription_cycle).
  if (invoice.id && (await recordInvoiceGrant(userId, rank.plan, rank.monthlyCredits, invoice.id))) {
    await grantMonthly(userId, rank.monthlyCredits, periodEnd);
  }
  await setSubscription({
    userId, plan: rank.plan, status: "active", cycle: rank.cycle,
    stripeSubscriptionId: invoiceSubId(invoice), monthlyCredits: rank.monthlyCredits, currentPeriodEnd: periodEnd,
  });
  return true;
}

export async function handleRankSubChange(event: Stripe.Event, subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.user_id;
  if (!userId) return;
  const rank = planFromPriceId(subscription.items?.data?.[0]?.price?.id ?? null);
  // Only a true termination drops the plan. cancel_at_period_end keeps status
  // "active" until the deletion event fires at period end (plan stays usable),
  // and past_due keeps the tier during Stripe's retry grace — credits simply
  // don't refresh (no invoice.paid), so they run out / expire on their own.
  const canceled = event.type === "customer.subscription.deleted" || ["canceled", "unpaid", "incomplete_expired"].includes(subscription.status);
  const pe = (subscription as any).current_period_end ?? (subscription as any).items?.data?.[0]?.current_period_end ?? Math.floor(Date.now() / 1000);
  await setSubscription({
    userId,
    plan: canceled ? "free" : rank?.plan ?? "free",
    status: canceled ? "canceled" : "active",
    cycle: rank?.cycle ?? null,
    stripeSubscriptionId: subscription.id,
    monthlyCredits: rank?.monthlyCredits ?? 0,
    currentPeriodEnd: new Date(pe * 1000).toISOString(),
  });
}
