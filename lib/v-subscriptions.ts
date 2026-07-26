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
import { resolvePlanV1FromPriceId, setPlanV1, clearPlanV1, type PlanV1Cycle } from "./preflight/entitlements-v1";
import { planV1 } from "./preflight/pass-pricing";

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
// unix seconds -> ISO for the _v1 subscription anchor (current_period_start). A missing/garbled payload
// anchors at "now" — the metering window simply starts today — never at 1970.
function periodStartIso(invoice: any): string {
  const n = Number(invoice.period_start ?? invoice.lines?.data?.[0]?.period?.start);
  return new Date(Number.isFinite(n) && n > 0 ? n * 1000 : Date.now()).toISOString();
}
// Resolve a _v1 plan the same two ways the legacy path resolves its plans: by price id
// (STRIPE_PRICE_{BUILDER_V1,PRO_V1,SCALE_V1}_{MONTHLY,YEARLY}), else by the locked subscription
// metadata (covers a missing/renamed env in the webhook runtime). Legacy plan keys never match planV1
// (fresh _v1 keys, ruling 2), so a legacy subscription can never resolve as _v1 — and vice versa.
function v1FromPriceOrMeta(priceId: string | null, meta: Record<string, string> | null | undefined): { key: string; cycle: PlanV1Cycle } | null {
  const byPrice = resolvePlanV1FromPriceId(priceId);
  if (byPrice) return byPrice;
  if (meta?.type === "v_plan" && meta.plan && planV1(meta.plan)) {
    return { key: planV1(meta.plan)!.key, cycle: meta.cycle === "yearly" ? "yearly" : "monthly" };
  }
  return null;
}

// Returns true if this invoice was a Rank subscription invoice (handled here).
export async function handleRankInvoicePaid(invoice: Stripe.Invoice): Promise<boolean> {
  const inv = invoice as any;

  // ── Versioned per-pass plans (_v1) — flag-INDEPENDENT storage, inert until VRAELIS_PASS_PRICING
  // flips (nothing reads plan_v1 before then). A _v1 invoice NEVER grants ledger credits: the allowance
  // is METERED in flow units from v_profiles.plan_v1 (docs/pricing-verdict-final.md), not granted. The
  // anchor is current_period_start of the FIRST period (billing_reason subscription_create); renewal
  // invoices never move it — that anchor is what makes monthlyWindow release an ANNUAL plan's usage in
  // monthly buckets with no scheduler (ruling 7). Cancellation keeps plan_v1 until the subscription
  // deletion event (ruling 8: no clawback on a mere renewal cancellation).
  {
    const v1 = v1FromPriceOrMeta(linePriceId(inv), subMeta(inv));
    if (v1) {
      const v1User = invoiceUserId(inv);
      if (!v1User) { console.error("[rank] _v1 invoice.paid could not attribute a user:", inv.id); return true; }
      if (inv.status === "paid") {
        await setPlanV1(v1User, {
          plan: v1.key, cycle: v1.cycle,
          anchorIso: periodStartIso(inv),
          anchorOnlyIfUnset: inv.billing_reason !== "subscription_create",
        });
      }
      return true; // handled — never fall through to the legacy credit-granting path
    }
  }

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
      await expireMonthly(userId, inv.id ?? undefined, inv.id ? `expire:${inv.id}` : undefined); // clear PRIOR tier, keep this grant; idempotent per invoice
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

/** Does this owner still have a DIFFERENT live _v1 subscription? Used before revoking a plan, so the
 *  death of one subscription cannot cancel entitlement another one is still paying for.
 *
 *  Fails CLOSED on any error: if Stripe cannot be reached we return false and the caller proceeds to
 *  clear. Revoking a plan we cannot prove is still paid is the safe direction; the customer can be
 *  restored, whereas silently serving a plan nobody is paying for cannot be detected. */
async function ownerHasAnotherLiveV1Subscription(dying: Stripe.Subscription): Promise<boolean> {
  const customerId = typeof dying.customer === "string" ? dying.customer : dying.customer?.id;
  if (!customerId) return false;
  try {
    const { getStripe } = await import("./stripe");
    const list = await getStripe().subscriptions.list({ customer: customerId, status: "all", limit: 20 });
    const LIVE = new Set(["active", "trialing", "past_due"]);
    return list.data.some(
      (s) => s.id !== dying.id && s.metadata?.type === "v_plan" && LIVE.has(s.status),
    );
  } catch (e) {
    console.error("[v-subscriptions] sibling-subscription check failed, clearing:", e);
    return false;
  }
}

export async function handleRankSubChange(event: Stripe.Event, subscription: Stripe.Subscription): Promise<void> {
  const userId = subscription.metadata?.user_id;
  if (!userId) return;

  // ── Versioned per-pass plans (_v1): plan_v1 state only — never v_subscriptions, never the ledger
  // (there are no monthly credits to grant or claw back; the allowance is metered). past_due keeps the
  // plan through dunning; cancel-at-period-end stays "active" until the deletion event, so plan_v1
  // persists until the paid-for period actually ends (ruling 8). Cleared ONLY on a true termination.
  {
    const v1 = v1FromPriceOrMeta(subscription.items?.data?.[0]?.price?.id ?? null, subscription.metadata as Record<string, string>);
    if (v1) {
      const gone = event.type === "customer.subscription.deleted" || ["canceled", "unpaid", "incomplete_expired"].includes(subscription.status);
      if (gone) {
        // ── ONLY THE SUBSCRIPTION THAT GRANTED THE PLAN MAY TAKE IT AWAY ────────────────────────────
        //
        // clearPlanV1 is keyed on user_id alone, so ANY dying subscription for this owner used to wipe
        // the plan, including one that never granted it. That is not hypothetical once a customer can
        // have a second subscription in flight: starting an upgrade and abandoning it ends in a
        // cancellation or an expiry, and the old code would have cancelled the plan they are still
        // paying for on the original subscription.
        //
        // Rather than store the granting subscription id (a migration, and a second source of truth to
        // keep correct), ask Stripe whether the owner still has a LIVE v_plan subscription. If they do,
        // this death is not the one that matters and the plan stays. Stripe is the authority on what is
        // being billed, which is the question actually being asked.
        if (await ownerHasAnotherLiveV1Subscription(subscription)) return;
        await clearPlanV1(userId);
      } else {
        const ps = Number((subscription as any).current_period_start ?? (subscription as any).items?.data?.[0]?.current_period_start);
        await setPlanV1(userId, {
          plan: v1.key, cycle: v1.cycle,
          anchorIso: new Date(Number.isFinite(ps) && ps > 0 ? ps * 1000 : Date.now()).toISOString(),
          anchorOnlyIfUnset: true, // invoice.paid on subscription_create owns the anchor reset
        });
      }
      return;
    }
  }

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
  // subscription.id is stable across the deleted / updated→canceled redeliveries
  // for the same termination, so the clawback debits exactly once (23505 on replay).
  if (canceled) await expireMonthly(userId, undefined, `cancel:${subscription.id}`);
}
