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

// ── The payload vocabulary, and the ONE translation out of it ────────────────────────────────────────
//
// The /api-runs routes answer with customer-safe verdict LABELS rather than the internal decision enum,
// and that payload shape is a stable contract an integrator may already be parsing. It is declared here,
// once, because it was previously declared three times: in both api-runs routes and, inverted by hand, in
// the api-runtime workspace that renders it.
//
// THE HAND-INVERTED COPY WAS WRONG, AND WRONG IN THE ONE DIRECTION THIS PRODUCT CANNOT AFFORD. It mapped
// "REPAIR VERIFIED" to VERIFIED. toPublicDecision maps repair_verified to *blocked*: a repair check is a
// targeted rerun of the flows that failed, so it says the repair held, never that the system is verified.
// The workspace therefore printed a green-adjacent VERIFIED over a run the API, the CI gate and the
// webhooks all call blocked. A false Verified is the single failure mode the product exists to prevent,
// and it was rendering inside the product.
//
// The fix is not a corrected second table. It is that there is no second table: a payload label is turned
// back into the decision it was made from, and the answer comes from toPublicDecision like everywhere
// else. A new decision cannot be added to one map and forgotten in the other, because there is one map.
export const PAYLOAD_VERDICT: Record<string, string> = {
  ready: "READY", blocked: "BLOCKED", needs_review: "NEEDS REVIEW", repair_verified: "REPAIR VERIFIED",
  infra_failure: "COULD NOT COMPLETE", not_verified: "NOT VERIFIED",
};

/** Payload label -> the internal decision it was rendered from. */
const DECISION_FROM_PAYLOAD: Record<string, string> = Object.fromEntries(
  Object.entries(PAYLOAD_VERDICT).map(([decision, label]) => [label, decision]),
);

/** The public decision behind a payload verdict label, or null when the label carries no decision at all
 *  (COULD NOT COMPLETE and NOT VERIFIED are absence-of-verdict, not verdicts). */
export function publicDecisionFromPayloadVerdict(label: string): PublicDecision | null {
  const decision = DECISION_FROM_PAYLOAD[label];
  if (!decision || decision === "infra_failure" || decision === "not_verified") return null;
  return toPublicDecision("completed", decision);
}
