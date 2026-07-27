// POST /api/v1/verifications/plans/{id}/approve — approve a reviewed plan. A distinct, durable, auditable
// event, separate from execution: this records WHO approved WHICH plan hash and WHEN. Possessing the plan id
// is not approval; a paid run refuses a plan that has not passed through here.
//
// Idempotent: approving an already-approved plan returns the existing approval (already_approved: true). A
// changed plan is a different plan_hash, which means a new reviewed plan and a new approval — never a mutation
// of this one. Requires the same run:create scope as launching, because approval is what authorizes the spend.
import { resolvePrincipal, logKeyUsage, PREFLIGHT_SCOPES } from "@/lib/preflight/api-principal";
import { approveReviewedPlan, getReviewedPlanView } from "@/lib/preflight/reviewed-plan-db";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { apiError, requestId } from "@/app/api/v1/_lib";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId();
  if (!preflightEnabled()) return apiError("not_found", "Not found.", 404, rid);
  const p = await resolvePrincipal(req, PREFLIGHT_SCOPES.runCreate);
  if (!p.ok) return p.res;

  const { id } = await params;

  // A GUARANTEE'S PLAN IS HUMAN-APPROVED OR NOT AT ALL.
  //
  // resolvePrincipal accepts an API key here, and the line below happily stamps that key's prefix as the
  // approver. For an ordinary verification that is fine: the key belongs to the owner and approving is
  // authorising their own spend. For a plan that DEFINES A GUARANTEE it is not, because the company's
  // position is that a model may author a requirement and only a person may review it. Without this refusal
  // an agent could approve the plan it just caused to be written, and the whole chain would be
  // machine-approved while every surface reported human_reviewed: true.
  //
  // principal.via is checked nowhere else in this repo, which is precisely why this is easy to miss.
  const view = await getReviewedPlanView(p.principal.email, id);
  if (view && (view as { guarantee_id?: string | null }).guarantee_id && p.principal.via !== "session") {
    return Response.json({ error: { code: "guarantee_plan_requires_human", message: "This plan defines a guarantee. Only a signed-in person can approve it. Open it under Review.", request_id: rid } }, { status: 403, headers: { "X-Request-Id": rid } });
  }

  // The approving principal, recorded for audit: the public key prefix when a key approved, else the email.
  const approver = p.principal.keyPrefix || p.principal.email;
  const r = await approveReviewedPlan(p.principal.email, id, approver, Date.now());
  if (!r.ok) {
    await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications/plans/:id/approve", status: r.status });
    return Response.json({ error: { code: r.code, message: r.message, request_id: rid } }, { status: r.status, headers: { "X-Request-Id": rid } });
  }
  await logKeyUsage(p.principal, { endpoint: "POST /v1/verifications/plans/:id/approve", status: 200 });
  return Response.json({
    reviewed_plan_id: id,
    approval_state: "approved",
    already_approved: r.alreadyApproved,
  }, { status: 200, headers: { "X-Request-Id": rid } });
}
