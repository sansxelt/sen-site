import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { sendVerifyAccountEmail } from "../../../../lib/email";
import {
  findPendingByEmail,
  rotatePendingToken,
} from "../../../../lib/pending-signup";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { APP_URL } from "../../../../lib/stripe";
import { getUserCredentialByEmail } from "../../../../lib/user-credentials";

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
export async function POST(request: Request) {
  // ── Rate limit ──────────────────────────────────────────────
  const headersList = await headers();
  const ip =
    headersList.get("cf-connecting-ip") ??
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!checkRateLimit(ip, 3, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: "Too many resend attempts. Wait a few minutes and try again." },
      { status: 429 },
    );
  }

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
      { error: "That email already has a verified VRAELIS account. Sign in instead." },
      { status: 409 },
    );
  }

  // Rotate the token if a pending row exists; silently succeed otherwise
  // (don't leak whether the email is in the pending table).
  try {
    const rotated = await rotatePendingToken(email);
    if (rotated) {
      const pending = await findPendingByEmail(email);
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
