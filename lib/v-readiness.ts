// Decision readiness — a PURE derivation over an evaluation's already-computed
// Intelligence (margin, confidence, signal, filter rate) plus completion state and
// audience fit. It answers "is this decision ready to act on?", not just "what won".
// Invents no statistics; never overstates certainty. Shared by the report UI and the
// Decision Package so they always agree.

import type { Intelligence } from "./v-intelligence";

export type ReadinessLabel =
  | "Strong recommendation"
  | "Ready to decide"
  | "Directional signal"
  | "Needs more judgments"
  | "Too close to call"
  | "Noisy signal"
  | "Audience mismatch"
  | "Collecting judgments";
export type ReadinessTone = "good" | "warn" | "bad" | "neutral";

export type ReadinessSignals = {
  validJudgments: number;
  target: number | null;
  targetProgress: number | null; // % of target, capped at 100
  marginPts: number | null;
  signalQuality: string;
  audienceFit: string | null;
  filterRate: number;
};

export type DecisionReadiness = {
  label: ReadinessLabel;
  reason: string;
  nextStep: string;
  tone: ReadinessTone;
  signals: ReadinessSignals;
};

// Thresholds (kept honest + explicit):
const MIN_VALID = 15;            // below this, the sample is too small to decide
const TARGET_FLOOR = 0.3;        // < 30% of target → needs more judgments
const NOISY_FILTER_RATE = 25;    // ≥ this % filtered → result may be unreliable
const WEAK_FITS = new Set(["Weak fit", "Limited fit"]); // low audience match

export function decisionReadiness(opts: {
  complete: boolean;
  intel: Intelligence;
  valid: number;
  target?: number | null;
  audienceFit?: string | null;
  screeningEnabled?: boolean;
}): DecisionReadiness {
  const { complete, intel } = opts;
  const valid = opts.valid;
  const target = opts.target && opts.target > 0 ? opts.target : null;
  const targetProgress = target ? Math.min(100, Math.round((valid / target) * 100)) : null;
  const belowTargetFloor = !!(target && valid < target * TARGET_FLOOR);
  const audienceFit = opts.screeningEnabled ? (opts.audienceFit ?? null) : null;
  const L = intel.recommendedOption ?? "the leader";
  const signals: ReadinessSignals = { validJudgments: valid, target, targetProgress, marginPts: intel.marginPts, signalQuality: intel.signalLabel, audienceFit, filterRate: intel.filteredRate };
  const make = (label: ReadinessLabel, reason: string, nextStep: string, tone: ReadinessTone): DecisionReadiness => ({ label, reason, nextStep, tone, signals });

  // ── In progress — never claim a final decision until the evaluation completes ──
  if (!complete) {
    if (valid === 0) return make("Collecting judgments", "No qualified judgments yet — the evaluation just started.", "Share or embed the evaluation to start collecting qualified signal.", "neutral");
    if (valid < MIN_VALID || belowTargetFloor) return make("Needs more judgments", `Still early${target ? ` — ${valid} of ${target} collected (${targetProgress}%)` : ` — ${valid} so far`}. Readiness firms up as more qualified signal arrives.`, "Keep collecting before you treat the lead as a decision.", "warn");
    if (intel.inconclusive) return make("Too close to call", "The top options are close while collection is still in progress.", "Keep collecting — the gap may still open up.", "warn");
    return make("Directional signal", `Option ${L} is leading so far${target ? ` at ${targetProgress}% of target` : ""}, but collection is still in progress.`, "Keep collecting to confirm before you ship.", "neutral");
  }

  // ── Complete — data quality first, then audience, then decisiveness/sufficiency, then strength ──
  if (valid > 0 && intel.filteredRate >= NOISY_FILTER_RATE) return make("Noisy signal", `${intel.filteredRate}% of responses were filtered for quality, so the result may be unreliable.`, "Review source quality and collect cleaner signal before acting on it.", "bad");
  if (audienceFit && WEAK_FITS.has(audienceFit)) return make("Audience mismatch", "A low share of respondents matched your intended audience, so the result may not reflect the right people.", "Narrow the audience or tighten screening, then rerun.", "warn");
  if (intel.inconclusive) return make("Too close to call", "No option leads by a clear margin — the result is a near-tie.", "Treat it as directional. Collect more signal, or retest the top two options.", "warn");
  if (intel.signalLabel !== "Clean signal" || belowTargetFloor) return make("Needs more judgments", `Only ${valid} valid judgment${valid === 1 ? "" : "s"}${target ? ` of ${target}` : ""} — not enough to decide confidently.`, "Collect more qualified judgments before making the final call.", "warn");
  if (intel.confidenceLabel === "Strong") return make("Strong recommendation", `Option ${L} leads by ${intel.marginPts} points with clean signal — a confident, clear result.`, `Ship Option ${L}, or use it as the client-approved direction.`, "good");
  if (intel.confidenceLabel === "Moderate") return make("Ready to decide", `Option ${L} leads by a meaningful margin with clean signal.`, `Go with Option ${L}. A short confirmation round can firm it up before a big spend.`, "good");
  return make("Directional signal", `Option ${L} leads, but the margin is narrow — treat it as directional, not definitive.`, "Collect more judgments, or retest the top two options, before committing budget.", "neutral");
}

// "How to read this report" glossary — concise, client-friendly, premium.
export const REPORT_GLOSSARY: { term: string; meaning: string }[] = [
  { term: "Recommendation", meaning: "The option Vraelis suggests, based on qualified human signal — a strong starting point, not a guarantee." },
  { term: "Confidence", meaning: "How strong the decision signal is, given the margin and sample size. Directional, not statistical certainty." },
  { term: "Margin", meaning: "How far the leading option is ahead of the runner-up, in percentage points." },
  { term: "Signal quality", meaning: "Whether responses look reliable after low-quality, too-fast, and duplicate responses are filtered out." },
  { term: "Audience fit", meaning: "Whether respondents matched your intended audience (shown when screening is on)." },
  { term: "Decision readiness", meaning: "Whether the result is strong enough to act on now, or needs more signal first." },
];
