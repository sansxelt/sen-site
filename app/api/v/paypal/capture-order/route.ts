// POST /api/v/paypal/capture-order — capture a PayPal credit top-up and grant credits.
// Body: { orderId }. Credits come from the CAPTURED amount (authoritative from PayPal), not
// from client input. Grants through the SAME ledger path as Stripe (grant reason "topup",
// ext_ref "paypal:<orderId>"), so it is idempotent per order and can't collide with Stripe.
// Self-confirming: a captured-but-not-credited case is surfaced loudly, never silent.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { capturePaypalOrder, isPaypalConfigured } from "@/lib/paypal";
import { grant } from "@/lib/v-credits";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";
import { logEvent } from "@/lib/v-events";

export const runtime = "nodejs";
const CREDITS_PER_DOLLAR = 10;

// Pull the authoritative USD from the capture response: purchase_units[0].payments.captures[0].
function capturedUsd(raw: unknown): number {
  const r = raw as { purchase_units?: Array<{ payments?: { captures?: Array<{ status?: string; amount?: { currency_code?: string; value?: string } }> } }> };
  const cap = r?.purchase_units?.[0]?.payments?.captures?.[0];
  if (!cap || cap.status !== "COMPLETED") return 0;
  if ((cap.amount?.currency_code || "").toUpperCase() !== "USD") return 0;
  const v = Number(cap.amount?.value);
  return Number.isFinite(v) && v > 0 ? v : 0;
}

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  if (!isPaypalConfigured() || !isDatabaseConfigured()) return NextResponse.json({ error: "billing_unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body?.orderId === "string" ? body.orderId.trim() : "";
  if (!orderId) return NextResponse.json({ error: "missing_order" }, { status: 400 });
  const extRef = `paypal:${orderId}`;

  try {
    const captured = await capturePaypalOrder(orderId);
    if (captured.status !== "COMPLETED") {
      return NextResponse.json({ error: "not_completed", status: captured.status }, { status: 502 });
    }

    const usd = capturedUsd(captured.raw);
    // floor, never round up: only credit whole dollars actually captured (create-order sends
    // integer amounts, so this is exact today; flooring keeps it safe if that ever changes).
    const credits = Math.floor(usd) * CREDITS_PER_DOLLAR;
    if (!(credits > 0)) {
      console.error(`[v paypal capture] captured but amount unreadable order=${orderId} usd=${usd}: manual reconciliation`);
      return NextResponse.json({ error: "capture_amount_invalid", orderId }, { status: 500 });
    }

    // Grant through the shared ledger. extRef makes it idempotent: a replay returns false
    // (23505) and no second grant is written.
    const granted = await grant(email, credits, "topup", { bucket: "purchased", extRef });
    if (granted) {
      logEvent({ userId: email, eventType: "credit_topup_paypal", actorType: "owner", source: "web", metadata: { credits, amount: usd, order: orderId } }).catch(() => {});
      return NextResponse.json({ status: "credited", credits });
    }

    // grant() returns false on a duplicate (already credited) OR a write error. Disambiguate
    // from the ledger so we never tell a paid customer it failed when it actually landed, and
    // never silently swallow a real captured-but-not-credited failure.
    const s = getSupabaseAdminClient();
    const { data } = await s.from("v_credit_ledger" as never)
      .select("id").eq("user_id", email).eq("reason", "topup").eq("ext_ref", extRef).maybeSingle();
    if (data) return NextResponse.json({ status: "credited", credits, note: "already_applied" });

    console.error(`PAYPAL CAPTURED BUT NOT CREDITED order=${orderId} email=${email} credits=${credits}: manual reconciliation required`);
    return NextResponse.json({ error: "captured_not_credited", message: `Payment received but credits could not be applied. Email help@vraelis.com with order id ${orderId}.`, orderId }, { status: 500 });
  } catch (e) {
    console.error("[v paypal capture-order] failed:", e);
    return NextResponse.json({ error: "paypal_error", orderId }, { status: 500 });
  }
}
