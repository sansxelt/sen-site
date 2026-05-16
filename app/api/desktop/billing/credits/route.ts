import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import { getOrCreateCustomer, getStripe, isStripeConfigured } from "../../../../../lib/stripe";
import { extractBillingErrorMessage } from "../../../../../lib/desktop-billing";

// v0.1.9, buy credits.
// Accepts { amount_dollars: number } in [1, MAX_DOLLARS], creates a
// Stripe PaymentIntent for that amount in cents, and returns the
// client secret so the desktop billing panel can confirm via Stripe
// Elements.
//
// The intent's metadata carries { kind: "credits", email, dollars } so
// the webhook (app/api/stripe/webhook/route.ts payment_intent.succeeded
// handler) can credit the user's balance idempotently on the
// payment_intent id.
//
// v0.1.13 \u2014 raised cap from $500 \u2192 $10,000. Stripe's hard per-charge
// ceiling is ~$999k but most cards reject transactions above ~$10k,
// so this is the realistic upper bound. Must stay in sync with
// CREDIT_MAX in desktop/src/billing-panel.tsx.

const MIN_DOLLARS = 1;
const MAX_DOLLARS = 10_000;

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: { amount_dollars?: number };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const dollars = Math.floor(Number(payload.amount_dollars ?? 0));
  if (!Number.isFinite(dollars) || dollars < MIN_DOLLARS || dollars > MAX_DOLLARS) {
    return NextResponse.json(
      { error: `amount_dollars must be between $${MIN_DOLLARS} and $${MAX_DOLLARS}.` },
      { status: 400 },
    );
  }

  const normalizedEmail = email.toLowerCase();

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(normalizedEmail);

    const intent = await stripe.paymentIntents.create({
      amount: dollars * 100, // dollars → cents
      currency: "usd",
      customer: customer.id,
      // Explicit allow-list, Amazon Pay / Klarna / etc. require
      // separate setup we haven't done. Match the recurring sub set.
      payment_method_types: ["card", "link", "cashapp"],
      metadata: {
        kind: "credits",
        email: normalizedEmail,
        dollars: String(dollars),
        surface: "desktop",
      },
      description: `vraelis credits, $${dollars}`,
    });

    if (!intent.client_secret) {
      return NextResponse.json(
        { error: "Stripe did not return a client secret." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "credits_ready",
      clientSecret: intent.client_secret,
      customerId: customer.id,
    });
  } catch (err) {
    const message = extractBillingErrorMessage(err);
    console.error("[desktop credits] failed:", message, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
