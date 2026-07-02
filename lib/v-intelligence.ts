// Evaluation Intelligence — a PURE derivation over an existing report's results.
// It invents no statistics and hallucinates no reasons. The headline confidence is
// a real POSTERIOR probability (Beta-binomial for 2 options, Dirichlet Monte Carlo
// for k options) that the recommended option is genuinely the most-preferred, and
// the Strong/Moderate/Tentative label is DERIVED from that probability so it can
// never overstate it. Reputation weighting can shift which option is recommended,
// but precision is driven by the Kish effective sample size (n_eff ≤ raw N), so
// weighting can never inflate confidence. Used by both the report UI and the JSON
// export, so they always agree.

import { OPTION_LETTERS } from "./v-db";
import {
  betaBinom, dirichletTopProbs, observedAgreement, recommendedSampleSize,
  confidenceLabelFromProb, wilsonLowerBound, type ConfidenceLabel,
} from "./v-stats";

export { wilsonLowerBound } from "./v-stats";
export type { ConfidenceLabel } from "./v-stats";

// `weighted` is the reputation-weighted count (present on new reports); falls back
// to raw `votes` for older reports and unweighted callers.
type RankedRow = { id: string; position: number; label: string | null; votes: number; pct: number; weighted?: number };
export type IntelInput = {
  total?: number;
  filtered?: number;
  effective_n?: number;              // Kish effective sample size (<= total)
  winner_option_id?: string | null;
  ranked?: RankedRow[];
  comments?: { option_id: string; reason: string }[];
};

export type SignalLabel = "Clean signal" | "Limited signal" | "Needs more judgments";

// Convergence — the secondary "signal engine" measure. Not "who got the most
// votes", but whether the leading option's share is distinguishable from chance
// (1/optionCount) given the sample, via the Wilson 95% lower bound. Honest
// statistics on judgments already collected; never a claim any judge is "correct".
export type ConvergenceState = "converged" | "leaning" | "split" | "insufficient";
export type Convergence = {
  state: ConvergenceState;
  winnerSharePct: number | null;
  lowerBoundPct: number | null;
  chancePct: number | null;
  clearsChanceByPts: number | null;
  label: string;
};

const CONVERGE_MIN_N = 15;
const CONVERGE_CLEAR_PTS = 15;

export function convergence(winnerVotes: number, total: number, optionCount: number): Convergence {
  if (total < 1 || optionCount < 2) {
    return { state: "insufficient", winnerSharePct: null, lowerBoundPct: null, chancePct: null, clearsChanceByPts: null, label: "Not enough signal yet to tell whether the result converged." };
  }
  const chance = 1 / optionCount;
  const lb = wilsonLowerBound(winnerVotes, total);
  const clearPts = Math.round((lb - chance) * 100);
  const winnerSharePct = Math.round((winnerVotes / total) * 100);
  const chancePct = Math.round(chance * 100);
  const lowerBoundPct = Math.round(lb * 100);

  let state: ConvergenceState;
  let label: string;
  if (total < CONVERGE_MIN_N) {
    state = "insufficient";
    label = `Too few responses (${total}) to tell converged from split. Collect more for a firm read.`;
  } else if (lb <= chance) {
    state = "split";
    label = `The signal is split: the lead can't be told apart from an even distribution at this sample. Treat it as too close to call.`;
  } else if (clearPts >= CONVERGE_CLEAR_PTS) {
    state = "converged";
    label = `The signal converged: attentive responses clustered on one option well beyond an even split.`;
  } else {
    state = "leaning";
    label = `The signal leans one way but hasn't fully converged. A confirmation round would firm it up.`;
  }
  return { state, winnerSharePct, lowerBoundPct, chancePct, clearsChanceByPts: clearPts, label };
}

export type Intelligence = {
  inconclusive: boolean;
  recommendedOption: string | null;
  recommendedLabel: string | null;
  totalValid: number;
  filtered: number;
  filteredRate: number;
  marginPts: number | null;            // raw lead over runner-up, in points (display)
  confidenceLabel: ConfidenceLabel;    // DERIVED from winProbability
  signalLabel: SignalLabel;
  convergence: Convergence;
  decisionSummary: string;
  marginText: string;
  signalText: string;
  action: string;
  // ── real statistics ──
  winProbability: number | null;       // posterior P(recommended option is truly #1), 0-1
  winProbabilityPct: number | null;
  winnerShareCI: [number, number] | null;   // 95% credible interval on winner's share (pct)
  marginCI: [number, number] | null;        // 95% CI on winner's margin over best rival (pct)
  effectiveN: number;                  // Kish effective sample size (<= totalValid)
  consensus: number;                   // P(two random raters agree) = sum of squared shares, 0-1
  consensusPct: number;
  recommendedAdditional: number;       // more judgments to reach a confident call (fixed-N power)
};

