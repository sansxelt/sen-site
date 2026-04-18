import { NextResponse } from "next/server";
import { APP_URL } from "../../../../lib/stripe";
import { sendVerifyAccountEmail } from "../../../../lib/email";
import { upsertPendingSignup } from "../../../../lib/pending-signup";
import { isDatabaseConfigured } from "../../../../lib/supabase-admin";
import { getUserCredentialByEmail } from "../../../../lib/user-credentials";

type RegisterPayload = {
  email?:    string;
  name?:     string;
  password?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/register
 *
 * Creates a **pending** signup — password hash is stashed in
 * pending_signups along with a verification token.  An email with
 * that token goes out; the real user_credentials / user_profiles
 * rows only get created when /api/auth/verify consumes the token.
 *
 * Client should redirect to /auth/verify-email after a 200 here.
 */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "Email sign-in is not configured in this environment yet. Please try again shortly." },
      { status: 503 },
    );
  }

  let payload: RegisterPayload;
  try {
    payload = (await request.json()) as RegisterPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email    = payload.email?.trim().toLowerCase() ?? "";
  const name     = payload.name?.trim() ?? "";
  const password = payload.password ?? "";

  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Use a password with at least 8 characters." },
      { status: 400 },
    );
  }

  // Already a real account?
  const existingCredential = await getUserCredentialByEmail(email);
  if (existingCredential) {
    return NextResponse.json(
      { error: "That email already has a sansxel account. Sign in instead." },
      { status: 409 },
    );
  }

  try {
    // Upsert the pending row — re-registering replaces any prior pending
    // attempt + invalidates the old token.
    const { token, expiresAt } = await upsertPendingSignup({ email, password, name });

    // Build the verify URL and compute a human-readable expiry label.
    const verifyUrl = `${APP_URL}/api/auth/verify?token=${encodeURIComponent(token)}`;
    const hoursLeft = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 3_600_000));
    const expiryLabel = hoursLeft === 1 ? "1 hour" : `${hoursLeft} hours`;

    // Fire-and-forget — we don't want an email hiccup to roll back the
    // pending row.  User can resend from /auth/verify-email if needed.
    sendVerifyAccountEmail({
      email,
      name,
      verifyUrl,
      expiryLabel,
    }).catch((err) => console.warn("[register] verify email failed:", err));

    return NextResponse.json({ ok: true, verify: "pending", email });
  } catch (error) {
    console.error("Registration failed:", error);
    return NextResponse.json(
      { error: "We couldn't create your account right now. Please try again shortly." },
      { status: 400 },
    );
  }
}
