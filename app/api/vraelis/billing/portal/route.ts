// Stripe Billing Portal hand-off. One signed-in link that lets a Vraelis owner
// fix a failed card, update payment method, see invoices, or cancel — covering
// the "fix payment", "manage billing", and "cancel" options in one hosted flow.
// (PayPal subscribers manage their plan in PayPal; the account UI links them
// there instead, since the Stripe portal can't act on a PayPal subscription.)

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, isStripeConfigured, APP_URL } from "@/lib/stripe";

export async function GET() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.redirect(`${APP_URL}/signin`);
  if (!isStripeConfigured()) {
    return NextResponse.redirect(`${APP_URL}/v/account?billing=unavailable`);
  }
  try {
    const stripe = getStripe();
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    if (!customer) {
      // No Stripe customer (e.g. free tier, or a PayPal-only subscriber).
      return NextResponse.redirect(`${APP_URL}/v/account?billing=none`);
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${APP_URL}/v/account`,
    });
    return NextResponse.redirect(portal.url);
  } catch (e) {
    console.error("[billing portal] failed:", e);
    return NextResponse.redirect(`${APP_URL}/v/account?billing=error`);
  }
}
