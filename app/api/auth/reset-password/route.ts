import { NextResponse } from "next/server";
import { sendPasswordResetEmail } from "../../../../lib/email";
import { createPasswordResetToken } from "../../../../lib/password-reset";
import { isDatabaseConfigured } from "../../../../lib/supabase-admin";
import { getUserCredentialByEmail } from "../../../../lib/user-credentials";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
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
    try {
      const token = await createPasswordResetToken(email);
      const baseUrl =
        process.env.AUTH_URL ??
        process.env.NEXTAUTH_URL ??
        "https://vraelis.com";
      const resetUrl = `${baseUrl}/auth/reset-password/confirm?token=${token}`;

      await sendPasswordResetEmail(email, resetUrl);
    } catch (error) {
      console.error("Password reset token/email failed:", error);
    }
  }

  return NextResponse.json({ ok: true });
}
