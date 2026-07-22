// POST /api/v1/verifications/plans/{id}/approve — approve a reviewed plan. A distinct, durable, auditable
// event, separate from execution: this records WHO approved WHICH plan hash and WHEN. Possessing the plan id
// is not approval; a paid run refuses a plan that has not passed through here.
//
// Idempotent: approving an already-approved plan returns the existing approval (already_approved: true). A
// changed plan is a different plan_hash, which means a new reviewed plan and a new approval — never a mutation
// of this one. Requires the same run:create scope as launching, because approval is what authorizes the spend.
import { resolvePrincipal, logKeyUsage, PREFLIGHT_SCOPES } from "@/lib/preflight/api-principal";
import { approveReviewedPlan } from "@/lib/preflight/reviewed-plan-db";
import { preflightEnabled } from "@/lib/v-preflight-flags";
import { apiError, requestId } from "@/app/api/v1/_lib";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId();
  if (!preflightEnabled()) return apiError("not_found", "Not found.", 404, rid);
  const p = await resolvePrincipal(req, PREFLIGHT_SCOPES.runCreate);
  if (!p.ok) return p.res;

  const { id } = await params;
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
