// POST /api/flip/checkout — start a Stripe Checkout for a paid Vraelis plan.
// Body: { plan: "seller"|"growth"|"operator", cycle: "monthly"|"yearly"|"lifetime" }.
// Maps plan+cycle to a Stripe price via env (STRIPE_PRICE_<PLAN>_<CYCLE>); the
// shared webhook flips the account to 'pro' on completion. Lifetime = one-time
// (mode "payment"); monthly/yearly = subscription.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, isStripeConfigured, APP_URL } from "@/lib/stripe";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || APP_URL;
const PLANS = new Set(["seller", "growth", "operator"]);
const CYCLES = new Set(["monthly", "yearly", "lifetime"]);

// Resolve the Stripe price id for a plan+cycle. Seller/monthly falls back to the
// original single Pro price so existing checkout keeps working before the new
// prices are created in Stripe.
function resolvePrice(plan: string, cycle: string): string | null {
  const id = process.env[`STRIPE_PRICE_${plan.toUpperCase()}_${cycle.toUpperCase()}`];
  if (id) return id;
  if (plan === "seller" && cycle === "monthly") return process.env.STRIPE_FLIP_PRICE_ID || null;
  return null;
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const plan = PLANS.has(body?.plan) ? body.plan : "seller";
  const cycle = CYCLES.has(body?.cycle) ? body.cycle : "monthly";

  const price = resolvePrice(plan, cycle);
  if (!price) {
    // Plan exists in the UI but its Stripe price hasn't been created yet.
    return NextResponse.json({ error: "plan_unavailable", plan, cycle }, { status: 503 });
  }

  try {
    const stripe = getStripe();
    const oneTime = cycle === "lifetime";
    const checkout = await stripe.checkout.sessions.create({
      mode: oneTime ? "payment" : "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: email,
      client_reference_id: email,
      metadata: { flip: "1", user_id: email, plan, cycle },
      ...(oneTime ? {} : { subscription_data: { metadata: { flip: "1", user_id: email, plan, cycle } } }),
      allow_promotion_codes: true,
      success_url: `${SITE_URL}/flip/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/flip/billing/cancel`,
    });
    return NextResponse.json({ url: checkout.url });
  } catch (e) {
    console.error("[vraelis checkout] failed:", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
