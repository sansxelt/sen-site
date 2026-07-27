// POST /api/preflight/apps/[id]/guarantees/[gid]/verify — prove a standing guarantee, again.
//
// THE MISSING HALF. A guarantee could be created, planned and approved, and then nothing. The plan sat as an
// approved artifact with no way to execute it, so every run in the product was an anonymous verification
// that answered a question once and proved no standing promise. This is the entrance that closes that loop.
//
// WHAT MAKES THIS DIFFERENT FROM A NORMAL LAUNCH. A normal launch is told what to run: the caller picks
// flows and Vraelis executes them. Here the caller picks NOTHING. Every executable input is resolved
// server-side from the approved guarantee:
//
//   the flows          come from the FROZEN contract approval materialized (kind='guarantee'), which
//                      refuses addFlow/updateFlow/deleteFlow, so they cannot drift after a human read them
//   the binding        (id, plan version, plan hash, reviewed plan id) is read off the guarantee row
//   the meaning        is approved_claim, which nothing in this path regenerates, re-synthesizes or edits
//
// That is deliberate and it is the security property. The runs route documents why it passes guarantee:null
// — a guarantee id accepted from a request body would be a false-Verified manufacturing primitive, because
// any editor could post one trivial approved flow alongside the tenant's most critical guarantee id and that
// guarantee would render Verified. Here the id comes from the URL and everything executable is derived from
// the approved record, so the worst a caller can do is re-prove something a human already approved.
//
// REVERIFICATION. An optional parent_run_id makes this a repair check rather than a fresh proof. The parent
// is validated to belong to THIS guarantee and this owner, and its binding is compared to the guarantee's
// current one: re-proving a definition that has since been re-approved is a different claim, and the caller
// is told so rather than having the new meaning quietly attributed to the old failure.
//
// Everything after the guarantee is resolved is the shared acceptance service — the same caps, idempotency,
// key ceiling, billing and release paths the console launch runs. There is no second money path here.
import { NextResponse } from "next/server";
import { resolvePrincipal, PREFLIGHT_SCOPES } from "@/lib/preflight/api-principal";
import { preflightEnabled, runsDisabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication, listFlows } from "@/lib/v-applications";
import { applicationAccess } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";
import { getSetupExtras } from "@/lib/preflight/setup-read";
import { evaluateAuthReadiness, anyAuthenticated, type PreviewFlow } from "@/lib/preflight/auth-preflight";
import { unsafeHttpsUrlReason } from "@/lib/safe-fetch";
import { linkedVercelDeploymentUrl } from "@/lib/preflight/oauth/vercel-deploy";
import { isRunsGovernorPaused, globalActiveRunsAtCap, checkAccountVelocity } from "@/lib/preflight/cost-governor";
import { acceptVerificationRun } from "@/lib/preflight/acceptance/accept-run";
import { getGuarantee } from "@/lib/preflight/guarantees-db";
import { getRunInternal } from "@/lib/preflight/run-report-db";

export const runtime = "nodejs";

const ENDPOINT = "POST /api/preflight/apps/{id}/guarantees/{gid}/verify";

