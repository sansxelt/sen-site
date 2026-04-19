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
  const rawText = payload.text.slice(0, 4096);

  // Force the TTS model to pronounce the brand correctly. Without
  // this, "sansxel" comes out closer to "san-zell" or "sans-ex-el".
  // The brand should sound like "sans-zul".
  const text = rawText
    .replace(/\bsansxel-1\b/gi, "sans-zul one")
    .replace(/\bsansxel-?2\b/gi, "sans-zul two")
    .replace(/\bsansxel\b/gi, "sans-zul");

  // Optional voice from client. Default is fable (British, expressive)
  // because that's the brand voice we want when nothing's set.
  const voice =
    typeof (payload as { voice?: string }).voice === "string"
      ? ((payload as { voice?: string }).voice as
          | "alloy" | "ash" | "ballad" | "coral" | "echo"
          | "fable" | "nova" | "onyx" | "sage" | "shimmer" | "verse")
      : "fable";

  try {
    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
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
