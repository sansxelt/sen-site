// The PURE derivation of a guarantee's live status from its latest tagged run plus its plan_state. No DB, no
// clock. A guarantee never STORES a verdict; its status is computed on read from the same public-decision
// translator every other surface uses (public-decision.ts), so the vocabulary can never drift. The DB reads
// that fetch the latest run and the run history live in guarantees-db.ts; this file only decides the label.
import { toPublicDecision, type PublicDecision } from "./public-decision";

//   verified / failed / blocked   — the latest run's public decision (the claim held / did not / no verdict)
//   checking                      — a verification is in flight (latest run not terminal yet)
//   unproven                      — no run has ever tagged this guarantee (freshly approved, or never run)
//   plan_review_required          — the definition changed since approval; a human must re-approve the plan
//                                    before it can be verified again ("workflow changed since approval")
export type GuaranteeStatus = PublicDecision | "checking" | "unproven" | "plan_review_required";

export type LatestRunRef = { state: string; decision: string | null } | null;

// plan_state 'review_required' takes precedence: a drifted definition means the last run proved an OLD plan,
// so the actionable state is "re-approve", not the stale verdict. Otherwise delegate to toPublicDecision,
// mapping still-running to "checking" and no-run to "unproven".
export function guaranteeStatus(latest: LatestRunRef, planState: string): GuaranteeStatus {
  if (planState === "review_required") return "plan_review_required";
  if (!latest) return "unproven";
  const pub = toPublicDecision(latest.state, latest.decision);
  return pub === null ? "checking" : pub;
}

// The newest run in a newest-first history whose public decision is 'verified' — i.e. the last deployment on
// which this guarantee was actually proven. Null when it has never verified.
export function lastProvenRun<T extends { state: string; decision: string | null }>(historyNewestFirst: T[]): T | null {
  for (const r of historyNewestFirst) {
    if (toPublicDecision(r.state, r.decision) === "verified") return r;
  }
  return null;
}
