import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import {
  getUserProfileByEmail,
  upsertUserProfile,
} from "../../../../lib/user-profile";

// GET /api/desktop/account — returns the signed-in user's profile
export async function GET(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const profile = await getUserProfileByEmail(email);
    return NextResponse.json({
      email,
      profile: profile ?? {
        email,
        display_name: null,
        focus_area: null,
        work_style: null,
        summary_style: "balanced",
        release_channel: "stable",
      },
    });
  } catch (err) {
    console.error("desktop/account.get failed:", err);
    return NextResponse.json(
      { error: "Could not load account." },
      { status: 500 },
    );
  }
}

type AccountPatch = {
  display_name?: string | null;
  focus_area?: string | null;
  work_style?: string | null;
};

// PATCH /api/desktop/account — update editable profile fields
export async function PATCH(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: AccountPatch;
  try {
    payload = (await request.json()) as AccountPatch;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const existing = await getUserProfileByEmail(email);
    const next = await upsertUserProfile(email, {
      displayName:
        payload.display_name !== undefined
          ? payload.display_name
          : existing?.display_name ?? null,
      focusArea:
        payload.focus_area !== undefined
          ? payload.focus_area
          : existing?.focus_area ?? null,
      workStyle:
        payload.work_style !== undefined
          ? payload.work_style
          : existing?.work_style ?? null,
      releaseChannel: existing?.release_channel,
      summaryStyle: existing?.summary_style,
      earlyAccessRequestedAt: existing?.early_access_requested_at ?? null,
    });
    return NextResponse.json({ email, profile: next });
  } catch (err) {
    console.error("desktop/account.patch failed:", err);
    return NextResponse.json(
      { error: "Could not save account." },
      { status: 500 },
    );
  }
}
