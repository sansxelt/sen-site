import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import {
  findUsableSubscription,
  getOrCreateCustomer,
  getStripe,
} from "../../../../../lib/stripe";

/**
 * POST /api/account/billing/cancel   → schedule cancel at period end
 * POST /api/account/billing/cancel?undo=true → undo a scheduled cancel
 *
 * We never hard-cancel — users keep access until their paid period ends.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const undo = url.searchParams.get("undo") === "true";

  try {
    const stripe = getStripe();
    const customer = await getOrCreateCustomer(session.user.email.toLowerCase());
    const subscription = await findUsableSubscription(customer.id);
    if (!subscription) {
      return NextResponse.json({ error: "No active subscription." }, { status: 400 });
    }

    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: !undo,
    });

    return NextResponse.json({ ok: true, cancelAtPeriodEnd: !undo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error.";
    console.error("[cancel] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
