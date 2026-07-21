// Pure rules for WHICH flows a run executes and WHEN a submission id may be replaced. No DB, no browser,
// no env; fully covered by scripts/preflight-scope-verify.ts. Two production bugs live behind these rules:
//
//   1. Targeted rerun scope: a run's stored flow selection (v_preflight_runs.flow_ids) is AUTHORITATIVE.
//      The worker must execute exactly the selected flows — never "every approved flow of the contract".
//      A missing/invalid selection is an internal configuration error and must fail the run BEFORE any
//      browser session exists (nothing billable, nothing for issue reconciliation to act on).
//
//   2. Rerun deduplication: an INVALID prior run (invalidated target_mismatch, cancelled, infrastructure
//      failure) must not occupy the submission key forever — a legitimate replacement is allowed. Only a
//      run that is still in flight or completed with a valid result blocks a duplicate submission.

import { createHash } from "node:crypto";

export type FlowSelectionPlan = { ok: true; ids: string[] } | { ok: false; reason: string };

// Validate a run row's stored selection against the run's approved contract snapshot (the ids of the
// contract's enabled+approved flows). Returns the deduplicated selected ids in the order given, or a
// human-readable reason the selection is invalid. Fail-closed: null / non-array / empty / non-string
// entries / an id outside the approved snapshot are ALL invalid — the caller must fail the run as an
// internal configuration error, never fall back to "run everything".
export function planFlowSelection(raw: unknown, approvedIds: string[]): FlowSelectionPlan {
  if (!Array.isArray(raw)) {
    return { ok: false, reason: "the run has no stored flow selection (flow_ids missing or not an array)" };
  }
  const approved = new Set(approvedIds);
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string" || entry.length === 0) {
      return { ok: false, reason: "the stored flow selection contains a non-string entry" };
    }
    if (seen.has(entry)) continue;                       // duplicates collapse; not an error
    if (!approved.has(entry)) {
      return { ok: false, reason: `selected flow ${entry} is not an enabled+approved flow of the run's contract` };
    }
    seen.add(entry);
    ids.push(entry);
  }
  if (!ids.length) return { ok: false, reason: "the stored flow selection is empty" };
  return { ok: true, ids };
}

// The 'failed' rerun scope: the parent's flows that failed or were blocked, deduplicated. Used by the
// rerun route and the fixture driver so "Rerun failed flows" means one thing everywhere.
export const RERUN_FAILED_STATES = ["failed", "blocked"] as const;
export function selectFailedFlows(parentFlows: { testFlowId: string; state: string }[]): string[] {
  const failed = new Set<string>(RERUN_FAILED_STATES);
  return Array.from(new Set(parentFlows.filter((f) => failed.has(f.state)).map((f) => f.testFlowId)));
}

// Does an EXISTING run with this state block a new run reusing its submission id?
//   - queued / discovering / running / analyzing: yes — double-click / concurrent-tab protection.
//   - completed: yes — a valid result for this submission already exists (idempotent replay returns it).
//   - failed (invalidated target_mismatch, flow_selection_invalid, provider/infrastructure failures) and
//     cancelled: no — an invalid or abandoned execution never satisfies the submission, so a legitimate
//     replacement may be queued. The historical row is kept untouched (never deleted).
// Unknown states block (fail-safe: when in doubt, protect against the duplicate).
export function dedupBlocksReplacement(state: string): boolean {
  return !(state === "failed" || state === "cancelled");
}

// Deterministic replacement submission ids: the original key first, then -r2, -r3, ... so a replacement
// run is traceable back to the submission it supersedes.
export function submissionIdForAttempt(base: string, attempt: number): string {
  return attempt === 0 ? base : `${base}-r${attempt + 1}`;
}

// ── Idempotency key, bound to the payload ────────────────────────────────────────────────────────────────
// A stored submission id is "<keyFingerprint>#<payloadFingerprint>", where the key half identifies the
// caller's Idempotency-Key (scoped to owner+application, so two tenants can pick the same key) and the
// payload half identifies WHAT was requested. Both halves are hashed rather than interpolated: a caller's
// key is arbitrary text, and a raw '#' or a LIKE wildcard inside it would let one key's prefix reach into
// another's. Hex cannot.
//
// The point of the payload half is that a key alone is not enough. Reusing one key with a different body
// would otherwise return the FIRST run, so an agent believes its new flow selection ran when it did not.
// Same key + same payload is a genuine retry and returns the original run; same key + different payload is
// refused loudly.
function sha(v: string): string { return createHash("sha256").update(v).digest("hex"); }

export function keyFingerprint(owner: string, applicationId: string, clientKey: string): string {
  return sha(`${owner.trim().toLowerCase()} ${applicationId} ${clientKey}`).slice(0, 24);
}

// CANONICAL BY CONSTRUCTION. The caller's JSON never reaches this hash: the route extracts the fields it
// acts on and this function rebuilds them in a fixed key order, so a body with reordered keys, or one using
// the deployment_url spelling instead of deploymentUrl, hashes identically. Flow ids are deduplicated and
// sorted for the same reason, since selecting the same flows in a different order is the same request.
//
// The fields hashed here are exactly the fields that change WHAT EXECUTES: which application, against which
// URL, running which flows. That is deliberate, not an oversight. Hashing the whole body would break a
// legitimate retry from a client that added a harmless field, and hashing less would let a changed request
// pass as a replay. preflight-api-key-access-verify.ts asserts the run route consumes no OTHER meaningful
// body field, so adding one later without extending this fingerprint fails the suite.
export function payloadFingerprint(input: { applicationId: string; deploymentUrl: string; flowIds: string[] }): string {
  const flows = Array.from(new Set(input.flowIds)).sort();
  return sha(JSON.stringify({ app: input.applicationId, url: input.deploymentUrl, flows })).slice(0, 16);
}

export function buildSubmissionId(keyFp: string, payloadFp: string): string {
  return `${keyFp}#${payloadFp}`;
}

// Read the payload half back out, tolerating submissionIdForAttempt's "-rN" replacement suffix — a
// replacement run supersedes the same submission, so it must still count as the SAME payload, not a reuse
// conflict. Returns "" for a legacy submission id minted before payload binding existed.
export function submissionPayloadOf(submissionId: string): string {
  return submissionId.split("#")[1]?.replace(/-r\d+$/, "") ?? "";
}

// The flat per-run credit hold, derived from the SAME selected-flow set that is stored on the run and
// executed by the worker — estimates, reservations, execution, report counts, and settlement all read
// one number. Kept in full as the charge on completion; refunded in full when no flow ran.
export const RUN_CREDITS_PER_FLOW = 1;
export const MIN_RUN_CREDITS = 1;
export function estimateRunCredits(selectedFlowCount: number): number {
  return Math.max(MIN_RUN_CREDITS, selectedFlowCount * RUN_CREDITS_PER_FLOW);
}
