import { NextResponse } from "next/server";
import { signAutoSigninToken } from "../../../../lib/auto-signin-token";
import { sendWelcomeEmail } from "../../../../lib/email";
import {
  deletePendingSignup,
  findPendingByToken,
  isPendingExpired,
} from "../../../../lib/pending-signup";
import { APP_URL } from "../../../../lib/stripe";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import { syncUserProfileIdentity } from "../../../../lib/user-profile";
import { getUserCredentialByEmail, getUserCredentialByCanonical, canonicalizeEmail } from "../../../../lib/user-credentials";
import { trackServer } from "../../../../lib/analytics";

/**
 * Build the redirect target that kicks off auto-signin on whatever
 * device clicked the email link.  The auto-signin page immediately
 * POSTs the token to NextAuth's credentials provider on mount.
 */
function autoSigninRedirect(email: string): string {
  const token = signAutoSigninToken(email);
  const params = new URLSearchParams({ email, token });
  return `${APP_URL}/auth/auto-signin?${params.toString()}`;
}

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

  // Expired?, route to the landing page so the user can resend.
  if (isPendingExpired(pending)) {
    return NextResponse.redirect(
      `${APP_URL}/auth/verify-email?status=expired&email=${encodeURIComponent(pending.email)}`,
    );
  }

  // Race guard, if somehow user_credentials already exists (user double-
  // clicked the link, or verified in a second tab), just treat it as
  // success and clean up the stale pending row, then auto-sign them in.
  const alreadyVerified = await getUserCredentialByEmail(pending.email);
  if (alreadyVerified) {
    await deletePendingSignup(pending.email);
    return NextResponse.redirect(autoSigninRedirect(pending.email));
  }

  // An alias of an inbox that already has an account (verified under a different alias). Same
  // person, so don't mint a second account (and a second signup grant): clean up the pending
  // row and send them to sign in with their existing account.
  const canonicalOwner = await getUserCredentialByCanonical(pending.email);
  if (canonicalOwner) {
    await deletePendingSignup(pending.email);
    return NextResponse.redirect(`${APP_URL}/signin`);
  }

  // Happy path, promote pending → real user.  Insert the credential row
  // directly (password is already hashed in the pending row, so we don't
  // call createUserCredential which would double-hash).
  try {
    const supabase = getSupabaseAdminClient();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("user_credentials" as never)
      .insert({
        email:          pending.email,
        canonical_email: canonicalizeEmail(pending.email),
        password_hash:  pending.password_hash,
        updated_at:     now,
      } as never);

    if (error) {
      // A unique violation means a concurrent verification (exact dupe or a canonical alias)
      // won the race and created the account. Not a user-facing error: send them to sign in.
      if ((error as { code?: string }).code === "23505") {
        await deletePendingSignup(pending.email);
        return NextResponse.redirect(`${APP_URL}/signin`);
      }
      throw error;
    }

    await syncUserProfileIdentity({
      email: pending.email,
      name:  pending.display_name ?? null,
    });

    await deletePendingSignup(pending.email);

    // Conversion: account is now real (email verified). Server-side so it can't
    // be dropped by an ad-blocker. Fire-and-forget; never blocks the redirect.
    void trackServer("signup", { email: pending.email, clientId: pending.email });

    // Welcome email replaces the "confirm" one from this point on.
    sendWelcomeEmail(pending.email, pending.display_name ?? undefined).catch((err) =>
      console.warn("[verify] welcome email failed:", err),
    );

    // Auto-signin: the user just proved email ownership by clicking
    // the link, so we trust them enough to skip the "sign in" screen
    // and drop them straight into the app on whatever device they
    // clicked the link on.
    return NextResponse.redirect(autoSigninRedirect(pending.email));
  } catch (error) {
    console.error("[verify] account creation failed:", error);
    return NextResponse.redirect(`${APP_URL}/auth/verify-email?status=error`);
  }
}
