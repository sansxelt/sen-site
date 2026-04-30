// v0.2.0 phase G — per-model pricing snapshot for the duel surface.
//
// Cost shown next to each duel column ("GPT: $0.012", "Claude: $0.009")
// is computed client-side from token counts the duel route streams
// down. We don't bill from this file; it's purely informational so
// the user sees what the comparison cost.
//
// Numbers are USD per 1M tokens; mirror Anthropic + OpenAI public
// pricing pages. If the underlying model ids in lib/ai-models.ts
// change, update the matching row here.
//
// Last verified: 2026-04-29. Sources:
//   - Anthropic: https://www.anthropic.com/pricing
//   - OpenAI:    https://openai.com/api/pricing
// If you ship a deploy 90+ days from the date above, sanity-check
// these against the live pricing pages — providers reprice silently
// and a wildly wrong cost chip is worse than no chip at all.

type Pricing = {
  // USD per 1,000,000 input tokens.
  input_per_mtok: number;
  // USD per 1,000,000 output tokens.
  output_per_mtok: number;
};

const PRICING: Record<string, Pricing> = {
  // Anthropic Claude models. Sonnet family ($3 / $15) hasn't moved
  // since 3.5; Haiku 4.5 is the cheap reasoning tier; Opus 4.x sits
  // at the top end.
  "claude-sonnet-4-6": { input_per_mtok: 3, output_per_mtok: 15 },
  "claude-sonnet-4-5": { input_per_mtok: 3, output_per_mtok: 15 },
  "claude-haiku-4-5-20251001": { input_per_mtok: 1, output_per_mtok: 5 },
  "claude-opus-4-7": { input_per_mtok: 15, output_per_mtok: 75 },
  // OpenAI models. gpt-5 standard tier sits below gpt-4o on input
  // (per OpenAI's published pricing) but matches it on output.
  "gpt-4o":      { input_per_mtok: 2.5,  output_per_mtok: 10 },
  "gpt-4o-mini": { input_per_mtok: 0.15, output_per_mtok: 0.6 },
  "gpt-5":       { input_per_mtok: 1.25, output_per_mtok: 10 },
};

// Returns USD cost for a given model + token usage. Unknown models
// return 0 so the UI still renders cleanly (we'd rather show "$0.00"
// than break the chip when a new model ships before this table does).
export function priceFor(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const row = PRICING[model];
  if (!row) return 0;
  const input = (inputTokens / 1_000_000) * row.input_per_mtok;
  const output = (outputTokens / 1_000_000) * row.output_per_mtok;
  return input + output;
}

// Formats a USD cost for the in-chat chip. Uses 4-decimal precision
// for sub-cent costs ("$0.0042") and 2-decimal otherwise ("$0.42")
// so users see something meaningful at typical chat-turn sizes.
export function formatCost(usd: number): string {
  if (usd <= 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
