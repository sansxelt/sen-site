// POST /api/flip/checkout — start a Stripe EMBEDDED Checkout session for a paid
// plan. Returns a client_secret that mounts on vraelis.com (no redirect to
// checkout.stripe.com). Body: { plan, cycle }. Lifetime = one-time (mode
// "payment"); monthly/yearly = subscription. The shared webhook flips the
// account to 'pro' on completion (checkout.session.completed).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, isStripeConfigured, APP_URL } from "@/lib/stripe";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || APP_URL;
const PLANS = new Set(["seller", "growth", "operator"]);
const CYCLES = new Set(["monthly", "yearly", "lifetime"]);

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
  if (!price) return NextResponse.json({ error: "plan_unavailable", plan, cycle }, { status: 503 });

  try {
    const stripe = getStripe();
    const oneTime = cycle === "lifetime";
    const checkout = await stripe.checkout.sessions.create({
      // This SDK's UiMode enum is mislabeled ("embedded_page"/"hosted_page"), but
      // its OWN field docs (client_secret, return_url, success_url) say the real
      // API value is "embedded" — and Stripe's servers only accept "embedded".
      // Send the real value; cast past the bad enum type.
      ui_mode: "embedded" as never,
      mode: oneTime ? "payment" : "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: email,
      client_reference_id: email,
      metadata: { flip: "1", user_id: email, plan, cycle },
      ...(oneTime ? {} : { subscription_data: { metadata: { flip: "1", user_id: email, plan, cycle } } }),
      allow_promotion_codes: true,
      return_url: `${SITE_URL}/flip/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    });
    return NextResponse.json({ clientSecret: checkout.client_secret });
  } catch (e) {
    console.error("[vraelis checkout] failed:", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
