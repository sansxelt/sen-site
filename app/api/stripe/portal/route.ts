import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { APP_URL, getStripe, isStripeConfigured } from "../../../../lib/stripe";

export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: "Billing is not configured yet." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in to manage billing." }, { status: 401 });
  }

  const stripe = getStripe();

  // Find customer by email
  const customers = await stripe.customers.list({ email: session.user.email, limit: 1 });
  if (!customers.data.length) {
    return NextResponse.json({ error: "No billing account found for this email." }, { status: 404 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customers.data[0].id,
    return_url: `${APP_URL}/account`,
  });

  return NextResponse.json({ url: portalSession.url });
}
