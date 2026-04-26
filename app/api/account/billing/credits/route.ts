import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getOrCreateCustomer, getStripe, isStripeConfigured } from "../../../../../lib/stripe";

// v0.1.16, Web equivalent of the desktop credits-purchase route.
// Accepts { amount_dollars: number } in [MIN, MAX], creates a Stripe
// PaymentIntent for that amount in cents, and returns the client
// secret so the billing panel can confirm via Stripe Elements.
//
// The intent's metadata carries { kind: "credits", email, dollars }
// so the existing webhook handler (handlePaymentIntentSucceeded → the
// kind === "credits" branch) credits the user's balance idempotently
// on the payment_intent id. No new webhook code needed.
//
// Range matches the desktop route: $1–$9,999. Below $1 isn't usable
// (Stripe min is ~$0.50 USD but the credit ledger uses dollars as
// the unit). Above $9,999 most cards reject anyway.

const MIN_DOLLARS = 1;
const MAX_DOLLARS = 9_999;

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
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
      { error: `Amount must be between $${MIN_DOLLARS} and $${MAX_DOLLARS.toLocaleString()}.` },
      { status: 400 },
    );
  }

  const normalizedEmail = session.user.email.toLowerCase();

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(normalizedEmail);

    const intent = await stripe.paymentIntents.create({
      amount: dollars * 100, // dollars → cents
      currency: "usd",
      customer: customer.id,
      // Explicit allow-list, same set the recurring subscription
      // route uses. Without this, automatic_payment_methods would
      // surface every method enabled in the Stripe dashboard
      // (Amazon Pay, Klarna, Affirm, etc.) which isn't what we
      // want, those need separate setup we haven't done.
      payment_method_types: ["card", "link", "cashapp"],
      metadata: {
        kind: "credits",
        email: normalizedEmail,
        dollars: String(dollars),
        surface: "web",
      },
      description: `sansxel credits, $${dollars}`,
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
      dollars,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    console.error("[web credits] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
