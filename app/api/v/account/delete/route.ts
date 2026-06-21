// Delete the signed-in user's Vraelis account data. Scoped to the authenticated
// user only, and gated by an explicit "DELETE" confirmation from the client.
// Cancels any active Stripe subscription first so billing stops.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdminClient, isDatabaseConfigured } from "@/lib/supabase-admin";
import { getSubscription } from "@/lib/v-db";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

function norm(e: string) { return e.trim().toLowerCase(); }

export async function POST(req: Request) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return NextResponse.json({ error: "signin_required" }, { status: 401 });
  const confirm = String((await req.json().catch(() => ({})))?.confirm || "");
  if (confirm !== "DELETE") return NextResponse.json({ error: "confirm_required" }, { status: 400 });
  if (!isDatabaseConfigured()) return NextResponse.json({ error: "unavailable" }, { status: 503 });

  const uid = norm(email);

  // Stop billing before deleting the record.
  try {
    const sub = await getSubscription(email);
    if (sub?.stripe_subscription_id && isStripeConfigured()) {
      await getStripe().subscriptions.cancel(sub.stripe_subscription_id);
    }
  } catch (e) { console.error("account delete: stripe cancel:", e); }

  const s = getSupabaseAdminClient();
  // v_tests cascades to options, judgments, and reports. v_webhook_endpoints
  // cascades to deliveries. Everything else is scoped by the user's id.
  await s.from("v_tests" as never).delete().eq("user_id", uid);
  await s.from("v_webhook_endpoints" as never).delete().eq("user_id", uid);
  await s.from("v_api_keys" as never).delete().eq("user_id", uid);
  await s.from("v_subscriptions" as never).delete().eq("user_id", uid);
  await s.from("v_credit_ledger" as never).delete().eq("user_id", uid);
  await s.from("v_payments" as never).delete().eq("user_id", uid);
  await s.from("v_voter_rep" as never).delete().eq("voter_id", uid);
  await s.from("v_profiles" as never).delete().eq("user_id", uid);

  return NextResponse.json({ ok: true });
}
