// The run executor. Given a claimed run, it opens ONE isolated browser session via the provider, executes
// each approved flow's bounded semantic steps, records DETERMINISTIC observations (never an AI verdict),
// derives each flow's pass/fail and the run decision by explainable rules, persists incrementally, and
// finalizes. The session is always closed in a finally, and a lost lease / requested cancel aborts
// browser work immediately (checked before every step via the ownership-checked heartbeat). No AI here.
import type { BrowserProvider, RunStore, ClaimedRun, FlowResult, FlowSpec, RunDecision, StepObservation, ArtifactSink, AuthFlowMeta, AuthFailureCode } from "./types";
import { flowRequiresAuth, flowRoles, AUTH_ACTIONS } from "./types";
import { classifyProviderError } from "./provider-errors";
import { resolveNavigationUrl, targetInvariantViolation } from "../../lib/preflight/target-url";
import { classifyStepAction, evaluateBoundary } from "../../lib/preflight/boundaries";
import { log, clearActiveCredentials } from "./redaction";
import { signInAs, verifyAuth, signOut, resetContext, resolveRole, type CredentialOpener } from "./auth-executor";

export type ExecLimits = { leaseSecs: number; maxRunMs: number; maxFlowMs: number; maxStepsPerFlow: number };
// credentialOpener: opens a role's sealed credential owner+application scoped, at the moment of use. Absent
// in tests that never sign in; injected by the worker wiring for real runs (openTestAccount bound to the
// run's owner + application). vaultConfigured mirrors secret-vault.vaultConfigured() so the executor can
// fail closed WITHOUT importing the vault (keeping this module DB/vendor free); defaults true.
export type ExecDeps = {
  store: RunStore; provider: BrowserProvider; workerId: string; limits: ExecLimits;
  now?: () => number; artifacts?: ArtifactSink;
  credentialOpener?: CredentialOpener; vaultConfigured?: boolean;
};

export class LeaseLostError extends Error { constructor() { super("lease_lost"); } }
export class CancelledError extends Error { constructor() { super("cancelled"); } }
// The run's snapshot target could not be honored (a Vraelis harness bug, NEVER an application blocker):
// the run aborts as an infrastructure failure before any browser work, is terminal (retrying a
// deterministic resolution bug cannot heal it), opens no issues, and refunds the reservation.
export class TargetMismatchError extends Error { constructor(reason: string) { super(`target_mismatch: ${reason}`); } }
// EVERY selected flow was refused by the application's test boundaries before ANY step executed: nothing
// ran, so nothing may be billed. Terminal (a retry cannot change the boundaries), full refund, no issues.
export class PolicyBlockedError extends Error { constructor() { super("blocked_by_policy"); } }
// EVERY selected flow could not authenticate for a WORKER/ENVIRONMENT reason (missing/revoked credential,
// vault failure, MFA/CAPTCHA, provider infra) and no application work ran: this is a worker-config outcome,
// NEVER an application blocker. Full refund (nothing verifiable happened), no issues. The failure_code
// carries the specific reason so the report tells the operator exactly what to fix.
export class WorkerConfigFailedError extends Error { constructor(public readonly failureCode: string) { super("worker_config_failed"); } }

