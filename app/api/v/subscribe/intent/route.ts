// POST /api/v/subscribe/intent — start a plan subscription WITHOUT leaving the site.
//
// The sibling route (../route.ts) creates a Stripe Checkout session and hands back a client_secret for
// Stripe's own embedded UI. This one creates the subscription directly, in default_incomplete, and hands
// back the confirmation secret so a Payment Element rendered on our own page can confirm it. Same plans,
// same prices, same metadata, same webhook. The only difference is who draws the form.
//
// WHY THIS IS NOT A COSMETIC CHANGE.
//
// Checkout will not create a subscription until payment succeeds, so by the time any webhook fires the
// status is already active. Creating the subscription first inverts that: it exists, unpaid, before a cent
// has moved. Every entitlement guard in the webhook was written under the old assumption and treated
// anything that was not terminal as entitled, so a subscription at `incomplete` granted the paid plan for
// free. app/api/stripe/webhook now returns early on `incomplete`. That guard is a PRECONDITION of this
// route, not a detail of it.
//
// THE WEBHOOK REMAINS THE ONLY ACTIVATION AUTHORITY. This route never writes plan state. It creates a
// Stripe object and returns a secret; the plan appears when Stripe says the money moved.
//
// DOUBLE CHARGING is the failure mode that matters, and an adversarial review found the first three
// defences here were each answering a slightly different question than the one that mattered. What holds
// now:
//   1. STRIPE is asked whether the owner is already subscribed, not only the local plan row. That row is
//      exactly what is missing when a webhook is lost, which is when the guard has to hold.
//   2. ONE open checkout per owner, not one per plan. Matching only plan+cycle left the first subscription
//      alive and confirmable when someone changed their mind: two tabs, two live secrets, two real
//      charges, one plan's worth of entitlement. Every other unpaid v_plan subscription is cancelled.
//   3. The idempotency key never spans a cancel. A fixed daily key made Stripe replay its cached response
//      for a subscription this route had just cancelled, handing back a dead secret.
//   4. A frozen owner cannot start a checkout at all, because the plan write would be suppressed and they
//      would pay for nothing.
//
// PROMOTION CODES ARE DELIBERATELY ABSENT. Checkout gives that field for free and this screen does not.
// Dropped on purpose, not overlooked; it returns as a server-validated coupon field when there is a
// promotion to run.

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
import { isBillingFrozen } from "@/lib/preflight/billing-freeze";

export const runtime = "nodejs";

const PLANS = new Set(["starter", "creator", "pro", "scale"]);
const V1_PLANS = new Set<string>(PLAN_CATALOG_V1.map((p) => p.key));
const CYCLES = new Set(["monthly", "yearly"]);

/** Live means "being billed". Any of these means the owner already has a subscription and must not get
 *  a second one. `unpaid` is included deliberately: it is a subscription in late dunning, not a free slot. */
const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

/** THE SECRET THAT FRONTS A SUBSCRIPTION'S FIRST INVOICE.
 *
 *  Stripe's 2025.x API renamed latest_invoice.payment_intent to latest_invoice.confirmation_secret, and
 *  lib/stripe.ts pins 2026-03-25.dahlia, where the Invoice object has no root payment_intent at all.
 *  Reading only the old field returns nothing every single time, so the route would cancel the subscription
 *  it had just created and show the customer a dead end: all subscription revenue on this surface, gone,
 *  silently. Both names are read, newest first, exactly as app/api/stripe/payment-intent/route.ts and
 *  lib/desktop-billing.ts already do, so a version move in either direction keeps working.
 *
 *  Returns null when Stripe attached no secret, which is a REAL state and not an error: a zero-amount or
 *  fully discounted first invoice activates immediately and there is nothing to confirm. */
function firstClientSecret(sub: Stripe.Subscription): string | null {
  const invoice = sub.latest_invoice;
  if (!invoice || typeof invoice === "string") return null;
  const raw = invoice as unknown as {
    confirmation_secret?: { client_secret?: string } | null;
    payment_intent?: { client_secret?: string } | string | null;
  };
  if (raw.confirmation_secret?.client_secret) return raw.confirmation_secret.client_secret;
  if (raw.payment_intent && typeof raw.payment_intent === "object" && raw.payment_intent.client_secret) {
    return raw.payment_intent.client_secret;
  }
  return null;
}

/** What the customer will be charged, from the INVOICE rather than a PaymentIntent, because at the pinned
 *  API version there may not be a PaymentIntent to read. */
function amountDue(sub: Stripe.Subscription): { cents: number | null; currency: string } {
  const invoice = sub.latest_invoice;
  if (!invoice || typeof invoice === "string") return { cents: null, currency: "usd" };
  return { cents: invoice.amount_due ?? null, currency: invoice.currency ?? "usd" };
}

