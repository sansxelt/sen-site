// WHAT A COMPLETED VERIFICATION SAYS IT CHECKED, AND IN WHAT ORDER.
//
// A verification response echoes its requirements so the caller can tell whether the claim was understood.
// That echo has to be the same every time it is read, or "rerun and prove the same approved meaning again"
// is not a property the product has.
//
// It was not. Every requirement the lane wrote landed with order_index 9999, so within a contract the order
// was whatever Postgres returned for a tied sort. POST echoed plan order, GET re-read row order, and the two
// could disagree about the same verification.
//
// The fix is not to guess better. There are three cases and they are genuinely different:
//
//   reviewed_plan   The run consumed an approved plan. The plan is immutable and plan_hash binds its
//                   ordering, so the order it was approved in is still readable. Use it. Authoritative.
//   order_index     The contract's own order_index values are unique. Nothing to reconstruct. Trustworthy.
//   legacy          Rows share an order_index and there is no plan to read. THE AUTHORED ORDER IS GONE.
//                   created_at plus a UUID is not evidence of insertion order: sequential inserts can share
//                   a timestamp and UUIDv4 carries no sequence at all. Manufacturing a sequence here would
//                   produce a confident answer with nothing behind it, which is the failure this product
//                   exists to catch. Report the rows and say the ordering is incomplete.
import { listRequirements, requirementOrderIsComplete } from "../v-applications";
import { getReviewedPlanByRunId } from "./reviewed-plan-db";

export type RequirementOrderBasis = "reviewed_plan" | "order_index" | "legacy_incomplete";

export type RequirementsForRun = {
  requirements: string[];
  orderBasis: RequirementOrderBasis;
  /** True only when the order shown is the order something durable actually recorded. */
  orderProven: boolean;
};

export async function requirementsForRun(
  owner: string, runId: string, contractId: string | null,
): Promise<RequirementsForRun> {
  const plan = runId ? await getReviewedPlanByRunId(owner, runId) : null;
  if (plan && plan.requirementTexts.length) {
    return { requirements: plan.requirementTexts, orderBasis: "reviewed_plan", orderProven: true };
  }

  if (!contractId) return { requirements: [], orderBasis: "order_index", orderProven: true };

  const rows = (await listRequirements(owner, contractId)).filter((r) => r.enabled);
  const complete = requirementOrderIsComplete(rows);
  return {
    requirements: rows.map((r) => r.requirement),
    orderBasis: complete ? "order_index" : "legacy_incomplete",
    orderProven: complete,
  };
}
