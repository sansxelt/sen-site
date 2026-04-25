import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { consumeCredits, CREDIT_COSTS } from "../../../../lib/credits";
import { recordUsage } from "../../../../lib/usage";

export const runtime = "nodejs";

const client = new Anthropic();

// POST /api/ai/vision
// Body: { image_data_url: string (data:image/...), mime?: string, prompt?: string }
// Returns: { text: string }
//
// Multimodal one-shot: takes a base64 image + a question and returns a
// short analysis. Used by the LEI image panel "Analyze" button. Burns
// `image` credits (5 per call) — same cost surface as image gen so
// users have a single mental model.
export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: { image_data_url?: unknown; mime?: unknown; prompt?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const dataUrl = typeof payload.image_data_url === "string" ? payload.image_data_url : "";
  const mimeIn = typeof payload.mime === "string" ? payload.mime : "";
  const userPrompt =
    typeof payload.prompt === "string" && payload.prompt.trim()
      ? payload.prompt.trim().slice(0, 1000)
      : "Describe what you see and call out anything notable.";

  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) {
    return NextResponse.json({ error: "image_data_url must be a data: URL." }, { status: 400 });
  }
  const mime = (mimeIn || m[1] || "image/png").toLowerCase();
  const b64 = m[2];

  if (!/^image\/(png|jpeg|jpg|webp|gif)$/.test(mime)) {
    return NextResponse.json({ error: "Unsupported image type." }, { status: 415 });
  }

  // Budget guard — base64 length × 0.75 ≈ bytes; cap at ~10 MB raw.
  if (b64.length > 14_000_000) {
    return NextResponse.json({ error: "Image too large (10 MB max)." }, { status: 413 });
  }

  const ref = `vision:${email}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
  const charged = await consumeCredits(email, CREDIT_COSTS.image, "consume", ref);
  if (!charged.ok) {
    return NextResponse.json(
      { error: "Not enough credits. Top up to analyze images.", remaining: charged.remaining },
      { status: 402 },
    );
  }

  const startedAt = Date.now();
  try {
    const result = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mime as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
                data: b64,
              },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    });

    const text =
      result.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("\n")
        .trim() || "(no description returned)";

    void recordUsage({
      email,
      kind: "image",
      model: "claude-sonnet-4-6-vision",
      surface: request.headers.get("x-sansxel-surface") === "desktop" ? "desktop" : "web",
      input_tokens: Math.round(b64.length / 4),
      duration_ms: Date.now() - startedAt,
    });

    return NextResponse.json({ text }, { status: 200 });
  } catch (err) {
    console.error("ai/vision failed:", err);
    const message = err instanceof Error ? err.message : "Vision call failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
