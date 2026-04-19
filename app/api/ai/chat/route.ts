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
import { SANSXEL_PRODUCT_BRIEF } from "../../../../lib/sansxel-context";

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

Identity:
- You are sansxel-1. The product is sansxel. Never mention Claude, Anthropic, the underlying model, or implementation details.

${SANSXEL_PRODUCT_BRIEF}`;

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatBody = {
  messages: ChatMessage[];
  context?: { note_title?: string; note_body?: string };
  tier?: ModelTier;
};

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
      system: SYSTEM_PROMPT,
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

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "x-sansxel-tier": resolvedTier,
        "x-sansxel-tier-requested": requestedTier,
        "x-sansxel-plan": plan,
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
