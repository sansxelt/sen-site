// v0.2.0 phase G — side-by-side model duel route.
//
// One user prompt → two parallel assistant streams (Claude + GPT)
// multiplexed into a single newline-delimited JSON event stream.
// The frontend reads side-tagged events ({"side":"left",...}) and
// fans them into two columns in real time. Cost + token counts are
// emitted as a single "done" event per side once that side's
// stream resolves.
//
// Tools (web_search / web_fetch) are intentionally OFF here — the
// whole point of the duel is to compare raw model intelligence on
// the same prompt with the same context. Adding tools to one side
// would skew the comparison; adding them to both is on the roadmap
// once we wire OpenAI tool-calling parity.
//
// Persistence: both responses are saved to chat_messages with a
// shared duel_group_id. Pick-winner (POST /api/ai/duel/winner)
// flips duel_winner on the chosen row and deletes the loser, so
// the thread's history reads as a normal solo conversation
// from then on.

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { getPlanForEmail } from "../../../../lib/account-billing";
import {
  DUEL_CLAUDE_MODEL,
  getDuelGptModel,
} from "../../../../lib/ai-models";
import { VRAELIS_PRODUCT_BRIEF } from "../../../../lib/vraelis-context";
import {
  appendMessage as saveMessage,
  createThread as createChatThread,
  getThread as getChatThread,
  getThreadProjectId,
} from "../../../../lib/chat-history";
import {
  createDuelPlaceholder,
  discardDuelGroup,
  setDuelMessageContent,
} from "../../../../lib/duel-history";
import {
  buildProjectContextBlock,
  getProjectWithPins,
  listPinsForProject,
} from "../../../../lib/projects";
import {
  consumeBoostForKind,
  decideChatRequest,
  decideDuelRequest,
  getWeeklyUsage,
  hasUnconsumedBoost,
} from "../../../../lib/plan-limits";
import { consumeCredits, CREDIT_COSTS } from "../../../../lib/credits";
import { getActiveAddonKeys } from "../../../../lib/active-addons";
import { detectLanguage, langLabel } from "../../../../lib/i18n";
import { recordUsage } from "../../../../lib/usage";
import { recordMetric } from "../../../../lib/metrics";
import { priceFor } from "../../../../lib/duel-pricing";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

const anthropic = new Anthropic();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "missing",
});

type DuelMessage = {
  role: "user" | "assistant";
  content: string;
};

type DuelBody = {
  messages: DuelMessage[];
  thread_id?: string;
  project_id?: string | null;
  client_time_iso?: string;
  client_timezone?: string;
  client_time_label?: string;
};

// Compare-mode system prompt. Deliberately model-neutral, neither
// side claims to be vraelis-1 in duel mode because the user is
// explicitly comparing raw model intelligence. Project context +
// time + language lock are appended just like /api/ai/chat so both
// sides have identical grounding.
const DUEL_SYSTEM_PROMPT = `You are answering inside vraelis.ai's side-by-side model duel. The user is comparing your raw intelligence against another model on the exact same prompt. Be yourself, answer directly in your natural voice.

Hard rules:
- MIRROR the user's energy and length. One word in, one word out. Casual in, casual out. "wsg" / "yo" / "hi" / "w" are greetings, NOT requests for clarification, treat them as openers and reply naturally ("hey, what's up?", "yo", "wsg"), never ask for "more details" or "could you clarify".
- No preamble. Skip "Sure!", "Great question!", "I'd be happy to", "It looks like you might have...", "Could you please provide more details?". Start with the actual reply.
- Don't ask clarifying questions on short / ambiguous prompts. Make your best guess and answer; only ask if you genuinely cannot proceed (e.g. the user pasted code with no context AT ALL).
- Use markdown only when the answer needs structure. Don't markdownify a one-line reply.
- Don't moralize, hedge, or pad with disclaimers on normal creative / cultural / casual topics.
- For time-sensitive or live-data questions, say what you don't know rather than fabricating; the duel surface intentionally has no live web access.
- Never mention the comparison itself or that you're being compared.
- The vraelis workspace renders fenced code blocks in svg, html, jsx, tsx, or python as live inline previews. When the user asks for a chart, graph, diagram, map, visualization, or interactive demo, BUILD it: emit an svg or html code block with the actual rendered output. Don't punt to TradingView / Google / Yahoo. Don't say "I can't render that inline" — you can.

${VRAELIS_PRODUCT_BRIEF}`;

