// POST /api/preflight/apps/[id]/runs; enqueue a Preflight RUN for a connected application.
//
// This route ONLY reserves credits and inserts a QUEUED job. It NEVER executes a browser: the Railway
// worker claims the queued run (v_preflight_claim) and drives Playwright in an isolated Browserbase session.
// No Playwright, no provider secrets, no signed URLs are ever touched here. Everything is owner-scoped; the
// signed-in email is the only owner; nothing from the client body is trusted as an owner.
//
// Gates, in order: preflight flag (404) -> kill switch (503) -> auth, session OR api key, with the
// preflight:run:create scope (401/403) -> ownership (404) -> role (403) -> DB migrated (503) -> contract
// APPROVED (400) -> >=1 selected flow (400) -> every selected flow enabled+approved (400) -> safe https
// deployment URL (400) -> per-owner concurrency cap (429) -> per-owner DAILY cap (429) -> submission id /
// idempotency key (400) -> that key not already used for a DIFFERENT payload (409) -> credit hold (402).
// Only after the hold succeeds do we insert the queued run; a unique-submission collision returns the
// existing run (409) and releases this attempt's hold.
//
// An API key is only a second way to name the acting email. Every gate below it is the same code the
// browser path runs, so a key can never spend more or reach further than its owner can in the app.

import { NextResponse } from "next/server";
import { resolvePrincipal, PREFLIGHT_SCOPES } from "@/lib/preflight/api-principal";
import { preflightEnabled, runsDisabled } from "@/lib/v-preflight-flags";
import { preflightDbReady } from "@/lib/preflight/db-ready";
import { getApplication, getApprovedContract, listFlows } from "@/lib/v-applications";
import { applicationAccess } from "@/lib/preflight/team-access";
import { hasAtLeastRole } from "@/lib/v-workspace";
import { getSetupExtras } from "@/lib/preflight/setup-read";
import { evaluateAuthReadiness, anyAuthenticated, type PreviewFlow } from "@/lib/preflight/auth-preflight";
import { unsafeHttpsUrlReason } from "@/lib/safe-fetch";
import { linkedVercelDeploymentUrl } from "@/lib/preflight/oauth/vercel-deploy";
import { isRunsGovernorPaused, globalActiveRunsAtCap, checkAccountVelocity } from "@/lib/preflight/cost-governor";
import { acceptVerificationRun } from "@/lib/preflight/acceptance/accept-run";

export const runtime = "nodejs";

// At most this many of an owner's runs may be in flight at once (worker-load guard; the credit hold is the
// hard spend limit). Credits held per requested flow (estimateRunCredits); pricing is flat per run, so a
// completed run keeps the full hold as the charge and the worker refunds the whole hold only if no flow ran
// (no partial remainder).