const EXPAND = ["latest_invoice.confirmation_secret", "latest_invoice.payment_intent"];

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

  // THE LOWERCASED OWNER, EVERYWHERE BELOW. v_profiles is keyed on it and Stripe's customer email filter is
  // case sensitive, so looking a customer up by the raw session email creates a SECOND Stripe customer. The
  // billing portal looks up lowercased, finds that empty customer, and shows no subscription: the paying
  // customer cannot cancel, cannot replace an expiring card, and resolves it with their bank instead.
  const owner = email.toLowerCase();

  // A frozen owner must not be able to pay. The plan write is suppressed while a freeze is in force, so the
  // charge would succeed and the entitlement would never appear: money taken from the person most likely to
  // dispute it, and a second thing for them to dispute.
  if (await isBillingFrozen(owner)) {
    return NextResponse.json(
      { error: "billing_frozen", manage: "/billing", message: "Billing is on hold for this account. Contact support before subscribing." },
      { status: 403 },
    );
  }

  // Fast local refusal. Not sufficient alone (see the Stripe read below) but it saves a round trip in the
  // common case and matches the Checkout route exactly.
  const existingPlan = await getPlanV1State(owner);
  if (existingPlan?.plan) {
    return NextResponse.json(
      { error: "already_subscribed", plan: existingPlan.plan, manage: "/billing", message: "You already have an active plan. Change or cancel it from Billing." },
      { status: 409 },
    );
  }

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(owner);

    // ONE read of the truth, then every decision from it. status "all" matters: an ACTIVE subscription is
    // invisible to a list filtered on "incomplete", and that is precisely the case where the local plan row
    // was never written because a webhook was lost. Asking the DB there would create a second subscription.
    const all = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 30 });
    const ours = all.data.filter((sub) => sub.metadata?.type === "v_plan");

    const live = ours.find((sub) => LIVE_STATUSES.has(sub.status));
    if (live) {
      return NextResponse.json(
        {
          error: "already_subscribed",
          plan: live.metadata?.plan ?? null,
          manage: "/billing",
          message: "You already have an active subscription. Change or cancel it from Billing.",
        },
        { status: 409 },
      );
    }

    const unpaid = ours.filter((sub) => sub.status === "incomplete");
    const match = unpaid.find(
      (sub) => sub.metadata?.plan === plan && sub.metadata?.cycle === cycle && sub.items?.data?.[0]?.price?.id === price,
    );

    // Reuse the matching one if it can still be paid, so a refresh, a browser-back or a double-click all
    // land on the SAME secret rather than minting another subscription.
    if (match) {
      const full = await stripe.subscriptions.retrieve(match.id, { expand: EXPAND });
      const secret = firstClientSecret(full);
      if (secret) {
        const { cents, currency } = amountDue(full);
        return NextResponse.json({ clientSecret: secret, subscriptionId: full.id, amountCents: cents, currency, reused: true });
      }
    }

    // EVERY OTHER UNPAID SUBSCRIPTION IS A SECOND CHARGEABLE CHECKOUT for this owner, and the customer can
    // still confirm it from a tab left open. Cancelling them is what makes "one open checkout per owner"
    // true rather than aspirational. The matching one is included when it turned out to have no usable
    // secret, because a subscription that cannot be paid here but could be charged later is the worst of
    // both.
    const cancelled: string[] = [];
    for (const sub of unpaid) {
      if (sub.id === match?.id) {
        const retained = await stripe.subscriptions.retrieve(sub.id, { expand: EXPAND }).catch(() => null);
        if (retained && firstClientSecret(retained)) continue;
      }
      await stripe.subscriptions.cancel(sub.id).then(() => { cancelled.push(sub.id); }).catch(() => { /* already gone */ });
    }

    // THE KEY MUST NOT SPAN A CANCEL. A fixed owner+plan+cycle+day key made Stripe replay its cached
    // response for a subscription this route had just cancelled, handing back a dead object with a stale
    // secret: either a form that can never complete, or money moving against a cancelled subscription that
    // no webhook will ever turn into a plan. Folding the cancelled ids in makes a retry genuinely new,
    // while a plain double-click (nothing cancelled) still collapses to one subscription.
    const day = new Date().toISOString().slice(0, 10);
    const attempt = cancelled.length ? `:after:${cancelled.slice().sort().join(",")}` : "";
    const idempotencyKey = `v_plan:${owner}:${plan}:${cycle}:${day}${attempt}`;

    const created = await stripe.subscriptions.create(
      {
        customer: customer.id,
        items: [{ price }],
        payment_behavior: "default_incomplete",
        payment_settings: { save_default_payment_method: "on_subscription" },
        expand: EXPAND,
        // Byte-identical to the Checkout route's metadata. The webhook dispatches on type and attributes on
        // user_id, so activation works without knowing which screen sold the plan.
        metadata: { type: "v_plan", plan, cycle, user_id: owner },
      },
      { idempotencyKey },
    );

    const secret = firstClientSecret(created);
    const { cents, currency } = amountDue(created);

    if (!secret) {
      // NOT automatically an error. A zero-amount or fully discounted first invoice activates immediately
      // and there is nothing to confirm. Cancelling here would revoke a subscription Stripe has already
      // activated and the webhook has already granted.
      if (created.status === "active" || created.status === "trialing") {
        await logEvent({
          userId: email, eventType: "checkout_intent_created", actorType: "owner", source: "web",
          metadata: { kind: "v_plan", plan, cycle, subscription_id: created.id, surface: "custom", activated_without_payment: true },
        });
        return NextResponse.json({ activated: true, subscriptionId: created.id, amountCents: cents, currency });
      }
      await stripe.subscriptions.cancel(created.id).catch(() => { /* best effort */ });
      return NextResponse.json({ error: "no_payment_intent" }, { status: 502 });
    }

    await logEvent({
      userId: email,
      eventType: "checkout_intent_created",
      actorType: "owner",
      source: "web",
      metadata: { kind: "v_plan", plan, cycle, subscription_id: created.id, surface: "custom", cancelled: cancelled.length },
    });

    return NextResponse.json({ clientSecret: secret, subscriptionId: created.id, amountCents: cents, currency, reused: false });
  } catch (e) {
    console.error("[v subscribe intent] failed:", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
