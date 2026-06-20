// POST /api/v/subscribe — start a FIXED recurring plan subscription.
// Body: { plan: "starter"|"creator"|"pro"|"scale", cycle: "monthly"|"yearly" }.
// Uses fixed Stripe price IDs (STRIPE_PRICE_<PLAN>_<CYCLE>). Embedded so it
// mounts on vraelis.com. Credits are granted by the webhook on invoice.paid.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { getStripe, isStripeConfigured, APP_URL } from "@/lib/stripe";
import { priceIdFor } from "@/lib/v-plans";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || APP_URL;
const PLANS = new Set(["starter", "creator", "pro", "scale"]);
const CYCLES = new Set(["monthly", "yearly"]);

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  await ensureProfile(email, session.user?.name ?? undefined);

  const body = await req.json().catch(() => ({}));
  const plan = PLANS.has(body?.plan) ? String(body.plan) : "";
  const cycle = CYCLES.has(body?.cycle) ? String(body.cycle) : "monthly";
  if (!plan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

  const price = priceIdFor(plan, cycle);
  if (!price) return NextResponse.json({ error: "plan_unavailable", plan, cycle }, { status: 503 });

  try {
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: email,
      client_reference_id: email,
      subscription_data: { metadata: { type: "v_plan", plan, cycle, user_id: email } },
      metadata: { type: "v_plan", plan, cycle, user_id: email },
      allow_promotion_codes: true,
      return_url: `${SITE_URL}/app/plans?session_id={CHECKOUT_SESSION_ID}`,
    });
    return NextResponse.json({ clientSecret: checkout.client_secret });
  } catch (e) {
    console.error("[v subscribe] failed:", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
