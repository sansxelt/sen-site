import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { APP_URL, getPriceId, getStripe, isStripeConfigured } from "../../../../lib/stripe";
import type { BillingCycle } from "../../../../lib/stripe";

export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in to upgrade your plan." }, { status: 401 });
  }

  let payload: { planKey?: string; cycle?: string; seats?: number };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const planKey = payload.planKey?.toLowerCase() ?? "";
  const cycle: BillingCycle = payload.cycle === "yearly" ? "yearly" : "monthly";
  const seats = planKey === "teams" ? Math.max(3, Math.floor(payload.seats ?? 3)) : 1;

  const priceId = getPriceId(planKey, cycle);
  if (!priceId) {
    return NextResponse.json(
      { error: `No Stripe price configured for "${planKey}" (${cycle}). Add STRIPE_PRICE_${planKey.toUpperCase()}_${cycle.toUpperCase()} to your env.` },
      { status: 400 },
    );
  }

  const stripe = getStripe();

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: session.user.email,
    line_items: [{ price: priceId, quantity: seats }],
    success_url: `${APP_URL}/account?upgrade=success&plan=${planKey}&cycle=${cycle}`,
    cancel_url:  `${APP_URL}/pricing`,
    metadata: {
      userEmail: session.user.email,
      planKey,
      cycle,
    },
    subscription_data: {
      metadata: {
        userEmail: session.user.email,
        planKey,
        cycle,
      },
    },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