export async function POST(req: Request, { params }: { params: Promise<{ id: string; gid: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (runsDisabled()) {
    return NextResponse.json({ error: "runs_paused", message: "New verifications are temporarily paused. Existing reports remain available." }, { status: 503 });
  }
  if (await isRunsGovernorPaused()) {
    return NextResponse.json({ error: "runs_paused", message: "New verifications are temporarily paused. Existing reports remain available." }, { status: 503 });
  }
  if (await globalActiveRunsAtCap()) {
    return NextResponse.json({ error: "runs_busy", message: "Vraelis is at capacity right now. Please try again in a moment." }, { status: 503 });
  }

  // Session OR API key with run:create. Launching is not approving: a key may re-prove what a human already
  // approved, and it cannot approve anything (that route is session-only, by design).
  const p = await resolvePrincipal(req, PREFLIGHT_SCOPES.runCreate);
  if (!p.ok) return p.res;
  const email = p.principal.email;
  const { id, gid } = await params;

  const access = await applicationAccess(email, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const owner = access.owner;
  if (!hasAtLeastRole(access.role, "editor")) {
    return NextResponse.json({ error: "forbidden", message: "You have view-only access to this system. Ask an editor or the owner to verify this guarantee." }, { status: 403 });
  }

  {
    const v = await checkAccountVelocity(owner);
    if (v) return NextResponse.json({ error: v.reason, message: v.message }, { status: 429, headers: { "Retry-After": String(v.retryAfterSec) } });
  }

  const app = await getApplication(owner, id);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await preflightDbReady())) {
    return NextResponse.json({ error: "setup_required", message: "Preflight is not fully set up yet." }, { status: 503 });
  }

  // ── the guarantee, and whether it is actually provable right now ──────────────────────────────────────
  const g = await getGuarantee(owner, gid);
  if (!g || g.application_id !== id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (g.status === "archived") {
    return NextResponse.json({ error: "guarantee_archived", message: "This guarantee is archived. Restore it before verifying." }, { status: 409 });
  }
  // Approval is the gate, and it is a human's. plan_state 'draft' means nobody has approved a plan yet;
  // 'review_required' means the definition moved and the standing approval no longer covers it.
  if (g.plan_state !== "ok") {
    return NextResponse.json({
      error: "guarantee_not_approved",
      message: g.plan_state === "review_required"
        ? "This guarantee changed since its plan was approved. Review and approve the new proof plan before verifying."
        : "Approve this guarantee's proof plan before verifying it.",
      plan_state: g.plan_state,
    }, { status: 409 });
  }
  // Approval writes the plan onto the guarantee and THEN materializes the runnable contract, and it lets the
  // approval stand if that second write fails. So an approved guarantee is not automatically a runnable one,
  // and this says which it is instead of inventing a contract at launch time.
  if (!g.plan_contract_id) {
    return NextResponse.json({
      error: "guarantee_not_runnable",
      message: "This guarantee's plan was approved but never materialized into a runnable contract. Approve the plan again to rebuild it.",
    }, { status: 409 });
  }
  if (!g.approved_plan_hash) {
    return NextResponse.json({
      error: "guarantee_not_runnable",
      message: "This guarantee has no approved plan hash, so a run could not be tied to the meaning it proves. Approve the plan again.",
    }, { status: 409 });
  }

  // The flows are the frozen contract's, never the caller's. An approved contract refuses mutation, so this
  // set is the same one the approver read.
  const flows = await listFlows(owner, g.plan_contract_id);
  const flowIds = flows
    .filter((f) => f.enabled && (((f as { review_state?: string }).review_state ?? "approved") === "approved"))
    .map((f) => f.id);
  if (!flowIds.length) {
    return NextResponse.json({
      error: "guarantee_not_runnable",
      message: "This guarantee's approved plan has no runnable journeys. Approve the plan again to rebuild it.",
    }, { status: 409 });
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));

  // ── reverification lineage ────────────────────────────────────────────────────────────────────────────
  const rawParent = typeof body?.parent_run_id === "string" ? body.parent_run_id.trim() : "";
  let parentRunId: string | null = null;
  if (rawParent) {
    const pin = await getRunInternal(owner, rawParent);
    // A parent that is not owned, not found, or not guarantee-bound cannot anchor a reverification.
    if (!pin || !pin.guaranteeId) {
      return NextResponse.json({ error: "parent_not_found", message: "That earlier run could not be found, or it was not bound to a guarantee." }, { status: 404 });
    }
    // THE CROSS-GUARANTEE REFUSAL. Without this, one guarantee's failure could be handed in as another
    // guarantee's repair, and the history would show a fix for something that never failed.
    if (pin.guaranteeId !== gid) {
      return NextResponse.json({ error: "parent_guarantee_mismatch", message: "That earlier run proves a different guarantee, so it cannot be this one's reverification." }, { status: 409 });
    }
    // Re-proving a definition that has since been re-approved is a different claim. Refuse rather than let
    // the new meaning inherit the old failure's lineage.
    if (pin.guaranteePlanHash && pin.guaranteePlanHash !== g.approved_plan_hash) {
      return NextResponse.json({
        error: "parent_plan_superseded",
        message: "This guarantee's approved plan changed after that run. A new approval is a new lineage, so start a fresh verification instead of a reverification.",
      }, { status: 409 });
    }
    parentRunId = rawParent;
  }

  // ── the deployment under test ─────────────────────────────────────────────────────────────────────────
  // Same resolution as the console launch. A repaired deployment is normally a new URL or a new Vercel
  // production deployment, which is exactly what makes the reverification meaningful.
  const explicitUrl = typeof body?.deployment_url === "string" ? body.deployment_url : (typeof body?.deploymentUrl === "string" ? body.deploymentUrl : "");
  let rawUrl = explicitUrl.trim();
  if (!rawUrl) {
    const liveVercel = await linkedVercelDeploymentUrl(owner, id).catch(() => null);
    rawUrl = liveVercel || app.app_url || "";
  }
  const deploymentUrl = (rawUrl || "").trim();
  if (unsafeHttpsUrlReason(deploymentUrl)) {
    return NextResponse.json({ error: "invalid_url", message: "Provide a public https deployment URL." }, { status: 400 });
  }

  // Signed-in journeys need a usable credential before any money moves, exactly as on the console launch.
  const selectedFlows: PreviewFlow[] = flows
    .filter((f) => flowIds.includes(f.id))
    .map((f) => ({ flowId: f.id, name: f.name, steps: Array.isArray(f.steps) ? (f.steps as { action: string; target?: string }[]) : [] }));
  if (anyAuthenticated(selectedFlows)) {
    const extras = await getSetupExtras(owner, id);
    const readiness = await evaluateAuthReadiness(owner, id, selectedFlows, extras.environment ?? null, extras.boundaries);
    if (!readiness.ok) {
      return NextResponse.json({
        error: "auth_not_ready",
        message: readiness.reasons[0] ?? "This guarantee needs a signed-in role that is not ready. Add or re-add the test account under Connections, then verify again.",
        reasons: readiness.reasons,
        roles: readiness.roles.map((r) => ({ role: r.role, ok: r.ok, credentialState: r.credentialState, environmentMatch: r.environmentMatch })),
      }, { status: 400 });
    }
  }

  const outcome = await acceptVerificationRun({
    owner,
    applicationId: id,
    contract: { id: g.plan_contract_id, version: g.plan_contract_version ?? null },
    deploymentUrl,
    flowIds,
    principal: p.principal,
    clientKey: (req.headers.get("idempotency-key") || (typeof body?.submission_id === "string" ? body.submission_id : "")).slice(0, 100),
    // Read off the approved record, never off the request. This is the whole point of the entrance.
    guarantee: {
      id: g.id,
      planVersion: g.plan_version,
      planHash: g.approved_plan_hash,
      reviewedPlanId: g.approved_reviewed_plan_id ?? null,
    },
    parentRunId,
    actor: { email, level: access.level, role: access.role },
    endpoint: ENDPOINT,
    risk: {
      ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? req.headers.get("x-real-ip"),
      userAgent: req.headers.get("user-agent"),
    },
  });

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error, message: outcome.message, ...(outcome.runId ? { runId: outcome.runId, status: "queued" } : {}) },
      { status: outcome.status, ...(outcome.retryAfterSec ? { headers: { "Retry-After": String(outcome.retryAfterSec) } } : {}) },
    );
  }
  // The response states the lineage rather than leaving a caller to infer it: which guarantee, which
  // approved plan, which run, and what it re-verifies.
  return NextResponse.json({
    runId: outcome.runId,
    status: "queued",
    flowCount: outcome.flowCount,
    guaranteeId: g.id,
    planVersion: g.plan_version,
    planHash: g.approved_plan_hash,
    reviewedPlanId: g.approved_reviewed_plan_id ?? null,
    parentRunId,
    deploymentUrl,
  });
}
