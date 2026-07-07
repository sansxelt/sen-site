/* eslint-disable @typescript-eslint/no-explicit-any */
// Vraelis Rank subscription logic for the PAYPAL rail. Mirrors lib/v-subscriptions.ts (the
// Stripe path): grant monthly plan credits on each successful payment (idempotent per PayPal
// sale id), set/clear subscription state, and claw back on cancel. Only touches subscriptions
// created by our create-subscription route (custom_id.type === "v_plan"); everything else is
// ignored, so this never interferes with the retired product's PayPal webhook.

import { getPaypalSubscription, vraelisPlanFromPaypalPlanId } from "./paypal";
import { monthlyCreditsFor } from "./v-plans";
import { setSubscription, getSubscription, recordInvoiceGrant } from "./v-db";
import { grantMonthly, expireMonthly } from "./v-credits";

type Custom = { type?: string; email?: string; plan?: string; cycle?: string };

function parseCustom(s: unknown): Custom | null {
  if (typeof s !== "string" || !s) return null;
  try { return JSON.parse(s) as Custom; } catch { return null; }
}

type SubCtx = { email: string; plan: string; cycle: "monthly" | "yearly"; periodEnd: string; monthlyCredits: number };

// Fetch the fresh subscription and resolve it to a Vraelis user + plan. Returns null when it
// isn't one of ours (no v_plan custom_id), so the caller skips it.
async function subContext(subId: string): Promise<SubCtx | null> {
  const sub = (await getPaypalSubscription(subId)) as unknown as {
    plan_id?: string; custom_id?: string; billing_info?: { next_billing_time?: string };
  };
  const custom = parseCustom(sub.custom_id);
  if (!custom || custom.type !== "v_plan" || !custom.email) return null;
  // Plan + cycle come from the AUTHORITATIVE PayPal plan_id (what the customer actually
  // subscribed to and pays for), never from custom_id, so the credits granted can never
  // diverge from the price charged. custom_id is used only to attribute the user (email).
  const mapped = vraelisPlanFromPaypalPlanId(sub.plan_id);
  if (!mapped) return null;
  const nb = sub.billing_info?.next_billing_time;
  const periodEnd = nb ? new Date(nb).toISOString() : new Date(Date.now() + (mapped.cycle === "yearly" ? 366 : 31) * 86400000).toISOString();
  return { email: custom.email.trim().toLowerCase(), plan: mapped.plan, cycle: mapped.cycle, periodEnd, monthlyCredits: monthlyCreditsFor(mapped.plan) };
}

// Never resurrect a subscription the user already canceled (out-of-order webhook delivery).
async function setActiveUnlessCanceled(ctx: SubCtx, subId: string) {
  const existing = await getSubscription(ctx.email);
  const resurrecting = existing?.status === "canceled" && existing.stripe_subscription_id === subId;
  if (resurrecting) return;
  await setSubscription({ userId: ctx.email, plan: ctx.plan, status: "active", cycle: ctx.cycle, stripeSubscriptionId: subId, monthlyCredits: ctx.monthlyCredits, currentPeriodEnd: ctx.periodEnd });
}

// Handle one verified PayPal webhook event. Never throws to the caller.
export async function handleVraelisPaypalSubEvent(event: { event_type?: string; resource?: any }): Promise<void> {
  const type = event.event_type || "";
  const resource = (event.resource as Record<string, any>) || {};

  // A subscription payment (initial + every renewal). This is where credits are granted.
  if (type === "PAYMENT.SALE.COMPLETED") {
    const subId = typeof resource.billing_agreement_id === "string" ? resource.billing_agreement_id : null;
    const saleId = typeof resource.id === "string" ? resource.id : null;
    if (!subId || !saleId) return; // not a subscription sale, or missing ids
    const ctx = await subContext(subId);
    if (!ctx) return;

    if (ctx.monthlyCredits > 0) {
      // Yearly is billed once for the whole year -> grant 12x up front, same as Stripe.
      const credits = ctx.cycle === "yearly" ? ctx.monthlyCredits * 12 : ctx.monthlyCredits;
      const extRef = `paypalsale:${saleId}`;
      // Idempotent per sale id: a redelivered PAYMENT.SALE.COMPLETED returns false, no re-grant.
      const granted = await grantMonthly(ctx.email, credits, ctx.periodEnd, extRef);
      if (granted) {
        await expireMonthly(ctx.email, extRef, `expire:${extRef}`); // clear PRIOR tier, keep this grant
        await recordInvoiceGrant(ctx.email, ctx.plan, credits, extRef);
      }
    }
    await setActiveUnlessCanceled(ctx, subId);
    return;
  }

  // Lifecycle events carry the subscription id as resource.id.
  const subId = typeof resource.id === "string" ? resource.id : null;
  if (!subId) return;
  const ctx = await subContext(subId);
  if (!ctx) return;

  switch (type) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.UPDATED":
    case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
      await setActiveUnlessCanceled(ctx, subId);
      return;
    case "BILLING.SUBSCRIPTION.SUSPENDED":
    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      await setSubscription({ userId: ctx.email, plan: ctx.plan, status: "past_due", cycle: ctx.cycle, stripeSubscriptionId: subId, monthlyCredits: ctx.monthlyCredits, currentPeriodEnd: ctx.periodEnd });
      return;
    case "BILLING.SUBSCRIPTION.CANCELLED":
    case "BILLING.SUBSCRIPTION.EXPIRED":
      await setSubscription({ userId: ctx.email, plan: "free", status: "canceled", cycle: null, stripeSubscriptionId: subId, monthlyCredits: 0, currentPeriodEnd: ctx.periodEnd });
      // Claw back unused monthly credits so a canceled user can't keep spending the old
      // allotment. Idempotent per subscription id (23505 on redelivery).
      await expireMonthly(ctx.email, undefined, `cancel:${subId}`);
      return;
    default:
      return;
  }
}
