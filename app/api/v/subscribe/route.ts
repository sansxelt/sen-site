// POST /api/v/subscribe — start a FIXED recurring plan subscription.
// Body: { plan: "starter"|"creator"|"pro"|"scale" (legacy) or "builder_v1"|"pro_v1"|"scale_v1" (pricing
// cutover, accepted ONLY when VRAELIS_PASS_PRICING=1), cycle: "monthly"|"yearly" }.
// Uses fixed Stripe price IDs (STRIPE_PRICE_<PLAN>_<CYCLE>; the _v1 keys resolve the six operator-created
// STRIPE_PRICE_{BUILDER_V1,PRO_V1,SCALE_V1}_{MONTHLY,YEARLY} through the same scheme). Embedded so it
// mounts on vraelis.com. The webhook consumes metadata { type: "v_plan", plan, cycle, user_id } for both
// generations: legacy plans are granted credits on invoice.paid; _v1 plans set metered plan_v1 state
// (lib/v-subscriptions.ts + lib/preflight/entitlements-v1.ts) and never grant credits.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { getStripe, isStripeConfigured, APP_URL } from "@/lib/stripe";
import { priceIdFor } from "@/lib/v-plans";
import { passPricingEnabled, PLAN_CATALOG_V1 } from "@/lib/preflight/pass-pricing";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || APP_URL;
const PLANS = new Set(["starter", "creator", "pro", "scale"]);
const V1_PLANS = new Set<string>(PLAN_CATALOG_V1.map((p) => p.key));
const CYCLES = new Set(["monthly", "yearly"]);

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  await ensureProfile(email, session.user?.name ?? undefined);

  const body = await req.json().catch(() => ({}));
  // _v1 keys exist ONLY behind the pricing flag: with it off they fall through to invalid_plan exactly
  // like any unknown plan, and the legacy keys are untouched either way.
  const requested = typeof body?.plan === "string" ? body.plan : "";
  const plan = PLANS.has(requested) || (passPricingEnabled() && V1_PLANS.has(requested)) ? requested : "";
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
      return_url: `${SITE_URL}/plans?session_id={CHECKOUT_SESSION_ID}`,
    });
    return NextResponse.json({ clientSecret: checkout.client_secret });
  } catch (e) {
    console.error("[v subscribe] failed:", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
