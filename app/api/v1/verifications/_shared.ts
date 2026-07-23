// A verification IS a run. The public id is the run id with a prefix, so there is no second table to keep
// in sync with run state and no way for the two to disagree.
//
// The prefix is not decoration: it makes a verification id self-describing in a log or a CI output, and it
// means a caller who pastes an internal run id somewhere public gets a clean "not found" rather than a
// partially-working request.
const PREFIX = "vrf_";

export function toVerificationId(runId: string): string { return `${PREFIX}${runId}`; }

// Canonical form of a claim, used to decide whether a reused idempotency key names the SAME request. Trim
// and collapse internal whitespace, nothing more: two submissions that differ only in spacing are the same
// outcome, and anything else is a different claim that must not be answered with an earlier run's result.
export function canonicalClaim(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s+/g, " ");
}

/** Null when the id is not a verification id at all, so a caller cannot probe run ids through this surface. */
export function toRunId(verificationId: string): string | null {
  if (!verificationId.startsWith(PREFIX)) return null;
  const raw = verificationId.slice(PREFIX.length);
  return raw.length ? raw : null;
}

// The public decision vocabulary + mapping now live in lib/preflight/public-decision.ts so the worker's
// outbound webhooks and the CI gate share ONE source of truth with this API surface. Re-exported here so
// every existing importer of this module keeps working unchanged.
export { toPublicDecision, type PublicDecision } from "../../../../lib/preflight/public-decision";
