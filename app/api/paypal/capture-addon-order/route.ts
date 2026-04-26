import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { capturePaypalOrder, isPaypalConfigured } from "../../../../lib/paypal";
import { billingAddonMap, isOneTimeBoost, type BillingAddonKey } from "../../../../lib/pricing";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../../../../lib/supabase-admin";
import { invalidateAddonsCache } from "../../../../lib/active-addons";

export const runtime = "nodejs";

/**
 * POST /api/paypal/capture-addon-order
 * Body: { orderId, addonKey }
 *
 * Captures the PayPal order (pulls the funds) and then activates the
 * addon in our system:
 *   - One-time boosts (session_boost, weekly_boost) → insert into
 *     boost_credits (same table the Stripe webhook writes to). The
 *     gating layer in lib/plan-limits.ts already redeems these.
 *   - Recurring addons (copilot_pro_pack, power_pack) → insert as a
 *     1-month boost_credits row using the addon_key. Renewal requires
 *     buying again next cycle (no PayPal subscription on file).
 *
 * Idempotent on orderId: the boost_credits row's unique key on
 * `stripe_payment_intent` (which we reuse for "paypal:<orderId>")
 * makes a duplicate capture a no-op.
 */
export async function POST(request: Request) {
  if (!isPaypalConfigured()) {
    return NextResponse.json({ error: "PayPal is not configured." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as {
    orderId?: string;
    addonKey?: string;
  };

  const orderId = typeof payload.orderId === "string" ? payload.orderId.trim() : "";
  const addonKey = payload.addonKey?.toLowerCase() as BillingAddonKey | undefined;
  if (!orderId || !addonKey || !(addonKey in billingAddonMap)) {
    return NextResponse.json({ error: "Missing orderId or addonKey." }, { status: 400 });
  }

  const email = session.user.email.toLowerCase();

  try {
    const captured = await capturePaypalOrder(orderId);
    if (captured.status !== "COMPLETED") {
      return NextResponse.json(
        { error: `Order capture not completed (${captured.status}).` },
        { status: 502 },
      );
    }

    if (!isDatabaseConfigured()) {
      // Payment captured but we can't activate. Refund-the-user-later
      // territory; surface clearly so support can intervene.
      return NextResponse.json(
        { error: "Payment captured but addon activation backend is offline. Contact support with order id: " + orderId },
        { status: 500 },
      );
    }

    const supabase = getSupabaseAdminClient();
    // Reuse the existing stripe_payment_intent column with a "paypal:"
    // prefix so we don't need a schema migration. Unique constraint on
    // that column gives us idempotency for free.
    const ledgerId = `paypal:${orderId}`;
    const { error } = await supabase
      .from("boost_credits" as never)
      .insert([
        {
          email,
          addon_key: addonKey,
          stripe_payment_intent: ledgerId,
          consumed: false,
        },
      ] as never);

    if (error) {
      // Already credited (replay), return ok so the client doesn't
      // double-confirm or try again.
      if ((error as { code?: string }).code === "23505") {
        return NextResponse.json({ status: "already_active" });
      }
      console.error("[paypal capture-addon-order] insert failed:", error.message);
      return NextResponse.json(
        { error: "Payment captured but activation failed. Contact support with order id: " + orderId },
        { status: 500 },
      );
    }

    const recurring = !isOneTimeBoost(addonKey);
    // Drop any cached addon set so the new PayPal-bought recurring
    // addon takes effect on the next chat/image/voice request.
    invalidateAddonsCache(email);
    return NextResponse.json({
      status: "active",
      orderId,
      addonKey,
      note: recurring
        ? "Activated for one billing cycle. PayPal-recurring not yet wired, buy again next cycle to renew."
        : "Boost credit added.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "PayPal capture error.";
    console.error("[paypal capture-addon-order] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
