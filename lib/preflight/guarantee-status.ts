// The PURE derivation of a guarantee's live status from its tagged runs plus its plan_state. No DB, no clock.
// A guarantee never STORES a verdict; its status is computed on read from the same public-decision translator
// every other surface uses (public-decision.ts), so the vocabulary can never drift. The DB reads that fetch
// the runs live in guarantees-db.ts; this file only decides the label.
import { toPublicDecision, type PublicDecision } from "./public-decision";

// The states a guarantee can really be in, in the order they are checked.
//
//   plan_review_required  the definition changed since approval; a person must re-approve before any run
//                         can mean anything. Takes precedence over every verdict, because the last run
//                         proved an OLD plan and the actionable thing is to re-approve, not to read a stale
//                         result.
//   unproven              no run has ever proved this guarantee at its current approved meaning
//   checking              a verification is in flight
//   verified / failed / blocked   the latest QUALIFYING run's public decision
//   reverified            the latest run is verified AND repaired an earlier failure. Not a fourth verdict:
//                         it IS verified, and the extra word is the story of how it got there, which is the
//                         single most persuasive thing a guarantee can say.
//   repairing             the latest run failed and a repair is under way against it
export type GuaranteeStatus =
  | PublicDecision | "checking" | "unproven" | "plan_review_required" | "reverified" | "repairing";

export type LatestRunRef = { state: string; decision: string | null } | null;

/** A run considered as evidence for a guarantee. planHash is what the run PINNED at launch. */
export type GuaranteeRunEvidence = {
  state: string;
  decision: string | null;
  /** Set when this run repaired or re-verified an earlier one. */
  parentRunId?: string | null;
  /** The guarantee meaning this run actually executed (migration 23). Null on runs predating the binding. */
  planHash?: string | null;
};

/** Whether a run still proves the CURRENT definition.
 *
 *  approveGuaranteePlan overwrites approved_plan_hash in place, so a guarantee that has been re-approved has
 *  a different meaning than it did when older runs executed. Those runs stay in the history — they really
 *  happened and they really proved something — but they must not count toward the live verdict, or one
 *  re-approval would silently restate every past result as evidence for the new wording.
 *
 *  A run with NO pinned hash is a legacy run from before the binding existed. It is not evidence for the
 *  current meaning either, because nothing recorded what it proved. Unknown is not the same as matching. */
export function provesCurrentMeaning(run: GuaranteeRunEvidence, approvedPlanHash: string | null): boolean {
  if (!approvedPlanHash) return false;
  return Boolean(run.planHash) && run.planHash === approvedPlanHash;
}

/** The guarantee's live status, from its runs newest-first. Only runs proving the CURRENT meaning count. */
export function guaranteeStatusFrom(
  historyNewestFirst: GuaranteeRunEvidence[],
  planState: string,
  approvedPlanHash: string | null,
): GuaranteeStatus {
  if (planState === "review_required") return "plan_review_required";

  const qualifying = historyNewestFirst.filter((r) => provesCurrentMeaning(r, approvedPlanHash));
  const latest = qualifying[0];
  if (!latest) return "unproven";

  const decision = toPublicDecision(latest.state, latest.decision);
  if (decision === null) return "checking";

  if (decision === "verified") {
    // Verified, and it got there by fixing something: the latest run repaired an earlier one, and that
    // earlier one is in this guarantee's own history having not held. Both halves are required, or a first
    // run that merely carries a parent id would claim a repair story it does not have.
    const repairedSomething = Boolean(latest.parentRunId)
      && qualifying.slice(1).some((r) => toPublicDecision(r.state, r.decision) === "failed");
    return repairedSomething ? "reverified" : "verified";
  }

  return decision;
}

/** Layered on top of the run history: a repair that is under way but has not produced a result yet.
 *  Kept separate because it is the only state that needs a fact from outside the runs themselves. */
export function withRepairInProgress(status: GuaranteeStatus, repairOpen: boolean): GuaranteeStatus {
  return status === "failed" && repairOpen ? "repairing" : status;
}

// The words each state is shown as, and its tone. ONE mapping, so no surface can invent its own vocabulary.
// Nothing here says a guarantee is permanently healthy: "Verified" is always about the latest qualifying
// run, and every caller pairs it with the standing disclosure that a verification proves a deployment at a
// point in time, not continuous coverage.
export const GUARANTEE_STATUS_LABEL: Record<GuaranteeStatus, { label: string; tone: "verified" | "failed" | "blocked" | "progress" | "unproven" }> = {
  verified: { label: "Verified most recently", tone: "verified" },
  reverified: { label: "Reverified after a failure", tone: "verified" },
  failed: { label: "Failed most recently", tone: "failed" },
  repairing: { label: "Repair in progress", tone: "blocked" },
  blocked: { label: "Blocked most recently", tone: "blocked" },
  checking: { label: "Checking", tone: "progress" },
  unproven: { label: "Never verified", tone: "unproven" },
  plan_review_required: { label: "Review required", tone: "blocked" },
};

/** The standing disclosure. A guarantee reports its LATEST verification; it is never a claim of continuous
 *  or complete coverage, and one Verified run must never be read as permanent health. */
export const GUARANTEE_COVERAGE_NOTE = "Latest verification, not continuous or complete coverage.";

// ── Back-compat: the single-run form the existing surfaces still call ──────────────────────────────────
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
