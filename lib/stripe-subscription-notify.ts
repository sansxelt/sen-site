// WHICH SUBSCRIPTION EMAILS AN EVENT EARNS, DECIDED WITHOUT SENDING ANYTHING.
//
// This logic lived inline in app/api/stripe/webhook/route.ts, BELOW the per-product early returns. Four
// products sell through that one webhook and each returns as soon as it has written its own state, so the
// switch that sent the lifecycle emails was only ever reached by the legacy sansxel path.
//
// Vraelis Rank, which is the product actually being sold, returned two branches earlier. A real paying
// customer was therefore never told that their subscription had started, that their cancellation had been
// scheduled, or that it had ended. The three templates existed, were correct, were covered by tests, and
// were unreachable. The renewal receipt had the same shape of bug one function further down.
//
// THE DECISION IS SEPARATED FROM THE SENDING ON PURPOSE. A Next route file may not export anything but its
// HTTP handlers, so anything living there cannot be imported by a test, and this is billing: what a
// customer is told when they start paying, stop paying, or are about to be charged again. Everything here
// is pure, so scripts/stripe-subscription-lifecycle-verify.ts can hold every event shape against it with no
// Stripe account, no database and no mail server.
//
// SENDING stays in the route, behind claimNotification(event.id, kind, recipient), which is an atomic
// single-send marker. Deciding twice is free. Sending twice is not.
import { getPricingPlan, type PricingPlanKey, pricingPlanMap } from "./pricing";
import { STRIPE_PRICES } from "./stripe";
import { planV1 } from "./preflight/pass-pricing";
import { resolvePlanV1FromPriceId } from "./preflight/entitlements-v1";
import { TERMINAL_SUB_STATUSES } from "./v-subscriptions";

export type PlanCycle = "monthly" | "yearly";

/** Only the parts of a Stripe subscription these decisions read. Structural rather than Stripe.Subscription
 *  so a test can build one by hand, and so a Stripe type bump cannot quietly change what this file believes
 *  a subscription is. */
export type SubscriptionLike = {
  status?: string | null;
  cancel_at_period_end?: boolean | null;
  metadata?: Record<string, string | undefined> | null;
  current_period_end?: number | null;
  items?: { data?: Array<{ price?: { id?: string | null } | null; current_period_end?: number | null } | null | undefined> | null } | null;
};

/** Only the parts of a Stripe invoice these decisions read. */
export type InvoiceLike = {
  customer_email?: string | null;
  parent?: { subscription_details?: { metadata?: Record<string, string | undefined> | null } | null } | null;
  subscription_details?: { metadata?: Record<string, string | undefined> | null } | null;
};

export type SubscriptionEmailContext = {
  email: string;
  planKey: string;
  planName: string;
  cycle: PlanCycle;
  periodEndUnix: number | null;
};

export type PlannedSubscriptionEmail =
  | { kind: "subscription_activated"; planName: string; cycle: PlanCycle; amountLabel: string }
  | { kind: "cancellation_scheduled"; planName: string; endsOn: string }
  | { kind: "subscription_ended"; planName: string };

// ── Plan catalogues ────────────────────────────────────────────────────────────────────────────────────

/** Reverse-lookup a Stripe price id in the LEGACY catalogue (lib/stripe.ts). */
export function resolvePlanFromPriceId(priceId: string | null): { planKey: string; cycle: PlanCycle } | null {
  if (!priceId) return null;
  for (const [key, cycles] of Object.entries(STRIPE_PRICES)) {
    if (cycles.monthly === priceId) return { planKey: key, cycle: "monthly" };
    if (cycles.yearly === priceId) return { planKey: key, cycle: "yearly" };
  }
  return null;
}

// THE PLANS BEING SOLD ARE NOT IN THE CATALOGUE THIS FILE USED TO READ.
//
// The webhook resolved price ids against STRIPE_PRICES alone, the retired chatbot catalogue. The live plans
// are builder_v1 / pro_v1 / scale_v1, so no price id ever matched and every invoice-triggered email fell
// through to its last-resort label: the renewal notice read "your your plan renews next week". The _v1
// catalogue is tried first and the legacy one second, because legacy subscriptions are still live.
export function resolvePlanKeyFromPriceId(priceId: string | null): { planKey: string; cycle: PlanCycle } | null {
  const v1 = resolvePlanV1FromPriceId(priceId);
  if (v1) return { planKey: v1.key, cycle: v1.cycle };
  return resolvePlanFromPriceId(priceId);
}

/** A plan key as a customer would recognise it on an invoice, across both catalogues. Null when the key
 *  belongs to neither, so the caller decides what to print rather than this inventing a label. */
export function planDisplayName(planKey: string): string | null {
  const v1 = planV1(planKey);
  if (v1) return v1.name;
  if (planKey in pricingPlanMap) return getPricingPlan(planKey as PricingPlanKey).name;
  return null;
}

/** The recurring price, as a customer would recognise it. Empty when the key belongs to neither catalogue:
 *  an activation email reads better with no figure than with a wrong one. */
export function amountLabelFor(planKey: string, cycle: PlanCycle): string {
  const v1 = planV1(planKey);
  if (v1) {
    const cents = cycle === "yearly" ? v1.yearlyCents : v1.monthlyCents;
    if (typeof cents !== "number") return "";
    return `$${(cents / 100).toLocaleString("en-US")}/${cycle === "yearly" ? "yr" : "mo"}`;
  }
  if (planKey in pricingPlanMap) {
    const plan = getPricingPlan(planKey as PricingPlanKey);
    return (cycle === "yearly" ? plan.yearlyLabel ?? plan.monthlyLabel : plan.monthlyLabel) ?? "";
  }
  return "";
}

