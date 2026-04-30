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
import { SANSXEL_PRODUCT_BRIEF } from "../../../../lib/sansxel-context";
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
  getWeeklyUsage,
  hasUnconsumedBoost,
} from "../../../../lib/plan-limits";
import { consumeCredits, CREDIT_COSTS } from "../../../../lib/credits";
import { getActiveAddonKeys } from "../../../../lib/active-addons";
import { detectLanguage, langLabel } from "../../../../lib/i18n";
import { recordUsage } from "../../../../lib/usage";
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

// Compare-mode system prompt. Deliberately model-neutral — neither
// side claims to be sansxel-1 in duel mode because the user is
// explicitly comparing raw model intelligence. Project context +
// time + language lock are appended just like /api/ai/chat so both
// sides have identical grounding.
const DUEL_SYSTEM_PROMPT = `You are answering inside sansxel.ai's side-by-side model duel. The user is comparing your raw intelligence against another model on the exact same prompt and context. Be yourself — answer directly, accurately, in your natural style. No preamble ("Sure!", "Great question!"); start with the answer.

Rules:
- Match the user's voice and length expectations.
- Use markdown for structure (headings, lists, code blocks) when it helps.
- For ambiguous requests, ask one short clarifying question rather than guessing wrong.
- For time-sensitive or live-data questions, say what you don't know rather than fabricating; the duel surface intentionally does not give you live web access so the comparison stays clean.
- Don't mention the comparison itself in your answer; just give your best response.

${SANSXEL_PRODUCT_BRIEF}`;

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

  // Plan gating. A duel fires TWO model calls (GPT + Claude) in
  // parallel, so it bills 2 weekly chat slots — not 1. Two-step
  // check: first decideChatRequest to see if the FIRST slot fits
  // (catches the "you're already at the cap" case with the right
  // upgrade copy), then a synthetic +1 weekly check to see if the
  // SECOND slot also fits. Either failing falls through to the
  // boost / credit ledger; the ledger is charged at 2× chat cost.
  //
  // Usage recording stays organic: each pump (Claude, GPT) calls
  // recordUsage({ kind: "chat" }) when its stream resolves, so
  // weekly.chat_requests naturally ticks up by 2 per duel without
  // any extra accounting here.
  const DUEL_CHAT_SLOTS = 2;
  const [plan, weekly, activeAddons] = await Promise.all([
    getPlanForEmail(email),
    getWeeklyUsage(email),
    getActiveAddonKeys(email),
  ]);
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
  const blockingDecision =
    firstSlotDecision.kind === "blocked"
      ? firstSlotDecision
      : secondSlotDecision.kind === "blocked"
        ? secondSlotDecision
        : null;
  if (blockingDecision) {
    let allowed = false;
    // Boost path: a single boost (session_boost = +50, weekly_boost
    // = +500) easily covers a duel's 2-slot cost. Burn one and let
    // the request through.
    if (await hasUnconsumedBoost(email, "chat")) {
      const burnt = await consumeBoostForKind(email, "chat");
      if (burnt) allowed = true;
    }
    // Credit ledger path: charge 2× the chat credit cost since
    // we're spending two model calls.
    if (!allowed) {
      const cost = CREDIT_COSTS.chat * DUEL_CHAT_SLOTS;
      const refId = `duel-chat:${Math.floor(Date.now() / 1000)}`;
      const { ok } = await consumeCredits(email, cost, "consume", refId);
      if (ok) allowed = true;
    }
    if (!allowed) {
      // Polished copy + upgrade link. The frontend's error pill
      // surfaces upgrade_url as a "Upgrade" button when present.
      return NextResponse.json(
        {
          error: "Duel uses 2 chats. Upgrade to compare answers.",
          upgrade_url: "/account/plan",
          limit: blockingDecision.limit,
          used: blockingDecision.used,
          reset: blockingDecision.reset,
        },
        { status: 429 },
      );
    }
  }

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
    request.headers.get("x-sansxel-surface") === "desktop"
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
        const startedAt = Date.now();
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
                writeLine({ side: "right", type: "phase", label: "Writing…" });
              }
              buffer += event.delta.text;
              writeLine({ side: "right", type: "text", text: event.delta.text });
            }
          }
          const cost = priceFor(claudeModel, inputTokens, outputTokens);
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
            duration_ms: Date.now() - startedAt,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "stream failed";
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
        const startedAt = Date.now();
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
                writeLine({ side: "left", type: "phase", label: "Writing…" });
              }
              buffer += delta;
              writeLine({ side: "left", type: "text", text: delta });
            }
          }
          const cost = priceFor(gptModel, inputTokens, outputTokens);
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
            duration_ms: Date.now() - startedAt,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "stream failed";
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
      "x-sansxel-stream-format": "duel-jsonl",
      "Cache-Control": "no-store",
      "x-sansxel-thread-id": resolvedThreadId ?? "",
      "x-sansxel-duel-group-id": groupId,
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
