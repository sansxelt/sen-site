import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../../../../../lib/supabase-admin";
import { getOrCreateCustomer, getStripe, isStripeConfigured } from "../../../../../lib/stripe";

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

  // Cancel every active Stripe subscription on the caller's
  // customer record, not just the one tracked in
  // account_subscriptions. The local row can be missing or stale
  // while Stripe still has a live sub from an earlier dev / test
  // grant; without this pass, getBillingState would still resolve
  // the user to Pro on /account/plan.
  if (isStripeConfigured()) {
    try {
      const stripe = getStripe();
      const customer = await getOrCreateCustomer(email);
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status: "all",
        limit: 50,
      });
      for (const sub of subs.data) {
        if (
          sub.status === "active" ||
          sub.status === "trialing" ||
          sub.status === "past_due" ||
          sub.status === "unpaid" ||
          sub.status === "incomplete"
        ) {
          try {
            await stripe.subscriptions.cancel(sub.id);
          } catch (err) {
            console.warn(`[reset-to-free] cancel ${sub.id} failed:`, err);
          }
        }
      }
    } catch (err) {
      console.warn("[reset-to-free] stripe sweep failed:", err);
    }
  }
  void row;

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
