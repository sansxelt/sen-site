import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import {
  isAnthropicConfigured,
  streamRecommendation,
  type CompareAnswers,
} from "../../../../lib/ai-compare";

export const runtime = "nodejs";

const VALID_AUDIENCE = new Set(["me", "team", "org"]);
const VALID_USAGE    = new Set(["light", "daily", "heavy", "hardcore"]);
const VALID_API      = new Set(["no", "maybe", "yes"]);

function isValidAnswers(a: unknown): a is CompareAnswers {
  if (!a || typeof a !== "object") return false;
  const obj = a as Record<string, unknown>;
  return (
    typeof obj.audience === "string" && VALID_AUDIENCE.has(obj.audience) &&
    typeof obj.usage    === "string" && VALID_USAGE.has(obj.usage) &&
    typeof obj.api      === "string" && VALID_API.has(obj.api)
  );
}

/**
 * POST /api/compare/recommend
 * Body: { answers: CompareAnswers, selectedPlanKeys: string[] }
 *
 * Streams Claude's recommendation as plain text.  First line of the output
 * is `PLAN_KEY=<key>` which the client parses to highlight the recommended
 * plan.  Everything after the blank line is the explanation — streamed to
 * the UI character-by-character so the experience feels instant.
 *
 * Requires sign-in (prevents anonymous abuse of the LLM endpoint).
 */
export async function POST(request: Request) {
  if (!isAnthropicConfigured()) {
    return NextResponse.json({ error: "AI advisor not configured." }, { status: 503 });
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Sign in to use the advisor." }, { status: 401 });
  }

  let payload: { answers?: unknown; selectedPlanKeys?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isValidAnswers(payload.answers)) {
    return NextResponse.json({ error: "Invalid answers." }, { status: 400 });
  }
  const selectedPlanKeys = Array.isArray(payload.selectedPlanKeys)
    ? payload.selectedPlanKeys.filter((k): k is string => typeof k === "string")
    : [];

  const encoder = new TextEncoder();
  const anthropicStream = streamRecommendation({
    answers: payload.answers,
    selectedPlanKeys,
  });

  // Forward every text delta from the SDK stream to the browser as plain
  // UTF-8 bytes.  Client reads with a TextDecoder and appends to state.
  //
  // If Anthropic throws (credits exhausted, auth failure, rate limit, etc.),
  // close the stream silently.  The client sees an empty stream and falls
  // back to the heuristic recommendation + plan description — no raw error
  // JSON leaks into the UI.
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[compare/recommend] upstream error:", message);
        // Close silently — do NOT enqueue the error into the stream body.
      } finally {
        controller.close();
      }
    },
    cancel() {
      anthropicStream.controller.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no", // disable nginx buffering on Vercel edge
    },
  });
}
