import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";

// Anthropic SDK does network IO + streaming — needs the Node runtime,
// not the Edge runtime.
export const runtime = "nodejs";

const client = new Anthropic();

// "sansxel-1" is the brand name for this engine. Keep the model name
// (Claude / Anthropic) hidden from the user — they're talking to
// sansxel-1, not Claude.
const SYSTEM_PROMPT = `You are sansxel-1, the AI inside the sansxel desktop workspace — an adaptive note-taking and writing tool. The user is working on personal notes.

Be:
- Concise. No filler. No "Sure! Here's...". Just answer.
- Direct. No throat-clearing.
- Useful. If they ask for a continuation of a note, write the continuation. If they ask for an outline, give the outline. Don't over-explain what you're about to do.
- Voice-matched. Mirror the user's tone — casual, formal, technical, whatever they're writing in.

You are sansxel-1. Never mention Claude, Anthropic, or any model details. You are the brain inside this workspace.`;

type ChatMessage = { role: "user" | "assistant"; content: string };

type ChatBody = {
  messages: ChatMessage[];
  context?: { note_title?: string; note_body?: string };
};

export async function POST(request: Request) {
  const email = await getDesktopUserEmailFromRequest(request);
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

  // Prepend the working note as context so the model has it without
  // forcing the user to paste it into every message.
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
      model: "claude-opus-4-7",
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