// ── Shapes ─────────────────────────────────────────────────────────────────────────────────────────────

export function formatBillingDate(unix: number | null): string {
  if (!unix) return "your next billing date";
  try {
    return new Date(unix * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return "your next billing date";
  }
}

/** When the paid period ends. Newer Stripe API versions moved current_period_end onto the subscription
 *  ITEM and leave it off the subscription itself, so reading only the top level produced "your next billing
 *  date" in place of a real date in the cancellation notice. lib/v-subscriptions.ts already reads both. */
export function subscriptionPeriodEnd(subscription: SubscriptionLike): number | null {
  const top = subscription.current_period_end;
  if (typeof top === "number" && top > 0) return top;
  const item = subscription.items?.data?.[0]?.current_period_end;
  return typeof item === "number" && item > 0 ? item : null;
}

/** Email context for a Vraelis Rank subscription, built from the LOCKED checkout metadata.
 *
 *  app/api/v/subscribe/route.ts writes { type: "v_plan", plan, cycle, user_id }, where user_id is the
 *  lowercased owner email and is the same key plan_v1 is stored under. That is deliberately preferred over
 *  Stripe's customer record, which the customer can edit in the billing portal.
 *
 *  Returns null when the metadata does not carry something that can be emailed. user_id is an email today;
 *  the check is here so that if it ever becomes an opaque id, this declines to send rather than posting a
 *  billing notice to a string that is not an address. */
export function rankEmailContext(subscription: SubscriptionLike): SubscriptionEmailContext | null {
  const meta = subscription.metadata ?? {};
  const email = (meta.user_id ?? "").trim();
  if (!email.includes("@")) return null;

  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const resolved = resolvePlanKeyFromPriceId(priceId);
  const planKey = resolved?.planKey ?? (meta.plan ?? "").trim();
  const cycle: PlanCycle = resolved?.cycle ?? (meta.cycle === "yearly" ? "yearly" : "monthly");

  return {
    email,
    planKey,
    planName: (planKey && planDisplayName(planKey)) || "subscription",
    cycle,
    periodEndUnix: subscriptionPeriodEnd(subscription),
  };
}

/** Who a subscription invoice's notice belongs to.
 *
 *  Prefers the locked subscription metadata over invoice.customer_email, for the reason
 *  lib/v-subscriptions.ts gives for the same choice: customer_email is a finalization snapshot the customer
 *  can change in the portal, while metadata.user_id is the key the account is stored under. It also matters
 *  for dedupe, because the recipient is part of the single-send key: two spellings of the same person would
 *  otherwise each be allowed one copy of the same renewal receipt. */
export function invoiceRecipient(invoice: InvoiceLike): string | null {
  const meta = invoice.parent?.subscription_details?.metadata ?? invoice.subscription_details?.metadata ?? null;
  const locked = (meta?.user_id ?? "").trim();
  if (locked.includes("@")) return locked;
  return (invoice.customer_email ?? "").trim() || null;
}

// ── The decision ───────────────────────────────────────────────────────────────────────────────────────

/**
 * Which lifecycle emails this event earns, in send order. Never sends, never touches the network.
 *
 * An empty array is the common answer and is not a failure: most subscription updates change nothing a
 * customer needs to be told about, and announcing them all is how a billing system teaches people to filter
 * its mail.
 */
export function plannedSubscriptionEmails(
  eventType: string,
  subscription: SubscriptionLike,
  previousAttributes: Record<string, unknown> | null | undefined,
  ctx: SubscriptionEmailContext,
): PlannedSubscriptionEmail[] {
  const prev = previousAttributes ?? {};
  const status = subscription.status ?? "";

  switch (eventType) {
    case "customer.subscription.created": {
      // Only a subscription that is actually live earns the welcome. `incomplete` means the first invoice
      // is unpaid, and the webhook returns before this is ever reached; `trialing` does reach it, and a
      // trial IS access, so it is told.
      if (status !== "active" && status !== "trialing") return [];
      return [{
        kind: "subscription_activated",
        planName: ctx.planName,
        cycle: ctx.cycle,
        amountLabel: amountLabelFor(ctx.planKey, ctx.cycle),
      }];
    }

    case "customer.subscription.updated": {
      const planned: PlannedSubscriptionEmail[] = [];

      // A cancellation that was JUST scheduled, false to true. Reading the TRANSITION rather than the
      // current value is what stops every later update on an already-cancelling subscription announcing
      // the same cancellation again. On a redelivery previous_attributes is identical, so this re-evaluates
      // true and the single-send marker is what makes the resend a no-op.
      if (Boolean(subscription.cancel_at_period_end) && !Boolean(prev.cancel_at_period_end)) {
        planned.push({
          kind: "cancellation_scheduled",
          planName: ctx.planName,
          endsOn: formatBillingDate(ctx.periodEndUnix),
        });
      }

      // A previously-live subscription that became terminal through an update, e.g. status moved to
      // "unpaid" once Stripe gave up retrying. The terminal set is imported rather than written out again:
      // scripts/cancellation-lifecycle-verify.ts exists because this rule was once copied per branch.
      const prevStatus = typeof prev.status === "string" ? prev.status : null;
      if (prevStatus && prevStatus !== status && (TERMINAL_SUB_STATUSES as readonly string[]).includes(status)) {
        planned.push({ kind: "subscription_ended", planName: ctx.planName });
      }

      return planned;
    }

    case "customer.subscription.deleted":
      // The paid period ran out on a scheduled cancel, or an admin hard-cancelled.
      return [{ kind: "subscription_ended", planName: ctx.planName }];

    default:
      // Not a subscription lifecycle event. Anything malformed or unrelated leaves with nothing to send
      // rather than throwing, because the caller has already written the state that matters.
      return [];
  }
}
