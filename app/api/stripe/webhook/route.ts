import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, STRIPE_PRICES } from "../../../../lib/stripe";
import { upsertActiveSubscription } from "../../../../lib/subscriptions";
import {
  sendPaymentFailedEmail,
  sendSubscriptionActivatedEmail,
  sendSubscriptionCancellationScheduledEmail,
  sendSubscriptionEndedEmail,
} from "../../../../lib/email";
import { getPricingPlan, type PricingPlanKey, pricingPlanMap } from "../../../../lib/pricing";

// Reverse-lookup a Stripe price ID to its plan key / cycle.
function resolvePlanFromPriceId(priceId: string | null): { planKey: string; cycle: "monthly" | "yearly" } | null {
  if (!priceId) return null;
  for (const [key, cycles] of Object.entries(STRIPE_PRICES)) {
    if (cycles.monthly === priceId) return { planKey: key, cycle: "monthly" };
    if (cycles.yearly  === priceId) return { planKey: key, cycle: "yearly"  };
  }
  return null;
}

function pickPlanItem(subscription: Stripe.Subscription): Stripe.SubscriptionItem | null {
  const items = subscription.items.data;
  if (items.length === 0) return null;
  const addonKeys = new Set(["memory_boost", "api_boost", "key_pack"]);
  for (const item of items) {
    const resolved = resolvePlanFromPriceId(item.price.id);
    if (resolved && !addonKeys.has(resolved.planKey)) return item;
  }
  return items[0] ?? null;
}

function formatDate(unix: number | null): string {
  if (!unix) return "your next billing date";
  try {
    return new Date(unix * 1000).toLocaleDateString("en-US", {
      month: "long", day: "numeric", year: "numeric",
    });
  } catch { return "your next billing date"; }
}

// ── Resolve email + plan context from a subscription ──────────────────────
async function resolveContext(subscription: Stripe.Subscription): Promise<{
  email:    string;
  planKey:  string;
  planName: string;
  cycle:    "monthly" | "yearly";
  periodEndUnix: number | null;
} | null> {
  let email = subscription.metadata?.userEmail ?? "";
  if (!email) {
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
    if (!customerId) return null;
    const customer = await getStripe().customers.retrieve(customerId);
    if (customer.deleted || !customer.email) return null;
    email = customer.email;
  }

  const planItem = pickPlanItem(subscription);
  const resolved = planItem ? resolvePlanFromPriceId(planItem.price.id) : null;
  const planKey  = resolved?.planKey ?? subscription.metadata?.planKey ?? "free";
  const cycle    = (resolved?.cycle ?? subscription.metadata?.cycle ?? "monthly") as "monthly" | "yearly";

  const planName = planKey in pricingPlanMap
    ? getPricingPlan(planKey as PricingPlanKey).name
    : planKey;

  const periodEndRaw = (subscription as unknown as Record<string, unknown>)["current_period_end"];
  const periodEndUnix = typeof periodEndRaw === "number" ? periodEndRaw : null;

  return { email, planKey, planName, cycle, periodEndUnix };
}

async function handleSubscriptionChange(event: Stripe.Event, subscription: Stripe.Subscription) {
  const ctx = await resolveContext(subscription);
  if (!ctx) {
    console.warn("[stripe webhook] missing email context — skipping");
    return;
  }

  // Keep the Supabase snapshot in sync.
  await upsertActiveSubscription({
    email:            ctx.email,
    planKey:          ctx.planKey,
    billingCycle:     ctx.cycle,
    currentPeriodEnd: ctx.periodEndUnix,
    stripeStatus:     subscription.status,
  });

  // ── Email side effects ─────────────────────────────────────────
  // Only send for events where a user-facing state changed.  Event
  // data.previous_attributes lets us detect specific transitions
  // (e.g. just-scheduled cancellation) without misfiring on every update.
  const prev = (event.data as unknown as { previous_attributes?: Record<string, unknown> })
    .previous_attributes ?? {};
  const plan = ctx.planKey in pricingPlanMap
    ? getPricingPlan(ctx.planKey as PricingPlanKey)
    : null;

  switch (event.type) {
    case "customer.subscription.created": {
      if (subscription.status === "active" || subscription.status === "trialing") {
        const amountLabel = plan
          ? (ctx.cycle === "yearly" ? plan.yearlyLabel ?? plan.monthlyLabel : plan.monthlyLabel)
          : "";
        await sendSubscriptionActivatedEmail({
          email:       ctx.email,
          name:        "",
          planName:    ctx.planName,
          cycle:       ctx.cycle,
          amountLabel,
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const prevCancel = Boolean(prev.cancel_at_period_end);
      const currCancel = Boolean((subscription as unknown as { cancel_at_period_end?: boolean }).cancel_at_period_end);

      // Transition: cancellation was JUST scheduled (was false, now true).
      if (currCancel && !prevCancel) {
        await sendSubscriptionCancellationScheduledEmail({
          email:    ctx.email,
          name:     "",
          planName: ctx.planName,
          endsOn:   formatDate(ctx.periodEndUnix),
        });
      }

      // Transition: previously-active sub became inactive via update
      // (e.g. status moved to "unpaid" after retries exhausted).
      const prevStatus = typeof prev.status === "string" ? prev.status : null;
      if (
        prevStatus && prevStatus !== subscription.status &&
        ["unpaid", "canceled", "incomplete_expired"].includes(subscription.status)
      ) {
        await sendSubscriptionEndedEmail({
          email:    ctx.email,
          name:     "",
          planName: ctx.planName,
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      // Period ended on a scheduled cancel, or admin hard-canceled.
      await sendSubscriptionEndedEmail({
        email:    ctx.email,
        name:     "",
        planName: ctx.planName,
      });
      break;
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const email = invoice.customer_email ?? null;
  if (!email) return;

  // Try to get the plan name from the first subscription line item.
  // The API version we pin deprecates InvoiceLineItem.price at the type
  // level (moved under `pricing`), but Stripe still returns the legacy
  // `price` field at runtime.  Narrow cast keeps us off the hot path.
  let planName = "your";
  const lineItem = invoice.lines?.data?.[0];
  const priceId =
    (lineItem as unknown as { price?: { id?: string } | null } | undefined)
      ?.price?.id ?? null;
  const resolved = resolvePlanFromPriceId(priceId);
  if (resolved && resolved.planKey in pricingPlanMap) {
    planName = getPricingPlan(resolved.planKey as PricingPlanKey).name;
  }

  await sendPaymentFailedEmail({ email, name: "", planName });
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret || !sig) {
    return NextResponse.json({ error: "Webhook not configured." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event, event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case "invoice.paid":
        // No-op — activation + renewal state already flows through
        // customer.subscription.updated.  Kept here just so Stripe
        // doesn't complain about "unhandled event type".
        break;

      default:
        break;
    }
  } catch (err) {
    console.error(`[stripe webhook] handler failed for ${event.type}:`, err);
    // Still return 200 so Stripe doesn't retry on our application bugs.
  }

  return NextResponse.json({ received: true });
}
