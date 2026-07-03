// lib/v-gate.ts
// Quality-gate scoring for the developer API. Turns an optional `threshold` into a
// pass/fail verdict against a completed EvalResult, so a team can wire /api/v1/check as a
// CI/CD deploy gate ("fail the build unless the output clears the bar"). Pure and
// side-effect free (no money, no I/O), so the gate logic is independently testable and
// carries none of the billing risk.
//
// The gate judges ONE version: the recommended pick if the check produced one, else the
// highest-overall candidate. For the common CI case (one output per item) that is simply
// that output; for a multi-version compare it is the best available version.

import type { EvalResult, CandidateEval } from "./v-evaluator";

export type ThresholdSpec = { overall?: number; criteria?: Record<string, number> };

export type GateCriterion = { criterion: string; label: string; score: number | null; min: number; passed: boolean };
export type Gate = {
  passed: boolean;
  evaluated: { index: number; label: string } | null;
  overall: { score: number; min: number; passed: boolean } | null;
  criteria: GateCriterion[];
  failures: number;
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const MAX_CRITERIA_KEYS = 12; // rubrics carry <= 4; 12 is generous slack, bounds abuse

// Parse an untrusted `threshold` field. Accepts either:
//   - a number                          -> { overall }
//   - { overall?: number, criteria?: { <criterionKey>: number } }
// Returns null when absent, the sentinel "invalid" on a malformed shape (the caller turns
// that into a 400), or a normalized spec with every bound clamped to 0..100.
export function parseThreshold(raw: unknown): ThresholdSpec | null | "invalid" {
  if (raw == null) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return "invalid";
    return { overall: clamp(raw) };
  }
  if (typeof raw !== "object") return "invalid";
  const o = raw as { overall?: unknown; criteria?: unknown };
  const spec: ThresholdSpec = {};

  if (o.overall != null) {
    if (typeof o.overall !== "number" || !Number.isFinite(o.overall)) return "invalid";
    spec.overall = clamp(o.overall);
  }

  if (o.criteria != null) {
    if (typeof o.criteria !== "object" || Array.isArray(o.criteria)) return "invalid";
    const out: Record<string, number> = {};
    let n = 0;
    for (const [k, v] of Object.entries(o.criteria as Record<string, unknown>)) {
      // Validate BEFORE the cap so a malformed value anywhere is rejected, not silently
      // dropped once the key cap is hit (fail-closed on bad input).
      if (typeof v !== "number" || !Number.isFinite(v)) return "invalid";
      if (n >= MAX_CRITERIA_KEYS) break;
      const key = k.trim().toLowerCase();
      if (!key) continue;
      out[key] = clamp(v);
      n++;
    }
    if (Object.keys(out).length) spec.criteria = out;
  }

  // A threshold with no bound at all is a caller mistake, not a silent no-op gate.
  if (spec.overall == null && !spec.criteria) return "invalid";
  return spec;
}

// The candidate the gate judges: the recommended pick if present, else the highest
// overall, else the sole candidate.
function gatedCandidate(result: EvalResult): CandidateEval | null {
  if (!result.candidates.length) return null;
  if (result.recommendedIndex != null) {
    const rec = result.candidates.find((c) => c.index === result.recommendedIndex);
    if (rec) return rec;
  }
  return [...result.candidates].sort((a, b) => b.overall - a.overall || a.index - b.index)[0];
}

// Evaluate the gate. FAIL-CLOSED: a criterion bound that can't be satisfied (e.g. a
// criterion key not in this output type's rubric -> score null) counts as a failure, so
// the gate never silently ignores a bar the caller asked it to enforce. The full per-bar
// breakdown is returned so a CI step can log exactly why it blocked.
export function evaluateGate(result: EvalResult, spec: ThresholdSpec): Gate {
  const c = gatedCandidate(result);
  if (!c) {
    return { passed: false, evaluated: null, overall: spec.overall != null ? { score: 0, min: spec.overall, passed: false } : null, criteria: [], failures: 1 };
  }

  const overall = spec.overall != null ? { score: c.overall, min: spec.overall, passed: c.overall >= spec.overall } : null;
  const criteria: GateCriterion[] = Object.entries(spec.criteria ?? {}).map(([key, min]) => {
    const sc = c.scores.find((s) => s.criterion === key);
    const score = sc ? sc.score : null;
    return { criterion: key, label: sc?.label ?? key, score, min, passed: score != null && score >= min };
  });

  const failures = (overall && !overall.passed ? 1 : 0) + criteria.filter((x) => !x.passed).length;
  return { passed: failures === 0, evaluated: { index: c.index, label: c.label }, overall, criteria, failures };
}
