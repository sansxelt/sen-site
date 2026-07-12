// POST /api/v/checkout — dynamic credit top-up. Body: { amountDollars }.
// Builds a Stripe Checkout Session with price_data on the fly (no fixed price
// IDs); the early-access ledger rate is 10 credits per dollar, pending the per-pass pricing migration. Embedded (embedded_page) so it mounts on vraelis.com.
// The webhook grants the credits on completion (deduped by session id).

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { logEvent } from "@/lib/v-events";
import { getStripe, isStripeConfigured, APP_URL } from "@/lib/stripe";
import { TOPUP_MIN_DOLLARS, topupMaxDollars } from "@/lib/v-entitlements";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || APP_URL;
const MIN = TOPUP_MIN_DOLLARS, CREDITS_PER_DOLLAR = 10;
// $999,999 — the hard ceiling for a single Stripe charge. Above this needs invoicing
// (a future build); elevated accounts get a contact path, not an oversized checkout.
const MAX = topupMaxDollars();

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isStripeConfigured()) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });
  await ensureProfile(email, session.user?.name ?? undefined);

  const body = await req.json().catch(() => ({}));
  const amountDollars = Math.floor(Number(body?.amountDollars));
  if (!Number.isFinite(amountDollars) || amountDollars < MIN || amountDollars > MAX) {
    return NextResponse.json({ error: "invalid_amount", min: MIN, max: MAX }, { status: 400 });
  }
  const credits = amountDollars * CREDITS_PER_DOLLAR;

  try {
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.create({
      ui_mode: "embedded_page",
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amountDollars * 100,
          product_data: {
            name: "Vraelis Credits",
            description: `${credits.toLocaleString()} credits, funds Vraelis Production Passes`,
          },
        },
      }],
      customer_email: email,
      client_reference_id: email,
      metadata: { type: "credit_topup", credits: String(credits), amountDollars: String(amountDollars), user_id: email },
      allow_promotion_codes: true,
      return_url: `${SITE_URL}/credits?session_id={CHECKOUT_SESSION_ID}`,
    });
    await logEvent({ userId: email, eventType: "checkout_started", actorType: "owner", source: "web", metadata: { kind: "credit_topup", credits, amount: amountDollars } });
    return NextResponse.json({ clientSecret: checkout.client_secret });
  } catch (e) {
    console.error("[v checkout] failed:", e);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
