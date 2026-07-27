// GET /api/v1/verifications/{id} — the decision, the evidence, and what to do about it.
//
// Reads through the SAME ownership resolver as the internal run report (applicationAccessForRun), so a
// verification id cannot reach a run its holder could not already read. This route reshapes; it does not
// re-authorize.
//
// The response is a translation, not a passthrough. Internal vocabulary (ready / needs_review / blocked,
// flows, issues, passes) stays internal so it can be renamed without breaking a caller, and the external
// contract stays the sentence the product promises: a claimed outcome, a decision, and evidence for it.
import { resolvePrincipal, logKeyUsage, PREFLIGHT_SCOPES } from "@/lib/preflight/api-principal";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { applicationAccessForRun } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";
import { getRun, runContractId } from "@/lib/preflight/runs-db";
import { getRunInternal } from "@/lib/preflight/run-report-db";
import { getGuarantee } from "@/lib/preflight/guarantees-db";
import { appHostUrl } from "@/lib/app-routes";
import { getContractById } from "@/lib/v-applications";
import { requirementsForRun } from "@/lib/preflight/requirements-for-run";
import { getReviewedPlanByRunId } from "@/lib/preflight/reviewed-plan-db";
import { apiError, requestId } from "../../_lib";
import { toRunId, toPublicDecision } from "../_shared";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId();
  if (!preflightEnabled()) return apiError("not_found", "Not found.", 404, rid);

  const p = await resolvePrincipal(req, PREFLIGHT_SCOPES.runRead);
  if (!p.ok) return p.res;

  const { id } = await params;
  const runId = toRunId(id);
  // A malformed id is a 404, not a validation error: telling a caller their id was "the right shape but
  // wrong" is a probing oracle, and there is nothing here they could fix.
  if (!runId) return apiError("not_found", "No such verification.", 404, rid);

  const access = await applicationAccessForRun(p.principal.email, runId);
  if (!access || !hasAtLeastRole(access.role, "viewer")) return apiError("not_found", "No such verification.", 404, rid);
  const detail = await getRun(access.owner, runId);
  if (!detail) return apiError("not_found", "No such verification.", 404, rid);

  const decision = toPublicDecision(detail.run.state, detail.run.decision ?? null);
  await logKeyUsage(p.principal, { endpoint: "GET /v1/verifications/{id}", status: 200, runId });

  // Still running: a small, cheap body. A poller hitting this every few seconds should not be paying for the
  // full evidence payload on every tick.
  if (decision === null) {
    return Response.json({
      verification_id: id,
      state: "running",
      status_url: `/v1/verifications/${id}`,
    }, { headers: { "X-Request-Id": rid, "cache-control": "no-store" } });
  }

  // The contract carries the claim (as its source prompt) and the requirements that were derived from it.
  // Both are echoed on the terminal response so the caller can judge whether the claim was understood, which
  // is the only defense against a confidently wrong verdict from a misread claim.
  const contractId = await runContractId(access.owner, runId);
  const contract = contractId ? await getContractById(access.owner, contractId) : null;
  // Order comes from the immutable reviewed plan when this run consumed one, and is reported as incomplete
  // rather than invented when it does not exist to be read.
  const reqs = await requirementsForRun(access.owner, runId, contract?.id ?? null);
  const reviewedPlan = await getReviewedPlanByRunId(access.owner, runId);

  // THE DURABLE RELATIONSHIP, RETURNED. An agent that launched a verification over the API could read the
  // decision and the evidence and had no way to learn which standing promise it belonged to, whether it was
  // repairing an earlier run, or where to open the record a human would look at. All three are recorded; not
  // returning them made the API a poorer citizen of its own product than the console.
  const internal = await getRunInternal(access.owner, runId);
  const guarantee = internal?.guaranteeId ? await getGuarantee(access.owner, internal.guaranteeId) : null;
  const consoleBase = appHostUrl("");
  const recordUrl = `${consoleBase}/systems/${access.applicationId}/passes/${runId}`;

  // Only failures the run actually observed. Each carries what was expected, what happened instead, and how
  // to reproduce it.
  const failures = detail.issues.map((i) => ({
    severity: i.severity,
    title: i.title,
    expected: i.expected,
    observed: i.observed,
    reproduce: i.repro,
  }));

  // Per-flow evidence, named by what was being checked rather than by internal flow identity.
  const evidence = detail.flows.map((f) => ({
    checking: f.name ?? null,
    result: f.state ?? null,
    // The step where it broke, derived from the step list rather than stored separately, so it can never
    // disagree with the evidence beside it.
    failed_at_step: (() => { const i = f.steps.findIndex((s) => s.status === "failed"); return i === -1 ? null : i + 1; })(),
  }));

  // The loop-closing artifact. Vraelis found the problem; this is what an agent feeds back to its model to
  // fix it. Returning the decision without it would leave the caller knowing something is wrong and not
  // knowing what to do, which is the gap this product exists to close.
  const repairPrompt = detail.issues.find((i) => i.repair_prompt)?.repair_prompt ?? null;

  return Response.json({
    verification_id: id,
    state: "completed",
    decision,
    // WHICH STANDING PROMISE THIS PROVES, and the exact meaning it proved. guarantee_plan_hash is what makes
    // the claim checkable later: compare it against the guarantee's current approved hash to learn whether
    // this evidence still speaks to the live definition, or to one that has since been re-approved.
    guarantee_id: internal?.guaranteeId ?? null,
    ...(guarantee ? { guarantee_title: guarantee.title, guarantee_plan_version: internal?.guaranteePlanVersion ?? null, guarantee_plan_hash: internal?.guaranteePlanHash ?? null } : {}),
    // The repair relationship. Present when this run re-verified an earlier one; null for a first attempt.
    reverification_of: detail.run.parent_run_id ?? null,
    ...(detail.run.parent_run_id ? { reverification_of_url: `${consoleBase}/systems/${access.applicationId}/passes/${detail.run.parent_run_id}` } : {}),
    // Where a person looks. An API result that cannot be opened is a dead end for the human the agent is
    // reporting to.
    console_url: recordUrl,
    claim: contract?.source_prompt ?? null,
    requirements: reqs.requirements,
    failures,
    evidence,
    repair_prompt: repairPrompt,
    // ASSERTED FROM THE PERSISTED BINDING, NOT HARDCODED.
    //
    // This was the literal `false` on every response, including runs that had consumed an approved reviewed
    // plan, so the one case where a person really had reviewed the plan was reported as if nobody had. The
    // run -> plan binding is durable (v_reviewed_plans.run_id, stamped at consume time), so the answer is
    // readable rather than assumed.
    human_reviewed: reviewedPlan?.approvalState === "approved",
    ...(reviewedPlan?.approvalState === "approved"
      ? { reviewed_by: reviewedPlan.approvedBy, reviewed_at: reviewedPlan.approvedAt, reviewed_plan_id: reviewedPlan.id }
      : {}),
    // Two INDEPENDENT facts, never collapsed into one. A decision is historical and is never rewritten;
    // whether a person reviewed the contract behind it is a separate question with a separate answer, and a
    // record may carry both, either, or neither.
    decision_status: contract?.legacy_approval_class ? "legacy" : "current",
    contract_review_status: contract?.legacy_approval_class
      ?? (reviewedPlan?.approvalState === "approved" ? "human_reviewed" : "unreviewed"),
    // Whether the order above is the order something durable recorded, or simply the order the rows came
    // back in. Silence here would present a tied legacy sort as if it were the approved sequence.
    requirement_order: reqs.orderBasis,
  }, { headers: { "X-Request-Id": rid, "cache-control": "no-store" } });
}
