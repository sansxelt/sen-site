// THE COVERAGE GATE, BELOW EVERY LAUNCH ENTRANCE.
//
// WHAT WAS WRONG. The gate lived in two route bodies: POST /v1/verifications and the guarantee prepare
// route. The console launch and the rerun evaluated coverage NOWHERE, so the product's defining refusal —
// declining to charge for a plan that cannot prove the claim — was absent from the path every human takes
// and present only on the API surface nobody was using yet. acceptVerificationRun() fixed the ENTRANCE
// problem (one money path) and left this one untouched, which is easy to misread as fixed.
//
// WHY THIS IS NOT SIMPLY "CALL resolveCoverage FROM THE ACCEPTANCE SERVICE". There are two gates with the
// same name and they are not interchangeable:
//
//   resolveCoverage()  the CORRECTIVE resolver. Needs a fresh synthesis and page snapshots, calls a model
//                      up to twice, can trigger a recrawl, and can take 300s. It belongs where a plan is
//                      being BUILT, which is the API route and the guarantee prepare route. It cannot run
//                      on a launch: there is no synthesis in hand and no budget for one.
//   coverageReport()   the DETERMINISTIC gate. Pure, synchronous, no model, no network. Given a claim, the
//                      requirement texts and the flows, it answers whether this plan could prove that
//                      claim. This is the one that moves.
//
// lib/preflight/reviewed-plan.ts already made exactly this distinction for stored plans ("the deterministic
// gate only — no model, no recrawl, no correction — run against the exact approved requirements and
// flows"). This is the same decision applied to a stored CONTRACT, and it deliberately reuses
// coverageReport rather than restating any part of it, so there is one authority on what coverage means.
//
// THE CLAIM IS contract.source_prompt AND THAT IS NOT A GUESS. The run report renders that field as
// "Submitted claim", GET /v1/verifications/{id} returns it as `claim`, and prepareVerification WRITES the
// caller's claim into it. A guarantee's materialized contract carries approved_claim in the same column.
// One field, already the claim everywhere else in the product.
import { coverageReport, type FlowLite, type StepLite } from "../coverage";
import { listRequirements, listFlows } from "../../v-applications";
import { flowApprovedEnabled } from "../runs-db";

/** What the gate needs, already loaded. Kept as plain data so the decision is testable without a database. */
export type LaunchCoverageInput = {
  /** The outcome this run must prove. Null or blank when the contract never named one. */
  claim: string | null;
  /** Texts of the requirements that are actually in force on this contract. */
  requirements: string[];
  /** ONLY the flows this run will execute: the selected ids, intersected with what is enabled and approved. */
  flows: FlowLite[];
  /** How many requirements exist and are enabled but still sit at 'suggested'. See AWAITING REVIEW below. */
  awaitingReview?: number;
};

export type LaunchCoverageVerdict =
  | { gate: "passed" }
  /** No claim exists, so there is no proposition to test the plan against. See NO_CLAIM below. */
  | { gate: "no_claim" }
  /** Requirements were derived and nobody has approved them yet. NOT a statement about the claim. */
  | { gate: "awaiting_review"; suggested: number }
  | { gate: "refused"; missing: string[] };

// WHY A BLANK CLAIM IS NOT A REFUSAL, AND NOT SILENTLY A PASS EITHER.
//
// checkExecutionCoverage does NOT fall open on an empty claim. With no named value it applies
// valuelessPersistenceChecklist, which requires the flow to assert something after a sign-in or reload. So
// feeding it "" would refuse any contract whose journeys do not happen to cross a persistence boundary —
// including entirely legitimate ones ("the pricing page lists three plans"). Wiring the gate up naively
// would therefore have refused most console launches, which is very likely why nobody did.
//
// The honest reading: a coverage gate answers "can this plan prove THAT?" and a contract with no claim has
// no THAT. Inventing obligations the customer never asked for would be the gate manufacturing a refusal,
// which is the same class of error as manufacturing a Verified. So this returns a THIRD state rather than
// pretending to have decided. The caller records it; it is not a silent pass.
//
// This is a real remaining hole and it is named rather than hidden: a contract created with no outcome
// sentence is not gated, because nothing can gate it. The fix is upstream (require the outcome when a
// system is connected), not here.
// AWAITING REVIEW IS NOT A REFUSAL, AND CALLING IT ONE COST THIS PRODUCT EVERY FIRST RUN IT EVER HAD.
//
// requirementsInForce() keeps only rows that are enabled AND approved, which is correct: an unreviewed row
// must not silently become an obligation. But when EVERY row is still 'suggested' that filter returns an
// empty list, and coverageReport is then asked whether zero requirements can prove a claim. It answers no,
// in the only vocabulary it has -- "no requirement preserves the expected value", "no requirement asserts it
// after the persistence boundary", "no requirement carries that condition" -- and the caller renders that as
// claim_not_provable. Which reads, to the person who wrote the claim, as "your sentence was too vague."
//
// It is not too vague. Measured on the production contracts, one application, twenty versions: every single
// version derived five to nine requirements, and v20's included "Pro plan status must be retained when user
// signs back in with the same account" -- the exact persistence and identity conditions the refusal said
// were absent. Nineteen of the twenty sat at 'suggested'. The one that was approved, v19, passed. Across all
// twenty-six gated contracts the correlation is perfect: approved passed, suggested refused.
//
// So the reader rewords the claim, because that is what the message told them to do, and nothing changes --
// three distinct claim texts across eighteen versions in the data, none of it helping, because rewording
// cannot approve a requirement. This state exists so the product says the true thing instead: the checks are
// written, they are waiting for you, and the claim is fine.
//
// DELIBERATELY NARROW. It fires only when NOTHING is in force and something is pending. If even one
// requirement is approved and coverage still fails, that is a real refusal about a real plan and it is
// reported as one.
export function decideLaunchCoverage(input: LaunchCoverageInput): LaunchCoverageVerdict {
  const claim = (input.claim ?? "").trim();
  if (!claim) return { gate: "no_claim" };

  const awaiting = input.awaitingReview ?? 0;
  if (input.requirements.length === 0 && awaiting > 0) return { gate: "awaiting_review", suggested: awaiting };

  const report = coverageReport(claim, input.requirements, input.flows);
  if (report.readyToLaunch) return { gate: "passed" };
  return { gate: "refused", missing: [...report.claim.missing, ...report.execution.missing] };
}

