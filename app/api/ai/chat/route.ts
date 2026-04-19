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
  decideChatRequest,
  getWeeklyUsage,
  hasUnconsumedBoost,
  PLAN_LIMITS,
} from "../../../../lib/plan-limits";
import { detectLanguage, langLabel } from "../../../../lib/i18n";

export const runtime = "nodejs";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are sansxel-1, the AI inside the sansxel workspace — an adaptive product for thinking, writing, and building. You are an assistant for serious creative and professional work.

How to respond:
- Just do the thing. No "Sure!", no "I'd be happy to", no "Here's...". Skip the preamble entirely and start with the actual answer.
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
};

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
  if (payload.input_mode !== "voice") {
    return false;
  }

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

  // v0.1.4 — Agent mode directive. Toggled from the "+" menu in the
  // desktop chat input. Just a prompt directive for now; real tool-
  // calling lands in v0.1.5+.
  if (payload.agent_mode) {
    prompt = `${prompt}\n\n${AGENT_MODE_PROMPT}`;
  }

  // v0.1.4 i18n response-language hook. Cheap detection on the latest
  // user turn — if they're writing in something other than English,
  // tell the model to respond in the same language. The detector is
  // a heuristic; the model itself usually matches the user's language
  // already, so this is a nudge, not a hard switch.
  const lastUserMessage = latestUserMessage(payload.messages);
  if (lastUserMessage) {
    const detectedLang = detectLanguage(lastUserMessage);
    if (detectedLang !== "en") {
      prompt += `\n\nThe user is writing in ${langLabel(detectedLang)}. Respond in the same language.`;
    }
  }

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
  const plan = await getPlanForEmail(email);
  let resolvedTier = resolveTier(plan, requestedTier);

  // Plan limits: hard weekly cap on free/apprentice/studio,
  // silent tier-throttle on pro, no cap on teams/enterprise.
  const weekly = await getWeeklyUsage(email);
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
    let boostConsumed = false;
    if (await hasUnconsumedBoost(email, "chat")) {
      const burnt = await consumeBoostForKind(email, "chat");
      if (burnt) boostConsumed = true;
    }
    if (!boostConsumed) {
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
    // tool_use blocks. When false (or absent), behaves identically
    // to the v0.1.7 plain-text stream so older callers keep working.
    const toolsEnabled = payload.tools_enabled !== false;

    const stream = await client.messages.stream({
      model: descriptor.model,
      max_tokens: 2048,
      system: systemPromptForPayload(payload, referenceBlock),
      // v0.1.4 — translate to Anthropic content-block form so user
      // turns with attached images become multimodal content arrays.
      // Text-only turns pass through as plain strings.
      messages: messages.map(toAnthropicMessage),
      ...(toolsEnabled
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ({ tools: DESKTOP_TOOLS as any } as Record<string, unknown>)
        : {}),
    });

    const startedAt = Date.now();
    // Capture from the surface header so the dashboard can split
    // web vs desktop usage.
    const surface =
      request.headers.get("x-sansxel-surface") === "desktop"
        ? "desktop"
        : "web";
    const encoder = new TextEncoder();
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
                writeLine({ type: "text", text: event.delta.text });
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
              // Legacy plain-text path — unchanged.
              controller.enqueue(encoder.encode(event.delta.text));
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
