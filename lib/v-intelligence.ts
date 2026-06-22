// Evaluation Intelligence — a PURE derivation over an existing report's results.
// It invents no statistics and hallucinates no reasons: every output is computed
// from the counts, margins, and comments already collected. Used by both the
// report UI (owner + public) and the JSON export, so they always agree.

import { OPTION_LETTERS } from "./v-db";

type RankedRow = { id: string; position: number; label: string | null; votes: number; pct: number };
export type IntelInput = {
  total?: number;
  filtered?: number;
  winner_option_id?: string | null;
  ranked?: RankedRow[];
  comments?: { option_id: string; reason: string }[];
};

export type ConfidenceLabel = "Strong" | "Moderate" | "Tentative" | "None";
export type SignalLabel = "Clean signal" | "Limited signal" | "Needs more judgments";

export type Intelligence = {
  inconclusive: boolean;
  recommendedOption: string | null;   // letter, e.g. "B"
  recommendedLabel: string | null;
  totalValid: number;
  filtered: number;
  filteredRate: number;                // percent (0-100)
  marginPts: number | null;            // lead over runner-up, in percentage points
  confidenceLabel: ConfidenceLabel;    // directional only — never a statistical claim
  signalLabel: SignalLabel;
  decisionSummary: string;
  marginText: string;
  signalText: string;
  action: string;                      // what to ship / what to improve
};

const DISCLAIMER = "Directional, based on valid judgments collected. Not a guarantee of sales, clicks, conversions, or revenue.";

export function intelligenceDisclaimer(): string { return DISCLAIMER; }

export function evaluationIntelligence(r: IntelInput, votesTarget = 0): Intelligence {
  const total = r.total ?? 0;
  const filtered = r.filtered ?? 0;
  const denom = total + filtered;
  const filteredRate = denom ? Math.round((filtered / denom) * 100) : 0;
  const ranked = [...(r.ranked ?? [])].sort((a, b) => b.votes - a.votes);
  const top = ranked[0];
  const runner = ranked[1];
  const letter = (pos: number) => OPTION_LETTERS[pos] ?? "?";
  // A recommendation requires a flagged winner AND a real lead over the runner-up.
  const hasWinner = !!r.winner_option_id && !!top && (!runner || top.votes > runner.votes);
  const marginPts = !hasWinner ? null : runner ? Math.max(0, (top!.pct ?? 0) - (runner.pct ?? 0)) : (top!.pct ?? 0);

  // Signal quality — purely about sample size and how much was filtered.
  let signalLabel: SignalLabel;
  let signalText: string;
  if (total === 0) { signalLabel = "Needs more judgments"; signalText = "No valid judgments have been collected yet."; }
  else if (total < 15) { signalLabel = "Limited signal"; signalText = `Only ${total} valid judgment${total === 1 ? "" : "s"} so far${votesTarget ? ` of ${votesTarget} targeted` : ""}. Collect more for a firmer read.`; }
  else { signalLabel = "Clean signal"; signalText = `${total} valid judgments collected, ${filteredRate}% filtered for quality.`; }

  // Directional confidence — a label, never a statistical guarantee.
  let confidenceLabel: ConfidenceLabel = "None";
  if (hasWinner && marginPts != null) {
    if (marginPts >= 20 && total >= 30) confidenceLabel = "Strong";
    else if (marginPts >= 10 && total >= 15) confidenceLabel = "Moderate";
    else confidenceLabel = "Tentative";
  }

  let decisionSummary: string;
  let marginText: string;
  let action: string;

  if (total === 0) {
    decisionSummary = "No clear recommendation yet. Collect valid judgments to generate a result.";
    marginText = "No judgments collected yet.";
    action = "Collect valid judgments — there is no recommendation yet.";
  } else if (!hasWinner) {
    decisionSummary = "No clear recommendation yet. The top options are too close to call.";
    marginText = "No option led by a clear margin.";
    action = "Collect more judgments to break the tie, or iterate the closest options.";
  } else {
    const L = letter(top!.position);
    decisionSummary = `Option ${L} is the recommended output, preferred by ${top!.pct}% of valid judgments.`;
    if ((marginPts ?? 0) >= 20) marginText = `Option ${L} led by ${marginPts} percentage points across ${total} valid judgments — a clear margin.`;
    else if ((marginPts ?? 0) >= 10) marginText = `Option ${L} led by ${marginPts} percentage points across ${total} valid judgments.`;
    else marginText = `Option ${L} led by only ${marginPts} percentage point${marginPts === 1 ? "" : "s"}. The result is close — treat it as directional, not definitive.`;

    if (total < 15) action = `Option ${L} is ahead, but the sample is small. Collect more judgments before committing budget.`;
    else if (confidenceLabel === "Strong") action = `Ship Option ${L}.`;
    else if (confidenceLabel === "Moderate") action = `Option ${L} is ahead. A short confirmation round will firm it up before a big spend.`;
    else action = `Option ${L} leads narrowly. Collect more judgments, or iterate the runner-up, before deciding.`;
  }

  return {
    inconclusive: !hasWinner,
    recommendedOption: hasWinner ? letter(top!.position) : null,
    recommendedLabel: hasWinner ? (top!.label ?? null) : null,
    totalValid: total, filtered, filteredRate,
    marginPts, confidenceLabel, signalLabel,
    decisionSummary, marginText, signalText, action,
  };
}
