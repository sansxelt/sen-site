import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../../../../../lib/supabase-admin";
import { getStripe, isStripeConfigured } from "../../../../../lib/stripe";

export const runtime = "nodejs";

// POST /api/account/billing/reset-to-free
//
// Self-serve "drop me to Free now." Deletes the caller's row in
// account_subscriptions and, if there's an attached Stripe
// subscription, cancels it immediately (no period-end wait). Used
// when a stale dev / test grant has the user marked Pro without a
// real card on file. Auth is required (caller's session email is
// the only row touched), so this can't be used to reset anyone
// else.

export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  // Find the row first so we can read provider_subscription_id and
  // cancel upstream Stripe / PayPal cleanly. Falls through if no row.
  type Row = {
    provider?: string | null;
    provider_subscription_id?: string | null;
  };
  const { data } = await supabase
    .from("account_subscriptions" as never)
    .select("provider, provider_subscription_id")
    .eq("email", email)
    .maybeSingle();
  const row = (data as unknown as Row) ?? null;

  // Cancel the upstream Stripe sub if there is one. PayPal / other
  // providers fall through; we just drop the local row and let the
  // user re-subscribe later if they want.
  if (
    row?.provider === "stripe" &&
    row.provider_subscription_id &&
    isStripeConfigured()
  ) {
    try {
      const stripe = getStripe();
      await stripe.subscriptions.cancel(row.provider_subscription_id);
    } catch (err) {
      // Non-fatal. The Stripe row may already be canceled, or the
      // sub id might be stale. Either way, drop the local record.
      console.warn("[reset-to-free] stripe cancel failed:", err);
    }
  }

  const { error: delErr } = await supabase
    .from("account_subscriptions" as never)
    .delete()
    .eq("email", email);
  if (delErr) {
    console.error("[reset-to-free] delete failed:", delErr);
    return NextResponse.json({ error: "Reset failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, plan: "free" }, { status: 200 });
}
