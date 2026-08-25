import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sendPasswordResetEmail } from "../../../../lib/email";
import { createPasswordResetToken } from "../../../../lib/password-reset";
import { isDatabaseConfigured } from "../../../../lib/supabase-admin";
import { canonicalizeEmail, getUserCredentialByEmail } from "../../../../lib/user-credentials";
import { allowStrict, limitOr429 } from "../../../../lib/vraelis-ratelimit";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// SECURITY (finding H5): this route had NO rate limit. Each accepted request costs a Resend send, so it
// was an unauthenticated mail-bomb aimed at any address that has an account. Its sibling
// /api/auth/resend-verification already carried a limiter and a comment describing this exact vector.
//
// Two buckets, at DIFFERENT points, and the difference matters:
//   - per IP, first, before any work — so one source cannot sweep many addresses.
//   - per CANONICAL mailbox, consumed ONLY where a message is actually sent (inside the `if (credential)`
//     branch). Checking it earlier made the route a silent account-recovery lockout, because an address
//     with no account sends nothing yet still burned the canonical bucket of a real one.
// Both use the Postgres-backed limiter (shared across serverless instances), not lib/rate-limit's
// per-instance in-memory Map. The per-mailbox gate uses allowStrict, so a limiter outage denies the send
// instead of restoring the unlimited mail-bomb.
//
// Enumeration: every path returns {ok:true} with the same body, and the provider call is fire-and-forget
// so an address with an account no longer takes measurably longer than one without.
export async function POST(request: NextRequest) {
  const limited = await limitOr429(request, "pwreset", 3, 600);
  if (limited) return limited;

  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Password reset is not available in this environment yet." },
      { status: 503 },
    );
  }

  let payload: { email?: string };

  try {
    payload = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase() ?? "";

  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  // Always return success to avoid leaking whether an account exists.
  const credential = await getUserCredentialByEmail(email);

  if (credential) {
    // CONSUME THE PER-MAILBOX BUDGET ONLY WHEN A MESSAGE IS ACTUALLY GOING OUT.
    //
    // Checking it earlier turned this route into a silent account-recovery lockout. The bucket key is
    // canonicalised (+tags stripped on every domain) but the credential lookup uses the RAW address, so
    // "bob+1@acme.com" — which has no account and therefore sends nothing — still burned bob@acme.com's
    // budget. Three such requests an hour, well inside the per-IP allowance, left the real bob unable to
    // receive a reset while the UI kept saying "check your email".
    //
    // Consuming on send makes the budget mean what it says: at most 3 reset emails per mailbox per hour.
    // A request for an address with no account costs nothing, so it cannot deny service to anyone.
    if (!(await allowStrict(`pwreset-email:${canonicalizeEmail(email)}`, 3, 3600))) {
      // Visible in logs, unlike before: an operator can tell this apart from a delivery failure.
      console.warn("[auth/reset-password] send suppressed by per-mailbox limit");
      return NextResponse.json({ ok: true });
    }
    try {
      const token = await createPasswordResetToken(email);
      const baseUrl =
        process.env.AUTH_URL ??
        process.env.NEXTAUTH_URL ??
        "https://vraelis.com";
      const resetUrl = `${baseUrl}/auth/reset-password/confirm?token=${token}`;

      // Fire-and-forget. Awaiting the provider call made this route a practical account-existence oracle:
      // an address with an account took several hundred ms longer than one without, separable from a
      // handful of samples. The response now returns without waiting on the network round trip.
      void sendPasswordResetEmail(email, resetUrl).catch((error) => {
        console.error("Password reset email failed:", error);
      });
    } catch (error) {
      console.error("Password reset token/email failed:", error);
    }
  }

  return NextResponse.json({ ok: true });
}
