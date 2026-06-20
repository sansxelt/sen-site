/* eslint-disable @typescript-eslint/no-explicit-any */
// Vraelis Rank subscription webhook logic (kept out of the shared webhook file).
// Credits are granted from invoice.paid (idempotent per invoice id), only for an
// actually-paid create/renewal cycle. Subscription state flows through
// customer.subscription.*. Identity comes from the locked subscription metadata
// (set at checkout), NOT the customer-mutable invoice.customer_email.

import type Stripe from "stripe";
import { planFromPriceId, monthlyCreditsFor } from "./v-plans";
import { setSubscription, getSubscription, recordInvoiceGrant } from "./v-db";
import { grantMonthly, expireMonthly } from "./v-credits";

function linePriceId(invoice: any): string | null {
  const ls = invoice.lines?.data?.[0];
  if (!ls) return null;
  return ls.price?.id ?? ls.pricing?.price_details?.price ?? ls.plan?.id ?? null;
}
// Immutable subscription-metadata snapshot Stripe attaches to each invoice.
function subMeta(invoice: any): Record<string, string> | null {
  return invoice.parent?.subscription_details?.metadata ?? invoice.subscription_details?.metadata ?? null;
}
// Attribute to the locked metadata.user_id (set by our checkout); fall back to
// customer_email only if absent. customer_email is a finalization snapshot the
// customer can change in the portal, so it must not be the primary key.
function invoiceUserId(invoice: any): string | null {
  return subMeta(invoice)?.user_id || invoice.customer_email || null;
}
function invoiceSubId(invoice: any): string | null {
  if (typeof invoice.subscription === "string") return invoice.subscription;
  if (invoice.subscription?.id) return invoice.subscription.id;
  const p = invoice.parent?.subscription_details?.subscription;
  return typeof p === "string" ? p : p?.id ?? null;
}
// unix seconds -> ISO. Non-positive/missing becomes now + one cycle, so a bad
// payload never expires fresh credits at 1970 or immediately.
function toIso(unix: any, cycle: string): string {
  const n = Number(unix);
  const days = cycle === "yearly" ? 366 : 31;
  const sec = Number.isFinite(n) && n > 0 ? n : Math.floor(Date.now() / 1000) + days * 86400;
  return new Date(sec * 1000).toISOString();
}
function invoicePeriodEnd(invoice: any, cycle: string): string {
  return toIso(invoice.period_end || invoice.lines?.data?.[0]?.period?.end, cycle);
}

// Returns true if this invoice was a Rank subscription invoice (handled here).
export async function handleRankInvoicePaid(invoice: Stripe.Invoice): Promise<boolean> {
  const inv = invoice as any;
  // Resolve the Rank plan: by line price, else the subscription-metadata snapshot
  // (covers a missing/renamed STRIPE_PRICE_* env in the webhook runtime).
  let plan: string | null = null, cycle = "monthly", monthlyCredits = 0;
  const byPrice = planFromPriceId(linePriceId(inv));
  if (byPrice) { plan = byPrice.plan; cycle = byPrice.cycle; monthlyCredits = byPrice.monthlyCredits; }
  else {
    const m = subMeta(inv);
    if (m?.type === "v_plan" && m.plan) { plan = m.plan; cycle = m.cycle || "monthly"; monthlyCredits = monthlyCreditsFor(m.plan); }
  }
  if (!plan) return false; // not a Rank invoice — let the existing handler run

  const userId = invoiceUserId(inv);
  if (!userId) { console.error("[rank] invoice.paid could not attribute a user:", inv.id); return true; }

  const periodEnd = invoicePeriodEnd(inv, cycle);
  const isPaidCycle = inv.status === "paid" && (inv.billing_reason === "subscription_create" || inv.billing_reason === "subscription_cycle");

  if (isPaidCycle && monthlyCredits > 0) {
    // Yearly is billed once for the whole year -> grant 12x up front.
    const credits = cycle === "yearly" ? monthlyCredits * 12 : monthlyCredits;
    // Idempotent per invoice id (ledger ext_ref): a replay/race returns false.
    const granted = await grantMonthly(userId, credits, periodEnd, inv.id ?? undefined);
    if (granted) {
      await expireMonthly(userId, inv.id ?? undefined); // clear the PRIOR tier, keep this grant
      await recordInvoiceGrant(userId, plan, credits, inv.id ?? `inv_${userId}_${periodEnd}`);
    }
  }

  // Refresh plan state — but never resurrect a subscription the user already
  // canceled (out-of-order / retried invoice delivery).
  const subId = invoiceSubId(inv);
  const existing = await getSubscription(userId);
  const resurrecting = existing?.status === "canceled" && existing.stripe_subscription_id === subId;
  if (!resurrecting) {
    await setSubscription({ userId, plan, status: "active", cycle, stripeSubscriptionId: subId, monthlyCredits, currentPeriodEnd: periodEnd });
  }
  return true;
}

export async function handleRankSubChange(event: Stripe.Event, subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.user_id;
  if (!userId) return;
  const rank = planFromPriceId(subscription.items?.data?.[0]?.price?.id ?? null);
  const status = subscription.status;
  const canceled = event.type === "customer.subscription.deleted" || ["canceled", "unpaid", "incomplete_expired"].includes(status);
  const pastDue = status === "past_due";
  const cycle = rank?.cycle ?? "monthly";
  const pe = (subscription as any).current_period_end ?? (subscription as any).items?.data?.[0]?.current_period_end;

  await setSubscription({
    userId,
    plan: canceled ? "free" : rank?.plan ?? "free",
    // past_due keeps the tier during dunning (getPlan honors it); cancel_at_period_end
    // stays "active" until the deletion event; only a true termination -> free.
    status: canceled ? "canceled" : pastDue ? "past_due" : "active",
    cycle: rank?.cycle ?? null,
    stripeSubscriptionId: subscription.id,
    monthlyCredits: rank?.monthlyCredits ?? 0,
    currentPeriodEnd: toIso(pe, cycle),
  });

  // On a hard/early termination, claw back unused monthly credits so a canceled
  // user can't keep spending the old allotment. (cancel_at_period_end is "active"
  // here, so this only fires on real terminations — credits paid for the current
  // period stay available until they expire.)
  if (canceled) await expireMonthly(userId);
}
