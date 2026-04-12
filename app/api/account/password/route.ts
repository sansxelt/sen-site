import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getSupabaseAdminClient } from "../../../../lib/supabase-admin";
import {
  getUserCredentialByEmail,
  verifyPassword,
} from "../../../../lib/user-credentials";

type PasswordPayload = {
  currentPassword?: string;
  newPassword?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: PasswordPayload;

  try {
    payload = (await request.json()) as PasswordPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { currentPassword = "", newPassword = "" } = payload;

  if (!currentPassword) {
    return NextResponse.json(
      { error: "Enter your current password." },
      { status: 400 },
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const credential = await getUserCredentialByEmail(email);

  if (!credential) {
    return NextResponse.json(
      { error: "No password-based account found for this email." },
      { status: 400 },
    );
  }

  const valid = await verifyPassword(currentPassword, credential.password_hash);

  if (!valid) {
    return NextResponse.json(
      { error: "Current password is incorrect." },
      { status: 400 },
    );
  }

  try {
    const newHash = await hash(newPassword, 12);
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

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password update failed:", error);

    return NextResponse.json(
      { error: "We couldn't update your password. Please try again." },
      { status: 400 },
    );
  }
}
