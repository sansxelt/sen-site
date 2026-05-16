import OpenAI from "openai";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { recordUsage } from "../../../../lib/usage";
import { recordMetric } from "../../../../lib/metrics";
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
// real key still fail with a 401 from OpenAI, that's the right
// behavior for an unconfigured deploy.
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "missing" });

type ImageSize = "1024x1024" | "1024x1792" | "1792x1024";

const ALLOWED_SIZES: ImageSize[] = ["1024x1024", "1024x1792", "1792x1024"];

// POST /api/ai/image
// Body: { prompt: string, size?: "1024x1024" | "1024x1792" | "1792x1024" }
// Returns: { url: string, revised_prompt?: string }
//
// One-shot image generation for inline rendering in the VRAELIS chat.
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

  let payload: {
    prompt?: unknown;
    size?: unknown;
    thread_id?: unknown;
    count?: unknown;
    project_id?: unknown;
  };
  try {
    payload = (await request.json()) as {
      prompt?: unknown;
      size?: unknown;
      thread_id?: unknown;
      count?: unknown;
      project_id?: unknown;
    };
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

  // Multi-image: client can ask for up to 4 in one call. Capped low
  // because each image is its own credit burn AND the response payload
  // grows linearly (b64 PNGs are 500KB-2MB each).
  const countRaw = Math.floor(Number(payload.count ?? 1));
  const count = Math.min(4, Math.max(1, Number.isFinite(countRaw) ? countRaw : 1));

  const requestedSize =
    typeof payload.size === "string" && (ALLOWED_SIZES as string[]).includes(payload.size)
      ? (payload.size as ImageSize)
      : "1024x1024";

  const surface =
    request.headers.get("x-VRAELIS-surface") === "desktop" ? "desktop" : "web";

  // Plan gate. Power Pack lifts the image cap to unlimited.
  const [plan, weekly, activeAddons] = await Promise.all([
    getPlanForEmail(email),
    getWeeklyUsage(email),
    getActiveAddonKeys(email),
  ]);
  const decision = decideImageRequest({ plan, weekly, activeAddons });
  // v0.1.8, image_credit_pack override (legacy v0.1.8 boost path; the
  // image_credit_pack SKU was dropped in v0.1.9 so hasUnconsumedBoost
  // for "image" always returns false now, but the path is kept so any
  // already-purchased boost rows in boost_credits keep redeeming).
  // v0.1.9, fall through to consumeCreditFor as the new default.
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
      recordMetric({
        kind: "limit_hit",
        email,
        props: {
          surface_kind: "image",
          gate: "image_cap",
          plan,
          used: decision.used,
          limit: decision.limit,
        },
      });
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

  // v0.1.16, Resolve / create the thread + persist the user prompt
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
      const newProjectId =
        typeof payload.project_id === "string" && payload.project_id.trim()
          ? payload.project_id.trim()
          : null;
      const created = await createChatThread(email, undefined, newProjectId);
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
      n: count,
    });

    if (!result.data || result.data.length === 0) {
      return NextResponse.json(
        { error: "No image returned." },
        { status: 502 },
      );
    }

    // gpt-image-1 returns base64 by default; dall-e-3 can return a
    // hosted URL. Handle both so the route survives a model swap.
    const urls: string[] = [];
    let revised: string | null = null;
    for (const img of result.data) {
      if (typeof img.b64_json === "string" && img.b64_json) {
        urls.push(`data:image/png;base64,${img.b64_json}`);
      } else if (typeof img.url === "string" && img.url) {
        urls.push(img.url);
      }
      if (!revised && typeof img.revised_prompt === "string") {
        revised = img.revised_prompt;
      }
    }
    if (urls.length === 0) {
      return NextResponse.json(
        { error: "Image response had no usable urls." },
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

    // Persist the assistant turn with image markdown for each
    // generated image. Multi-image renders as a sequence of
    // ![generated image N](url) blocks separated by newlines
    // the client renderer treats consecutive images as a grid.
    const imageMarkdown = urls
      .map((u, i) => `![generated image ${i + 1}](${u})`)
      .join("\n\n");
    const caption = revised
      ? `*${revised}*\n\n${imageMarkdown}`
      : imageMarkdown;
    if (resolvedThreadId) {
      void saveMessage({
        email,
        threadId: resolvedThreadId,
        role: "assistant",
        content: caption,
        createdAt: assistantTurnAt.toISOString(),
      });
    }

    // Response shape: urls[] is the new canonical field; url is a
    // legacy alias for the first image so existing single-image
    // clients keep working without code changes.
    return NextResponse.json(
      revised
        ? { url: urls[0], urls, revised_prompt: revised }
        : { url: urls[0], urls },
      {
        status: 200,
        headers: {
          "x-VRAELIS-thread-id": resolvedThreadId ?? "",
        },
      },
    );
  } catch (err) {
    console.error("ai/image failed:", err);
    // Sanitize provider errors before returning to the client.
    // OpenAI's safety / rate-limit / billing messages include
    // request IDs, support URLs, and other implementation details
    // we don't want to surface as user-facing copy.
    let message = "Could not generate that image. Try a different prompt.";
    if (err instanceof Error) {
      const raw = err.message ?? "";
      if (/safety system|content_policy|moderation/i.test(raw)) {
        message =
          "That prompt was rejected by the safety filter. Try rephrasing it.";
      } else if (/rate limit|too many requests/i.test(raw)) {
        message =
          "Image gen is rate-limited right now. Try again in a minute.";
      } else if (/billing|quota|insufficient_quota/i.test(raw)) {
        message =
          "Image gen is temporarily unavailable. Try again soon.";
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
