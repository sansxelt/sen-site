// POST /api/v/checkout — embedded Stripe Checkout for a credit pack. Returns a
// client_secret that mounts on vraelis.com (no redirect). Credits are granted by
// the webhook on completion (server-trusted amount from this catalog, not the client).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { getStripe, isStripeConfigured, APP_URL } from "@/lib/stripe";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || APP_URL;

const PACKS: Record<string, { credits: number }> = {
  pack_100: { credits: 100 },
  pack_500: { credits: 500 },
  pack_1000: { credits: 1000 },
  pack_5000: { credits: 5000 },
  pack_10000: { credits: 10000 },
};

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  await ensureProfile(email, session.user?.name ?? undefined);

  const body = await req.json().catch(() => ({}));
  const sku = String(body?.sku || "");
  const pack = PACKS[sku];
  if (!pack) return NextResponse.json({ error: "bad_sku" }, { status: 400 });

  const price = process.env[`STRIPE_PRICE_${sku.toUpperCase()}`];
  if (!price) return NextResponse.json({ error: "plan_unavailable", sku }, { status: 503 });

  try {
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      mode: "payment",
      line_items: [{ price, quantity: 1 }],
      customer_email: email,
      client_reference_id: email,
      metadata: { kind: "v_pack", sku, credits: String(pack.credits), user_id: email },
      allow_promotion_codes: true,
      return_url: `${SITE_URL}/app/credits?session_id={CHECKOUT_SESSION_ID}`,
    });
    return NextResponse.json({ clientSecret: checkout.client_secret });
  } catch (e) {
    console.error("[v checkout] failed:", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