const DISCLAIMER = "Directional, based on valid judgments collected. Not a guarantee of sales, clicks, conversions, or revenue.";
export function intelligenceDisclaimer(): string { return DISCLAIMER; }

export function evaluationIntelligence(r: IntelInput, votesTarget = 0): Intelligence {
  const total = r.total ?? 0;
  const filtered = r.filtered ?? 0;
  const denom = total + filtered;
  const filteredRate = denom ? Math.round((filtered / denom) * 100) : 0;

  // Rank by weighted count when present (weighting can shift the recommendation);
  // fall back to raw votes. Raw votes/pct are kept for display.
  const rows = [...(r.ranked ?? [])];
  const wv = (row: RankedRow) => (row.weighted != null ? row.weighted : row.votes);
  const ranked = rows.sort((a, b) => wv(b) - wv(a) || b.votes - a.votes);
  const top = ranked[0];
  const runner = ranked[1];
  const letter = (pos: number) => OPTION_LETTERS[pos] ?? "?";
  const hasWinner = !!r.winner_option_id && !!top && (!runner || wv(top) > wv(runner));

  // Effective sample size (Kish, <= total). Falls back to raw total for old reports.
  const effN = r.effective_n != null ? r.effective_n : total;
  const effRounded = Math.round(effN);
  const wsum = ranked.reduce((s, row) => s + wv(row), 0);
  const shareOf = (row?: RankedRow) => (row && wsum > 0 ? wv(row) / wsum : 0);
  const consensus = wsum > 0 ? observedAgreement(ranked.map((row) => wv(row) / wsum)) : 0;

  // Raw margin (display): lead over runner-up in points, from raw votes.
  const marginPts = !hasWinner ? null
    : total > 0 ? Math.max(0, Math.round(((top!.votes - (runner?.votes ?? 0)) / total) * 100))
    : (top!.pct ?? 0);

  // ── Real posterior confidence ──
  let winProbability: number | null = null;
  let winnerShareCI: [number, number] | null = null;
  let marginCI: [number, number] | null = null;
  let recommendedAdditional = 0;
  if (hasWinner && total >= 1 && effN >= 1) {
    const k = ranked.length;
    const pWin = shareOf(top);
    if (k <= 2) {
      const x = pWin * effN;                       // effective winner "successes"
      const bb = betaBinom(x, effN);
      winProbability = bb.probAboveHalf;           // P(winner's true share > 0.5)
      winnerShareCI = [Math.round(bb.lo * 100), Math.round(bb.hi * 100)];
      marginCI = [Math.round((2 * bb.lo - 1) * 100), Math.round((2 * bb.hi - 1) * 100)];
    } else {
      const seed = ranked.reduce((s, row, i) => (Math.imul(s, 31) + ((row.votes | 0) * (i + 3))) >>> 0, (total + k) >>> 0);
      const eff = ranked.map((row) => shareOf(row) * effN);
      const dir = dirichletTopProbs(eff, { draws: 10000, seed });
      winProbability = dir.pWinnerIsTop;           // P(winner has the max true share)
      winnerShareCI = [Math.round(dir.winnerShareCI[0] * 100), Math.round(dir.winnerShareCI[1] * 100)];
      marginCI = [Math.round(dir.topTwoMarginCI[0] * 100), Math.round(dir.topTwoMarginCI[1] * 100)];
    }
    const need = recommendedSampleSize(pWin, 0.10);
    recommendedAdditional = Math.max(0, Math.ceil(need - effN));
  }
  // Cap the displayed percentage at 99: no human-judged result is ever a 100%
  // certainty, and showing "100%" would read as a guarantee. The raw
  // winProbability float stays exact for the Decision Package.
  const winProbabilityPct = winProbability != null ? Math.min(99, Math.round(winProbability * 100)) : null;
  const confidenceLabel = confidenceLabelFromProb(winProbability);

  // Signal quality — from the EFFECTIVE sample size and how much was filtered.
  let signalLabel: SignalLabel;
  let signalText: string;
  if (total === 0) {
    signalLabel = "Needs more judgments"; signalText = "No valid judgments have been collected yet.";
  } else if (effN < 15) {
    signalLabel = "Limited signal";
    signalText = `Effective sample of ${effRounded} judgment${effRounded === 1 ? "" : "s"}${effRounded < total ? ` (from ${total} valid, reputation-weighted)` : ""}${votesTarget ? ` of ${votesTarget} targeted` : ""}. Collect more for a firmer read.`;
  } else {
    signalLabel = "Clean signal";
    signalText = `${total} valid judgments${effRounded < total ? ` (effective ${effRounded} after weighting)` : ""}, ${filteredRate}% filtered for quality.`;
  }

  const optionCount = ranked.length;
  const conv = convergence(top?.votes ?? 0, total, optionCount);

  let decisionSummary: string;
  let marginText: string;
  let action: string;
  const moreText = recommendedAdditional > 0 ? ` about ${recommendedAdditional} more judgments` : " a short confirmation round";

  if (total === 0) {
    decisionSummary = "No clear recommendation yet. Collect valid judgments to generate a result.";
    marginText = "No judgments collected yet.";
    action = "Collect valid judgments. There is no recommendation yet.";
  } else if (!hasWinner) {
    decisionSummary = "No clear recommendation yet. The top options are too close to call.";
    marginText = "No option led by a clear margin.";
    action = "Collect more judgments to break the tie, or iterate the closest options.";
  } else {
    const L = letter(top!.position);
    decisionSummary = `Option ${L} is the recommended output: a ${winProbabilityPct}% probability it's the true preference, from ${effRounded} effective judgment${effRounded === 1 ? "" : "s"}.`;
    if ((marginPts ?? 0) >= 20) marginText = `Option ${L} led by ${marginPts} percentage points across ${total} valid judgments, a clear margin.`;
    else if ((marginPts ?? 0) >= 10) marginText = `Option ${L} led by ${marginPts} percentage points across ${total} valid judgments.`;
    else marginText = `Option ${L} led by only ${marginPts} percentage point${marginPts === 1 ? "" : "s"}. The result is close: treat it as directional, not definitive.`;

    if (effN < 15) action = `Option ${L} is ahead, but the effective sample is small. Collect${moreText} before committing budget.`;
    else if (confidenceLabel === "Strong") action = `Ship Option ${L}.`;
    else if (confidenceLabel === "Moderate") action = `Option ${L} is ahead (${winProbabilityPct}% probability it's the true preference). A confirmation round of${moreText} firms it up before a big spend.`;
    else action = `Option ${L} leads narrowly (${winProbabilityPct}% probability it's the true preference). Collect${moreText}, or retest the top two, before deciding.`;
  }

  return {
    inconclusive: !hasWinner,
    recommendedOption: hasWinner ? letter(top!.position) : null,
    recommendedLabel: hasWinner ? (top!.label ?? null) : null,
    totalValid: total, filtered, filteredRate,
    marginPts, confidenceLabel, signalLabel, convergence: conv,
    decisionSummary, marginText, signalText, action,
    winProbability, winProbabilityPct, winnerShareCI, marginCI,
    effectiveN: effRounded, consensus, consensusPct: Math.round(consensus * 100), recommendedAdditional,
  };
}

