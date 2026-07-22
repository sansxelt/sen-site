// GET /api/v1/verifications/plans/{id} — read a reviewed plan so a human or agent can review it before
// approving. Owner-scoped; a plan belonging to another tenant reads as not-found. Returns the exact
// requirements and flows that would run, the immutable plan hash, coverage, and the approval/execution state.
import { resolvePrincipal, PREFLIGHT_SCOPES } from "@/lib/preflight/api-principal";
import { getReviewedPlanView } from "@/lib/preflight/reviewed-plan-db";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { apiError, requestId } from "@/app/api/v1/_lib";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId();
  if (!preflightEnabled()) return apiError("not_found", "Not found.", 404, rid);
  const p = await resolvePrincipal(req, PREFLIGHT_SCOPES.runRead);
  if (!p.ok) return p.res;

  const { id } = await params;
  const v = await getReviewedPlanView(p.principal.email, id);
  if (!v) {
    return Response.json({ error: { code: "reviewed_plan_not_found", message: "No reviewed plan with that id.", request_id: rid } }, { status: 404, headers: { "X-Request-Id": rid } });
  }
  return Response.json({
    reviewed_plan_id: v.id,
    approval_state: v.approval_state,
    execution_state: v.execution_state,
    plan_hash: v.plan_hash,
    deployment_url: v.deployment_url,
    claim: v.claim,
    coverage: v.coverage,
    role_refs: v.role_refs ?? [],
    approved_by: v.approved_by,
    approved_at: v.approved_at,
    run_id: v.run_id,
    expires_at: v.expires_at,
    // The exact artifact under review: the requirements to be judged, and each flow with its step count.
    requirements: (v.plan.requirements ?? []).map((r) => r.text),
    flows: (v.plan.flows ?? []).map((f) => ({ name: f.name, goal: f.goal, steps: (f.steps ?? []).length })),
    human_reviewed: v.approval_state === "approved",
  }, { status: 200, headers: { "X-Request-Id": rid } });
}
