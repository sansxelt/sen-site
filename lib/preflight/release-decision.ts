// The aggregate RELEASE decision across a system's guarantees, in the same public vocabulary a single
// verification uses (verified / failed / blocked). Pure and total, so the agent loop and any UI roll-up read
// one rule. The caller resolves each guarantee's status ON THE TARGET DEPLOYMENT first (a guarantee proven on
// deployment A is NOT green for release B — that per-deployment comparison uses sameDeploymentIdentity in
// deployments-db.ts, never a reviewed-plan fingerprint); this module only combines the resolved statuses.
import type { PublicDecision } from "./public-decision";
import type { GuaranteeStatus } from "./guarantee-status";

export type ReleaseItem = { criticality: string; statusOnTarget: GuaranteeStatus };

// Rule (critical guarantees gate the release; non-critical surface as warnings and never block):
//   any critical FAILED on target                  -> failed  (a real regression against this build)
//   else any critical not VERIFIED on target       -> blocked (unproven / plan_review_required / checking / blocked)
//   all critical VERIFIED on target                -> verified
//   no critical guarantees at all                  -> blocked (a release with nothing proven is not shippable)
export function rollupRelease(items: ReleaseItem[]): PublicDecision {
  const critical = items.filter((i) => i.criticality === "critical");
  if (critical.length === 0) return "blocked";
  if (critical.some((i) => i.statusOnTarget === "failed")) return "failed";
  if (critical.some((i) => i.statusOnTarget !== "verified")) return "blocked";
  return "verified";
}