// THE WHOLE GATE, INCLUDING THE READS, IN ONE PLACE.
//
// Both launch entrances call THIS, not decideLaunchCoverage directly. The acceptance service and the rerun
// route still have separate money paths (the rerun prices differently: $3 per selected flow, capped), and
// merging those is a bigger change than this one. But if each of them loaded the requirements and flows and
// assembled the input itself, there would be two copies of "what the gate looks at" — which is exactly the
// shape of the bug that put a private balance fold in lib/v-lifecycle.ts while lib/v-credits was careful.
// One function loads, filters and decides; the callers only render the refusal in their own idiom.
export async function gateLaunchCoverage(
  owner: string,
  contractId: string,
  claim: string | null,
  flowIds: string[],
): Promise<LaunchCoverageVerdict> {
  const [allRequirements, allFlows] = await Promise.all([
    listRequirements(owner, contractId),
    listFlows(owner, contractId),
  ]);
  return decideLaunchCoverage({
    claim,
    requirements: requirementsInForce(allRequirements),
    awaitingReview: requirementsAwaitingReview(allRequirements),
    flows: selectRunnableFlows(allFlows, flowIds),
  });
}

// ── The two filters, extracted so they can FAIL A TEST ────────────────────────────────────────────────
//
// These were inline in gateLaunchCoverage, which meant the only thing standing behind them was a source
// scan. An adversarial mutation campaign against this change proved that inadequate: deleting the selection
// check, and separately hardcoding the claim to null, both left every assertion green. A source scan proves
// a function is CALLED; it cannot prove the function still does anything. Pulled out here, both are pure and
// exercised on fixture rows by scripts/launch-coverage-verify.ts.

/** ONLY the flows this run will execute. Two conditions, and dropping either is a real defect:
 *  the SELECTION (a caller runs a subset, and an unselected strong journey must never vouch for a selected
 *  weak one) and ELIGIBILITY (the same predicate createRun re-reads with and the worker claims by). */
export function selectRunnableFlows(
  allFlows: { id: string; name: string; role: string | null; steps: unknown; enabled: boolean; review_state?: string | null }[],
  flowIds: string[],
): FlowLite[] {
  const selected = new Set(flowIds);
  return allFlows
    .filter((f) => selected.has(f.id))
    .filter((f) => flowApprovedEnabled(f as { enabled: boolean; review_state?: string }))
    .map((f) => ({
      name: f.name,
      role: f.role,
      steps: (Array.isArray(f.steps) ? f.steps : []) as StepLite[],
    }));
}

/** The requirements actually in force. Same pair of conditions the contract editor uses to decide what
 *  "will be tested": enabled is not enough on its own, because a row can be enabled and still unreviewed. */
export function requirementsInForce(
  allRequirements: { requirement: string; enabled: boolean; review_state?: string | null }[],
): string[] {
  return allRequirements
    .filter((r) => r.enabled && ((r.review_state ?? "approved") === "approved"))
    .map((r) => r.requirement);
}

/** Requirements that are enabled and still waiting on the reviewer. 'rejected' is NOT counted: that was a
 *  decision somebody made, not a step they have yet to take, and telling them to go approve a row they threw
 *  away would be its own wrong message. Mirrors requirementsInForce so the two cannot disagree about what a
 *  row's state means. */
export function requirementsAwaitingReview(
  allRequirements: { requirement: string; enabled: boolean; review_state?: string | null }[],
): number {
  return allRequirements.filter((r) => r.enabled && (r.review_state ?? "approved") === "suggested").length;
}

/** What to say when the checks exist and nobody has approved them. It has one job beyond being accurate:
 *  stop the reader rewording a claim that was never the problem. */
export function launchCoverageAwaitingReviewMessage(suggested: number): string {
  const n = suggested === 1 ? "1 requirement" : `${suggested} requirements`;
  return `Vraelis derived ${n} from this claim and none have been approved yet, so there is nothing in force to run. Nothing was charged. Review them and approve the ones that belong, then run again. The claim itself does not need rewording.`;
}

/** The customer-facing refusal. Same code as POST /v1/verifications so one vocabulary describes one
 *  decision on every surface; the message is written for someone looking at their own contract rather than
 *  at an API response. */
export function launchCoverageRefusalMessage(missing: string[]): string {
  const head = "Vraelis will not charge for this run, because the approved journeys could not prove the outcome this system claims.";
  if (!missing.length) return `${head} Edit the contract so a journey exercises the outcome end to end, then run again.`;
  const shown = missing.slice(0, 4).map((m) => `- ${m}`).join("\n");
  const more = missing.length > 4 ? `\n- and ${missing.length - 4} more` : "";
  return `${head} What is missing:\n${shown}${more}`;
}
