import { NextResponse } from "next/server";
import { sendVerifyAccountEmail } from "../../../../lib/email";
import {
  findPendingByEmail,
  rotatePendingToken,
} from "../../../../lib/pending-signup";
import { allowStrict, limitOr429 } from "../../../../lib/vraelis-ratelimit";
import type { NextRequest } from "next/server";
import { APP_URL } from "../../../../lib/stripe";
import { canonicalizeEmail, getUserCredentialByEmail } from "../../../../lib/user-credentials";

type ResendPayload = { email?: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/resend-verification
 * Body: { email }
 *
 * Regenerates the token on the pending_signups row for the given
 * email and emails a fresh link.  Responds with a generic success
 * whether or not a pending row exists, so the endpoint can't be
 * used to enumerate email addresses.
 *
 * Rate-limited to 3 requests / 10 min / IP so it can't be weaponized
 * as a "spam their inbox" vector.
 */
// SECURITY (finding H5, follow-up): this route was the bypass for the cap added to /api/auth/register.
// One register call creates the pending_signups row; every call here re-sends the verification email to
// that same inbox. Its original limiter did not stop it for two reasons: it read cf-connecting-ip first
// (a header Vercel never sets, so a caller minted a fresh bucket per request), and it used
// lib/rate-limit's in-memory Map, which is per-lambda-instance and resets on cold start. There was also
// no per-mailbox bucket at all, so the single-inbox flood was bounded by nothing.
export async function POST(request: NextRequest) {
  // ── Rate limit ──────────────────────────────────────────────
  const limited = await limitOr429(request, "resend-verify", 3, 600);
  if (limited) return limited;

  let payload: ResendPayload;
  try {
    payload = (await request.json()) as ResendPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase() ?? "";
  if (!emailPattern.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Already a real account?, tell the user plainly (doesn't leak info
  // because the signup form would've said the same thing on initial
  // register attempt).
  const existing = await getUserCredentialByEmail(email);
  if (existing) {
    return NextResponse.json(
      { error: "That email already has a verified Vraelis account. Sign in instead." },
      { status: 409 },
    );
  }

  // Rotate the token if a pending row exists; silently succeed otherwise
  // (don't leak whether the email is in the pending table).
  try {
    // Look BEFORE rotating. rotatePendingToken is a destructive write — it overwrites the token and
    // expiry, invalidating whatever link is already sitting in the user's inbox.
    //
    // Gating AFTER the rotation created a fresh, unauthenticated signup lockout: an attacker could poll
    // this route, rotating the victim's live token on every request while the per-mailbox budget stopped
    // any replacement email from being sent. The victim's link would die seconds after arriving and no new
    // one would ever come. Same ordering defect this codebase already fixed in
    // app/api/auth/reset-password/route.ts — consume the budget only where a send actually happens, and
    // never mutate state on a request that will be suppressed.
    const existingPending = await findPendingByEmail(email);
    if (existingPending) {
      // Per-mailbox budget, canonicalised so gmail dot/+tag aliases share one bucket. allowStrict: a
      // limiter outage must deny rather than restore the flood. Silent on exceed — the caller must not
      // learn whether a pending row exists.
      if (!(await allowStrict(`resend-verify-email:${canonicalizeEmail(email)}`, 3, 3600))) {
        console.warn("[resend-verification] send suppressed by per-mailbox limit");
        return NextResponse.json({ ok: true });
      }
    }
    const rotated = existingPending ? await rotatePendingToken(email) : null;
    if (rotated) {
      const pending = existingPending;
      const verifyUrl = `${APP_URL}/api/auth/verify?token=${encodeURIComponent(rotated.token)}`;
      const hoursLeft = Math.max(1, Math.round((rotated.expiresAt.getTime() - Date.now()) / 3_600_000));
      const expiryLabel = hoursLeft === 1 ? "1 hour" : `${hoursLeft} hours`;

      await sendVerifyAccountEmail({
        email,
        name:        pending?.display_name ?? "",
        verifyUrl,
        expiryLabel,
      });
    }
  } catch (err) {
    console.error("[resend-verification] failed:", err);
    // Still return ok, don't leak whether the email is pending.
  }

  return NextResponse.json({ ok: true });
}
