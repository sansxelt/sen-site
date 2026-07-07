// POST /api/v/paypal/create-order — PayPal credit top-up (one-time CAPTURE order).
// Body: { amountDollars }. The client renders PayPal buttons against the returned orderId;
// on approval it calls /api/v/paypal/capture-order, which captures + grants credits.
// Mirrors /api/v/checkout (Stripe): same $1 = 10 credits, same min/max, same auth.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureProfile } from "@/lib/v-db";
import { createPaypalOrder, isPaypalConfigured } from "@/lib/paypal";
import { TOPUP_MIN_DOLLARS, topupMaxDollars } from "@/lib/v-entitlements";

export const runtime = "nodejs";
const CREDITS_PER_DOLLAR = 10;

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isPaypalConfigured()) return NextResponse.json({ error: "paypal_unavailable" }, { status: 503 });
  await ensureProfile(email, session.user?.name ?? undefined);

  const body = await req.json().catch(() => ({}));
  const amountDollars = Math.floor(Number(body?.amountDollars));
  const MIN = TOPUP_MIN_DOLLARS, MAX = topupMaxDollars();
  if (!Number.isFinite(amountDollars) || amountDollars < MIN || amountDollars > MAX) {
    return NextResponse.json({ error: "invalid_amount", min: MIN, max: MAX }, { status: 400 });
  }
  const credits = amountDollars * CREDITS_PER_DOLLAR;

  try {
    const order = await createPaypalOrder({
      amountUsd: amountDollars,
      description: `${credits.toLocaleString()} Vraelis credits`,
      // Round-trips through PayPal so the capture step / webhook can attribute the payment.
      customId: JSON.stringify({ type: "credit_topup", email: email.toLowerCase(), amountDollars }),
    });
    return NextResponse.json({ orderId: order.id });
  } catch (e) {
    console.error("[v paypal create-order] failed:", e);
    return NextResponse.json({ error: "paypal_error" }, { status: 500 });
  }
}
