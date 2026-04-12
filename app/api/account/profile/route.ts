import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import {
  readSessionState,
  type ReleaseChannel,
  type SummaryStyle,
} from "../../../../lib/account-session";
import { getAuthErrorMessage } from "../../../../lib/auth-ui";
import { getUserProfileByEmail, upsertUserProfile } from "../../../../lib/user-profile";

type ProfilePayload = {
  displayName?: string;
  focusArea?: string;
  releaseChannel?: ReleaseChannel;
  summaryStyle?: SummaryStyle;
  workStyle?: string;
};

export async function GET() {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const profile = await getUserProfileByEmail(email);
  const sessionState = readSessionState(session, profile);

  return NextResponse.json({ sessionState });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const email = session?.user?.email ?? null;

  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: ProfilePayload;

  try {
    payload = (await request.json()) as ProfilePayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const existingProfile = await getUserProfileByEmail(email);
    const profile = await upsertUserProfile(email, {
      displayName: payload.displayName,
      earlyAccessRequestedAt: existingProfile?.early_access_requested_at ?? null,
      focusArea: payload.focusArea,
      releaseChannel: payload.releaseChannel ?? existingProfile?.release_channel,
      summaryStyle: payload.summaryStyle ?? existingProfile?.summary_style,
      workStyle: payload.workStyle,
    });

    return NextResponse.json({
      sessionState: readSessionState(session, profile),
    });
  } catch (error) {
    console.error("Profile save failed:", error);

    return NextResponse.json(
      { error: getAuthErrorMessage(error, "profile") },
      { status: 400 },
    );
  }
}
