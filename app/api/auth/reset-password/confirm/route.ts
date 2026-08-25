import { hash } from "bcryptjs";
import { bumpTokenVersion } from "@/lib/v-session-revocation";
import { revokeAllDesktopSessions } from "@/lib/desktop-auth";
import { NextResponse } from "next/server";
import { sendPasswordResetConfirmEmail } from "../../../../../lib/email";
import { consumeResetToken, verifyResetToken } from "../../../../../lib/password-reset";
import { getSupabaseAdminClient } from "../../../../../lib/supabase-admin";
import { getUserProfileByEmail } from "../../../../../lib/user-profile";

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

    // END EVERY EXISTING SESSION. The session strategy is JWT, so changing the password did NOT previously
    // invalidate the sessions the OLD password had created — which is exactly backwards from what someone
    // resetting a compromised password expects. Bumping the revocation counter refuses every token issued
    // before now, on every device.
    //
    // Failure is logged, not thrown: the password IS already changed at this point, and turning a
    // successful reset into an error would leave the user unable to tell whether it worked. The reset
    // still succeeded; what failed is the extra containment.
    const bumped = await bumpTokenVersion(email, "password_reset");
    if (bumped === null) {
      console.error("[reset-password/confirm] password changed but web sessions could NOT be revoked for this user");
    }

    // Desktop clients authenticate with an opaque bearer token, not a JWT, so the web revocation counter
    // cannot reach them — they need their own account-wide sweep. A password reset is precisely the event
    // that should reach every device, so it runs here.
    //
    // Ordinary web sign-out deliberately does NOT do this: closing a browser tab must not sign a laptop
    // app out. This is the "my account may be compromised" path, not the "I'm done for now" path.
    const desktop = await revokeAllDesktopSessions(email, "password_reset");
    if (desktop === null) {
      console.error("[reset-password/confirm] password changed but desktop sessions could NOT be revoked");
    }

    // "Your password was reset" confirmation, fire-and-forget.
    // Look up the display name so the greeting reads "Hi <name>,"
    // instead of the anonymous "Hi,".
    const profile    = await getUserProfileByEmail(email);
    const displayName = profile?.display_name ?? "";
    sendPasswordResetConfirmEmail(email, displayName).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password reset confirm failed:", error);

    return NextResponse.json(
      { error: "We couldn't reset your password. Please request a new link." },
      { status: 400 },
    );
  }
}
