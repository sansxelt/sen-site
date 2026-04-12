import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "../../../../lib/stripe";

// Store subscription state — extend this to write to your DB (Supabase) as needed
async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const email = subscription.metadata?.userEmail;
  const planKey = subscription.metadata?.planKey;
  const status = subscription.status;

  console.log(`[stripe webhook] subscription ${status} for ${email} / plan: ${planKey}`);

  // TODO: Update user's plan in Supabase based on status
  // if (status === "active") { await updateUserPlan(email, planKey); }
  // if (status === "canceled" || status === "unpaid") { await downgradeUser(email); }
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
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      console.log(`[stripe webhook] checkout completed for ${session.customer_email}`);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionChange(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionChange(event.data.object as Stripe.Subscription);
      break;
    default:
      // Unhandled event type — ignore
      break;
  }

  return NextResponse.json({ received: true });
}
