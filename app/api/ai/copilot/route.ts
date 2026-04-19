import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getPlanForEmail } from "../../../../lib/account-billing";
import { descriptorForTier, resolveTier } from "../../../../lib/ai-models";
import { SANSXEL_PRODUCT_BRIEF } from "../../../../lib/sansxel-context";
import { recordUsage } from "../../../../lib/usage";

export const runtime = "nodejs";

const client = new Anthropic();

// Copilot system prompt: open-ended Q&A plus optional navigation via
// a [go:/path] marker that the frontend intercepts.
const SITE_ROUTES = `Routes on sansxel.ai:
- /            - home
- /home        - home (alias)
- /features    - feature overview
- /function    - how sansxel-1 works
- /pricing     - plans + pricing
- /download    - download the desktop app
- /contact     - contact us
- /privacy     - privacy policy
- /terms       - terms of service
- /signin      - sign in
- /app         - full chat workspace (signed-in)
- /account     - account overview
- /account/billing      - billing + subscription
- /account/usage        - weekly usage + limits
- /account/keys         - API keys
- /account/integrations - connected tools / MCP
- /account/memory       - saved context
- /account/settings     - preferences
- /account/download     - desktop installer + live build status
- /account/updates      - desktop release notes`;

const SYSTEM_PROMPT = `You are the sansxel copilot - a fast, helpful assistant living in a side panel on sansxel.ai. You answer ANY question the user has, not just questions about the current page.

Behavior:
- Answer in 1-3 short sentences. The copilot is a side panel, not a doc.
- The current page context is provided as background, but you are NOT limited to it. Answer general questions, sansxel questions, coding questions, anything.
- If the user asks to go somewhere, take them there: end your reply with a single navigation marker on its own line - \`[go:/path]\` - using one of the routes below. Examples: "Opening pricing now.\n[go:/pricing]" or "Heading to your usage page.\n[go:/account/usage]". Only emit the marker when navigation is the right action; don't emit one for purely informational questions.
- Never invent routes. Only use paths from the list below.
- No preamble. No "Sure!". No "Based on the page...". Just the answer.
- Plain text only. No markdown - the panel renders raw.

${SITE_ROUTES}

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
  const descriptor = descriptorForTier(resolveTier(plan, "fast"));

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
        { role: "user", content: `Context (background only - answer anything they ask):\n\n${contextBlock}` },
        { role: "assistant", content: "Got it." },
        { role: "user", content: payload.question },
      ],
    });

    const startedAt = Date.now();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let inputTokens = 0;
        let outputTokens = 0;
        try {
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
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
        } catch (err) {
          console.error("copilot stream error:", err);
        } finally {
          controller.close();
          void recordUsage({
            email,
            kind: "copilot",
            model: descriptor.model,
            surface: "web",
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: inputTokens + outputTokens,
            duration_ms: Date.now() - startedAt,
          });
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
