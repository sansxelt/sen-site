// A verification IS a run. The public id is the run id with a prefix, so there is no second table to keep
// in sync with run state and no way for the two to disagree.
//
// The prefix is not decoration: it makes a verification id self-describing in a log or a CI output, and it
// means a caller who pastes an internal run id somewhere public gets a clean "not found" rather than a
// partially-working request.
const PREFIX = "vrf_";

export function toVerificationId(runId: string): string { return `${PREFIX}${runId}`; }

/** Null when the id is not a verification id at all, so a caller cannot probe run ids through this surface. */
export function toRunId(verificationId: string): string | null {
  if (!verificationId.startsWith(PREFIX)) return null;
  const raw = verificationId.slice(PREFIX.length);
  return raw.length ? raw : null;
}

// The public decision vocabulary. Deliberately NOT the internal decision strings: the external contract has
// to stay stable even if internal naming moves, and a caller branching on these should never be broken by a
// rename that was meant to be invisible.
//
//   verified  — the claim held, with evidence
//   failed    — the claim did not hold, with evidence and a repair prompt
//   blocked   — the run could not reach a verdict (the deployment could not be exercised)
export type PublicDecision = "verified" | "failed" | "blocked";

export function toPublicDecision(runState: string, decision: string | null): PublicDecision | null {
  if (!["completed", "failed", "cancelled"].includes(runState)) return null; // still running
  // A run that never completed cannot have verified anything, whatever it recorded on the way.
  if (runState !== "completed") return "blocked";
  const d = (decision ?? "").toLowerCase();
  if (d === "ready") return "verified";
  if (d === "blocked") return "failed";
  // needs_review and anything unrecognized: a verdict was not reached. Reporting it as verified would be a
  // false pass, and reporting it as failed would be a false alarm; blocked is the honest third answer.
  return "blocked";
}