// Classify an auth step for the S5 boundary gate. Auth actions are treated as CORE for the boundary layer
// EXCEPT that sign_in_as / switch_role's underlying submit is an authentication action — but authentication
// against the run's own origin is legitimate and must not be blocked (the login page is on-target). The one
// meaningful boundary interaction is that any navigation the auth step performs is judged by origin, and a
// destructive/side-effect target still trips its rule. We reuse classifyStepAction with the action's target.
async function runFlow(flow: FlowSpec, page: import("./types").PreflightPage, deps: ExecDeps, runId: string, runDeadline: number, targetUrl: string, run: ClaimedRun, counters: { performedSteps: number }): Promise<FlowResult> {
  const now = deps.now ?? (() => Date.now());
  const steps: StepObservation[] = [];
  const flowDeadline = Math.min(now() + flow.maxMs, runDeadline);
  const boundedSteps = flow.steps.slice(0, deps.limits.maxStepsPerFlow);
  let state: FlowResult["state"] = "passed";
  // The run target's origin, for the boundary origin rule. null when unparseable (the boundary layer then
  // refuses absolute external navigations outright — with no valid target there is no legitimate origin).
  let runOrigin: string | null = null;
  try { runOrigin = new URL(targetUrl).origin; } catch { runOrigin = null; }

  // Authenticated-flow bookkeeping (S6). An unauthenticated flow (no auth actions) leaves `auth` undefined
  // and behaves EXACTLY as before. For an authenticated flow we track which role is active, the account's
  // metadata (label/env, never a value), the resolved credential state, and the last verified auth time.
  const requiresAuth = flowRequiresAuth(flow.steps);
  const declaredRoles = flowRoles(flow.steps);
  const opener: CredentialOpener = deps.credentialOpener ?? (async () => null);
  // runId scopes the active-credential redaction set PER RUN so concurrent runs cannot leak into or clear
  // one another's credentials (see redaction.ts, S6 fix 3).
  const identity = { owner: run.owner, applicationId: run.applicationId, runId };
  const vaultConfigured = deps.vaultConfigured !== false;
  let activeAccountLabel: string | null = null;
  let activeEnvironment: string | null = run.environment ?? null;
  let credentialState: AuthFlowMeta["credentialState"] = "active";
  let verifiedAuthAt: string | null = null;
  let authFailure: AuthFailureCode | undefined;
  // Session reuse is ON when a flow signs in once and reuses that browser session for its remaining steps
  // (i.e. it does not reset_context or switch_role between). It is a property of the flow shape.
  const sessionReuse = requiresAuth
    && flow.steps.filter((s) => s.action === "sign_in_as").length >= 1
    && !flow.steps.some((s) => s.action === "reset_context" || s.action === "switch_role");
  // A flow that auth-failed for a WORKER/CONFIG reason (not an app defect) ends as auth_config_failed.
  let authConfigFailed = false;

  // Set this flow's viewport before its steps: mobile flows run narrow so viewport-gated defects (e.g. a
  // nav overlay covering the primary action) reproduce; desktop flows run wide. Non-fatal on failure.
  if (flow.viewport) { try { await page.setViewport(flow.viewport.width, flow.viewport.height); } catch { /* non-fatal */ } }

  try {
  for (const step of boundedSteps) {
    // Heartbeat BEFORE each step: extends the lease if we still own it, aborts if we lost it / cancel.
    if (!(await deps.store.heartbeat(runId, deps.workerId, deps.limits.leaseSecs))) {
      throw (await deps.store.cancelRequested(runId)) ? new CancelledError() : new LeaseLostError();
    }
    if (now() > flowDeadline) { steps.push({ action: step.action, ok: false, detail: "flow_timeout", ms: 0 }); state = "blocked"; break; }

    // ── S6: semantic AUTH actions ────────────────────────────────────────────────────────────────────
    if (AUTH_ACTIONS.has(step.action)) {
      // EVERY auth action passes through the S5 boundary gate FIRST (origin, environment, action class). An
      // auth action against the run's own origin is CORE, so this never blocks a legitimate on-target
      // sign-in; a boundary refusal is blocked_by_policy exactly as S5.
      const verdict = evaluateBoundary(run.boundaries, classifyStepAction({ action: step.action, target: step.target, value: step.value }, step.target, runOrigin));
      if (!verdict.allowed) {
        steps.push({ action: step.action, target: step.target, ok: false, detail: `blocked_by_policy: ${verdict.reason}`.slice(0, 400), ms: 0 });
        state = "blocked_by_policy";
        break;
      }
      counters.performedSteps += 1;
      const expect = { route: step.value || undefined, element: step.expect || undefined };
      let r;
      if (step.action === "sign_in_as" || step.action === "switch_role") {
        const role = step.target || "";
        // switch_role first isolates the prior role's session (reset_context) so no state leaks across roles.
        if (step.action === "switch_role") {
          const reset = await resetContext(page, now);
          steps.push(reset.obs);
          if (!reset.ok) { authFailure = reset.authFailure ?? "provider_infra_failure"; authConfigFailed = true; break; }
        }
        const account = resolveRole(run.testAccounts, role);
        // Record the resolved credential state for the UI (never a value).
        credentialState = account ? "active" : (run.testAccounts.length === 0 ? "missing" : "revoked");
        activeAccountLabel = account?.label ?? null;
        activeEnvironment = account?.environment ?? activeEnvironment;
        r = await signInAs(page, role, account, opener, identity, vaultConfigured, expect, now);
        if (r.ok && r.verifiedAuthAt) verifiedAuthAt = r.verifiedAuthAt;
      } else if (step.action === "verify_authenticated" || step.action === "verify_unauthorized") {
        r = await verifyAuth(page, step.action, expect, now);
      } else if (step.action === "sign_out") {
        r = await signOut(page, null, now);
      } else { // reset_context
        r = await resetContext(page, now);
      }
      steps.push(r.obs);
      if (!r.ok) {
        if (r.authFailure && !r.appDefect) {
          // A worker/config/infra/challenge failure: NEVER an application defect. The flow ends as
          // auth_config_failed and opens no issue; the run softens to needs_review.
          authFailure = r.authFailure;
          authConfigFailed = true;
        } else {
          // auth_rejected_by_app (broken login) OR a verify mismatch (an authorization finding): a REAL
          // failed flow, exactly like any broken journey — it opens an issue.
          if (r.authFailure) authFailure = r.authFailure;
          state = "failed";
        }
        break;
      }
      continue;
    }

    // Navigations are REBASED onto the current run target at execution time: the stored step keeps its
    // route intent, the run snapshot supplies origin + winning query params. The step the browser actually
    // executes carries the resolved URL, and the observation records requested vs resolved vs final.
    let exec = step;
    let requested: string | null = null;
    if (step.action === "navigate") {
      requested = step.target || step.value || "";
      exec = { ...step, target: resolveNavigationUrl(requested, targetUrl), value: undefined };
    }
    // S5 test-boundary gate, BEFORE the step executes. Navigations are judged by their RESOLVED URL (where
    // the browser will actually go — a stored absolute URL was already rebased onto the run target, which
    // is exactly why existing approved flows can never trip the origin rule). A refusal never executes the
    // step, is NEVER an application defect, and ends the flow as blocked_by_policy.
    const verdict = evaluateBoundary(run.boundaries, classifyStepAction(exec, exec.target, runOrigin));
    if (!verdict.allowed) {
      steps.push({ action: exec.action, target: exec.target, ok: false, detail: `blocked_by_policy: ${verdict.reason}`.slice(0, 400), ms: 0 });
      state = "blocked_by_policy";
      break;
    }
    let obs: StepObservation;
    try {
      counters.performedSteps += 1;   // a step actually reached the page layer (billing honesty for the all-blocked case)
      obs = await page.perform(exec);
    } catch (e) {
      obs = { action: exec.action, target: exec.target, ok: false, detail: `step_error: ${(e as Error).message}`.slice(0, 120), ms: 0 };
    }
    if (requested !== null && requested !== exec.target) {
      obs = { ...obs, detail: `${obs.detail} [requested ${requested}] [resolved ${exec.target}]`.slice(0, 400) };
    }
    steps.push(obs);
    // Stop the flow at the first failed step; an assertion/interaction that fails means the journey broke.
    if (!obs.ok) { state = "failed"; break; }
  }
  } finally {
    // The artifact sink also never keeps a filled-secret screenshot (suppression is reset per sign-in). The
    // active-credential redaction set is DELIBERATELY NOT cleared here: it must stay registered until AFTER
    // this flow's evidence is drained AND the flow result is persisted (executeRun clears the run's set right
    // after persistFlowResult), because Playwright delivers console events asynchronously — a password an app
    // echoes into the console right after submit can land in the evidence drained just below this finally, so
    // clearing here would scrub it too early. Run teardown (clearAllActiveCredentials) is the throw-safe net.
    page.screenshotsSuppressed = false;
  }

  // A worker/config auth failure supersedes the passed/failed derivation: the flow could not authenticate a
  // role it required, which is not an application defect. (blocked_by_policy already broke out above.)
  if (authConfigFailed && state !== "blocked_by_policy") state = "auth_config_failed";

  // Deterministic side-channel evidence for the whole flow.
  const consoleErrors = page.drainConsoleErrors();
  const networkFailures = page.drainNetworkFailures();
  // blocked_by_policy and auth_config_failed carry no severity: neither is evidence of an application defect.
  const severity: FlowResult["severity"] = state === "passed" || state === "blocked_by_policy" || state === "auth_config_failed" ? undefined : (flow.priority === "critical" ? "critical" : flow.priority === "important" ? "high" : "medium");

  const auth: AuthFlowMeta | undefined = requiresAuth ? {
    requiresAuth: true, roles: declaredRoles, accountLabel: activeAccountLabel, environment: activeEnvironment,
    credentialState, sessionReuse, verifiedAuthAt, authFailure,
  } : undefined;

  return { flowId: flow.flowId, state, severity, steps, evidence: { consoleErrors, networkFailures }, auth };
}

