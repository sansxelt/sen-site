// HOW ASK AI ANSWERS (founder 2026-10-10: Anthropic only, and no ongoing API cost by default).
//
//   "extract"   the default. No model and no key: the best-matching passages of the docs, quoted verbatim with
//               their section citations (_data/retrieve.ts extractAnswer). Nothing leaves the server.
//   "generate"  only when DOCS_ASSISTANT_LLM=1 AND ANTHROPIC_API_KEY is set: Claude writes the answer from the same
//               retrieved sections, and must cite them. If the call fails, the answer falls back to "extract".
//
// Server only (reads secrets' presence, never their values). The docs layout passes the mode to the panel so its
// labels and its one-line note match what the endpoint will do.

export type AssistantMode = "extract" | "generate";

export function assistantMode(): AssistantMode {
  return process.env.DOCS_ASSISTANT_LLM?.trim() === "1" && !!process.env.ANTHROPIC_API_KEY?.trim() ? "generate" : "extract";
}

/** The Anthropic model for generated answers. The privacy and subprocessors pages name Anthropic. */
export const ASSISTANT_MODEL = process.env.DOCS_ASSISTANT_MODEL?.trim() || "claude-sonnet-5-5";
