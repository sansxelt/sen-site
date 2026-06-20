// POST /api/v/portal — open the Stripe customer portal (cancel, update payment,
// switch plan). The portal is Stripe-hosted (there is no embedded variant), so
// this returns a URL to redirect to. We resolve the customer by email.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, isStripeConfigured, APP_URL } from "@/lib/stripe";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || APP_URL;

export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });

  try {
    const stripe = getStripe();
    const customers = await stripe.customers.list({ email: email.toLowerCase(), limit: 1 });
    const customer = customers.data[0];
    if (!customer) return NextResponse.json({ error: "no_subscription" }, { status: 404 });
    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${SITE_URL}/app/plans`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (e) {
    console.error("[v portal] failed:", e);
    return NextResponse.json({ error: "portal_failed" }, { status: 500 });
  }
}