// Explainable decision: any critical flow that failed/blocked => blocked; else any failure => needs_review;
// else ready. Never an aggregate score.
//
// Coverage gate: READY is a LAUNCH decision, so it additionally requires FULL critical coverage — every
// enabled+approved critical flow of the contract executed against this run's own target. A passing run
// with partial coverage (a targeted rerun) proves its repair, not readiness: its decision is
// repair_verified. Failures keep their meaning at any coverage (a broken flow on the current target is
// real evidence either way). The summary records coverage so health selection and reports can tell a
// certification apart from a repair proof.
export function decideRun(results: FlowResult[], flows: FlowSpec[], fullCoverage = true): { decision: RunDecision; summary: Record<string, unknown> } {
  const critById = new Map(flows.map((f) => [f.flowId, f.priority === "critical"]));
  const criticalTotal = flows.filter((f) => f.priority === "critical").length;
  const criticalPassed = results.filter((r) => critById.get(r.flowId) && r.state === "passed").length;
  const criticalFailed = results.some((r) => critById.get(r.flowId) && (r.state === "failed" || r.state === "blocked"));
  const anyFailed = results.some((r) => r.state === "failed" || r.state === "blocked");
  // blocked_by_policy flows were NEVER executed, so they are excluded from failure evidence entirely.
  // But a policy-blocked CRITICAL flow means the launch decision is unverifiable: a human must widen the
  // boundary, so the decision softens to needs_review — never READY (unverified critical) and never
  // BLOCKED (the application did not fail anything).
  const policyBlocked = results.filter((r) => r.state === "blocked_by_policy");
  const criticalPolicyBlocked = policyBlocked.some((r) => critById.get(r.flowId));
  // auth_config_failed (S6): a role-requiring flow could not authenticate for a WORKER/ENVIRONMENT reason
  // (missing/revoked credential, vault failure, MFA/CAPTCHA, provider infra). Like blocked_by_policy it is
  // NEVER an application defect: excluded from failure evidence, and a CRITICAL one only softens to
  // needs_review (a human must fix the credential/vault) — never READY (unverified critical), never BLOCKED
  // (the app failed nothing). auth_rejected_by_app is a normal `failed` and is counted above.
  const authConfigFailed = results.filter((r) => r.state === "auth_config_failed");
  const criticalAuthConfigFailed = authConfigFailed.some((r) => critById.get(r.flowId));
  let decision: RunDecision = criticalFailed ? "blocked" : (anyFailed || criticalPolicyBlocked || criticalAuthConfigFailed) ? "needs_review" : "ready";
  if (decision === "ready" && !fullCoverage) decision = "repair_verified";
  return { decision, summary: {
    critical_total: criticalTotal, critical_passed: criticalPassed, flows_total: flows.length,
    flows_passed: results.filter((r) => r.state === "passed").length,
    blockers: results.filter((r) => critById.get(r.flowId) && r.state !== "passed" && r.state !== "blocked_by_policy" && r.state !== "auth_config_failed").length,
    policy_blocked: policyBlocked.length,
    auth_config_failed: authConfigFailed.length,
    coverage: fullCoverage ? "full" : "partial", selected_total: flows.length,
  } };
}

