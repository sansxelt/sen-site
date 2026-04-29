import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../../../../../lib/supabase-admin";
import { getStripe, isStripeConfigured } from "../../../../../lib/stripe";

export const runtime = "nodejs";

// POST /api/account/billing/reset-all-to-free
//
// ADMIN ONLY. Cancels every active Stripe subscription referenced
// by account_subscriptions, then truncates the table so every
// account drops back to Free. Used after pricing changes or to
// clear out stale dev / test grants before a real launch. No-op
// for emails that never had a row.

type Row = {
  email: string;
  provider?: string | null;
  provider_subscription_id?: string | null;
};

export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (!isAdminEmail(email)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const supabase = getSupabaseAdminClient();

  const { data, error: readErr } = await supabase
    .from("account_subscriptions" as never)
    .select("email, provider, provider_subscription_id");
  if (readErr) {
    console.error("[reset-all-to-free] read failed:", readErr);
    return NextResponse.json({ error: "Read failed." }, { status: 500 });
  }
  const rows = (data as unknown as Row[]) ?? [];

  // Cancel every live Stripe subscription, not just the ones
  // tracked in account_subscriptions. Sweep the Stripe side
  // independently so stale subs from dev / test (where the local
  // row was deleted but the Stripe sub kept ticking) also get
  // canceled. Otherwise getBillingState() resolves users to Pro
  // off the Stripe row alone.
  let stripeCanceled = 0;
  let stripeFailed = 0;
  if (isStripeConfigured()) {
    const stripe = getStripe();
    let starting_after: string | undefined;
    while (true) {
      const page = await stripe.subscriptions.list({
        status: "all",
        limit: 100,
        ...(starting_after ? { starting_after } : {}),
      });
      for (const sub of page.data) {
        if (
          sub.status === "active" ||
          sub.status === "trialing" ||
          sub.status === "past_due" ||
          sub.status === "unpaid" ||
          sub.status === "incomplete"
        ) {
          try {
            await stripe.subscriptions.cancel(sub.id);
            stripeCanceled += 1;
          } catch (err) {
            console.warn(
              `[reset-all-to-free] cancel ${sub.id} failed:`,
              err,
            );
            stripeFailed += 1;
          }
        }
      }
      if (!page.has_more || page.data.length === 0) break;
      starting_after = page.data[page.data.length - 1].id;
    }
  }

  // Wipe the table. Supabase requires a filter; "neq email empty"
  // matches every row.
  const { error: delErr } = await supabase
    .from("account_subscriptions" as never)
    .delete()
    .neq("email", "");
  if (delErr) {
    console.error("[reset-all-to-free] delete failed:", delErr);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      rowsRemoved: rows.length,
      stripeCanceled,
      stripeFailed,
    },
    { status: 200 },
  );
}
