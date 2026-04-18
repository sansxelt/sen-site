import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { sendPasswordResetConfirmEmail } from "../../../../../lib/email";
import { consumeResetToken, verifyResetToken } from "../../../../../lib/password-reset";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";

type ConfirmPayload = {
  token?: string;
  password?: string;
};

export async function POST(request: Request) {
  let payload: ConfirmPayload;

  try {
    payload = (await request.json()) as ConfirmPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { token = "", password = "" } = payload;

  if (!token) {
    return NextResponse.json(
      { error: "Reset link is missing or invalid." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const email = await verifyResetToken(token);

  if (!email) {
    return NextResponse.json(
      { error: "This reset link has expired or already been used." },
      { status: 400 },
    );
  }

  try {
    const newHash = await hash(password, 12);
    const supabase = getSupabaseAdminClient();

    const { error } = await supabase
      .from("user_credentials" as never)
      .update({
        password_hash: newHash,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("email", email);

    if (error) {
      throw error;
    }

    await consumeResetToken(token);

    // "Your password was reset" confirmation — fire-and-forget.
    sendPasswordResetConfirmEmail(email, "").catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password reset confirm failed:", error);

    return NextResponse.json(
      { error: "We couldn't reset your password. Please request a new link." },
      { status: 400 },
    );
  }
}
