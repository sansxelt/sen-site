// POST /api/v/portal — open the Stripe customer portal (cancel, update payment,
// switch plan). The portal is Stripe-hosted (there is no embedded variant), so
// this returns a URL to redirect to. We resolve the customer by email.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStripe, isStripeConfigured, APP_URL } from "@/lib/stripe";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || APP_URL;

export async function POST() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });

  try {
    const stripe = getStripe();
    const norm = email.toLowerCase();
    const customers = await stripe.customers.list({ email: norm, limit: 1 });
    let customer = customers.data[0];
    // Create the customer on first use so even free users (who've never paid)
    // can add a card on file — the portal needs an existing customer.
    if (!customer) {
      customer = await stripe.customers.create({ email: norm, name: session.user?.name ?? undefined });
      if (isDatabaseConfigured()) {
        try { await getSupabaseAdminClient().from("v_profiles" as never).update({ stripe_customer_id: customer.id } as never).eq("user_id", norm); } catch { /* best-effort */ }
      }
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: `${SITE_URL}/app/billing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (e) {
    console.error("[v portal] failed:", e);
    return NextResponse.json({ error: "portal_failed" }, { status: 500 });
  }
}
