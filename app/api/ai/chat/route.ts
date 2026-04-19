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
  describePersona,
  isPersona,
  type Persona,
} from "../../../../lib/ai-voices";

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

type ChatMessage = { role: "user" | "assistant"; content: string };
type ChatInputMode = "text" | "voice";

type ChatBody = {
  messages: ChatMessage[];
  context?: { note_title?: string; note_body?: string };
  tier?: ModelTier;
  input_mode?: ChatInputMode;
  persona?: Persona;
};

function latestUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === "user") {
      return messages[i].content.trim();
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
    .map((message) => message.content.trim())
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

function systemPromptForPayload(payload: ChatBody): string {
  let prompt = SYSTEM_PROMPT;

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
  const resolvedTier = resolveTier(plan, requestedTier);
  const descriptor = descriptorForTier(resolvedTier);

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

  try {
    const stream = await client.messages.stream({
      model: descriptor.model,
      max_tokens: 2048,
      system: systemPromptForPayload(payload),
      messages,
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (err) {
          console.error("ai/chat stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    const personaDescriptor =
      payload.persona && isPersona(payload.persona)
        ? describePersona(payload.persona)
        : null;

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "x-sansxel-tier": resolvedTier,
        "x-sansxel-tier-requested": requestedTier,
        "x-sansxel-plan": plan,
        "x-sansxel-persona": personaDescriptor?.key ?? "",
        "x-sansxel-persona-delay-multiplier": String(
          personaDescriptor?.delay_multiplier ?? 1,
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
