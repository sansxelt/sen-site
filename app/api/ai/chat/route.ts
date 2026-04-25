import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { getPlanForEmail } from "../../../../lib/account-billing";
import {
  descriptorForTier,
  type ModelTier,
  resolveTier,
} from "../../../../lib/ai-models";
import { humanizeText, type HumanizationTone } from "../../../../lib/humanize-engine";
import { SANSXEL_PRODUCT_BRIEF } from "../../../../lib/sansxel-context";
import {
  buildReferenceBlock,
  fetchSourcesByIds,
} from "../../../../lib/chat-sources";
import {
  describePersona,
  isPersona,
  type Persona,
} from "../../../../lib/ai-voices";
import { recordUsage } from "../../../../lib/usage";
import {
  consumeBoostForKind,
  consumeCreditFor,
  decideChatRequest,
  getWeeklyUsage,
  hasUnconsumedBoost,
  PLAN_LIMITS,
} from "../../../../lib/plan-limits";
import { detectLanguage, langLabel } from "../../../../lib/i18n";
import {
  appendMessage as saveMessage,
  createAssistantPlaceholder,
  createThread as createChatThread,
  getThread as getChatThread,
  listMessages as listChatMessages,
  updateMessageContent,
} from "../../../../lib/chat-history";
import { generateAndSetThreadTitle } from "../../../../lib/thread-title";

export const runtime = "nodejs";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are sansxel-1, the AI inside the sansxel workspace — an adaptive product for thinking, writing, and building. You are an assistant for serious creative and professional work.

How to respond:
- Just do the thing. No "Sure!", no "I'd be happy to", no "Here's...". Skip the preamble entirely and start with the actual answer.
- For ANY question about current/live data — news, stock prices, sports scores, weather, recent events, "today/this week", anything time-sensitive — USE the web_search tool. Don't apologize for "no real-time data," don't dump links and ask the user to look it up themselves. Search, then answer with the actual data plus a short citation. Skip web_search only when the question is genuinely timeless (math, code, definitions, historical facts).
- When the user pastes or drops a URL (article, blog post, doc page, YouTube link, GitHub link, anything web-reachable), USE the web_fetch tool to read the actual page contents BEFORE replying. NEVER say "I can't access URLs" or "I don't have a browser" — you can. Fetch first, then answer with the real contents. If the fetch fails or the page is gated, say so explicitly and offer to work from what the user can paste in.
- Match the user's voice — vocabulary, sentence length, formality, all of it. If they write casually, you write casually. If they're technical, be technical. If they're sloppy, be sloppy with them.
- Write the requested length. If they ask for 5 pages, write 5 pages. Don't truncate, don't summarize.
- Don't add disclaimers about whether topics are silly, juvenile, or unconventional — if a user asks for an essay on skibidi toilet, write the essay. Creative + cultural topics are valid; treat them with the same craft as anything else.
- No moralizing on legitimate creative or research requests. The user is an adult choosing what they want to write. Your job is to write it well.
- Use markdown for formatting (headings, lists, bold, code blocks). Never wrap your whole response in a single code block.
- When the request is ambiguous, ask one targeted question — never a list of clarifying questions.
- For complex requests, you MAY briefly "think out loud" inside <think>...</think> tags before the actual answer. The UI renders this in a dim italic block separate from the answer, so users can see your reasoning without it cluttering the response. Keep it short (1-2 sentences) and skip it entirely on trivial questions. Never use <think> for the final answer itself.

Identity:
- You are sansxel-1. The product is sansxel. Never mention Claude, Anthropic, the underlying model, or implementation details.

${SANSXEL_PRODUCT_BRIEF}`;

// Appended to the system prompt when the user is in voice mode.
// Voice replies that ramble through long markdown sound terrible via
// TTS, but a hard "no markdown" rule made replies feel sterile when
// the user asked for a list / steps. Compromise: brief by default,
// light formatting allowed when the answer NEEDS it.
const VOICE_TURN_DIRECTIVE = `You're in voice mode. The user's question came from a microphone and your reply will be spoken back through TTS. Constraints:
- Keep replies SHORT — 1 to 3 sentences unless the user explicitly asks for depth, a list, or steps.
- Prefer plain prose. Only use markdown when the answer is genuinely list-shaped (steps, comparisons) — then a short bullet list is fine. No headers, no tables, no code fences for short replies.
- Conversational and direct. Read aloud, your reply should sound like a person, not a paragraph being read.
- Skip preamble ("Sure!", "Great question!"). Open with the answer.`;

const VOICE_HUMANIZATION_PROMPT = `Voice-only humanization mode:
- Only follow this mode when the latest request came through voice-to-text and the user is explicitly asking you to humanize, de-AI, or rewrite text so it sounds more natural.

Project goal:
- Transform AI-generated text into natural, human-like writing by modifying structure, tone, and reasoning, not just surface-level words.

