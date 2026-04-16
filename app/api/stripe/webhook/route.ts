import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, STRIPE_PRICES } from "../../../../lib/stripe";
import { upsertActiveSubscription } from "../../../../lib/subscriptions";

// Reverse-lookup a Stripe price ID to its plan key.  We walk STRIPE_PRICES
// to find the plan whose monthly/yearly price matches.  Returns null for
// addon prices.
function resolvePlanFromPriceId(priceId: string | null): { planKey: string; cycle: "monthly" | "yearly" } | null {
  if (!priceId) return null;
  for (const [key, cycles] of Object.entries(STRIPE_PRICES)) {
    if (cycles.monthly === priceId) return { planKey: key, cycle: "monthly" };
    if (cycles.yearly  === priceId) return { planKey: key, cycle: "yearly"  };
  }
  return null;
}

// Of a subscription's line items, pick the one that looks like a plan
// (not an addon).  Falls back to the first item if nothing matches — a
// subscription always has at least one item.
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

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const email = subscription.metadata?.userEmail;
  if (!email) {
    // Try to pull the email from the customer record as a fallback.
    const customerId = typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
    if (!customerId) {
      console.warn("[stripe webhook] no email on subscription — skipping");
      return;
    }
    const customer = await getStripe().customers.retrieve(customerId);
    if (customer.deleted || !customer.email) {
      console.warn("[stripe webhook] customer has no email — skipping");
      return;
    }
    subscription.metadata = { ...subscription.metadata, userEmail: customer.email };
  }

  const resolvedEmail = subscription.metadata?.userEmail ?? email ?? "";
  const planItem = pickPlanItem(subscription);
  const resolved = planItem ? resolvePlanFromPriceId(planItem.price.id) : null;

  const planKey = resolved?.planKey ?? subscription.metadata?.planKey ?? "free";
  const cycle   = resolved?.cycle   ?? subscription.metadata?.cycle   ?? "monthly";

  console.log(`[stripe webhook] subscription ${subscription.status} for ${resolvedEmail} / plan: ${planKey}`);

  const periodEnd = (subscription as unknown as Record<string, unknown>)["current_period_end"];

  await upsertActiveSubscription({
    email:            resolvedEmail,
    planKey,
    billingCycle:     cycle,
    currentPeriodEnd: typeof periodEnd === "number" ? periodEnd : null,
    stripeStatus:     subscription.status,
  });
}

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

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await handleSubscriptionChange(event.data.object as Stripe.Subscription);
      break;
    case "invoice.paid":
      // Subscription state already reflected by customer.subscription.updated
      // — log only, no extra work.
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
