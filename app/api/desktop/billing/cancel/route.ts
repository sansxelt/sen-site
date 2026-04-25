import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import {
  findUsableSubscription,
  getOrCreateCustomer,
  getStripe,
} from "../../../../../lib/stripe";

export async function POST(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const undo = url.searchParams.get("undo") === "true";

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(email.toLowerCase());
    const subscription = await findUsableSubscription(customer.id);
    if (!subscription) {
      return NextResponse.json({ error: "No active subscription." }, { status: 400 });
    }

    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: !undo,
      metadata: { ...subscription.metadata, surface: "desktop" },
    });

    return NextResponse.json({ ok: true, cancelAtPeriodEnd: !undo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    console.error("[desktop cancel] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