export async function executeRun(run: ClaimedRun, deps: ExecDeps): Promise<void> {
  const now = deps.now ?? (() => Date.now());
  const runDeadline = now() + deps.limits.maxRunMs;
  let executedAny = false;
  let session: Awaited<ReturnType<BrowserProvider["createSession"]>> | null = null;

  try {
    // Pre-execution invariant, BEFORE any browser is paid for: the first navigation must resolve onto the
    // run's snapshot target (same origin, every target query param honored). A violation is a harness bug:
    // abort as a terminal infrastructure failure with no session, no flows, no issues, and a full refund.
    if (run.deploymentUrl) {
      const firstNav = run.flows.flatMap((f) => f.steps).find((s) => s.action === "navigate");
      const resolvedFirst = resolveNavigationUrl(firstNav?.target || firstNav?.value || "", run.deploymentUrl);
      const violation = targetInvariantViolation(resolvedFirst, run.deploymentUrl);
      if (violation) throw new TargetMismatchError(violation);
    }

    await deps.store.setState(run.runId, "running");
    session = await deps.provider.createSession({ runId: run.runId, environment: run.environment, workerId: deps.workerId });
    await deps.store.setProviderSession(run.runId, deps.provider.name, session.providerSessionId);
    log({ worker_id: deps.workerId, run_id: run.runId, provider_session_id: session.providerSessionId, event: "session_created", result: "ok" });

    const results: FlowResult[] = [];
    const counters = { performedSteps: 0 };   // steps that actually reached the page (policy refusals never do)
    for (const flow of run.flows) {
      if (await deps.store.cancelRequested(run.runId)) throw new CancelledError();
      executedAny = true;
      const result = await runFlow(flow, session.page, deps, run.runId, runDeadline, run.deploymentUrl, run, counters);
      results.push(result);
      await deps.store.persistFlowResult(run.runId, result);      // incremental persistence
      // Clear this run's active-credential redaction set ONLY now — AFTER the flow's evidence was drained
      // (inside runFlow) and the result was persisted (the sink also redacts against the still-registered
      // values). Any async console echo of a password after submit is captured + scrubbed before this point.
      clearActiveCredentials(run.runId);
      // Evidence: capture the flow's final-state screenshot and upload it. Best-effort — an upload failure
      // (incl. a missing artifact bucket) is logged and never fails the run, whose decision is deterministic.
      // A screenshot is SKIPPED entirely while a secret is being entered (page.screenshotsSuppressed) so a
      // filled-password field can never be captured; suppression is reset after each sign-in, so the normal
      // final-state screenshot is unaffected. Defensive belt-and-suspenders check here too.
      if (deps.artifacts && !session.page.screenshotsSuppressed) {
        try {
          const shot = await session.page.captureScreenshot();
          if (shot) await deps.artifacts.saveScreenshot(run.runId, flow.flowId, shot);
        } catch (e) { log({ worker_id: deps.workerId, run_id: run.runId, flow_run_id: flow.flowId, event: "artifact_save_failed", result: (e as Error).message.slice(0, 80) }); }
      }
      log({ worker_id: deps.workerId, run_id: run.runId, flow_run_id: flow.flowId, event: "flow_done", result: result.state });
    }

    // If EVERY selected flow was refused by policy before ANY step executed, nothing ran at all: the run
    // fails terminally as blocked_by_policy with a full refund (nothing ran, nothing billed) instead of
    // pretending to decide anything. If even one step executed, the run finalizes normally (the executed
    // work is real and charged; policy-blocked flows soften the decision via decideRun).
    if (results.length > 0 && counters.performedSteps === 0 && results.every((r) => r.state === "blocked_by_policy")) {
      throw new PolicyBlockedError();
    }
    // If EVERY selected flow could not authenticate for a worker/config reason and NO application flow ever
    // passed or failed, nothing verifiable ran: fail terminally with the specific worker-config code and a
    // full refund. auth_rejected_by_app is a normal `failed` (it never reaches this branch). Vault/infra
    // failures consume nothing; a missing/revoked credential likewise verified nothing about the app.
    if (results.length > 0
        && results.every((r) => r.state === "auth_config_failed" || r.state === "blocked_by_policy")
        && results.some((r) => r.state === "auth_config_failed")
        && !results.some((r) => r.state === "passed" || r.state === "failed" || r.state === "blocked")) {
      const firstCode = results.map((r) => r.auth?.authFailure).find(Boolean) ?? "worker_vault_failure";
      throw new WorkerConfigFailedError(firstCode);
    }

    await deps.store.setState(run.runId, "analyzing");
    const { decision, summary } = decideRun(results, run.flows, run.fullCoverage !== false);
    await deps.store.finalizeRun(run.runId, decision, summary);   // atomic: decision + charge-on-completion
    log({ worker_id: deps.workerId, run_id: run.runId, event: "run_finalized", result: decision });
  } catch (e) {
    // Cancels / lost leases keep their exact codes; everything else is classified into a coarse, owner-safe
    // failure code (classifyProviderError NEVER puts a raw provider string in the code). The truncated real
    // message still rides along as failure_message, which is stored server-side only.
    const code = e instanceof CancelledError ? "cancelled"
      : e instanceof LeaseLostError ? "lease_lost"
      : e instanceof TargetMismatchError ? "target_mismatch"
      : e instanceof PolicyBlockedError ? "blocked_by_policy"
      : e instanceof WorkerConfigFailedError ? e.failureCode
      : classifyProviderError(e).code;
    // A failed cleanup must never strand the run: failRun requeues (attempts remain) or fails terminally,
    // and refunds the reservation when no flow ran. blocked_by_policy and a worker-config auth failure both
    // mean NO application work was verifiably billable (verified above), so they are reported as
    // not-executed to guarantee the full refund. Nothing about the application was validated either way.
    const executed = (e instanceof PolicyBlockedError || e instanceof WorkerConfigFailedError) ? false : executedAny;
    const message = e instanceof PolicyBlockedError
      ? "Every selected flow was refused by this application's test boundaries before any step executed. Widen the boundaries and run again. Nothing was charged."
      : e instanceof WorkerConfigFailedError
      ? "Vraelis could not authenticate the roles these flows require, so no application work ran. Check the test-account credentials and worker configuration. Nothing was charged."
      : (e as Error).message.slice(0, 200);
    await deps.store.failRun(run.runId, code, message, executed);
    log({ worker_id: deps.workerId, run_id: run.runId, event: "run_failed", result: code });
  } finally {
    // Run teardown, throw-safe: clear this run's active-credential redaction set no matter how the run exits
    // (a mid-flow throw skips the per-flow clear above). Scoped to this run so a concurrent run is untouched.
    clearActiveCredentials(run.runId);
    // Always close the provider session; a close failure is logged, never thrown (would strand the run).
    if (session) { try { await session.close(); } catch (e) { log({ worker_id: deps.workerId, run_id: run.runId, event: "session_close_failed", result: (e as Error).message.slice(0, 80) }); } }
  }
}
