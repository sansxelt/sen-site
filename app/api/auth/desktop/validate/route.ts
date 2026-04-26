import { NextResponse } from "next/server";
import {
  findActiveSessionByToken,
  touchSession,
} from "../../../../../lib/desktop-auth";
import { getUserProfileByEmail } from "../../../../../lib/user-profile";

// Called by the desktop app on every launch (and before any
// AI-call) to check whether the saved token is still good. Returns
// the user info the desktop UI needs, or 401 if the token has been
// revoked / never existed.
export async function POST(request: Request) {
  let payload: { token?: string };
  try {
    payload = (await request.json()) as { token?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!payload.token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  try {
    const session = await findActiveSessionByToken(payload.token);
    if (!session) {
      return NextResponse.json(
        { error: "Invalid or revoked token." },
        { status: 401 },
      );
    }

    const profile = await getUserProfileByEmail(session.email);

    // Fire-and-forget, failure here doesn't block the validate
    touchSession(session.id).catch((err) =>
      console.warn("touchSession failed:", err),
    );

    return NextResponse.json({
      email: session.email,
      display_name: profile?.display_name ?? null,
      device_label: session.device_label,
    });
  } catch (error) {
    console.error("desktop/validate failed:", error);
    return NextResponse.json(
      { error: "Could not validate session." },
      { status: 500 },
    );
  }
}
