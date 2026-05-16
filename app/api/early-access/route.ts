import { NextResponse } from "next/server";
import { auth } from "../../../auth";
import { sendEarlyAccessEmail } from "../../../lib/email";
import { isDatabaseConfigured } from "../../../lib/supabase-admin";
import {
  getUserProfileByEmail,
  saveEarlyAccessRequest,
  upsertUserProfile,
} from "../../../lib/user-profile";

type EarlyAccessPayload = {
  email?: string;
  focusArea?: string;
  name?: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Early access requests are temporarily unavailable. Please try again shortly.",
      },
      { status: 503 },
    );
  }

  let payload: EarlyAccessPayload;

  try {
    payload = (await request.json()) as EarlyAccessPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = payload.email?.trim().toLowerCase() ?? "";
  const name = payload.name?.trim() ?? "";
  const focusArea = payload.focusArea?.trim() ?? "";

  if (!emailPattern.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const requestedAt = await saveEarlyAccessRequest(email, {
      focusArea,
      name,
      source: "website",
    });
    const session = await auth();
    const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? null;

    if (sessionEmail && sessionEmail === email) {
      const existingProfile = await getUserProfileByEmail(email);

      await upsertUserProfile(email, {
        displayName: name || existingProfile?.display_name,
        earlyAccessRequestedAt: requestedAt,
        focusArea: focusArea || existingProfile?.focus_area,
        releaseChannel: existingProfile?.release_channel,
        summaryStyle: existingProfile?.summary_style,
        workStyle: existingProfile?.work_style,
      });
    }

    void sendEarlyAccessEmail(email, name);

    return NextResponse.json({
      ok: true,
      requestedAt,
    });
  } catch (error) {
    console.error("Early access save failed:", error);

    return NextResponse.json(
      {
        error:
          "We couldn't save your request right now. Please try again or contact help@vraelis.ai.",
      },
      { status: 400 },
    );
  }
}
