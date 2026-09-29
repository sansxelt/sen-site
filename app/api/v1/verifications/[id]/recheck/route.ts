// POST /api/v1/verifications/{id}/recheck — run the SAME approved plan again, after a fix.
//
// This is the call a coding agent makes when Vraelis said Failed, it changed the code, and it has
// redeployed. A person approved the plan once; this re-runs every journey of that plan against the same site
// and returns a NEW verification id. The earlier record is never touched: the new run points back at it
// through parent_run_id, the same lineage the console's "Run again" writes.
//
// Every rule about WHETHER a re-check may run lives in lib/preflight/recheck.ts (pure, tested). The money
// path is lib/preflight/acceptance/accept-run.ts, unchanged, so a re-check is billed, capped and ceilinged
// exactly like any other verification. This route only reads HTTP, resolves the records, and renders.
//
// ALL JOURNEYS, NOT JUST THE FAILED ONES. A run over a subset can only ever prove a repair, and the public
// mapping renders that as Blocked until a full run returns Verified. An agent asking "did my fix work?" needs
// the full answer, so a re-check runs everything the approved plan ran.
import { randomUUID } from "node:crypto";
import { resolvePrincipal, logKeyUsage, PREFLIGHT_SCOPES } from "@/lib/preflight/api-principal";
import { preflightEnabled, runsDisabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { applicationAccessForRun } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";
import { getRun } from "@/lib/preflight/runs-db";
import { getRunInternal, parentRunFlows } from "@/lib/preflight/run-report-db";
import { getContractById, listFlows } from "@/lib/v-applications";
import { getReviewedPlanView } from "@/lib/preflight/reviewed-plan-db";
import { getSetupExtras } from "@/lib/preflight/setup-read";
import { evaluateAuthReadiness, anyAuthenticated, type PreviewFlow } from "@/lib/preflight/auth-preflight";
import { unsafeHttpsUrlReason } from "@/lib/safe-fetch";
import { isRunsGovernorPaused, globalActiveRunsAtCap, checkAccountVelocity } from "@/lib/preflight/cost-governor";
import { acceptVerificationRun } from "@/lib/preflight/acceptance/accept-run";
import { findApprovalRoot, countRechecks, decideRecheck } from "@/lib/preflight/recheck";
import { requirementsForRun } from "@/lib/preflight/requirements-for-run";
import { apiError, requestId } from "../../../_lib";
import { toRunId, toVerificationId, toPublicDecision } from "../../_shared";

export const runtime = "nodejs";

const ENDPOINT = "POST /v1/verifications/{id}/recheck";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const rid = requestId();
  const err = (code: string, status: number, message: string, headers: Record<string, string> = {}) =>
    Response.json({ error: { code, message, request_id: rid } }, { status, headers: { "X-Request-Id": rid, ...headers } });

  if (!preflightEnabled()) return apiError("not_found", "Not found.", 404, rid);
  if (runsDisabled() || await isRunsGovernorPaused()) return err("runs_paused", 503, "New verifications are temporarily paused. Existing reports remain available.");
  if (await globalActiveRunsAtCap()) return err("runs_busy", 503, "Vraelis is at capacity right now. Please try again in a moment.");

  // A re-check spends money, so it needs the same scope a launch does.
  const p = await resolvePrincipal(req, PREFLIGHT_SCOPES.runCreate);
  if (!p.ok) return p.res;

  const { id } = await params;
  const runId = toRunId(id);
  if (!runId) return apiError("not_found", "No such verification.", 404, rid);

  const access = await applicationAccessForRun(p.principal.email, runId);
  if (!access) return apiError("not_found", "No such verification.", 404, rid);
  if (!hasAtLeastRole(access.role, "editor")) return err("forbidden", 403, "You have view-only access to this application. Ask an editor or the owner to re-check it.");
  const owner = access.owner;

  {
    const v = await checkAccountVelocity(owner);
    if (v) return err(v.reason, 429, v.message, { "Retry-After": String(v.retryAfterSec) });
  }
  if (!(await preflightDbReady())) return err("setup_required", 503, "Verification is not fully set up yet.");

  const detail = await getRun(owner, runId);
  const parent = await getRunInternal(owner, runId);
  if (!detail || !parent) return apiError("not_found", "No such verification.", 404, rid);
  if (!parent.contractId) return err("recheck_not_available", 409, "That verification has no approved plan to run again. Start a new verification.");

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const root = await findApprovalRoot(owner, runId);
  const rootView = root ? await getReviewedPlanView(owner, root.plan.id) : null;
  const approvedUrl = (rootView?.deployment_url || parent.deploymentUrl || "").trim();
  const requestedUrl = typeof (body as Record<string, unknown>)?.deployment_url === "string" ? String((body as Record<string, unknown>).deployment_url).trim() : "";
  const targetUrl = requestedUrl || (parent.deploymentUrl ?? "").trim() || approvedUrl;
  const unsafe = unsafeHttpsUrlReason(targetUrl);
  if (unsafe) return err("validation_error", 400, `deployment_url is not usable: ${unsafe}`);

  const verdict = decideRecheck({
    parentCompleted: toPublicDecision(detail.run.state, detail.run.decision ?? null) !== null,
    parentGuaranteeId: parent.guaranteeId,
    root,
    used: root ? await countRechecks(owner, root.rootRunId) : 0,
    approvedUrl,
    targetUrl,
    nowMs: Date.now(),
  });
  if (!verdict.ok) {
    await logKeyUsage(p.principal, { endpoint: ENDPOINT, status: verdict.status, applicationId: parent.applicationId, runId });
    return err(verdict.code, verdict.status, verdict.message);
  }

  // The contract the parent ran, at the version it ran. The claim comes off the contract, never the body.
  const contract = await getContractById(owner, parent.contractId);
  if (!contract) return err("recheck_not_available", 409, "The plan behind that verification is no longer available. Start a new verification.");

  // Every journey the parent ran that is still enabled and approved. A parent that failed before any
  // journey started falls back to the contract's eligible journeys, which is the same set it was given.
  const contractFlows = await listFlows(owner, parent.contractId);
  const eligible = new Set(contractFlows
    .filter((f) => f.enabled && (((f as { review_state?: string }).review_state ?? "approved") === "approved"))
    .map((f) => f.id));
  let flowIds = (await parentRunFlows(owner, runId)).map((f) => f.testFlowId);
  if (!flowIds.length) flowIds = Array.from(eligible);
  flowIds = Array.from(new Set(flowIds)).filter((f) => eligible.has(f));
  if (!flowIds.length) return err("recheck_not_available", 409, "None of that verification's journeys can run any more. Start a new verification.");

  // Same test-account readiness check the launch route makes, before any money moves.
  const selected: PreviewFlow[] = contractFlows
    .filter((f) => flowIds.includes(f.id))
    .map((f) => ({ flowId: f.id, name: f.name, steps: Array.isArray(f.steps) ? (f.steps as { action: string; target?: string }[]) : [] }));
  if (anyAuthenticated(selected)) {
    const extras = await getSetupExtras(owner, parent.applicationId);
    const readiness = await evaluateAuthReadiness(owner, parent.applicationId, selected, extras.environment ?? null, extras.boundaries);
    if (!readiness.ok) return err("auth_not_ready", 400, readiness.reasons[0] ?? "A test account this plan signs in with is not ready. Re-add it under Connections, then re-check.");
  }

  const outcome = await acceptVerificationRun({
    owner,
    applicationId: parent.applicationId,
    contract: { id: contract.id, version: parent.contractVersion ?? contract.version },
    deploymentUrl: targetUrl,
    flowIds,
    principal: p.principal,
    // Each re-check is its own verification unless the caller retries with the same key on purpose.
    clientKey: (req.headers.get("idempotency-key") || `recheck-${randomUUID()}`).slice(0, 100),
    guarantee: null,
    claim: contract.source_prompt ?? null,
    parentRunId: runId,
    actor: { email: p.principal.email, level: access.level, role: access.role },
    risk: {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip"),
      userAgent: req.headers.get("user-agent"),
    },
    endpoint: ENDPOINT,
  });
  if (!outcome.ok) {
    return err(outcome.error, outcome.status, outcome.message, outcome.retryAfterSec ? { "Retry-After": String(outcome.retryAfterSec) } : {});
  }

  const vid = toVerificationId(outcome.runId);
  const reqs = await requirementsForRun(owner, runId, parent.contractId);
  return Response.json({
    verification_id: vid,
    state: "running",
    status_url: `/v1/verifications/${vid}`,
    recheck_of: id,
    claim: contract.source_prompt ?? null,
    requirements: reqs.requirements,
    deployment_url: targetUrl,
    // The approval this re-check stands on, and how much of it is left.
    human_reviewed: true,
    reviewed_by: root?.plan.approvedBy ?? null,
    reviewed_at: root?.plan.approvedAt ?? null,
    reviewed_plan_id: root?.plan.id ?? null,
    rechecks_left: verdict.left,
    recheck_window_ends_at: verdict.windowEndsAt,
  }, { status: 202, headers: { "X-Request-Id": rid } });
}
