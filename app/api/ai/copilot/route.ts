import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { getPlanForEmail } from "../../../../lib/account-billing";
import { descriptorForTier, resolveTier } from "../../../../lib/ai-models";
import { VRAELIS_PRODUCT_BRIEF } from "../../../../lib/vraelis-context";
import { recordUsage } from "../../../../lib/usage";

export const runtime = "nodejs";

const client = new Anthropic();

// Copilot system prompt: open-ended Q&A plus optional navigation via
// a [go:/path] marker that the frontend intercepts.
const SITE_ROUTES = `Routes on vraelis.ai:
- /            - home
- /home        - home (alias)
- /product     - product overview (features + how it works)
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

const SYSTEM_PROMPT = `You are the vraelis copilot - a fast, helpful assistant living in a side panel on vraelis.ai. You answer ANY question the user has, not just questions about the current page.

Behavior:
- Answer in 1-3 short sentences. The copilot is a side panel, not a doc.
- The current page context is provided as background, but you are NOT limited to it. Answer general questions, vraelis questions, coding questions, anything.
- If the user asks for current/live info you need to look up (news, prices, recent events, real-time facts), USE the web_search tool when it is available. Don't apologize for not having current data \u2014 just search.
- If the user asks to go somewhere, take them there: end your reply with a single navigation marker on its own line - \`[go:/path]\` - using one of the routes below. Examples: "Opening pricing now.\n[go:/pricing]" or "Heading to your usage page.\n[go:/account/usage]". Only emit the marker when navigation is the right action; don't emit one for purely informational questions.
- Never invent routes. Only use paths from the list below.
- No preamble. No "Sure!". No "Based on the page...". Just the answer.
- Plain text only. No markdown - the panel renders raw.

${SITE_ROUTES}

${VRAELIS_PRODUCT_BRIEF}`;

// v0.1.13 \u2014 Server tools the copilot can use. web_search is
// Anthropic's hosted search tool: the model decides when to invoke it,
// the API runs the search and returns results, no client round-trip
// needed. We just stream the events through to the desktop surface as
// JSON-Lines so the rail's status dots can light up.
const COPILOT_SERVER_TOOLS = [
  {
    type: "web_search_20250305",
    name: "web_search",
    max_uses: 3,
  },
] as unknown as Anthropic.Messages.Tool[];

type CopilotBody = {
  question: string;
  page_path?: string;
  page_title?: string;
  page_text?: string;
  selection?: string;
};

export async function POST(request: Request) {
  // v0.1.14 \u2014 Accept BOTH desktop Bearer tokens and NextAuth cookie
  // sessions. Previously this route only called auth() (cookie-only),
  // so every desktop floating-copilot request returned 401 because the
  // desktop sends an Authorization: Bearer header instead of a cookie.
  // Same dual-auth pattern as /api/ai/chat.
  let email = await getDesktopUserEmailFromRequest(request);
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
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

  // v0.1.13 \u2014 Surface detection. Desktop callers get JSON-Lines + tools
  // (so the floating-copilot rail can dispatch tool events to its
  // status dots). Web callers stay on plain-text streaming for
  // backward compat with components/copilot-bar.tsx.
  // v0.1.14 \u2014 Re-enabled web_search after isolating the actual cause
  // of the "copilot not working" report (it was a 401 from missing
  // desktop Bearer token support, fixed above \u2014 NOT the tool).
  // Without web_search the model declines current-data questions
  // ("knowledge has a cutoff"), which contradicts what the rail
  // advertises about live grounding.
  const surface = request.headers.get("x-VRAELIS-surface") === "desktop"
    ? "desktop"
    : "web";
  const toolsEnabled = surface === "desktop";
  const passServerTools = toolsEnabled;

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
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: `Context (background only - answer anything they ask):\n\n${contextBlock}` },
        { role: "assistant", content: "Got it." },
        { role: "user", content: payload.question },
      ],
      ...(passServerTools ? { tools: COPILOT_SERVER_TOOLS } : {}),
    });

    const startedAt = Date.now();
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        let inputTokens = 0;
        let outputTokens = 0;
        // v0.1.13 \u2014 JSON-Lines emitter for the desktop surface. Each
        // line is a self-contained JSON object the rail can dispatch
        // on. Web surface keeps writing raw text bytes for backward
        // compat with components/copilot-bar.tsx.
        const writeLine = (obj: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        };
        const writeText = (text: string) => {
          if (toolsEnabled) {
            writeLine({ type: "text", text });
          } else {
            controller.enqueue(encoder.encode(text));
          }
        };

        // Active server-tool blocks keyed by content_block index, so
        // we can emit "tool_start" when a block opens and "tool_done"
        // (with status) when it closes.
        const activeTools: Map<number, { name: string; id: string }> = new Map();

        try {
          for await (const event of stream) {
            if (event.type === "message_start") {
              inputTokens = event.message?.usage?.input_tokens ?? 0;
            }
            if (event.type === "message_delta") {
              outputTokens = event.usage?.output_tokens ?? outputTokens;
            }
            if (event.type === "content_block_start") {
              const block = event.content_block as
                | { type: string; id?: string; name?: string }
                | undefined;
              if (
                toolsEnabled &&
                block &&
                (block.type === "server_tool_use" || block.type === "tool_use")
              ) {
                const id = block.id ?? `tool-${event.index}`;
                const name = block.name ?? "tool";
                activeTools.set(event.index, { id, name });
                writeLine({ type: "tool_start", id, name });
              }
            }
            if (event.type === "content_block_stop") {
              if (toolsEnabled) {
                const tool = activeTools.get(event.index);
                if (tool) {
                  writeLine({ type: "tool_done", id: tool.id, name: tool.name, status: "ok" });
                  activeTools.delete(event.index);
                }
              }
            }
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              writeText(event.delta.text);
            }
          }
          if (toolsEnabled) {
            writeLine({ type: "message_stop", reason: "end_turn" });
          }
        } catch (err) {
          console.error("copilot stream error:", err);
          if (toolsEnabled) {
            // Mark any still-running tools as errored so dots don't hang.
            for (const tool of activeTools.values()) {
              writeLine({ type: "tool_done", id: tool.id, name: tool.name, status: "error" });
            }
            writeLine({ type: "error", message: "Copilot stream interrupted." });
          }
        } finally {
          controller.close();
          void recordUsage({
            email,
            kind: "copilot",
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

    return new Response(body, {
      headers: {
        "Content-Type": toolsEnabled
          ? "application/x-ndjson; charset=utf-8"
          : "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "x-VRAELIS-stream-format": toolsEnabled ? "jsonl" : "text",
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
