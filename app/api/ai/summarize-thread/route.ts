import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { getDesktopUserEmailFromRequest } from "../../../../lib/desktop-auth";
import { getPlanForEmail } from "../../../../lib/account-billing";
import { descriptorForTier, resolveTier } from "../../../../lib/ai-models";
import { recordUsage } from "../../../../lib/usage";

export const runtime = "nodejs";

const client = new Anthropic();

// Cheap summarizer used by the desktop sidebar. Given the full
// conversation, returns a short title (under 6 words) and a one-line
// description (under 14 words) that captures what the thread is
// actually about. Re-runs after each turn so the title evolves with
// the conversation. Uses Haiku because this is high-frequency + low
// stakes.
const SYSTEM_PROMPT = `You write headlines for chat conversations.

Given a transcript, output STRICT JSON with two fields:
- title: under 6 words, no trailing period, captures the core topic
- description: under 14 words, present tense, one line, what's actually being discussed

Rules:
- Output ONLY the JSON object, nothing else
- No markdown fences, no preamble, no commentary
- Skip filler ("Hello", "Hi", "thanks") \u2014 focus on what the user is trying to do
- If the conversation is generic small talk, set title to "Conversation"`;

type SummarizeBody = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

export async function POST(request: Request) {
  // Accept both desktop Bearer auth and web cookie session
  let email: string | null = null;
  try {
    email = await getDesktopUserEmailFromRequest(request);
  } catch {
    email = null;
  }
  if (!email) {
    const session = await auth();
    email = session?.user?.email ?? null;
  }
  if (!email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SummarizeBody;
  try {
    body = (await request.json()) as SummarizeBody;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 });
  }

  // Always Haiku for summaries \u2014 fast + cheap, no need for the
  // user's tier resolution.
  const plan = await getPlanForEmail(email);
  const descriptor = descriptorForTier(resolveTier(plan, "fast"));

  // Compose a clean transcript. Cap at ~4000 chars per message so we
  // don't blow context on long generated artifacts.
  const transcript = body.messages
    .slice(-30) // last 30 turns is plenty for a title
    .map((m) => {
      const trimmed = m.content.length > 4000 ? m.content.slice(0, 4000) + "\u2026" : m.content;
      return `${m.role === "user" ? "User" : "Assistant"}: ${trimmed}`;
    })
    .join("\n\n");

  const startedAt = Date.now();
  let title = "Conversation";
  let description = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const response = await client.messages.create({
      model: descriptor.model,
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Transcript:\n\n${transcript}\n\nReturn the JSON.`,
        },
      ],
    });
    inputTokens = response.usage?.input_tokens ?? 0;
    outputTokens = response.usage?.output_tokens ?? 0;

    const block = response.content.find((c) => c.type === "text");
    if (block && block.type === "text") {
      const raw = block.text.trim();
      // Strip code fences if the model insists on adding them
      const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      try {
        const parsed = JSON.parse(cleaned) as {
          title?: string;
          description?: string;
        };
        if (parsed.title && typeof parsed.title === "string") {
          title = parsed.title.trim().slice(0, 80);
        }
        if (parsed.description && typeof parsed.description === "string") {
          description = parsed.description.trim().slice(0, 160);
        }
      } catch {
        // Fall back to extracting the first line as the title
        const firstLine = raw.split("\n")[0].trim();
        if (firstLine && firstLine.length < 80) title = firstLine;
      }
    }
  } catch (err) {
    console.error("summarize-thread failed:", err);
    return NextResponse.json(
      { error: "Could not summarize" },
      { status: 500 },
    );
  }

  // Record usage so summarization counts against the budget honestly
  void recordUsage({
    email,
    kind: "summary",
    model: descriptor.model,
    surface: request.headers.get("x-sansxel-surface") === "desktop" ? "desktop" : "web",
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    duration_ms: Date.now() - startedAt,
  });

  return NextResponse.json({ title, description });
}
