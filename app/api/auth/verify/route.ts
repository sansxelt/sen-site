import { NextResponse } from "next/server";
import { sendWelcomeEmail } from "../../../../lib/email";
import {
  deletePendingSignup,
  findPendingByToken,
  isPendingExpired,
} from "../../../../lib/pending-signup";
import { APP_URL } from "../../../../lib/stripe";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { syncUserProfileIdentity } from "../../../../lib/user-profile";
import { getUserCredentialByEmail } from "../../../../lib/user-credentials";

/**
 * GET /api/auth/verify?token=xxx
 *
 * Consumes a pending-signup token.  On success, creates the real
 * user_credentials + user_profiles rows, deletes the pending row,
 * fires the welcome email, and redirects the user to /auth/verified.
 *
 * On failure, redirects to /auth/verify-email with a status flag so
 * the landing page can render the right message + resend form.
 */
export async function GET(request: Request) {
  const url   = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/auth/verify-email?status=invalid`);
  }

  const pending = await findPendingByToken(token);
  if (!pending) {
    return NextResponse.redirect(`${APP_URL}/auth/verify-email?status=invalid`);
  }

  // Expired? — route to the landing page so the user can resend.
  if (isPendingExpired(pending)) {
    return NextResponse.redirect(
      `${APP_URL}/auth/verify-email?status=expired&email=${encodeURIComponent(pending.email)}`,
    );
  }

  // Race guard — if somehow user_credentials already exists (user double-
  // clicked the link, or verified in a second tab), just treat it as
  // success and clean up the stale pending row.
  const alreadyVerified = await getUserCredentialByEmail(pending.email);
  if (alreadyVerified) {
    await deletePendingSignup(pending.email);
    return NextResponse.redirect(
      `${APP_URL}/auth/verified?email=${encodeURIComponent(pending.email)}`,
    );
  }

  // Happy path — promote pending → real user.  Insert the credential row
  // directly (password is already hashed in the pending row, so we don't
  // call createUserCredential which would double-hash).
  try {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("user_credentials" as never)
      .insert({
        email:         pending.email,
        password_hash: pending.password_hash,
        updated_at:    now,
      } as never);

    if (error) throw error;

    await syncUserProfileIdentity({
      email: pending.email,
      name:  pending.display_name ?? null,
    });

    await deletePendingSignup(pending.email);

    // Welcome email replaces the "confirm" one from this point on.
    sendWelcomeEmail(pending.email, pending.display_name ?? undefined).catch((err) =>
      console.warn("[verify] welcome email failed:", err),
    );

    return NextResponse.redirect(
      `${APP_URL}/auth/verified?email=${encodeURIComponent(pending.email)}`,
    );
  } catch (error) {
    console.error("[verify] account creation failed:", error);
    return NextResponse.redirect(`${APP_URL}/auth/verify-email?status=error`);
  }
}
