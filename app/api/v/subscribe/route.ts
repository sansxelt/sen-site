// POST /api/v/subscribe — start a FIXED recurring plan subscription.
// Body: { plan: "starter"|"creator"|"pro"|"scale" (legacy) or "builder_v1"|"pro_v1"|"scale_v1" (pricing
// cutover, accepted ONLY when VRAELIS_PASS_PRICING=1), cycle: "monthly"|"yearly" }.
// Uses fixed Stripe price IDs (STRIPE_PRICE_<PLAN>_<CYCLE>; the _v1 keys resolve the six operator-created
// STRIPE_PRICE_{BUILDER_V1,PRO_V1,SCALE_V1}_{MONTHLY,YEARLY} through the same scheme). Embedded so it
// mounts on vraelis.com. The webhook consumes metadata { type: "v_plan", plan, cycle, user_id } for both
// generations: legacy plans are granted credits on invoice.paid; _v1 plans set metered plan_v1 state
// (lib/v-subscriptions.ts + lib/preflight/entitlements-v1.ts) and never grant credits.
//
// V1.1 S1 duplicate-checkout guard: an owner with plan_v1 already set gets 409 already_subscribed
// (change plans through the portal, never a second overlapping subscription), and a refresh/browser-back
// re-entry within 10 minutes reuses the SAME still-open checkout session (logged in v_events as
// checkout_session_created) instead of minting a new one.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { logEvent, recentEventsByType } from "@/lib/v-events";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { priceIdFor } from "@/lib/v-plans";
import { passPricingEnabled, PLAN_CATALOG_V1 } from "@/lib/preflight/pass-pricing";
import { getPlanV1State } from "@/lib/preflight/entitlements-v1";
import { billingReturnUrls, stripeReturnUrl } from "@/lib/return-urls";

export const runtime = "nodejs";

const PLANS = new Set(["starter", "creator", "pro", "scale"]);
const V1_PLANS = new Set<string>(PLAN_CATALOG_V1.map((p) => p.key));
const CYCLES = new Set(["monthly", "yearly"]);
const REUSE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes: idempotent re-entry after refresh/browser-back

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

  const owner = email.toLowerCase();

  // Guard 1: one subscription per owner. An account with plan_v1 set already pays for a metered
  // allowance; a second subscription would double-charge without doubling anything. Plan changes go
  // through the Stripe portal (upgrade/downgrade on the EXISTING subscription), reachable from /billing.
  const existing = await getPlanV1State(owner);
  if (existing?.plan) {
    return NextResponse.json(
      { error: "already_subscribed", plan: existing.plan, manage: "/billing", message: "You already have an active plan. Change or cancel it from Billing, which opens the payment portal on your existing subscription." },
      { status: 409 },
    );
  }

  try {
    const stripe = getStripe();

    // Guard 2: 10-minute idempotent re-entry. If we created a checkout session for this same owner +
    // plan + cycle in the last 10 minutes and Stripe still reports it open, hand back the SAME session
    // instead of minting another (refresh / browser-back must not stack sessions).
    const since = new Date(Date.now() - REUSE_WINDOW_MS).toISOString();
    const recent = await recentEventsByType(owner, "checkout_session_created", since, 5);
    for (const ev of recent) {
      const m = ev.metadata ?? {};
      if (m.kind === "v_plan" && m.plan === plan && m.cycle === cycle && typeof m.session_id === "string") {
        try {
          const prev = await stripe.checkout.sessions.retrieve(m.session_id);
          if (prev.status === "open" && prev.client_secret) {
            return NextResponse.json({ clientSecret: prev.client_secret, reused: true });
          }
        } catch { /* stale/expired session: fall through and create a fresh one */ }
      }
    }

    // Return discipline (V1.1 S1): subscription checkouts come back to the canonical
    // app.vraelis.com/billing/success route from lib/return-urls.ts. The ?session_id is display-only
    // there; the webhook remains the ONLY activation authority.
    const checkout = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      customer_email: email,
      client_reference_id: email,
      subscription_data: { metadata: { type: "v_plan", plan, cycle, user_id: email } },
      metadata: { type: "v_plan", plan, cycle, user_id: email },
      allow_promotion_codes: true,
      return_url: `${stripeReturnUrl(billingReturnUrls().success)}?session_id={CHECKOUT_SESSION_ID}`,
    });
    await logEvent({
      userId: email, eventType: "checkout_session_created", actorType: "owner", source: "web",
      metadata: { kind: "v_plan", plan, cycle, session_id: checkout.id },
    });
    return NextResponse.json({ clientSecret: checkout.client_secret });
  } catch (e) {
    console.error("[v subscribe] failed:", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