// Evaluation health — a single trustworthiness state derived from the same real
// metrics. Order matters: data-quality problems first, then decisiveness, then
// sufficiency, then readiness. Active evaluations are "Collecting".
export type HealthState = "Collecting" | "Ready to decide" | "Needs more judgments" | "Noisy signal" | "Too close to call" | "Low-quality traffic";

export function evaluationHealth(status: string, intel: Intelligence): HealthState {
  if (status !== "complete") return "Collecting";
  if (intel.totalValid > 0 && intel.filteredRate >= 40) return "Low-quality traffic";
  if (intel.totalValid > 0 && intel.filteredRate >= 25) return "Noisy signal";
  if (intel.inconclusive) return "Too close to call";
  if (intel.convergence.state === "split") return "Too close to call";
  if (intel.signalLabel !== "Clean signal") return "Needs more judgments";
  if (intel.confidenceLabel === "Strong" || intel.confidenceLabel === "Moderate") return "Ready to decide";
  return "Needs more judgments";
}

export function healthTone(h: HealthState): "good" | "warn" | "bad" | "neutral" {
  if (h === "Ready to decide") return "good";
  if (h === "Low-quality traffic") return "bad";
  if (h === "Noisy signal" || h === "Too close to call" || h === "Needs more judgments") return "warn";
  return "neutral";
}
