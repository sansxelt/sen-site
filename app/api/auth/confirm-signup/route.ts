import { NextResponse } from "next/server";
import { verifyOAuthSignupToken } from "../../../../lib/oauth-signup-token";
import { sendWelcomeEmail } from "../../../../lib/email";
import {
  getUserProfileByEmail,
  syncUserProfileIdentity,
} from "../../../../lib/user-profile";

export async function POST(req: Request) {
  let body: { email?: string; provider?: string; name?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email    = typeof body.email    === "string" ? body.email.trim().toLowerCase() : "";
  const provider = typeof body.provider === "string" ? body.provider.trim()            : "";
  const name     = typeof body.name     === "string" ? body.name.trim()                : "";
  const token    = typeof body.token    === "string" ? body.token                      : "";

  if (!email || !provider || !token) {
    return NextResponse.json(
      { error: "Missing email, provider, or token." },
      { status: 400 },
    );
  }

  if (!verifyOAuthSignupToken(token, { email, provider })) {
    return NextResponse.json(
      { error: "Signup link expired or invalid. Please start over from sign in." },
      { status: 400 },
    );
  }

  // If a profile was already created between the page load and this POST
  // (e.g. a tab race), don't double-create, just proceed.
  const existing = await getUserProfileByEmail(email);
  if (existing) {
    return NextResponse.json({ ok: true, alreadyExisted: true });
  }

  try {
    await syncUserProfileIdentity({ email, name: name || null });
  } catch (err) {
    console.error("confirm-signup: profile create failed:", err);
    return NextResponse.json(
      { error: "We couldn't create your account. Please try again." },
      { status: 500 },
    );
  }

  // Fire-and-forget welcome, profile is already live, don't block on mail.
  sendWelcomeEmail(email, name).catch(() => {});

  return NextResponse.json({ ok: true });
}
