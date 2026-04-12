import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "../../../../lib/supabase-admin";
import { syncUserProfileIdentity } from "../../../../lib/user-profile";
import {
  createUserCredential,
  getUserCredentialByEmail,
} from "../../../../lib/user-credentials";

type RegisterPayload = {
  email?: string;
  name?: string;
  password?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Email sign-in is not configured in this environment yet. Please try again shortly.",
      },
      { status: 503 },
    );
  }

  let payload: RegisterPayload;

  try {
    payload = (await request.json()) as RegisterPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase() ?? "";
  const name = payload.name?.trim() ?? "";
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

  const existingCredential = await getUserCredentialByEmail(email);

  if (existingCredential) {
    return NextResponse.json(
      { error: "That email already has a sansxel account. Sign in instead." },
      { status: 409 },
    );
  }

  try {
    await createUserCredential(email, password);
    await syncUserProfileIdentity({
      email,
      name,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Registration failed:", error);

    return NextResponse.json(
      {
        error:
          "We couldn't create your account right now. Please try again shortly.",
      },
      { status: 400 },
    );
  }
}
