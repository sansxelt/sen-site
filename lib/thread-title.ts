// v0.1.16, AI-generated thread titles.
//
// Replaces the cheap "first user message snippet" heuristic with a
// proper one-line summary, ChatGPT/Claude-style. Fired after the
// first assistant turn lands. Uses the fast Haiku tier so it's
// cheap + nearly free latency-wise. Fails open, if generation
// errors, the existing snippet title stays.

import Anthropic from "@anthropic-ai/sdk";
import { listMessages, renameThread } from "./chat-history";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "missing" });

const TITLE_PROMPT = `You generate sidebar titles for chat conversations. Given the first exchange below, produce a SHORT title (3-7 words, no punctuation at the end, no quotes, no markdown). The title should describe what the user is actually working on or asking about, like a folder name a human would write. Skip filler words ("about", "regarding"). Capitalize like a heading.

Examples:
- User asks for stock data → "Live market check"
- User pastes code with a bug → "Debugging React state issue"
- User says hi → "Casual greeting"
- User asks how to make pasta → "Pasta cooking help"
- User drops an image of a UI → "UI design feedback"

Output ONLY the title text. Nothing else.`;

/**
 * Generates an AI title for a thread and saves it. Safe to fire-and-
 * forget. Skips when the thread doesn't have at least 1 user + 1
 * assistant turn yet (nothing useful to summarize).
 */
export async function generateAndSetThreadTitle(email: string, threadId: string): Promise<void> {
  if (!email || !threadId) return;
  try {
    const messages = await listMessages(email, threadId);
    const firstUser = messages.find((m) => m.role === "user");
    const firstAssistant = messages.find((m) => m.role === "assistant");
    if (!firstUser || !firstAssistant) return;

    // Cap inputs so a giant first message doesn't blow up the prompt.
    const userText = firstUser.content.slice(0, 600);
    const assistantText = firstAssistant.content.slice(0, 600);

    const result = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 40,
      system: TITLE_PROMPT,
      messages: [
        {
          role: "user",
          content: `User said:\n${userText}\n\nAI replied:\n${assistantText}\n\nTitle:`,
        },
      ],
    });

    const titleRaw =
      result.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("")
        .trim();

    // Strip stray quotes / trailing punctuation Anthropic sometimes
    // adds despite the system prompt asking otherwise.
    const cleaned = titleRaw
      .replace(/^["“'`]+|["”'`]+$/g, "")
      .replace(/[.!?,;:]+$/, "")
      .trim();

    if (!cleaned) return;
    // Hard cap so a runaway title doesn't break the sidebar.
    const final = cleaned.length > 60 ? cleaned.slice(0, 59) + "…" : cleaned;
    await renameThread(email, threadId, final);
  } catch (err) {
    console.warn("generateAndSetThreadTitle failed:", err);
  }
}
