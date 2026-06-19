// POST /api/flip/checkout — start a Stripe subscription Checkout for Flip Pro.
// Reuses the existing Stripe client. The flip metadata lets the shared webhook
// (app/api/stripe/webhook) flip the user to 'pro' on completion.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, isStripeConfigured, APP_URL } from "@/lib/stripe";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || APP_URL;

export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isStripeConfigured() || !process.env.STRIPE_FLIP_PRICE_ID) {
    return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  }
  try {
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: process.env.STRIPE_FLIP_PRICE_ID, quantity: 1 }],
      customer_email: email,
      client_reference_id: email,
      metadata: { flip: "1", user_id: email },
      subscription_data: { metadata: { flip: "1", user_id: email } },
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/flip/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/flip/billing/cancel`,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    console.error("[flip checkout] failed:", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
