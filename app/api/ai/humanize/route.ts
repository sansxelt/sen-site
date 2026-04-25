import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import {
  humanizeText,
  type HumanizationTone,
} from "../../../../lib/humanize-engine";

export const runtime = "nodejs";

type HumanizeBody = {
  text?: string;
  tone?: HumanizationTone;
};

export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: HumanizeBody;
  try {
    payload = (await request.json()) as HumanizeBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!payload.text || typeof payload.text !== "string") {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  const text = payload.text.trim();
  if (!text) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  return NextResponse.json({
    text: humanizeText(text, {
      tone: payload.tone,
    }),
  });
}
