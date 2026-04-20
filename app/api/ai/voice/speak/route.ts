import OpenAI from "openai";
import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../../lib/desktop-auth";
import { recordUsage } from "../../../../../lib/usage";
import { getPlanForEmail } from "../../../../../lib/account-billing";
import {
  consumeBoostForKind,
  consumeCreditFor,
  decideVoiceRequest,
  getWeeklyUsage,
  hasUnconsumedBoost,
} from "../../../../../lib/plan-limits";

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

  const startedAt = Date.now();
  const surface =
    request.headers.get("x-sansxel-surface") === "desktop" ? "desktop" : "web";

  // Voice cap: free can't speak at all on web (handled client-side
  // too), apprentice/studio have weekly minute caps. The estimated
  // seconds for THIS request is ~text.length / 14.
  const projectedSeconds = Math.max(1, Math.round(text.length / 14));
  const plan = await getPlanForEmail(email);
  const weekly = await getWeeklyUsage(email);
  const voiceDecision = decideVoiceRequest({
    plan,
    weekly,
    added_seconds: projectedSeconds,
  });
  if (voiceDecision.kind === "blocked") {
    // v0.1.8 — legacy voice_minute_pack override (the SKU was dropped
    // in v0.1.9 but already-purchased boost rows still redeem here).
    // v0.1.9 — fall through to credits if no boost is available.
    let allowed = false;
    if (await hasUnconsumedBoost(email, "voice")) {
      const burnt = await consumeBoostForKind(email, "voice");
      if (burnt) allowed = true;
    }
    if (!allowed && (await consumeCreditFor(email, "voice_minute"))) {
      allowed = true;
    }
    if (!allowed) {
      return NextResponse.json(
        {
          error: voiceDecision.reason,
          limit: voiceDecision.limit,
          used: voiceDecision.used,
          reset: voiceDecision.reset,
        },
        { status: 429 },
      );
    }
  }

  try {
    const speech = await client.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice,
      input: text,
      response_format: "mp3",
    });

    const arrayBuf = await speech.arrayBuffer();
    // TTS pricing is per character on OpenAI; use char count as the
    // input metric. ~140 wpm reading speed → audio_seconds estimate.
    const charCount = text.length;
    const estimatedSeconds = Math.round((charCount / 14) * 0.6) / 10; // ~14 chars/sec @ 140wpm
    void recordUsage({
      email,
      kind: "voice_speak",
      model: "gpt-4o-mini-tts",
      surface,
      input_tokens: charCount,
      audio_seconds: estimatedSeconds,
      duration_ms: Date.now() - startedAt,
    });

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
