import OpenAI from "openai";
import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";

export const runtime = "nodejs";

const client = new OpenAI();

// POST /api/ai/voice/speak  → returns audio/mpeg
// Body: { text: string }
// Synthesizes speech from text via OpenAI TTS. The desktop / web
// receive a binary mp3 stream they can play.
export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: { text?: string };
  try {
    payload = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!payload.text || typeof payload.text !== "string") {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }

  // Cap input so a runaway message can't drain credit.
  const text = payload.text.slice(0, 4096);

  try {
    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "shimmer",
      input: text,
      response_format: "mp3",
    });

    const arrayBuf = await speech.arrayBuffer();
    return new Response(arrayBuf, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("voice/speak failed:", err);
    return NextResponse.json(
      { error: "Could not synthesize speech." },
      { status: 500 },
    );
  }
}
