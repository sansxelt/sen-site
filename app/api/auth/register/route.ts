import { NextResponse } from "next/server";
import { APP_URL } from "../../../../lib/stripe";
import { sendVerifyAccountEmail } from "../../../../lib/email";
import { upsertPendingSignup } from "../../../../lib/pending-signup";
import {
  SIGNUP_CLAIM_COOKIE,
  signSignupClaim,
} from "../../../../lib/signup-claim-cookie";
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

  if (!name) {
    return NextResponse.json(
      { error: "Add your name so emails address you properly." },
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

    // Set the signed claim cookie so *this* browser can poll
    // /api/auth/check-signup-status and get auto-signed-in when the
    // verify email is clicked on another device.  HTTP-only so JS can't
    // read it; the server decides who gets an auto-signin token.
    const claim    = signSignupClaim(email);
    const response = NextResponse.json({ ok: true, verify: "pending", email });
    response.cookies.set({
      name:     SIGNUP_CLAIM_COOKIE,
      value:    claim.value,
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      path:     "/",
      maxAge:   claim.maxAge,
    });
    return response;
  } catch (error) {
    console.error("Registration failed:", error);
    return NextResponse.json(
      { error: "We couldn't create your account right now. Please try again shortly." },
      { status: 400 },
    );
  }
}
