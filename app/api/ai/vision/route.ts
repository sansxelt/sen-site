import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { recordUsage } from "../../../../lib/usage";
import { getPlanForEmail } from "../../../../lib/account-billing";
import {
  consumeBoostForKind,
  consumeCreditFor,
  decideImageRequest,
  getWeeklyUsage,
  hasUnconsumedBoost,
} from "../../../../lib/plan-limits";
import { getActiveAddonKeys } from "../../../../lib/active-addons";

export const runtime = "nodejs";

const client = new Anthropic();

// POST /api/ai/vision
// Body: { image_data_url: string (data:image/...), mime?: string, prompt?: string }
// Returns: { text: string }
//
// Multimodal one-shot: takes a base64 image + a question and returns a
// short analysis. Used by the LEI image panel "Analyze" button. Burns
// `image` credits (5 per call), same cost surface as image gen so
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

  // Budget guard, base64 length × 0.75 ≈ bytes; cap at ~10 MB raw.
  if (b64.length > 14_000_000) {
    return NextResponse.json({ error: "Image too large (10 MB max)." }, { status: 413 });
  }

  // Mirror /api/ai/image gating: plan first (unlimited tiers pass for
  // free), then weekly cap, then boost, then credits. Pro / Teams /
  // Enterprise never see a 402 because their plan covers it.
  // Power Pack lifts the weekly image cap to unlimited.
  const [plan, weekly, activeAddons] = await Promise.all([
    getPlanForEmail(email),
    getWeeklyUsage(email),
    getActiveAddonKeys(email),
  ]);
  const decision = decideImageRequest({ plan, weekly, activeAddons });
  if (decision.kind === "blocked") {
    let allowed = false;
    if (await hasUnconsumedBoost(email, "image")) {
      const burnt = await consumeBoostForKind(email, "image");
      if (burnt) allowed = true;
    }
    if (!allowed && (await consumeCreditFor(email, "image"))) {
      allowed = true;
    }
    if (!allowed) {
      return NextResponse.json(
        {
          error: "You're out of image credits this week. Top up or upgrade to keep analyzing.",
          limit: decision.limit,
          used: decision.used,
          reset: decision.reset,
        },
        { status: 402 },
      );
    }
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
      surface: request.headers.get("x-VRAELIS-surface") === "desktop" ? "desktop" : "web",
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
