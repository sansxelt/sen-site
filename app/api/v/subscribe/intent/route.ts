// POST /api/v/subscribe/intent — start a plan subscription WITHOUT leaving the site.
//
// The sibling route (../route.ts) creates a Stripe Checkout session and hands back a client_secret for
// Stripe's own embedded UI. This one creates the subscription directly, in `default_incomplete`, and hands
// back the PaymentIntent secret so a Payment Element rendered on our own page can confirm it. Same plans,
// same prices, same metadata, same webhook. The only difference is who draws the form.
//
// WHY THIS IS NOT A COSMETIC CHANGE, AND WHAT MAKES IT SAFE.
//
// Checkout will not create a subscription until payment succeeds, so by the time any webhook fires the
// status is already `active`. Creating the subscription first inverts that: the subscription exists, in
// `incomplete`, before a single cent has moved. Every entitlement guard in the webhook tested for
// "canceled | unpaid | incomplete_expired" and treated everything else as entitled, so an `incomplete`
// subscription would have granted the paid plan for free. app/api/stripe/webhook now returns early on
// `incomplete` and `incomplete_expired`, granting nothing and revoking nothing. That guard is a
// PRECONDITION of this route, not a detail of it.
//
// THE WEBHOOK REMAINS THE ONLY ACTIVATION AUTHORITY. This route never writes plan state. It creates a
// Stripe object and returns a secret; the plan appears when Stripe says the money moved.
//
// DOUBLE CHARGING is the failure mode that matters here, and there are three defences:
//   1. one subscription per owner, same as the Checkout route (409 already_subscribed)
//   2. an existing `incomplete` subscription for the same owner+plan+cycle is REUSED rather than replaced,
//      so refresh, browser-back and a double-clicked button all land on the same PaymentIntent
//   3. a deterministic idempotency key on create, so even a racing double POST yields one subscription
//
// PROMOTION CODES ARE DELIBERATELY ABSENT. Checkout gives a promo field for free (allow_promotion_codes)
// and this screen does not. That capability was dropped on purpose, not overlooked; it comes back as a
// server-validated coupon field when there is a promotion to run.

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { logEvent } from "@/lib/v-events";
import { getStripe, isStripeConfigured, getOrCreateCustomer } from "@/lib/stripe";
import { priceIdFor } from "@/lib/v-plans";
import { passPricingEnabled, PLAN_CATALOG_V1 } from "@/lib/preflight/pass-pricing";
import { getPlanV1State } from "@/lib/preflight/entitlements-v1";
import { customCheckoutEnabled } from "@/lib/custom-checkout";

export const runtime = "nodejs";

const PLANS = new Set(["starter", "creator", "pro", "scale"]);
const V1_PLANS = new Set<string>(PLAN_CATALOG_V1.map((p) => p.key));
const CYCLES = new Set(["monthly", "yearly"]);

/** The PaymentIntent that fronts a subscription's first invoice. Typed loosely because the expanded
 *  shape depends on the account's API version, and a wrong cast here would fail at runtime rather than
 *  at build. Returns null when Stripe has not attached one, which is a real state (a zero-amount or
 *  fully-discounted first invoice) and must not be treated as an error. */
function firstPaymentIntent(sub: Stripe.Subscription): Stripe.PaymentIntent | null {
  const invoice = sub.latest_invoice;
  if (!invoice || typeof invoice === "string") return null;
  const pi = (invoice as unknown as { payment_intent?: unknown }).payment_intent;
  return pi && typeof pi === "object" ? (pi as Stripe.PaymentIntent) : null;
}

