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
import { getContractById, listRequirements } from "@/lib/v-applications";
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
  const requirements = contract ? (await listRequirements(access.owner, contract.id)).filter((r) => r.enabled).map((r) => r.requirement) : [];

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
    claim: contract?.source_prompt ?? null,
    requirements,
    failures,
    evidence,
    repair_prompt: repairPrompt,
    human_reviewed: false,
  }, { headers: { "X-Request-Id": rid, "cache-control": "no-store" } });
}