function buildSystem(args: {
  projectContextBlock: string;
  lastUserMessage: string;
  timeLabel: string;
  tzLabel: string;
}): string {
  let prompt = DUEL_SYSTEM_PROMPT;
  if (args.projectContextBlock) {
    prompt += `\n\n${args.projectContextBlock}`;
  }
  if (args.lastUserMessage) {
    const lang = langLabel(detectLanguage(args.lastUserMessage));
    prompt += `\n\nLanguage lock: the user is writing in ${lang}. Reply ONLY in ${lang}.`;
  }
  prompt += `\n\nThe user's current local time is ${args.timeLabel} (timezone: ${args.tzLabel}).`;
  return prompt;
}

function lastUserText(messages: DuelMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") return (messages[i].content ?? "").trim();
  }
  return "";
}

export async function POST(request: Request) {
  // Auth (cookie or desktop bearer).
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: DuelBody;
  try {
    payload = (await request.json()) as DuelBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return NextResponse.json({ error: "Missing messages." }, { status: 400 });
  }

  // Plan gating for duel — three-layer gate:
  //
  //   1. weekly_duel_requests cap (Free = 5/wk; paid plans = null
  //      meaning the chat cap is the only thing that bites).
  //   2. weekly_chat_requests cap, two-slot aware. A duel = TWO
  //      model calls so we run decideChatRequest twice (current
  //      weekly + synthetic +1) to verify both slots fit.
  //   3. If either gate blocks, fall through to boosts (legacy,
  //      one boost covers the 2 chat slots) → credits (3-credit
  //      cost, slightly above chat to reflect the 2 model calls
  //      + the differentiation premium) → 429.
  //
  // Usage recording: per-side recordUsage({ kind: "chat" }) writes
  // 2 chat events naturally. We ALSO write a single
  // recordUsage({ kind: "duel" }) below so weekly.duel_requests
  // can be capped + monitored independently of chat volume.
  const DUEL_CREDIT_COST = CREDIT_COSTS.chat * 3;
  const [plan, weekly, activeAddons] = await Promise.all([
    getPlanForEmail(email),
    getWeeklyUsage(email),
    getActiveAddonKeys(email),
  ]);
  const duelCapDecision = decideDuelRequest({
    plan,
    weekly,
    activeAddons,
  });
  const firstSlotDecision = decideChatRequest({
    plan,
    requestedTier: "balanced",
    weekly,
    activeAddons,
  });
  const secondSlotDecision = decideChatRequest({
    plan,
    requestedTier: "balanced",
    weekly: { ...weekly, chat_requests: weekly.chat_requests + 1 },
    activeAddons,
  });
  // Pick the most relevant blocking decision: duel cap first
  // (Free's hardest gate), then chat-slot 1, then chat-slot 2.
  const blockingDecision =
    duelCapDecision.kind === "blocked"
      ? duelCapDecision
      : firstSlotDecision.kind === "blocked"
        ? firstSlotDecision
        : secondSlotDecision.kind === "blocked"
          ? secondSlotDecision
          : null;
  if (blockingDecision) {
    let allowed = false;
    // Boost path: a legacy session/weekly boost lifts the chat cap.
    // It does NOT lift the duel-only cap (5/wk on Free) — that's an
    // upgrade-driving wall, not a top-up wall, by design. Boost
    // bypass only runs when the chat cap was the gate.
    if (
      duelCapDecision.kind !== "blocked" &&
      (await hasUnconsumedBoost(email, "chat"))
    ) {
      const burnt = await consumeBoostForKind(email, "chat");
      if (burnt) allowed = true;
    }
    // Credit ledger path: 3-credit cost. Burns from balance for any
    // gate (duel cap, chat cap, or both).
    if (!allowed) {
      const refId = `duel-chat:${Math.floor(Date.now() / 1000)}`;
      const { ok } = await consumeCredits(email, DUEL_CREDIT_COST, "consume", refId);
      if (ok) allowed = true;
    }
    if (!allowed) {
      // Polished copy + upgrade link. Frontend's error pill
      // surfaces upgrade_url as an "Upgrade" CTA when present.
      const message =
        duelCapDecision.kind === "blocked"
          ? duelCapDecision.reason
          : "Duel uses 2 chats. Upgrade to compare answers.";
      recordMetric({
        kind: "limit_hit",
        email,
        props: {
          surface_kind: "duel",
          plan,
          gate:
            duelCapDecision.kind === "blocked"
              ? "duel_cap"
              : "chat_cap",
          used: blockingDecision.used,
          limit: blockingDecision.limit,
        },
      });
      return NextResponse.json(
        {
          error: message,
          upgrade_url: "/account/plan",
          limit: blockingDecision.limit,
          used: blockingDecision.used,
          reset: blockingDecision.reset,
        },
        { status: 429 },
      );
    }
    // We allowed the request via fallback (boost or credits).
    // Note which one for funnel analysis.
    recordMetric({
      kind: "credits_used",
      email,
      props: {
        surface_kind: "duel",
        plan,
        amount: duelCapDecision.kind === "blocked" ? 0 : 3,
      },
    });
  }

  // Fire-and-forget usage event so weekly_duel_requests counts
  // up by 1 per duel (independent of the 2 chat events the per-
  // side pumps will write when their streams resolve).
  void recordUsage({
    email,
    kind: "duel",
    surface:
      request.headers.get("x-VRAELIS-surface") === "desktop"
        ? "desktop"
        : "web",
  });
  // Duel is officially in flight. Log started so we can compute
  // started -> completed conversion + per-plan volume.
  recordMetric({
    kind: "duel_started",
    email,
    props: {
      plan,
      project_attached: !!payload.project_id || !!payload.thread_id,
    },
  });

  // Resolve / create the thread + save the user turn.
  let resolvedThreadId: string | null = null;
  const userTurnAt = new Date();
  const placeholderAt = new Date(userTurnAt.getTime() + 2000);
  try {
    const requestedThreadId =
      typeof payload.thread_id === "string" && payload.thread_id.trim()
        ? payload.thread_id.trim()
        : null;
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
      const lastUserTurn = [...payload.messages]
        .reverse()
        .find((m) => m.role === "user");
      if (lastUserTurn?.content?.trim()) {
        void saveMessage({
          email,
          threadId: resolvedThreadId,
          role: "user",
          content: lastUserTurn.content,
          createdAt: userTurnAt.toISOString(),
        });
      }
    }
  } catch (err) {
    console.warn("ai/duel thread persist failed:", err);
  }

  // Project memory wedge — same code path as /api/ai/chat so the
  // duel sees identical context.
  let projectContextBlock = "";
  if (resolvedThreadId) {
    const projectId = await getThreadProjectId(email, resolvedThreadId);
    if (projectId) {
      const [project, pins] = await Promise.all([
        getProjectWithPins(email, projectId),
        listPinsForProject(projectId),
      ]);
      if (project) {
        projectContextBlock = buildProjectContextBlock({ project, pins });
      }
    }
  }

  const tzLabel = payload.client_timezone ?? "UTC";
  const timeLabel =
    payload.client_time_label ??
    payload.client_time_iso ??
    new Date().toISOString();
  const systemPrompt = buildSystem({
    projectContextBlock,
    lastUserMessage: lastUserText(payload.messages),
    timeLabel,
    tzLabel,
  });

  const groupId = randomUUID();
  const gptModel = getDuelGptModel();
  const claudeModel = DUEL_CLAUDE_MODEL;

  // Insert one placeholder per side. The placeholder ids are
  // streamed to the client (assistant_id event) so the UI can
  // wire Pick Winner without waiting for a reload.
  const [leftMessageId, rightMessageId] = resolvedThreadId
    ? await Promise.all([
        createDuelPlaceholder({
          threadId: resolvedThreadId,
          groupId,
          side: "left",
          model: gptModel,
          createdAt: placeholderAt.toISOString(),
        }),
        createDuelPlaceholder({
          threadId: resolvedThreadId,
          groupId,
          side: "right",
          model: claudeModel,
          createdAt: new Date(placeholderAt.getTime() + 1).toISOString(),
        }),
      ])
    : [null, null];

  const surface =
    request.headers.get("x-VRAELIS-surface") === "desktop"
      ? "desktop"
      : "web";

  // Multiplexed NDJSON stream. Each line is a single JSON event with
  // a `side` field ("left" / "right") and a `type` ("phase",
  // "assistant_id", "text", "done", "error"). Plus a final
  // {"type":"meta",...} event with the group + thread ids.
  const encoder = new TextEncoder();
  const upstreamAbort = new AbortController();
  let clientAborted = false;
  request.signal.addEventListener("abort", () => {
    clientAborted = true;
    upstreamAbort.abort();
  });

  // Outer scope so the post-pump duel_completed metric can summarize
  // both sides' final state (tokens, cost, errors). Each pump fills
  // its own slot when its stream resolves.
  type SideOutcome = {
    bytes: number;
    input_tokens: number;
    output_tokens: number;
    cost: number;
    error: boolean;
    first_token_ms?: number;
  };
  const startedAt = Date.now();
  const outcome: { left?: SideOutcome; right?: SideOutcome } = {};

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writeLine = (obj: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        } catch {
          // controller may have closed (client disconnected).
        }
      };

      // Surface placeholder ids ASAP so the UI can wire Pick Winner
      // before either stream finishes.
      if (leftMessageId) {
        writeLine({ side: "left", type: "assistant_id", id: leftMessageId });
      }
      if (rightMessageId) {
        writeLine({ side: "right", type: "assistant_id", id: rightMessageId });
      }
      writeLine({ side: "left", type: "phase", label: "Thinking…" });
      writeLine({ side: "right", type: "phase", label: "Thinking…" });

      // Per-side pump. Buffers full reply, throttle-saves to the
      // placeholder, emits a single "done" event with cost + tokens
      // when the upstream stream resolves.
      const pumpClaude = async () => {
        let buffer = "";
        let inputTokens = 0;
        let outputTokens = 0;
        const pumpStartedAt = Date.now();
        let firstTokenMs: number | undefined;
        try {
          const stream = await anthropic.messages.stream(
            {
              model: claudeModel,
              max_tokens: 2048,
              system: systemPrompt,
              messages: payload.messages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            },
            { signal: upstreamAbort.signal },
          );
          let firstToken = false;
          for await (const event of stream) {
            if (event.type === "message_start") {
              inputTokens = event.message?.usage?.input_tokens ?? 0;
            }
            if (event.type === "message_delta") {
              outputTokens = event.usage?.output_tokens ?? outputTokens;
            }
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              if (!firstToken) {
                firstToken = true;
                firstTokenMs = Date.now() - pumpStartedAt;
                writeLine({ side: "right", type: "phase", label: "Writing…" });
              }
              buffer += event.delta.text;
              writeLine({ side: "right", type: "text", text: event.delta.text });
            }
          }
          const cost = priceFor(claudeModel, inputTokens, outputTokens);
          outcome.right = {
            bytes: buffer.length,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost,
            error: false,
            first_token_ms: firstTokenMs,
          };
          writeLine({
            side: "right",
            type: "done",
            cost,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            model: claudeModel,
          });
          if (resolvedThreadId && rightMessageId && buffer.trim()) {
            await setDuelMessageContent({
              messageId: rightMessageId,
              threadId: resolvedThreadId,
              content: buffer,
            });
          }
          void recordUsage({
            email,
            kind: "chat",
            model: claudeModel,
            surface,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
            duration_ms: Date.now() - pumpStartedAt,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "stream failed";
          outcome.right = {
            bytes: buffer.length,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost: 0,
            error: true,
            first_token_ms: firstTokenMs,
          };
          writeLine({ side: "right", type: "error", message: msg });
          if (resolvedThreadId && rightMessageId && buffer.trim()) {
            // Save what we got so the user doesn't lose partial output.
            await setDuelMessageContent({
              messageId: rightMessageId,
              threadId: resolvedThreadId,
              content: buffer,
            });
          }
        }
      };

      const pumpGpt = async () => {
        let buffer = "";
        let inputTokens = 0;
        let outputTokens = 0;
        const pumpStartedAt = Date.now();
        let firstTokenMs: number | undefined;
        try {
          const stream = await openai.chat.completions.create(
            {
              model: gptModel,
              stream: true,
              stream_options: { include_usage: true },
              messages: [
                { role: "system", content: systemPrompt },
                ...payload.messages.map((m) => ({
                  role: m.role,
                  content: m.content,
                })),
              ],
              max_tokens: 2048,
            },
            { signal: upstreamAbort.signal },
          );
          let firstToken = false;
          for await (const chunk of stream) {
            // Final usage chunk has no choice content.
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens ?? inputTokens;
              outputTokens = chunk.usage.completion_tokens ?? outputTokens;
            }
            const delta = chunk.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length > 0) {
              if (!firstToken) {
                firstToken = true;
                firstTokenMs = Date.now() - pumpStartedAt;
                writeLine({ side: "left", type: "phase", label: "Writing…" });
              }
              buffer += delta;
              writeLine({ side: "left", type: "text", text: delta });
            }
          }
          const cost = priceFor(gptModel, inputTokens, outputTokens);
          outcome.left = {
            bytes: buffer.length,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost,
            error: false,
            first_token_ms: firstTokenMs,
          };
          writeLine({
            side: "left",
            type: "done",
            cost,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            model: gptModel,
          });
          if (resolvedThreadId && leftMessageId && buffer.trim()) {
            await setDuelMessageContent({
              messageId: leftMessageId,
              threadId: resolvedThreadId,
              content: buffer,
            });
          }
          void recordUsage({
            email,
            kind: "chat",
            model: gptModel,
            surface,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
            duration_ms: Date.now() - pumpStartedAt,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "stream failed";
          outcome.left = {
            bytes: buffer.length,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cost: 0,
            error: true,
            first_token_ms: firstTokenMs,
          };
          writeLine({ side: "left", type: "error", message: msg });
          if (resolvedThreadId && leftMessageId && buffer.trim()) {
            await setDuelMessageContent({
              messageId: leftMessageId,
              threadId: resolvedThreadId,
              content: buffer,
            });
          }
        }
      };

      // Run both pumps concurrently. allSettled so one side's
      // failure doesn't kill the other.
      try {
        await Promise.allSettled([pumpGpt(), pumpClaude()]);
      } finally {
        // duel_completed metric. Captures both sides' final state
        // (error, tokens, cost, TTFT) plus a derived ttft_ms (the
        // FIRST byte the user saw on either side) so we can spot
        // one-side failures + latency drift over time. ttft_slow
        // is a precomputed flag at the >1.2s threshold for easy
        // dashboarding without log-side math.
        const leftTtft = outcome.left?.first_token_ms;
        const rightTtft = outcome.right?.first_token_ms;
        const ttftMs =
          typeof leftTtft === "number" && typeof rightTtft === "number"
            ? Math.min(leftTtft, rightTtft)
            : (leftTtft ?? rightTtft ?? null);
        const ttftSlow =
          typeof ttftMs === "number" ? ttftMs > 1200 : false;
        recordMetric({
          kind: "duel_completed",
          email,
          surface,
          props: {
            duration_ms: Date.now() - startedAt,
            ttft_ms: ttftMs,
            ttft_slow: ttftSlow,
            cancelled: clientAborted,
            gpt_error: outcome.left?.error ?? true,
            gpt_input_tokens: outcome.left?.input_tokens ?? 0,
            gpt_output_tokens: outcome.left?.output_tokens ?? 0,
            gpt_cost_usd: outcome.left?.cost ?? 0,
            gpt_ttft_ms: outcome.left?.first_token_ms ?? null,
            claude_error: outcome.right?.error ?? true,
            claude_input_tokens: outcome.right?.input_tokens ?? 0,
            claude_output_tokens: outcome.right?.output_tokens ?? 0,
            claude_cost_usd: outcome.right?.cost ?? 0,
            claude_ttft_ms: outcome.right?.first_token_ms ?? null,
          },
        });
        writeLine({
          type: "meta",
          group_id: groupId,
          thread_id: resolvedThreadId,
          cancelled: clientAborted,
        });
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "x-VRAELIS-stream-format": "duel-jsonl",
      "Cache-Control": "no-store",
      "x-VRAELIS-thread-id": resolvedThreadId ?? "",
      "x-VRAELIS-duel-group-id": groupId,
    },
  });
}

// DELETE /api/ai/duel?thread_id=...&group_id=...
// Wipes both rows of an open duel group. Used by Retry Both.
export async function DELETE(request: Request) {
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const url = new URL(request.url);
  const threadId = (url.searchParams.get("thread_id") ?? "").trim();
  const groupId = (url.searchParams.get("group_id") ?? "").trim();
  if (!threadId || !groupId) {
    return NextResponse.json(
      { error: "thread_id and group_id are required." },
      { status: 400 },
    );
  }
  const ok = await discardDuelGroup({ email, threadId, groupId });
  if (!ok) {
    return NextResponse.json({ error: "Could not discard duel." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