Core system design:
1. Perspective injection
- Add light opinion, bias, framing, or uncertainty when it helps the rewrite feel lived-in.
- Neutral claims can become slightly subjective if the original meaning still holds.
2. Structural variation
- Vary sentence length on purpose.
- Mix short sentences, longer flowing lines, and the occasional abrupt fragment.
- Break predictable paragraph rhythm when it improves the feel.
3. Semantic drift
- Allow slight, controlled deviation such as clarifications, side notes, or mini tangents.
- Never drift so far that the original point gets lost.
4. Stylometric personalization
- Let the rewrite lean formal, casual, or conversational based on what best fits the source.
- Rhetorical questions, emphasis, and light filler phrasing are allowed when they feel natural.
5. Coherence preservation
- Keep the meaning intact.
- Preserve logical flow.
- Do not introduce contradictions unless the user explicitly wants a more opinionated rewrite.

Do not:
- spam synonym swaps
- inject fake typos or forced grammar mistakes
- manufacture "human errors" just to look less AI

Output:
- Return the rewritten text directly unless the user asks for commentary.
- Simulate how humans think while writing, not just how they type.`;

const HUMANIZATION_INTENT_PATTERNS = [
  /\bhumani[sz]e\b/i,
  /\b(?:sound|sounds|sounding)\s+(?:more\s+)?human\b/i,
  /\bless\s+ai\b/i,
  /\bless\s+robotic\b/i,
  /\bmore\s+conversational\b/i,
  /\bmore\s+natural\b/i,
  /\bde-?ai\b/i,
  /\bin\s+my\s+voice\b/i,
  /\bsound\s+like\s+me\b/i,
  /\bmake\b[\s\S]{0,100}\b(?:sound|feel)\b[\s\S]{0,60}\b(?:natural|human|like me|more like me)\b/i,
  /\brewrite\b[\s\S]{0,100}\b(?:human|natural|conversational|casual|clearer|warmer|less stiff)\b/i,
  /\brephrase\b[\s\S]{0,100}\b(?:human|natural|conversational|casual|clearer|warmer|less stiff)\b/i,
  /\bpolish\b[\s\S]{0,100}\b(?:voice|tone|flow|wording)\b/i,
  /\bmake\b[\s\S]{0,100}\b(?:human|natural|conversational|less ai|less robotic|less stiff)\b/i,
  /\bhelp me rewrite\b/i,
];

const DETECTOR_EVASION_PATTERNS = [
  /\bpass(?:ing)?\b[\s\S]{0,40}\bdetectors?\b/i,
  /\bbypass\b[\s\S]{0,40}\bdetectors?\b/i,
  /\bevade\b[\s\S]{0,40}\bdetectors?\b/i,
  /\bavoid\b[\s\S]{0,40}\bdetection\b/i,
  /\bundetectable\b/i,
  /\bai\s+detectors?\b/i,
  /\b(?:gptzero|turnitin|originality(?:\.ai)?|copyleaks|writer(?:\s+detector)?)\b/i,
];

// v0.1.4 — Optional vision attachments on a user turn. media_type
// must be one of Anthropic's accepted image MIME types; data is the
// raw base64 (NO "data:image/png;base64," prefix). Each image is kept
// per-message so the model can localize references like "the second
// screenshot" correctly.
type ChatImageAttachment = {
  media_type: "image/png" | "image/jpeg" | "image/gif" | "image/webp";
  data: string;
};

// v0.1.8 — When tools are enabled, user / assistant messages may
// contain tool_use / tool_result content blocks alongside plain text.
// We forward whatever the client sends straight to Anthropic so the
// follow-up "here's the tool_result" turn round-trips correctly.
type ChatToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
type ChatToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
type ChatTextBlock = { type: "text"; text: string };
type ChatContentBlock = ChatTextBlock | ChatToolUseBlock | ChatToolResultBlock;

type ChatMessage = {
  role: "user" | "assistant";
  // String for back-compat with text-only callers; arrays for
  // tool_use / tool_result-bearing turns.
  content: string | ChatContentBlock[];
  images?: ChatImageAttachment[];
};
type ChatInputMode = "text" | "voice";

type ChatBody = {
  messages: ChatMessage[];
  context?: { note_title?: string; note_body?: string };
  tier?: ModelTier;
  input_mode?: ChatInputMode;
  persona?: Persona;
  // v0.1.4 — RAG-style attached sources. Server fetches each id from
  // chat_sources (owned by the requesting user) and injects the
  // bodies into the system prompt as reference material.
  source_ids?: string[];
  // v0.1.4 — when true, the system prompt asks the model to respond
  // as a numbered multi-step plan with a closing Done/Next line.
  // No real tool-calling yet; that's v0.1.5+.
  agent_mode?: boolean;
  // v0.1.8 — when true, the desktop tool registry is exposed to the
  // model and the response is streamed as JSON-Lines so the client
  // can dispatch tool_use blocks and feed tool_result back in.
  tools_enabled?: boolean;
  // v0.1.16 — thread persistence. If omitted, server creates a new
  // thread and returns its id in the x-sansxel-thread-id response
  // header so the client can stash it for follow-up turns. Same
  // account → same threads from any device.
  thread_id?: string;
  // v0.1.12 — client-supplied local time so the model can answer
  // "what time is it for me" without claiming it has no access to
  // the system clock. Client passes IANA timezone + a pre-formatted
  // local time string + ISO timestamp; server injects all three into
  // the system prompt. All optional — falls back to UTC server time
  // if the client doesn't send any of them.
  client_time_iso?: string;
  client_timezone?: string;
  client_time_label?: string;
};

// v0.1.16 — Anthropic-hosted server tools. web_search runs entirely
// inside the Anthropic API: model decides when to call it, search
// runs on their servers, results re-enter the model's context, and
// the next text block is the actual answer. We don't need to handle
// tool_use/tool_result on the client — the text stream just
// continues naturally with the grounded answer.
//
// Available on EVERY chat surface (web + desktop). Removes the
// "I can't pull live data, here are some links" punt response when
// the user asks about news, prices, recent events, sports scores.
const SERVER_TOOLS = [
  {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 3,
  },
  // v0.1.16 — web_fetch lets the model resolve a specific URL the user
  // drops in (article, doc, YouTube link, GitHub blob). Without this
  // the model would punt with "I can't access URLs" because web_search
  // alone only does Google-style queries, not page fetches. Requires
  // the `web-fetch-2025-09-10` beta header on the request — see the
  // anthropic-beta option passed to messages.stream below.
  {
    type: "web_fetch_20250910",
    name: "web_fetch",
    max_uses: 5,
  },
] as unknown as Anthropic.Messages.Tool[];

// Match http(s) URLs anywhere in the prompt. Used to keep tools
// enabled even when the prompt is short — "summarize https://…" is
// 30 chars and would otherwise get stripped by the trivial-prompt
// guard below.
const URL_PATTERN = /\bhttps?:\/\/\S+/i;

// v0.1.8 — Desktop tool registry. The model sees these as available
// callable functions; the actual handlers live in the Tauri client
// (see desktop/src/chat-view.tsx). Server only forwards the schema
// and round-trips tool_use / tool_result blocks.
const DESKTOP_TOOLS: Array<{
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
}> = [
  {
    name: "navigate",
    description:
      "Switch the workspace to a different view (chat, plan, usage, keys, memory, integrations, updates, settings, sources, preferences, account).",
    input_schema: {
      type: "object",
      properties: {
        view: {
          type: "string",
          enum: [
            "chat", "plan", "usage", "keys", "memory", "integrations",
            "updates", "settings", "sources", "preferences", "account",
          ],
        },
      },
      required: ["view"],
    },
  },
  {
    name: "start_new_chat",
    description: "Create a fresh chat thread and switch to it.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "search_threads",
    description: "Fuzzy-search the user's saved chat threads. Returns a list of {id, title, preview} matches.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "open_thread",
    description: "Switch to an existing chat thread by id.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "create_api_key",
    description: "Create a new desktop API key with the given display name. Returns the key id and prefix.",
    input_schema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  {
    name: "revoke_api_key",
    description: "Revoke an existing desktop API key by id.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "list_api_keys",
    description: "List the user's current desktop API keys.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "query_memory",
    description: "Query the user's long-term memory store. (Stub until v0.1.10.)",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "query_sources",
    description: "Search the user's uploaded sources. Returns the top 3 matches by title/body match.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "summarize_thread",
    description: "Generate a short title + description summary for a saved chat thread.",
    input_schema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "change_model_tier",
    description: "Change the active model tier. fast = quick replies; balanced = default; smart = deepest reasoning.",
    input_schema: {
      type: "object",
      properties: {
        tier: { type: "string", enum: ["fast", "balanced", "smart"] },
      },
      required: ["tier"],
    },
  },
  {
    name: "set_persona",
    description: "Change the assistant's persona: direct, warm, technical, or playful.",
    input_schema: {
      type: "object",
      properties: {
        persona: { type: "string", enum: ["direct", "warm", "technical", "playful"] },
      },
      required: ["persona"],
    },
  },
];

// Hard server-side cap on individual image payloads. The desktop
// client also enforces this client-side, but a hand-rolled API caller
// could ignore that — keep this as belt + suspenders against blowing
// up the upstream model with a 50MB PNG.
const MAX_IMAGE_BYTES = 1_000_000;
const ALLOWED_IMAGE_TYPES = new Set<ChatImageAttachment["media_type"]>([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

function approxBase64ByteLength(b64: string): number {
  // Each base64 char encodes 6 bits; 4 chars = 3 bytes (minus padding).
  // Cheap upper-bound estimate without decoding.
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.floor((b64.length * 3) / 4) - padding;
}

// Convert our internal ChatMessage shape into Anthropic's MessageParam
// content blocks. Text-only turns stay as plain strings (matches the
// SDK's most common path); image-bearing user turns become a content
// array with image blocks first, then a text block. Assistant turns
// always stay text-only since we don't generate images via this route.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toAnthropicMessage(message: ChatMessage): any {
  // v0.1.8 — structured content (tool_use / tool_result blocks)
  // passes straight through. The desktop client builds these arrays
  // when continuing a tool-using assistant turn.
  if (Array.isArray(message.content)) {
    return { role: message.role, content: message.content };
  }

  const validImages =
    message.role === "user" && Array.isArray(message.images)
      ? message.images.filter(
          (img) =>
            ALLOWED_IMAGE_TYPES.has(img.media_type) &&
            typeof img.data === "string" &&
            img.data.length > 0 &&
            approxBase64ByteLength(img.data) <= MAX_IMAGE_BYTES,
        )
      : [];

  if (validImages.length === 0) {
    return { role: message.role, content: message.content };
  }

  return {
    role: "user",
    content: [
      ...validImages.map(
        (img) =>
          ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: img.media_type,
              data: img.data,
            },
          }),
      ),
      { type: "text" as const, text: message.content || "" },
    ],
  };
}

const AGENT_MODE_PROMPT = `Agent mode: ON. Approach this like an autonomous agent. Break the task into 3-7 numbered steps. Execute or describe each step in order. After steps, give a single-line "Done" or "Next:" summary so the user can continue or branch.`;

function chatContentToText(content: string | ChatContentBlock[]): string {
  if (typeof content === "string") return content;
  return content
    .map((block) => {
      if (block.type === "text") return block.text;
      if (block.type === "tool_result") return block.content;
      return "";
    })
    .join("");
}

function latestUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") {
      return chatContentToText(messages[i].content).trim();
    }
  }
  return "";
}

function recentUserContext(
  messages: ChatMessage[],
  maxMessages = 3,
): string {
  const recent = messages
    .filter((message) => message.role === "user")
    .slice(-maxMessages)
    .map((message) => chatContentToText(message.content).trim())
    .filter(Boolean);

  return recent.join("\n\n");
}

function matchesVoiceHumanizationIntent(payload: ChatBody): boolean {
  // v0.1.16 — Removed the input_mode === "voice" gate. The user
  // wants humanization to fire whenever they ASK for it (humanize,
  // make this human, rewrite naturally, less AI), regardless of
  // whether the prompt came from typing, dictation, or full voice
  // mode. The detector-evasion guard still prevents abuse.
  const latestMessage = latestUserMessage(payload.messages);
  const context = recentUserContext(payload.messages);
  if (!latestMessage || !context) {
    return false;
  }

  if (DETECTOR_EVASION_PATTERNS.some((pattern) => pattern.test(context))) {
    return false;
  }

  return HUMANIZATION_INTENT_PATTERNS.some((pattern) =>
    pattern.test(context),
  );
}

function requestedHumanizationTone(payload: ChatBody): HumanizationTone | undefined {
  const context = recentUserContext(payload.messages, 2).toLowerCase();
  if (/\bformal\b|\bprofessional\b|\bpolished\b/.test(context)) {
    return "formal";
  }
  if (/\bcasual\b|\bconversational\b|\bfriendly\b/.test(context)) {
    return "conversational";
  }
  if (/\bbalanced\b|\bneutral\b|\bclear\b/.test(context)) {
    return "balanced";
  }
  return undefined;
}

function extractInlineRewriteTarget(message: string): string | null {
  const fenced = [...message.matchAll(/```(?:[\w-]+)?\n?([\s\S]+?)```/g)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => !!value && value.length > 24)
    .sort((a, b) => b.length - a.length)[0];
  if (fenced) {
    return fenced;
  }

  const quoted = [...message.matchAll(/["“]([\s\S]{24,}?)["”]/g)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => !!value && value.split(/\s+/).length >= 5)
    .sort((a, b) => b.length - a.length)[0];
  if (quoted) {
    return quoted;
  }

  const afterBlankLine = message.match(/\n\s*\n([\s\S]{24,})$/)?.[1]?.trim();
  if (afterBlankLine && afterBlankLine.split(/\s+/).length >= 5) {
    return afterBlankLine;
  }

  const afterColon = message.match(/:\s*([\s\S]{24,})$/)?.[1]?.trim();
  if (afterColon && afterColon.split(/\s+/).length >= 5) {
    return afterColon;
  }

  return null;
}

function resolveVoiceHumanizationSource(payload: ChatBody): string | null {
  if (!matchesVoiceHumanizationIntent(payload)) {
    return null;
  }

  const latestMessage = latestUserMessage(payload.messages);
  const inlineTarget = extractInlineRewriteTarget(latestMessage);
  if (inlineTarget) {
    return inlineTarget;
  }

  const noteBody = payload.context?.note_body?.trim();
  if (noteBody && noteBody.split(/\s+/).length >= 5) {
    return noteBody;
  }

  return null;
}

function systemPromptForPayload(
  payload: ChatBody,
  referenceBlock = "",
): string {
  let prompt = SYSTEM_PROMPT;

  // v0.1.4 — Source-attached reference block (RAG). Lives BEFORE the
  // persona overlay so persona instructions still take priority on
  // tone, but the model has the materials in scope when it answers.
  if (referenceBlock) {
    prompt = `${prompt}\n\n${referenceBlock}`;
  }

  // Persona overlay (direct/warm/technical/playful) — short style
  // directive appended to the base prompt. Keep this AFTER the base
  // so persona instructions override hedge-y behavior in the base.
  if (payload.persona && isPersona(payload.persona)) {
    const persona = describePersona(payload.persona);
    prompt = `${prompt}\n\n${persona.style_directive}`;
  }

  if (matchesVoiceHumanizationIntent(payload)) {
    prompt = `${prompt}\n\n${VOICE_HUMANIZATION_PROMPT}`;
  }

  // v0.1.16 — when the user is talking, replies must be brief and TTS-
  // friendly (no markdown, short sentences). Without this the model
  // happily ships 4-paragraph answers that sound terrible read aloud.
  if (payload.input_mode === "voice") {
    prompt = `${prompt}\n\n${VOICE_TURN_DIRECTIVE}`;
  }

  // v0.1.4 — Agent mode directive. Toggled from the "+" menu in the
  // desktop chat input. Just a prompt directive for now; real tool-
  // calling lands in v0.1.5+.
  if (payload.agent_mode) {
    prompt = `${prompt}\n\n${AGENT_MODE_PROMPT}`;
  }

  // v0.1.16 — Language lock. Previously: only nudged when the
  // detector flagged a non-English language. PROBLEM: when the model
  // calls web_search and gets back results in another language
  // (common for region-specific searches — stocks pulled Portuguese
  // results from a Brazilian source, for example), it would silently
  // SWITCH languages to match the search results. User asked in
  // English, got a reply in Portuguese.
  //
  // Fix: ALWAYS state the user's language explicitly, plus a hard
  // rule that the reply language is determined by the user's text,
  // never by the source language of any tool output / file / search
  // result. Detector only switches off English when there's a real
  // signal (≥2 stop-word hits in another lang); otherwise we lock
  // English. Same backend serves web + desktop, so this fixes both.
  const lastUserMessage = latestUserMessage(payload.messages);
  if (lastUserMessage) {
    const detectedLang = detectLanguage(lastUserMessage);
    const lang = langLabel(detectedLang);
    prompt += `\n\nLanguage lock: the user is writing in ${lang}. Reply ONLY in ${lang}. If web_search, attached files, or any other tool returns content in a different language, translate or paraphrase what's relevant into ${lang} — NEVER switch to the source language. The user's language is determined by their typed message, not by any external content.`;
  }

  // v0.1.12 — Client-supplied local time so the model can answer
  // time-of-day questions and frame replies appropriately ("good
  // evening" not "good afternoon" at 8pm). Client passes its own
  // IANA timezone + a formatted label; server falls back to UTC
  // when none of them are present.
  const tzLabel = payload.client_timezone ?? "UTC";
  const timeLabel =
    payload.client_time_label ??
    payload.client_time_iso ??
    new Date().toISOString();
  prompt += `\n\nThe user's current local time is ${timeLabel} (timezone: ${tzLabel}). Use this when answering time-of-day questions or framing greetings — never claim you don't have access to the time.`;

  return prompt;
}

export async function POST(request: Request) {
  // Two ways to authenticate this endpoint: a Bearer token (desktop)
  // or a NextAuth session cookie (browser at sansxel.ai/app). Either
  // one identifies a user; the rest of the route is identical.
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: ChatBody;
  try {
    payload = (await request.json()) as ChatBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(payload.messages) || payload.messages.length === 0) {
    return NextResponse.json({ error: "Missing messages." }, { status: 400 });
  }

  const directHumanizationSource = resolveVoiceHumanizationSource(payload);
  if (directHumanizationSource) {
    return new Response(
      humanizeText(directHumanizationSource, {
        tone: requestedHumanizationTone(payload),
      }),
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  // Resolve the requested tier against the user's plan. If they ask
  // for a tier their plan can't run, we silently downgrade — rejecting
  // would force the client to handle yet another error path. The
  // resolved tier is sent back via headers so the UI can surface it.
  const requestedTier: ModelTier = payload.tier ?? "balanced";
  // v0.1.16 r4 — parallelize plan + weekly fetches. They're independent
  // Supabase round-trips (~120ms each); awaiting them sequentially
  // doubled the pre-stream latency for nothing.
  const [plan, weekly] = await Promise.all([
    getPlanForEmail(email),
    getWeeklyUsage(email),
  ]);
  let resolvedTier = resolveTier(plan, requestedTier);

  // Plan limits: hard weekly cap on free/apprentice/studio,
  // silent tier-throttle on pro, no cap on teams/enterprise.
  const decision = decideChatRequest({
    plan,
    requestedTier: resolvedTier,
    weekly,
  });
  // v0.1.8 — boost ledger override. If the plan-cap blocked the
  // request, check for an unconsumed session_boost / weekly_boost.
  // We BURN the credit before letting the request through so a hung
  // chat never spends a credit twice. Throttle info from `decision`
  // only matters when kind === "ok"; capturing it before the
  // override lets TS narrow cleanly downstream.
  const throttledTierFromDecision =
    decision.kind === "ok" ? decision.throttledTier : null;
  if (decision.kind === "blocked") {
    let allowed = false;
    if (await hasUnconsumedBoost(email, "chat")) {
      const burnt = await consumeBoostForKind(email, "chat");
      if (burnt) allowed = true;
    }
    // v0.1.9 — credit ledger fallback. When no boost is on file, try
    // burning credits before returning 429.
    if (!allowed && (await consumeCreditFor(email, "chat"))) {
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
  // Pro plan throttle: server picked a cheaper tier than requested
  let throttleApplied: ModelTier | null = null;
  if (throttledTierFromDecision && throttledTierFromDecision !== resolvedTier) {
    throttleApplied = throttledTierFromDecision;
    resolvedTier = throttledTierFromDecision;
  }

  const descriptor = descriptorForTier(resolvedTier);
  const planLimit = PLAN_LIMITS[plan];

  // Build the messages list with optional note context as a leading turn
  const messages: ChatMessage[] = [];
  const ctx = payload.context;
  if (ctx && (ctx.note_title || ctx.note_body)) {
    const contextBlock = [
      "Working note:",
      ctx.note_title ? `Title: ${ctx.note_title}` : null,
      ctx.note_body ? `\n${ctx.note_body}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    messages.push({ role: "user", content: contextBlock });
    messages.push({
      role: "assistant",
      content: "Got it — I have the note in mind.",
    });
  }
  messages.push(...payload.messages);

  // v0.1.4 — fetch any attached source bodies and assemble a single
  // reference block. Failures here are non-fatal (we just skip the
  // injection) so a flaky source lookup never breaks the chat itself.
  let referenceBlock = "";
  if (Array.isArray(payload.source_ids) && payload.source_ids.length > 0) {
    try {
      const sources = await fetchSourcesByIds(email, payload.source_ids);
      referenceBlock = buildReferenceBlock(sources);
    } catch (err) {
      console.warn("ai/chat sources fetch failed:", err);
    }
  }

  try {
    // v0.1.8 — when tools_enabled, expose the desktop tool registry
    // and stream JSON-Lines events so the client can dispatch
    // tool_use blocks. v0.1.12 fix: default is now FALSE (must be
    // EXPLICITLY enabled). The previous "!== false" default treated
    // an absent flag as opt-in, so the website chat (which doesn't
    // send the flag) received raw JSON-Lines and dumped it into
    // the message bubble verbatim. Desktop callers all set
    // tools_enabled: true explicitly, so this is safe.
    const toolsEnabled = payload.tools_enabled === true;

    // v0.1.16 r5 — Tools are LATENCY-EXPENSIVE. Anthropic's hosted
    // web_search adds 2-5s of TTFT even when the model decides NOT to
    // use it (the option's existence triggers extra processing).
    // For short / clearly-conversational prompts, strip tools so the
    // first token comes back fast.
    const isVoiceTurn = payload.input_mode === "voice";
    const lastUserText = chatContentToText(
      [...payload.messages].reverse().find((m) => m.role === "user")?.content ?? "",
    ).trim();
    // Heuristic: skip server tools if the prompt is trivially short
    // (greetings, acks). The model would never need web_search to
    // answer "hi" / "thanks" / "ok" / "wsg".
    // EXCEPTION: a short prompt that contains a URL ("summarize
    // https://…") still needs web_fetch — strip would force the
    // "I can't access URLs" punt response.
    const containsUrl = URL_PATTERN.test(lastUserText);
    const isTrivialPrompt = lastUserText.length < 20 && !containsUrl;
    const toolsForCall = isVoiceTurn || isTrivialPrompt
      ? [] // strip ALL tools — fast first-token wins
      : toolsEnabled
        ? [...SERVER_TOOLS, ...(DESKTOP_TOOLS as unknown as Anthropic.Messages.Tool[])]
        : SERVER_TOOLS;

    // v0.1.16 — Thread persistence. Resolve or create the thread so
    // the conversation lives server-side and follows the user across
    // devices. Save the latest user turn before the model starts so
    // it's persisted even if the stream errors.
    let resolvedThreadId: string | null = null;
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
        const created = await createChatThread(email);
        if (created) resolvedThreadId = created.id;
      }
      if (resolvedThreadId) {
        const lastUserTurn = [...payload.messages].reverse().find((m) => m.role === "user");
        if (lastUserTurn) {
          const text = chatContentToText(lastUserTurn.content);
          if (text) {
            void saveMessage({
              email,
              threadId: resolvedThreadId,
              role: "user",
              content: text,
              images: lastUserTurn.images?.map((i) => ({
                media_type: i.media_type,
                data: i.data,
              })),
            });
          }
        }
      }
    } catch (err) {
      console.warn("ai/chat thread persist (user turn) failed:", err);
    }

    // v0.1.16 r7 — Progressive save re-enabled. The hang was a
    // CLIENT-SIDE thread-id capture bug, not the persistence layer.
    // Now generation truly survives client disconnect: throttled
    // 900ms updates to the placeholder + final UPDATE on stream end.
    const assistantMessageIdPromise: Promise<string | null> = resolvedThreadId
      ? createAssistantPlaceholder(email, resolvedThreadId).catch((err) => {
          console.warn("ai/chat placeholder create failed:", err);
          return null;
        })
      : Promise.resolve(null);

    // v0.1.16 r5 — Quick timing markers so the Vercel function logs
    // show where time goes when chats feel slow.
    const tStreamCall = Date.now();
    console.log(
      `[ai/chat] tools=${toolsForCall.length} promptLen=${lastUserText.length} model=${descriptor.model}`,
    );

    // v0.1.16 — web_fetch_20250910 is still on a beta header. Send it
    // whenever tools are enabled; harmless on calls that only end up
    // using web_search. Per-request headers don't affect caching.
    const wantsBetaTools = toolsForCall.some(
      (t) => (t as { type?: string }).type === "web_fetch_20250910",
    );
    const stream = await client.messages.stream(
      {
        model: descriptor.model,
        // Voice replies are short by design (system prompt enforces
        // 1-3 sentences). Cap tokens hard so the model can't drift
        // into a multi-paragraph essay that takes 8 seconds to TTS.
        max_tokens: isVoiceTurn ? 320 : 2048,
        system: systemPromptForPayload(payload, referenceBlock),
        // v0.1.4 — translate to Anthropic content-block form so user
        // turns with attached images become multimodal content arrays.
        // Text-only turns pass through as plain strings.
        messages: messages.map(toAnthropicMessage),
        ...(toolsForCall.length > 0 ? { tools: toolsForCall } : {}),
      },
      wantsBetaTools
        ? { headers: { "anthropic-beta": "web-fetch-2025-09-10" } }
        : undefined,
    );

    const startedAt = Date.now();
    // Capture from the surface header so the dashboard can split
    // web vs desktop usage.
    const surface =
      request.headers.get("x-sansxel-surface") === "desktop"
        ? "desktop"
        : "web";
    const encoder = new TextEncoder();
    // Buffer the assistant's text deltas so we can persist the full
    // reply once streaming finishes. Also throttle-save to the
    // placeholder message every ~900ms so partial output survives a
    // client disconnect.
    let assistantBuffer = "";
    let firstTokenLogged = false;
    // Throttled progressive save — partial output survives client
    // disconnect. UPDATE the placeholder with the latest buffer
    // every ~900ms so a navigation/closure doesn't lose state.
    let lastPersist = 0;
    const PERSIST_INTERVAL_MS = 900;
    const persistPartial = async () => {
      if (!resolvedThreadId || !assistantBuffer) return;
      const aid = await assistantMessageIdPromise;
      if (!aid) return;
      try {
        await updateMessageContent(email, resolvedThreadId, aid, assistantBuffer);
      } catch {
        // best-effort
      }
    };
    const maybePersist = () => {
      const now = Date.now();
      if (now - lastPersist > PERSIST_INTERVAL_MS) {
        lastPersist = now;
        void persistPartial();
      }
    };
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let inputTokens = 0;
        let outputTokens = 0;

        // v0.1.8 — when streaming JSON-Lines, every event is a
        // single-line JSON object terminated by \n. Buffers tool
        // input JSON across multiple input_json_delta events and
        // emits a single tool_use line at content_block_stop.
        const toolBuffers = new Map<
          number,
          { id: string; name: string; partial: string }
        >();
        const writeLine = (obj: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
        };

        try {
          for await (const event of stream) {
            if (event.type === "message_start") {
              inputTokens = event.message?.usage?.input_tokens ?? 0;
            }
            if (event.type === "message_delta") {
              outputTokens = event.usage?.output_tokens ?? outputTokens;
            }

            if (toolsEnabled) {
              if (event.type === "content_block_start") {
                const block = event.content_block;
                if (block && block.type === "tool_use") {
                  toolBuffers.set(event.index, {
                    id: block.id,
                    name: block.name,
                    partial: "",
                  });
                }
              }
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "input_json_delta"
              ) {
                const buf = toolBuffers.get(event.index);
                if (buf) {
                  buf.partial += event.delta.partial_json ?? "";
                }
              }
              if (event.type === "content_block_stop") {
                const buf = toolBuffers.get(event.index);
                if (buf) {
                  let parsed: unknown = {};
                  try {
                    parsed = buf.partial ? JSON.parse(buf.partial) : {};
                  } catch {
                    parsed = {};
                  }
                  writeLine({
                    type: "tool_use",
                    id: buf.id,
                    name: buf.name,
                    input: parsed,
                  });
                  toolBuffers.delete(event.index);
                }
              }
              if (
                event.type === "content_block_delta" &&
                event.delta.type === "text_delta"
              ) {
                if (!firstTokenLogged) {
                  firstTokenLogged = true;
                  console.log(
                    `[ai/chat] first-token in ${Date.now() - tStreamCall}ms`,
                  );
                }
                if (!firstTokenLogged) {
                  firstTokenLogged = true;
                  console.log(`[ai/chat] first-token in ${Date.now() - tStreamCall}ms`);
                }
                assistantBuffer += event.delta.text;
                writeLine({ type: "text", text: event.delta.text });
                maybePersist();
              }
              if (event.type === "message_delta") {
                const stop = event.delta?.stop_reason;
                if (stop) {
                  writeLine({ type: "message_stop", stop_reason: stop });
                }
              }
            } else if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              if (!firstTokenLogged) {
                firstTokenLogged = true;
                console.log(
                  `[ai/chat] first-token (text path) in ${Date.now() - tStreamCall}ms`,
                );
              }
              // Legacy plain-text path.
              assistantBuffer += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
              maybePersist();
            }
          }
        } catch (err) {
          console.error("ai/chat stream error:", err);
        } finally {
          controller.close();
          // Fire-and-forget usage record after the stream resolves
          void recordUsage({
            email,
            kind: "chat",
            model: descriptor.model,
            surface,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
            duration_ms: Date.now() - startedAt,
          });
          // v0.1.16 r2 — Final save: update the placeholder with the
          // full buffer (overwrites the throttled partials). Use UPDATE
          // not INSERT so we don't double-create the assistant
          // message. If somehow no placeholder exists (DB hiccup),
          // fall back to creating a fresh row.
          if (resolvedThreadId && assistantBuffer.trim()) {
            const tid = resolvedThreadId;
            void (async () => {
              const aid = await assistantMessageIdPromise;
              if (aid) {
                // UPDATE the placeholder with the final full buffer
                // (overwrites the throttled partials).
                await updateMessageContent(email, tid, aid, assistantBuffer);
              } else {
                // Fallback: placeholder didn't get created (DB hiccup),
                // INSERT a fresh row.
                await saveMessage({
                  email,
                  threadId: tid,
                  role: "assistant",
                  content: assistantBuffer,
                });
              }
              // After the assistant turn lands, fire AI title gen
              // for threads that still have the auto-snippet title
              // (the first user message). Cheap Haiku call. Fails
              // open — bad titles just stay snippets if it errors.
              try {
                const after = await listChatMessages(email, tid);
                const firstUser = after.find((m) => m.role === "user");
                const firstAssistant = after.find((m) => m.role === "assistant");
                if (firstUser && firstAssistant) {
                  // Snippet-detection regen: fire whenever the title
                  // looks like the auto-derived first-message snippet
                  // OR the placeholder. Covers fresh threads (first
                  // round) AND old crap-titled ones the user is now
                  // continuing — both auto-upgrade.
                  const t = await getChatThread(email, tid);
                  const currentTitle = (t?.title ?? "").trim();
                  const firstText = firstUser.content.replace(/\s+/g, " ").trim();
                  const looksLikeUrlTitle = /^https?:\/\//i.test(currentTitle);
                  const looksLikeSnippet =
                    !currentTitle ||
                    currentTitle === "New chat" ||
                    currentTitle === firstText ||
                    currentTitle === firstText.slice(0, 59).trimEnd() + "…" ||
                    looksLikeUrlTitle ||
                    (currentTitle.length < 30 &&
                      firstText.toLowerCase().startsWith(currentTitle.toLowerCase()));
                  if (looksLikeSnippet) {
                    await generateAndSetThreadTitle(email, tid);
                  }
                }
              } catch (err) {
                console.warn("ai/chat title-gen check failed:", err);
              }
            })();
          }
        }
      },
    });

    const personaDescriptor =
      payload.persona && isPersona(payload.persona)
        ? describePersona(payload.persona)
        : null;

    return new Response(body, {
      headers: {
        // v0.1.8 — JSON-Lines when tools are enabled, plain text
        // otherwise. The client checks x-sansxel-stream-format to
        // decide how to parse incoming chunks.
        "Content-Type": toolsEnabled
          ? "application/x-ndjson; charset=utf-8"
          : "text/plain; charset=utf-8",
        "x-sansxel-stream-format": toolsEnabled ? "jsonl" : "text",
        "Cache-Control": "no-store",
        "x-sansxel-tier": resolvedTier,
        "x-sansxel-tier-requested": requestedTier,
        "x-sansxel-plan": plan,
        "x-sansxel-persona": personaDescriptor?.key ?? "",
        "x-sansxel-persona-delay-multiplier": String(
          personaDescriptor?.delay_multiplier ?? 1,
        ),
        "x-sansxel-throttled": throttleApplied ?? "",
        "x-sansxel-weekly-used": String(weekly.chat_requests),
        "x-sansxel-weekly-limit": String(
          planLimit.weekly_chat_requests ?? "",
        ),
        // v0.1.16 — Echo the resolved thread id so the client can
        // stash it for follow-up turns + show it in the URL/sidebar.
        "x-sansxel-thread-id": resolvedThreadId ?? "",
      },
    });
  } catch (err) {
    console.error("ai/chat failed:", err);
    return NextResponse.json(
      { error: "Could not start AI chat." },
      { status: 500 },
    );
  }
}
