import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getPlanForEmail } from "../../../../lib/account-billing";
import {
  descriptorForTier,
  resolveTier,
} from "../../../../lib/ai-models";
import { SANSXEL_PRODUCT_BRIEF } from "../../../../lib/sansxel-context";

export const runtime = "nodejs";

const client = new Anthropic();

// Copilot-specific system prompt: scoped to the page the user is on,
// no markdown, short answers. Falls back to general help if asked
// something off-topic.
const SYSTEM_PROMPT = `You are the sansxel copilot — a small assistant inside the sansxel.ai marketing site that answers questions about whatever page the user is currently on.

Behavior:
- Answer in 1-3 short sentences. The copilot is a side panel, not a doc.
- Use the page context provided to ground your answer. Never invent feature details.
- If asked about something off this page, say so briefly and suggest where to look (which other page, or "open the full chat at /app").
- No preamble. No "Sure!". No "Based on the page…". Just the answer.
- Plain text only. No markdown — the panel renders raw.

${SANSXEL_PRODUCT_BRIEF}`;

type CopilotBody = {
  question: string;
  page_path?: string;
  page_title?: string;
  page_text?: string;
  selection?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: CopilotBody;
  try {
    payload = (await request.json()) as CopilotBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!payload.question || typeof payload.question !== "string") {
    return NextResponse.json({ error: "Missing question." }, { status: 400 });
  }

  const plan = await getPlanForEmail(email);
  // Copilot always runs on fast tier — it's small Q+A, doesn't need Opus
  const descriptor = descriptorForTier(resolveTier(plan, "fast"));

  // Trim page text to a sane size so we don't blow context on
  // header/footer noise the page passed in
  const pageText = (payload.page_text ?? "").slice(0, 12000);

  const contextBlock = [
    `Current page: ${payload.page_path ?? "(unknown)"}`,
    payload.page_title ? `Title: ${payload.page_title}` : null,
    pageText ? `Page contents:\n"""\n${pageText}\n"""` : null,
    payload.selection
      ? `User has highlighted this excerpt: "${payload.selection.slice(0, 600)}"`
      : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const stream = await client.messages.stream({
      model: descriptor.model,
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: contextBlock },
        { role: "assistant", content: "Got it — I have the page in mind." },
        { role: "user", content: payload.question },
      ],
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
          console.error("copilot stream error:", err);
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
    console.error("ai/copilot failed:", err);
    return NextResponse.json(
      { error: "Could not start copilot." },
      { status: 500 },
    );
  }
}
