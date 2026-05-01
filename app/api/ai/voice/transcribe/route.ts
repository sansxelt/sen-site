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
import { getActiveAddonKeys } from "../../../../../lib/active-addons";

export const runtime = "nodejs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "missing" });

// POST /api/ai/voice/transcribe
// multipart/form-data with field "audio" (any audio file the browser
// or Tauri can produce, webm, mp4, wav, m4a). Returns { text }.
export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob)) {
    return NextResponse.json({ error: "Missing audio." }, { status: 400 });
  }

  // OpenAI SDK accepts a File-like object. The Blob alone doesn't
  // carry a name/type the API expects, so wrap it.
  const file = new File([audio], "audio.webm", {
    type: audio.type || "audio/webm",
  });

  const startedAt = Date.now();
  const surface =
    request.headers.get("x-sansxel-surface") === "desktop" ? "desktop" : "web";

  // v0.1.16, Plan gate. Same model the speak route uses: estimate
  // seconds from audio size (worst case ~24 kbps Opus = 3 KB/s, so
  // bytes/3000 over-estimates which is the safe direction for cap
  // checks). Call decideVoiceRequest with that estimate, fall back
  // to boost/credit ledger when the cap is hit. Without this gate,
  // any signed-in user could burn unlimited Whisper minutes.
  const projectedSeconds = Math.max(1, Math.ceil(audio.size / 3000));
  const [plan, weekly, activeAddons] = await Promise.all([
    getPlanForEmail(email),
    getWeeklyUsage(email),
    getActiveAddonKeys(email),
  ]);
  const decision = decideVoiceRequest({
    plan,
    weekly,
    added_seconds: projectedSeconds,
    activeAddons,
  });
  if (decision.kind === "blocked") {
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
          error: decision.reason,
          limit: decision.limit,
          used: decision.used,
          reset: decision.reset,
        },
        { status: 429 },
      );
    }
  }

  try {
    const result = await client.audio.transcriptions.create({
      file,
      model: "gpt-4o-mini-transcribe",
    });
    void recordUsage({
      email,
      kind: "voice_transcribe",
      model: "gpt-4o-mini-transcribe",
      surface,
      // Whisper doesn't return token usage; approximate with byte size
      // for cost-class tracking. Refine later if we add server-side
      // duration estimation.
      input_tokens: Math.ceil(audio.size / 1024), // KB as a rough proxy
      duration_ms: Date.now() - startedAt,
      audio_seconds: projectedSeconds,
    });
    return NextResponse.json({ text: result.text });
  } catch (err) {
    console.error("voice/transcribe failed:", err);
    return NextResponse.json(
      { error: "Could not transcribe." },
      { status: 500 },
    );
  }
}
