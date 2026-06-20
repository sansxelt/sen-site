// Vraelis Rank — report intelligence. Turns raw votes + comments into the
// analysis buyers actually pay for: why the winner won, what's weak, what to fix.
// Uses the Anthropic SDK + structured output (same pattern as the repo's other
// AI calls). Generated lazily on first report view, cached on the report.

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const client = new Anthropic(); // reads ANTHROPIC_API_KEY

const Analysis = z.object({
  summary: z.string(),                  // 1–2 sentence verdict
  why_winner: z.string(),               // why the winning option won
  weaknesses: z.array(z.string()),      // what hurt the losing options
  suggestions: z.array(z.string()),     // concrete edits to push the winner further
  confidence: z.enum(["low", "medium", "high"]),
});

export type ReportAnalysis = z.infer<typeof Analysis>;

export async function analyzeReport(input: {
  title: string;
  category: string;
  options: { letter: string; pct: number; votes: number; isWinner: boolean }[];
  comments: { letter: string; reason: string }[];
}): Promise<ReportAnalysis | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  const totalVotes = input.options.reduce((s, o) => s + o.votes, 0);
  const PROMPT =
    `You are analyzing the results of a creative A/B test for the creator who ran it. Be specific, concrete, and useful — reference the actual voter comments, no fluff or filler.\n\n` +
    `Test: "${input.title}" (category: ${input.category}) · ${totalVotes} human votes\n` +
    `Results: ${input.options.map((o) => `Option ${o.letter} = ${o.pct}% (${o.votes})${o.isWinner ? " [WINNER]" : ""}`).join(", ")}\n\n` +
    `Voter comments:\n${input.comments.map((c) => `- [Option ${c.letter}] ${c.reason}`).join("\n") || "(no written comments — base the analysis on the vote distribution and the category)"}\n\n` +
    `Write: a one-line summary verdict; why the winner won (cite themes from comments); the weaknesses that held back the losing options; and concrete edits to make the winner even stronger. Set confidence honestly based on vote count and how decisive the margin is.`;

  try {
    const res = await client.messages.parse({
      // claude-sonnet-4-6 for analysis quality (the paid differentiator); swap to
      // claude-haiku-4-5 to cut COGS at scale, or claude-opus-4-8 for max quality.
      model: "claude-sonnet-4-6",
      max_tokens: 1400,
      messages: [{ role: "user", content: PROMPT }],
      output_config: { format: zodOutputFormat(Analysis) },
    });
    return res.parsed_output ?? null;
  } catch (e) {
    console.error("analyzeReport failed:", e);
    return null;
  }
}
