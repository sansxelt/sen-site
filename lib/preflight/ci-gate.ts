// The CI gate: how a pipeline turns a verification's DECISION into a process exit code.
//
// The whole point of this file is a single safety property: a deploy is authorized by the DECISION, never by
// the run STATE. A run can be "completed" and still be a FAILED verification; "completed" is a lifecycle
// fact, not a verdict. So this function is given ONLY the public decision, not the run state, which makes it
// structurally impossible to ship a release because a run merely finished.
//
// The public decision vocabulary (see app/api/v1/verifications/_shared.ts) is deliberately small and stable:
//   verified — the claim held, with evidence            -> exit 0 (ship)
//   failed   — the claim did not hold, with a repair prompt -> exit 1 (stop)
//   blocked  — no verdict was reached (e.g. the deploy could not be exercised, or the run needs review)
//                                                        -> exit 2 (stop)
//   null     — no decision yet (still running)           -> keep polling
// Anything else is an unrecognized verdict: never ship on it. That is a contract/config error, exit 3.
//
// Transport-level problems (a non-200 response, a network error, a bad key) are the caller's to detect before
// calling this; they should map to their own non-zero error exit. This function assumes a decision that was
// successfully read from a verification status response.

export type CiGateOutcome =
  | { action: "wait" }                                     // no decision yet -> poll again
  | { action: "exit"; code: 0; decision: "verified" }      // the claim held -> ship
  | { action: "exit"; code: 1; decision: "failed" }        // the claim did not hold -> stop
  | { action: "exit"; code: 2; decision: "blocked" }       // no verdict reached -> stop
  | { action: "exit"; code: 3; decision: string };         // unrecognized decision -> never ship

/**
 * Map a verification's public decision to a CI outcome. Pass the `decision` field from
 * GET /api/v1/verifications/{id}. Pass null/undefined while it is still running.
 *
 * By design this takes the DECISION and not the run state: only "verified" yields exit 0. A completed run
 * whose decision is "failed" or "blocked" can never pass, and a bare run state (e.g. "completed" or "ready")
 * fed in by mistake lands in the unrecognized branch (exit 3), not a ship.
 */
export function ciGate(decision: string | null | undefined): CiGateOutcome {
  const d = (decision ?? "").trim().toLowerCase();
  if (d === "") return { action: "wait" };
  switch (d) {
    case "verified": return { action: "exit", code: 0, decision: "verified" };
    case "failed": return { action: "exit", code: 1, decision: "failed" };
    case "blocked": return { action: "exit", code: 2, decision: "blocked" };
    default: return { action: "exit", code: 3, decision: d };
  }
}
