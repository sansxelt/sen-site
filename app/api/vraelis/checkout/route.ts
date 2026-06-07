// Creates a Stripe Checkout session for a vraelis plan + billing cycle.
// Recurring (monthly/yearly) → subscription mode; lifetime → one-time
// payment mode. Requires the user to be signed in.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { STRIPE_PRICES, isCycle, isPlanKey } from "@/lib/vraelis-plans";

const ORIGIN = "https://vraelis.com";

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ ok: false, needSignin: true }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ ok: false, error: "Payments not configured" }, { status: 500 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const plan = String(body.plan ?? "");
  const cycle = String(body.cycle ?? "");
  if (!isPlanKey(plan) || !isCycle(cycle)) {
    return NextResponse.json({ ok: false, error: "Unknown plan" }, { status: 400 });
  }

  const priceId = STRIPE_PRICES[plan][cycle];
  const mode = cycle === "lifetime" ? "payment" : "subscription";

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    // Embedded checkout: the payment UI renders inside our own page
    // (no redirect to checkout.stripe.com). On completion Stripe returns
    // the buyer to return_url, where we verify + record the plan.
    const checkout = await stripe.checkout.sessions.create({
      // This account's Stripe API version uses 'embedded_page' (the live
      // API rejects the older 'embedded' value).
      ui_mode: "embedded_page",
      mode,
      // Card, bank (ACH Direct Debit), and Amazon Pay — all verified to
      // work for both subscription (monthly/yearly) and one-time
      // (lifetime) modes on this account.
      payment_method_types: ["card", "us_bank_account", "amazon_pay"],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      return_url: `${ORIGIN}/account?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      metadata: { owner_email: email, plan, cycle },
      ...(mode === "subscription"
        ? { subscription_data: { metadata: { owner_email: email, plan, cycle } } }
        : {}),
    });
    return NextResponse.json({ ok: true, clientSecret: checkout.client_secret });
  } catch (error) {
    console.error("checkout session failed:", error);
    return NextResponse.json({ ok: false, error: "Could not start checkout" }, { status: 500 });
  }
}