export async function POST(req: Request) {
  if (!customCheckoutEnabled()) {
    // The flag is off, so this surface does not exist. 404 rather than 403: an endpoint that is not
    // enabled should not confirm that it is there.
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  await ensureProfile(email, session.user?.name ?? undefined);

  const body = await req.json().catch(() => ({}));
  const requested = typeof body?.plan === "string" ? body.plan : "";
  const plan = PLANS.has(requested) || (passPricingEnabled() && V1_PLANS.has(requested)) ? requested : "";
  const cycle = CYCLES.has(body?.cycle) ? String(body.cycle) : "monthly";
  if (!plan) return NextResponse.json({ error: "invalid_plan" }, { status: 400 });

  const price = priceIdFor(plan, cycle);
  if (!price) return NextResponse.json({ error: "plan_unavailable", plan, cycle }, { status: 503 });

  const owner = email.toLowerCase();

  // Defence 1. An owner who already pays for an allowance must not buy a second one; a plan change is an
  // edit to the EXISTING subscription, through the portal. Identical to the Checkout route's guard, and
  // deliberately duplicated rather than shared, because the two routes must be able to disagree about
  // everything else and still agree about this.
  const existingPlan = await getPlanV1State(owner);
  if (existingPlan?.plan) {
    return NextResponse.json(
      {
        error: "already_subscribed",
        plan: existingPlan.plan,
        manage: "/billing",
        message: "You already have an active plan. Change or cancel it from Billing.",
      },
      { status: 409 },
    );
  }

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(email);

    // Defence 2. Reuse an unpaid subscription rather than stacking another one. A customer who refreshes,
    // hits back, or double-clicks must land on the SAME PaymentIntent. Matching on plan and cycle as well
    // as status means switching plans mid-flow correctly starts a new one instead of paying the old price.
    const open = await stripe.subscriptions.list({ customer: customer.id, status: "incomplete", limit: 10 });
    const reusable = open.data.find(
      (s) =>
        s.metadata?.type === "v_plan" &&
        s.metadata?.plan === plan &&
        s.metadata?.cycle === cycle &&
        s.items?.data?.[0]?.price?.id === price,
    );

    if (reusable) {
      const full = await stripe.subscriptions.retrieve(reusable.id, {
        expand: ["latest_invoice.payment_intent"],
      });
      const pi = firstPaymentIntent(full);
      if (pi?.client_secret) {
        return NextResponse.json({
          clientSecret: pi.client_secret,
          subscriptionId: full.id,
          amountCents: pi.amount ?? null,
          currency: pi.currency ?? "usd",
          reused: true,
        });
      }
      // The reusable subscription has no usable intent (expired or in a state we cannot confirm). Cancel
      // it so it cannot linger as a half-open charge, then fall through and create a clean one.
      await stripe.subscriptions.cancel(reusable.id).catch(() => { /* already gone: nothing to undo */ });
    }

    // Defence 3. A deterministic key, so two requests racing the check above still produce ONE
    // subscription. Scoped to owner + plan + cycle + day: narrow enough that a genuine retry tomorrow is
    // allowed, wide enough that a double-clicked button today is not.
    const day = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `v_plan:${owner}:${plan}:${cycle}:${day}`;

    const created = await stripe.subscriptions.create(
      {
        customer: customer.id,
        items: [{ price }],
        // The subscription exists before payment. This is the whole reason the webhook must ignore
        // `incomplete`, and why that guard is a precondition of this route.
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: ["latest_invoice.payment_intent"],
        // Byte-identical to the Checkout route's metadata. The webhook dispatches on `type` and attributes
        // on `user_id`, so activation works without the webhook knowing which screen sold the plan.
        metadata: { type: "v_plan", plan, cycle, user_id: owner },
      },
      { idempotencyKey },
    );

    const pi = firstPaymentIntent(created);
    if (!pi?.client_secret) {
      // No intent means nothing for the customer to confirm. Rather than render a form that cannot
      // complete, fail loudly and leave no dangling unpaid subscription behind.
      await stripe.subscriptions.cancel(created.id).catch(() => { /* best effort */ });
      return NextResponse.json({ error: "no_payment_intent" }, { status: 502 });
    }

    await logEvent({
      userId: email,
      eventType: "checkout_intent_created",
      actorType: "owner",
      source: "web",
      metadata: { kind: "v_plan", plan, cycle, subscription_id: created.id, surface: "custom" },
    });

    return NextResponse.json({
      clientSecret: pi.client_secret,
      subscriptionId: created.id,
      amountCents: pi.amount ?? null,
      currency: pi.currency ?? "usd",
      reused: false,
    });
  } catch (e) {
    console.error("[v subscribe intent] failed:", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
