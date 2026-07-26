// POST /api/v/checkout/intent — buy credits WITHOUT leaving the site.
//
// The sibling route (../route.ts) builds a Stripe Checkout session for a top-up. This one mints the
// PaymentIntent directly so a Payment Element on our own page can confirm it. Same amount rules, same
// ledger, same rate.
//
// THE GRANT IS THE WHOLE RISK HERE, and it is a different risk from subscriptions. A subscription that
// fails to activate leaves the customer without a plan and a support ticket. A top-up that fails to grant
// leaves the customer CHARGED with nothing to show for it, and no subscription object to reconcile from.
// So: the webhook grants on payment_intent.succeeded for metadata { type: "credit_topup", source:
// "in_app" }, keyed on the PaymentIntent id, and this route sets exactly that. The source marker is what
// makes it impossible for the session handler and the intent handler to both grant the same purchase.
//
// THE AMOUNT IS NEVER TAKEN FROM THE CLIENT'S WORD FOR IT. The browser sends dollars; the server clamps to
// the same TOPUP_MIN_DOLLARS / topupMaxDollars() bounds the Checkout route uses and derives both the charge
// and the credits itself. A client that asks for $1 of credits and 10,000,000 credits gets $1 of credits.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { logEvent } from "@/lib/v-events";
import { getStripe, isStripeConfigured, getOrCreateCustomer } from "@/lib/stripe";
import { TOPUP_MIN_DOLLARS, topupMaxDollars } from "@/lib/v-entitlements";
import { customCheckoutEnabled } from "@/lib/custom-checkout";
import { isBillingFrozen } from "@/lib/preflight/billing-freeze";

export const runtime = "nodejs";

// Same rate the Checkout route uses. Stated here rather than imported from it because that route is a
// sibling, not a dependency, and the two must be able to be read independently. If the rate ever moves it
// moves in both, and the test asserts they agree.
const CREDITS_PER_DOLLAR = 10;

export async function POST(req: Request) {
  if (!customCheckoutEnabled()) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  await ensureProfile(email, session.user?.name ?? undefined);

  const body = await req.json().catch(() => ({}));
  const amountDollars = Math.floor(Number(body?.amountDollars));
  const MIN = TOPUP_MIN_DOLLARS;
  const MAX = topupMaxDollars();
  if (!Number.isFinite(amountDollars) || amountDollars < MIN || amountDollars > MAX) {
    return NextResponse.json({ error: "invalid_amount", min: MIN, max: MAX }, { status: 400 });
  }
  const credits = amountDollars * CREDITS_PER_DOLLAR;
  // Lowercased everywhere below. Stripe's customer email filter is case sensitive, so a raw session email
  // creates a SECOND customer, and the billing portal (which looks up lowercased) then cannot find what the
  // person is paying for.
  const owner = email.toLowerCase();

  // A frozen owner must not be able to pay. The grant is suppressed while a freeze is in force, so the
  // charge would land and the credits would never appear.
  if (await isBillingFrozen(owner)) {
    return NextResponse.json(
      { error: "billing_frozen", manage: "/billing", message: "Billing is on hold for this account. Contact support before buying credits." },
      { status: 403 },
    );
  }

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(owner);

    // REUSE RATHER THAN STACK, the same discipline the subscription route follows. A refresh or a
    // double-click must land on the SAME PaymentIntent, not mint a second one for the same purchase.
    // Matching on amount as well as owner means changing the amount correctly starts a fresh intent.
    //
    // Only intents that are still awaiting confirmation qualify. A succeeded or processing intent is a
    // purchase already in flight and must never be handed back to be confirmed again.
    const recent = await stripe.paymentIntents.search({
      query: `customer:"${customer.id}" AND metadata["type"]:"credit_topup" AND metadata["source"]:"in_app" AND status:"requires_payment_method"`,
      limit: 10,
    }).catch(() => null);
    const reusable = recent?.data.find(
      (pi) => pi.amount === amountDollars * 100 && pi.metadata?.user_id === owner,
    );
    if (reusable?.client_secret) {
      return NextResponse.json({
        clientSecret: reusable.client_secret,
        amountCents: reusable.amount,
        currency: reusable.currency,
        credits,
        reused: true,
      });
    }

    // A deterministic key, so two racing POSTs produce one intent. Scoped to owner + amount + day: a
    // genuine second purchase of the same size tomorrow is allowed, a double-clicked button today is not.
    const day = new Date().toISOString().slice(0, 10);
    const idempotencyKey = `credit_topup:${owner}:${amountDollars}:${day}`;

    const intent = await stripe.paymentIntents.create(
      {
        customer: customer.id,
        amount: amountDollars * 100,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        description: `${credits.toLocaleString()} Vraelis credits`,
        // The webhook grants on exactly this shape. `source` is what keeps the session grant and the
        // intent grant from ever both applying to one purchase.
        metadata: {
          type: "credit_topup",
          source: "in_app",
          credits: String(credits),
          amountDollars: String(amountDollars),
          user_id: owner,
        },
      },
      { idempotencyKey },
    );

    if (!intent.client_secret) {
      return NextResponse.json({ error: "no_payment_intent" }, { status: 502 });
    }

    await logEvent({
      userId: email,
      eventType: "checkout_intent_created",
      actorType: "owner",
      source: "web",
      metadata: { kind: "credit_topup", credits, amountDollars, payment_intent_id: intent.id, surface: "custom" },
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      amountCents: intent.amount,
      currency: intent.currency,
      credits,
      reused: false,
    });
  } catch (e) {
    console.error("[v checkout intent] failed:", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