export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!preflightEnabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  // Kill switch: pauses NEW runs only. Reports, history, and the worker's already-claimed work are untouched.
  if (runsDisabled()) {
    return NextResponse.json({ error: "runs_paused", message: "New verifications are temporarily paused. Existing reports remain available." }, { status: 503 });
  }
  // Cost governor auto-pause (blocker 3): DB-durable, survives redeploys. Trips when the global provider
  // -cost ceiling ($/hour or $/day) is reached; reset is operator-only. Same customer-facing behavior as
  // the env kill switch: NEW runs paused, reports/history untouched. Checked BEFORE billing.
  if (await isRunsGovernorPaused()) {
    return NextResponse.json({ error: "runs_paused", message: "New verifications are temporarily paused. Existing reports remain available." }, { status: 503 });
  }
  // Global in-flight brake (blocker 3, Finding 2): bounds how far a burst can outrun the cost auto-pause.
  if (await globalActiveRunsAtCap()) {
    return NextResponse.json({ error: "runs_busy", message: "Vraelis is at capacity right now. Please try again in a moment." }, { status: 503 });
  }
  // Session OR API key. The principal supplies ONLY the acting email; every gate below (team access,
  // entitlements, credit hold, quotas, cost governor, concurrency) is the unchanged session-path code, so a
  // key can never spend more, reach further, or bypass a limit its owner is subject to in the browser.
  const p = await resolvePrincipal(req, PREFLIGHT_SCOPES.runCreate);
  if (!p.ok) return p.res;
  const email = p.principal.email;
  const { id } = await params;

  // TEAM ACCESS: resolve the caller to the app's OWNER (the data-plane key) + the caller's role. Access is
  // granted to the owner or an active workspace member; anyone else gets a uniform 404 (indistinguishable
  // from "does not exist"). `owner` is the app owner from here on — every owner-scoped read/write, credit
  // hold, cap, and the velocity guard are keyed to the OWNER, so a member launching a run spends the OWNER's
  // credits and counts against the OWNER's quotas (owner-anchored billing). Degrades to owner-only when the
  // app has no workspace (single-user, unchanged).
  const access = await applicationAccess(email, id);
  if (!access) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const owner = access.owner;
  // Launching a paid run is an EDITOR+ action. A viewer/client_viewer is a real member but read-only, so a
  // forbidden here is honest (they already know the app exists). Non-members never reach this — they 404 above.
  if (!hasAtLeastRole(access.role, "editor")) {
    return NextResponse.json({ error: "forbidden", message: "You have view-only access to this application. Ask an editor or the owner to run a verification." }, { status: 403 });
  }

  // Per-account velocity cap + circuit breaker (blocker 3): stops the refund/infra loop (a fast
  // fail-then-refund churn) before any billing. Keyed to the app OWNER (whose account bears the cost). Fails
  // open on a read blip (velocity is a guard, not the hard spend limit — the billing hold + global governor
  // are).
  {
    const v = await checkAccountVelocity(owner);
    if (v) return NextResponse.json({ error: v.reason, message: v.message }, { status: 429, headers: { "Retry-After": String(v.retryAfterSec) } });
  }

  // The app is already resolved + access-checked above; re-read it in the OWNER's scope for the full row
  // (deployment URL, etc.). This is the owner's own app, so getApplication(owner, id) always returns it.
  const app = await getApplication(owner, id);
  if (!app) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // The run tables must be migrated, or there is nowhere to queue the job.
  if (!(await preflightDbReady())) {
    return NextResponse.json({ error: "setup_required", message: "Preflight is not fully set up yet." }, { status: 503 });
  }

  // The Production Contract must be APPROVED; approval is the gate before any paid run. The latest
  // APPROVED version is used, so an in-progress draft revision never blocks runs: the approved contract
  // remains what runs verify against until the draft is approved.
  const contract = await getApprovedContract(owner, id);
  if (!contract || contract.status !== "approved") {
    return NextResponse.json({ error: "contract_not_approved", message: "Approve the Production Contract before launching a preflight run." }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  // At least one flow id, de-duplicated.
  const rawFlowIds: unknown = Array.isArray(body?.flow_ids) ? body.flow_ids : (Array.isArray(body?.flowIds) ? body.flowIds : []);
  const flowIds = Array.from(new Set((rawFlowIds as unknown[]).filter((x): x is string => typeof x === "string" && x.length > 0)));
  if (!flowIds.length) {
    return NextResponse.json({ error: "flows_required", message: "Select at least one approved flow to run." }, { status: 400 });
  }

  // Every requested flow must be enabled + approved right now (mirrors the worker's claim() filter). The
  // client never picks flows we would not run.
  const flows = await listFlows(owner, contract.id);
  const eligible = new Set(
    flows.filter((f) => f.enabled && (((f as { review_state?: string }).review_state ?? "approved") === "approved")).map((f) => f.id),
  );
  if (flowIds.some((fid) => !eligible.has(fid))) {
    return NextResponse.json({ error: "flow_not_approved", message: "One or more selected flows are not enabled and approved." }, { status: 400 });
  }

  // Deployment target, in priority: an explicit preview URL from the request; else the LIVE Vercel
  // production URL when the app is linked to a Vercel account connection (the first place an OAuth token
  // changes what a run does — no stale hand-entered URL); else the stored connected app URL. The Vercel
  // resolution is fail-soft: any gap returns null and we fall through to app.app_url.
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

  // AUTH PREFLIGHT (S6 slice of S9): if any selected flow is authenticated, verify — worker-independent,
  // BEFORE any hold/charge — that every required role has an active, environment-matching, DECRYPTABLE test
  // credential and the worker vault is configured. This safe check opens each credential server-side only to
  // learn a boolean "decryptable"; the plaintext is never logged, returned, or retained. If anything is not
  // ready the launch is DISABLED with a specific reason and NO hold is taken. A non-authenticated run skips
  // this entirely and is unaffected (backward compatible). (Full pass-preview UI is deferred to S9.)
  const selectedFlows: PreviewFlow[] = flows
    .filter((f) => flowIds.includes(f.id))
    .map((f) => ({ flowId: f.id, name: f.name, steps: Array.isArray(f.steps) ? (f.steps as { action: string; target?: string }[]) : [] }));
  if (anyAuthenticated(selectedFlows)) {
    const extras = await getSetupExtras(owner, id);
    const runEnvironment = extras.environment ?? null;
    const readiness = await evaluateAuthReadiness(owner, id, selectedFlows, runEnvironment, extras.boundaries);
    if (!readiness.ok) {
      return NextResponse.json({
        error: "auth_not_ready",
        message: readiness.reasons[0] ?? "This run needs a signed-in role that is not ready. Add or re-add the test account under Connections, then run again.",
        reasons: readiness.reasons,
        roles: readiness.roles.map((r) => ({ role: r.role, ok: r.ok, credentialState: r.credentialState, environmentMatch: r.environmentMatch })),
      }, { status: 400 });
    }
  }

  // EVERYTHING FROM HERE IS THE ACCEPTANCE SERVICE.
  //
  // Caps, idempotency, the per-key ceiling, billing, the run insert and every release path moved into
  // lib/preflight/acceptance/accept-run.ts unchanged, in the same order. This route now owns only what a
  // route should own: reading HTTP, resolving who is asking and what they are asking about, and rendering
  // the outcome. A second entrance can reuse the money path without duplicating it or importing a handler.
  const outcome = await acceptVerificationRun({
    owner,
    applicationId: id,
    contract: { id: contract.id, version: contract.version },
    deploymentUrl,
    flowIds,
    principal: p.principal,
    clientKey: (req.headers.get("idempotency-key") || (typeof body?.submission_id === "string" ? body.submission_id : "")).slice(0, 100),
    // NO GUARANTEE FROM AN HTTP CALLER, EVER. A guarantee id accepted from the request body would be a
    // false-Verified manufacturing primitive: any editor or run:create key could POST one trivial approved
    // flow plus the tenant's most critical guarantee id, and that guarantee would render Verified. It would
    // also collide in payloadFingerprint, which hashes only {app, url, flows}. Guarantee-bound runs are
    // launched by the verify-this-guarantee path, which resolves the binding server-side.
    guarantee: null,
    actor: { email, level: access.level, role: access.role },
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
  return NextResponse.json({ runId: outcome.runId, status: "queued", flowCount: outcome.flowCount });
}
