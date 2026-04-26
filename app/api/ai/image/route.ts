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
import { getActiveAddonKeys } from "../../../../lib/active-addons";
import {
  appendMessage as saveMessage,
  createThread as createChatThread,
  getThread as getChatThread,
} from "../../../../lib/chat-history";

export const runtime = "nodejs";

// Pass an explicit fallback so module-eval at build time on Vercel
// doesn't crash when OPENAI_API_KEY is unset. Runtime calls without a
// real key still fail with a 401 from OpenAI — that's the right
// behavior for an unconfigured deploy.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "missing" });

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

  let payload: { prompt?: unknown; size?: unknown; thread_id?: unknown };
  try {
    payload = (await request.json()) as { prompt?: unknown; size?: unknown; thread_id?: unknown };
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
  const requestedThreadId =
    typeof payload.thread_id === "string" && payload.thread_id.trim()
      ? payload.thread_id.trim()
      : null;

  const requestedSize =
    typeof payload.size === "string" && (ALLOWED_SIZES as string[]).includes(payload.size)
      ? (payload.size as ImageSize)
      : "1024x1024";

  const surface =
    request.headers.get("x-sansxel-surface") === "desktop" ? "desktop" : "web";

  // Plan gate. Power Pack lifts the image cap to unlimited.
  const [plan, weekly, activeAddons] = await Promise.all([
    getPlanForEmail(email),
    getWeeklyUsage(email),
    getActiveAddonKeys(email),
  ]);
  const decision = decideImageRequest({ plan, weekly, activeAddons });
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

  // v0.1.16 — Resolve / create the thread + persist the user prompt
  // BEFORE we kick off image gen. Without this, when the user clicks
  // off and comes back, the prompt is gone and only the rendered
  // image (still in local state) shows up. Mirrors the chat route's
  // pattern: user turn lands first, assistant follows.
  let resolvedThreadId: string | null = null;
  const userTurnAt = new Date();
  const assistantTurnAt = new Date(userTurnAt.getTime() + 2000);
  try {
    if (requestedThreadId) {
      const owned = await getChatThread(email, requestedThreadId);
      resolvedThreadId = owned ? owned.id : null;
    }
    if (!resolvedThreadId) {
      const created = await createChatThread(email);
      if (created) resolvedThreadId = created.id;
    }
    if (resolvedThreadId) {
      void saveMessage({
        email,
        threadId: resolvedThreadId,
        role: "user",
        content: prompt,
        createdAt: userTurnAt.toISOString(),
      });
    }
  } catch (err) {
    console.warn("ai/image thread persist (user turn) failed:", err);
  }

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

    // Persist the assistant turn with the image markdown so the
    // generated image survives a thread switch / reload. The data URL
    // can be 500KB-2MB base64; we accept the storage cost rather than
    // standing up a separate Supabase Storage upload pipeline.
    const caption = revised
      ? `*${revised}*\n\n![generated image](${url})`
      : `![generated image](${url})`;
    if (resolvedThreadId) {
      void saveMessage({
        email,
        threadId: resolvedThreadId,
        role: "assistant",
        content: caption,
        createdAt: assistantTurnAt.toISOString(),
      });
    }

    return NextResponse.json(
      revised ? { url, revised_prompt: revised } : { url },
      {
        status: 200,
        headers: {
          "x-sansxel-thread-id": resolvedThreadId ?? "",
        },
      },
    );
  } catch (err) {
    console.error("ai/image failed:", err);
    const message =
      err instanceof Error ? err.message : "Could not generate image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
