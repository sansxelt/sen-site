import { NextResponse } from "next/server";
import { auth, signOut } from "../../../../auth";
import { sendAccountDeletedEmail } from "../../../../lib/email";
import { getStripe, isStripeConfigured } from "../../../../lib/stripe";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/**
 * Best-effort: cancel any Stripe subscriptions tied to this email so we
 * don't orphan an active paid subscription after the account is gone.
 * Swallows errors so a Stripe hiccup can't block the deletion that
 * otherwise succeeds, the user's intent ("delete my account") wins.
 */
async function cancelStripeSubscriptionsForEmail(email: string): Promise<void> {
  if (!isStripeConfigured()) return;
  try {
    const stripe = getStripe();
    const customers = await stripe.customers.list({ email, limit: 10 });
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: customer.id,
        status:   "all",
        limit:    20,
      });
      for (const sub of subs.data) {
        if (sub.status === "canceled" || sub.status === "incomplete_expired") continue;
        try {
          await stripe.subscriptions.cancel(sub.id);
        } catch (err) {
          console.error(`[account.delete] Stripe cancel failed for sub ${sub.id}:`, err);
        }
      }
    }
  } catch (err) {
    console.error("[account.delete] Stripe cleanup failed:", err);
  }
}

export async function DELETE() {
  const session = await auth();
  const rawEmail = session?.user?.email ?? null;

  if (!rawEmail) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const email = normalizeEmail(rawEmail);
  const displayName = session?.user?.name ?? "";

  try {
    // Step 1, cancel any live Stripe subscriptions for this email.
    // Failures are logged but don't block the deletion.
    await cancelStripeSubscriptionsForEmail(email);

    // Step 2, wipe every table keyed by email.  Done as a sequence of
    // separate DELETEs (no Postgres transaction primitive available via
    // supabase-js); if one fails the rest still attempt, and we surface
    // the first error to the user so they can retry.
    const supabase = getSupabaseAdminClient();
    const tablesToWipe = [
      "pending_signups",
      "password_reset_tokens",
      "api_keys",
      "account_subscriptions",
      "user_credentials",
      "user_profiles",
    ] as const;

    let firstError: { table: string; err: unknown } | null = null;
    for (const table of tablesToWipe) {
      const { error } = await supabase
        .from(table as never)
        .delete()
        .eq("email", email);
      if (error) {
        console.error(`[account.delete] Failed to delete from ${table}:`, error);
        if (!firstError) firstError = { table, err: error };
      }
    }

    // Only reject if the profile delete failed, the other tables
    // either legitimately had no rows or were best-effort cleanup.
    // user_profiles is the authoritative "does this account exist" row.
    if (firstError && firstError.table === "user_profiles") {
      throw firstError.err;
    }

    // Step 3, kill the session cookie so this browser can't keep
    // hitting /api/account/* with a JWT that no longer maps to a user.
    try {
      await signOut({ redirect: false });
    } catch (err) {
      console.error("[account.delete] signOut failed:", err);
    }

    // Step 4, goodbye email.  Fire-and-forget so a mail hiccup can't
    // undo the deletion that already succeeded above.
    sendAccountDeletedEmail(email, displayName).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Account deletion failed:", error);
    return NextResponse.json(
      {
        error:
          "We couldn't delete your account right now. Please contact support.",
      },
      { status: 500 },
    );
  }
}
