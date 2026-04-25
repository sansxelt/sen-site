import OpenAI from "openai";
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

export const runtime = "nodejs";

const client = new OpenAI();

type ImageSize = "1024x1024" | "1024x1792" | "1792x1024";

const ALLOWED_SIZES: ImageSize[] = ["1024x1024", "1024x1792", "1792x1024"];

// POST /api/ai/image
// Body: { prompt: string, size?: "1024x1024" | "1024x1792" | "1792x1024" }
// Returns: { url: string, revised_prompt?: string }
//
// One-shot image generation for inline rendering in the sansxel chat.
// Auth is Bearer (desktop) → cookie (web). Plan-gated via
// decideImageRequest: free is capped weekly, pro/teams/enterprise are
// uncapped. Returns a data URL when the model gives back base64, or
// the hosted URL when it returns one.
export async function POST(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: { prompt?: unknown; size?: unknown };
  try {
    payload = (await request.json()) as { prompt?: unknown; size?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const prompt =
    typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "Missing prompt." }, { status: 400 });
  }
  // Cap prompt length so a runaway message can't drain credit.
  const safePrompt = prompt.slice(0, 4000);

  const requestedSize =
    typeof payload.size === "string" && (ALLOWED_SIZES as string[]).includes(payload.size)
      ? (payload.size as ImageSize)
      : "1024x1024";

  const surface =
    request.headers.get("x-sansxel-surface") === "desktop" ? "desktop" : "web";

  // Plan gate
  const plan = await getPlanForEmail(email);
  const weekly = await getWeeklyUsage(email);
  const decision = decideImageRequest({ plan, weekly });
  // v0.1.8 — image_credit_pack override (legacy v0.1.8 boost path; the
  // image_credit_pack SKU was dropped in v0.1.9 so hasUnconsumedBoost
  // for "image" always returns false now, but the path is kept so any
  // already-purchased boost rows in boost_credits keep redeeming).
  // v0.1.9 — fall through to consumeCreditFor as the new default.
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
          error: decision.reason,
          limit: decision.limit,
          used: decision.used,
          reset: decision.reset,
        },
        { status: 429 },
      );
    }
  }

  const startedAt = Date.now();
  const model = "gpt-image-1";

  try {
    const result = await client.images.generate({
      model,
      prompt: safePrompt,
      size: requestedSize,
      n: 1,
    });

    const first = result.data?.[0];
    if (!first) {
      return NextResponse.json(
        { error: "No image returned." },
        { status: 502 },
      );
    }

    // gpt-image-1 returns base64 by default; dall-e-3 can return a
    // hosted URL. Handle both so the route survives a model swap.
    let url: string | null = null;
    if (typeof first.b64_json === "string" && first.b64_json) {
      url = `data:image/png;base64,${first.b64_json}`;
    } else if (typeof first.url === "string" && first.url) {
      url = first.url;
    }
    if (!url) {
      return NextResponse.json(
        { error: "Image response had no usable url." },
        { status: 502 },
      );
    }

    void recordUsage({
      email,
      kind: "image",
      model,
      surface,
      input_tokens: safePrompt.length,
      duration_ms: Date.now() - startedAt,
    });

    const revised =
      typeof first.revised_prompt === "string" ? first.revised_prompt : null;

    return NextResponse.json(
      revised ? { url, revised_prompt: revised } : { url },
      { status: 200 },
    );
  } catch (err) {
    console.error("ai/image failed:", err);
    const message =
      err instanceof Error ? err.message : "Could not generate image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
