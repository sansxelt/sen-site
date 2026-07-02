// lib/v-themes.ts
// Workstream D — report themes. SUMMARIZATION ONLY: turn the free-text reasons on
// valid judgments into 3-5 themes (a short label, a one-line read, and 1-3 VERBATIM
// quotes), attributed per option. The LLM never scores, ranks, judges, or changes
// the recommendation or any number; that stays 100% from the stats engine.
//
// Honesty is enforced in CODE, not by trusting the model:
//   1. Any reason that trips the PII scan is stripped BEFORE it is ever sent.
//   2. Every returned quote is kept only if it is a verbatim substring of an actual
//      reason; a theme left with no surviving quote is dropped (fewer themes, never
//      invented ones).
// Fail-soft everywhere: no key / too few reasons / a failed call all return null so
// the report renders fine with no themes section. Model is VRAELIS_LLM_MODEL
// (default claude-haiku-4-5); key is VRAELIS_LLM_API_KEY or ANTHROPIC_API_KEY.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { scanForPii } from "./v-content-policy";

export type ReportTheme = { label: string; read: string; option: string | null; quotes: string[] };

const MIN_REASONS = 5; // below this there isn't enough to summarize honestly
const MODEL = process.env.VRAELIS_LLM_MODEL || "claude-haiku-4-5";
const API_KEY = process.env.VRAELIS_LLM_API_KEY || process.env.ANTHROPIC_API_KEY;

const ThemeSchema = z.object({
  themes: z.array(
    z.object({
      label: z.string(),   // short theme label
      read: z.string(),    // one plain sentence
      option: z.string(),  // option letter this is about, or "" if cross-cutting
      quotes: z.array(z.string()), // 1-3 quotes copied verbatim from the reasons
    }),
  ),
});

// Forgiving-but-honest verbatim match (case + whitespace insensitive), so a quote
// counts only if its words truly appear in a real reason.
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export async function extractThemes(input: {
  title: string;
  category: string;
  options: { letter: string; isWinner: boolean }[];
  comments: { letter: string; reason: string }[];
}): Promise<ReportTheme[] | null> {
  if (!API_KEY) return null;

  // Strip any reason that looks like it contains personal data BEFORE sending.
  const clean = input.comments
    .map((c) => ({ letter: c.letter, reason: (c.reason || "").trim() }))
    .filter((c) => c.reason.length > 0 && scanForPii(c.reason).length === 0);
  if (clean.length < MIN_REASONS) return null;

  const haystack = clean.map((c) => norm(c.reason));
  const byOption = new Map<string, string[]>();
  for (const c of clean) { const a = byOption.get(c.letter) ?? []; a.push(c.reason); byOption.set(c.letter, a); }
  const optLine = input.options.map((o) => `Option ${o.letter}${o.isWinner ? " [recommended]" : ""}`).join(", ");
  const reasonsBlock = [...byOption.entries()]
    .map(([letter, rs]) => `Option ${letter}:\n${rs.map((r) => `- ${r}`).join("\n")}`)
    .join("\n\n");

  const PROMPT =
    `You are summarizing WHY real people judged an evaluation, for the team that ran it. This is summarization only: you do not score, rank, judge, or recommend anything. The recommendation is already decided by other means and nothing you write can change it.\n\n` +
    `Evaluation: "${input.title}" (category: ${input.category}). Options: ${optLine}.\n\n` +
    `Evaluators' own written reasons, grouped by option:\n${reasonsBlock}\n\n` +
    `Extract 3 to 5 themes across these reasons. For each theme give:\n` +
    `- label: a short phrase (2 to 5 words)\n` +
    `- read: one plain sentence describing the theme\n` +
    `- option: the single option letter the theme is mostly about (e.g. "B"), or "" if it spans options\n` +
    `- quotes: 1 to 3 short quotes copied WORD FOR WORD from the reasons above. Do not paraphrase, do not invent, copy exact text. Pick the most representative.\n\n` +
    `Rules: only report a theme that is clearly supported by the reasons. If you can only find 3 solid themes, return 3, not 5. Never invent a quote or a theme. Write plainly and do not use em dashes.`;

  let raw: z.infer<typeof ThemeSchema> | null = null;
  try {
    const client = new Anthropic({ apiKey: API_KEY, timeout: 40_000, maxRetries: 1 });
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: PROMPT }],
      output_config: { format: zodOutputFormat(ThemeSchema) },
    });
    raw = res.parsed_output ?? null;
  } catch (e) {
    console.error("extractThemes failed:", e);
    return null; // transient failure: do not cache, retry on a later view
  }
  if (!raw) return null;

  // ── Verbatim enforcement in code: a quote survives only if it is really a
  // substring of an actual reason; a theme with no surviving quote is dropped. ──
  const letters = new Set(input.options.map((o) => o.letter));
  const out: ReportTheme[] = [];
  for (const t of raw.themes.slice(0, 5)) {
    const quotes = (t.quotes || [])
      .map((q) => (q || "").trim())
      .filter((q) => q.length > 0 && haystack.some((h) => h.includes(norm(q))))
      .slice(0, 3);
    if (quotes.length === 0) continue; // no verbatim quote -> drop the theme
    const label = (t.label || "").trim().slice(0, 60);
    const read = (t.read || "").trim().slice(0, 200);
    if (!label || !read) continue;
    const option = t.option && letters.has(t.option.trim()) ? t.option.trim() : null;
    out.push({ label, read, option, quotes });
  }
  return out.slice(0, 5); // [] is a valid "no grounded themes" result and gets cached
}
