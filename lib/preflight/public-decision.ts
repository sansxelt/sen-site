// The PUBLIC verification decision vocabulary and the mapping from a run's internal (state, decision) to it.
// This lives in lib/ (not app/) because it has three consumers that must agree byte-for-byte: the public
// API surface (app/api/v1/verifications), the CI gate, and the outbound webhooks fired by the worker. The
// external contract stays stable even if the internal decision strings are renamed.
//
//   verified  — the claim held, with evidence
//   failed    — the claim did not hold, with evidence and a repair prompt
//   blocked   — the run could not reach a verdict (the deployment could not be exercised, or it needs review)
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
