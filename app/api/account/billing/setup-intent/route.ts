import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getOrCreateCustomer, getStripe } from "../../../../../lib/stripe";

/**
 * POST /api/account/billing/setup-intent
 * Creates a SetupIntent so the user can add/swap a payment method without
 * being charged.  The browser confirms it via Stripe Payment Element.
 * On confirm, the client posts the resulting payment method ID to
 * /update-payment-method.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const stripe   = getStripe();
    const customer = await getOrCreateCustomer(session.user.email.toLowerCase());

    const setupIntent = await stripe.setupIntents.create({
      customer:            customer.id,
      usage:               "off_session",
      payment_method_types: ["card"],
    });

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId:   customer.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    console.error("[setup-intent] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
