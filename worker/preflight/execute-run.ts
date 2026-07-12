// The run executor. Given a claimed run, it opens ONE isolated browser session via the provider, executes
// each approved flow's bounded semantic steps, records DETERMINISTIC observations (never an AI verdict),
// derives each flow's pass/fail and the run decision by explainable rules, persists incrementally, and
// finalizes. The session is always closed in a finally, and a lost lease / requested cancel aborts
// browser work immediately (checked before every step via the ownership-checked heartbeat). No AI here.
import type { BrowserProvider, RunStore, ClaimedRun, FlowResult, FlowSpec, RunDecision, StepObservation, ArtifactSink } from "./types";
import { classifyProviderError } from "./provider-errors";
import { resolveNavigationUrl, targetInvariantViolation } from "../../lib/preflight/target-url";
import { log } from "./redaction";

export type ExecLimits = { leaseSecs: number; maxRunMs: number; maxFlowMs: number; maxStepsPerFlow: number };
export type ExecDeps = { store: RunStore; provider: BrowserProvider; workerId: string; limits: ExecLimits; now?: () => number; artifacts?: ArtifactSink };

export class LeaseLostError extends Error { constructor() { super("lease_lost"); } }
export class CancelledError extends Error { constructor() { super("cancelled"); } }
// The run's snapshot target could not be honored (a Vraelis harness bug, NEVER an application blocker):
// the run aborts as an infrastructure failure before any browser work, is terminal (retrying a
// deterministic resolution bug cannot heal it), opens no issues, and refunds the reservation.
export class TargetMismatchError extends Error { constructor(reason: string) { super(`target_mismatch: ${reason}`); } }

async function runFlow(flow: FlowSpec, page: import("./types").PreflightPage, deps: ExecDeps, runId: string, runDeadline: number, targetUrl: string): Promise<FlowResult> {
  const now = deps.now ?? (() => Date.now());
  const steps: StepObservation[] = [];
  const flowDeadline = Math.min(now() + flow.maxMs, runDeadline);
  const boundedSteps = flow.steps.slice(0, deps.limits.maxStepsPerFlow);
  let state: FlowResult["state"] = "passed";

  // Set this flow's viewport before its steps: mobile flows run narrow so viewport-gated defects (e.g. a
  // nav overlay covering the primary action) reproduce; desktop flows run wide. Non-fatal on failure.
  if (flow.viewport) { try { await page.setViewport(flow.viewport.width, flow.viewport.height); } catch { /* non-fatal */ } }

  for (const step of boundedSteps) {
    // Heartbeat BEFORE each step: extends the lease if we still own it, aborts if we lost it / cancel.
    if (!(await deps.store.heartbeat(runId, deps.workerId, deps.limits.leaseSecs))) {
      throw (await deps.store.cancelRequested(runId)) ? new CancelledError() : new LeaseLostError();
    }
    if (now() > flowDeadline) { steps.push({ action: step.action, ok: false, detail: "flow_timeout", ms: 0 }); state = "blocked"; break; }
    // Navigations are REBASED onto the current run target at execution time: the stored step keeps its
    // route intent, the run snapshot supplies origin + winning query params. The step the browser actually
    // executes carries the resolved URL, and the observation records requested vs resolved vs final.
    let exec = step;
    let requested: string | null = null;
    if (step.action === "navigate") {
      requested = step.target || step.value || "";
      exec = { ...step, target: resolveNavigationUrl(requested, targetUrl), value: undefined };
    }
    let obs: StepObservation;
    try {
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

  // Deterministic side-channel evidence for the whole flow.
  const consoleErrors = page.drainConsoleErrors();
  const networkFailures = page.drainNetworkFailures();
  const severity: FlowResult["severity"] = state === "passed" ? undefined : (flow.priority === "critical" ? "critical" : flow.priority === "important" ? "high" : "medium");
  return { flowId: flow.flowId, state, severity, steps, evidence: { consoleErrors, networkFailures } };
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
  let decision: RunDecision = criticalFailed ? "blocked" : anyFailed ? "needs_review" : "ready";
  if (decision === "ready" && !fullCoverage) decision = "repair_verified";
  return { decision, summary: {
    critical_total: criticalTotal, critical_passed: criticalPassed, flows_total: flows.length,
    flows_passed: results.filter((r) => r.state === "passed").length,
    blockers: results.filter((r) => critById.get(r.flowId) && r.state !== "passed").length,
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
    for (const flow of run.flows) {
      if (await deps.store.cancelRequested(run.runId)) throw new CancelledError();
      executedAny = true;
      const result = await runFlow(flow, session.page, deps, run.runId, runDeadline, run.deploymentUrl);
      results.push(result);
      await deps.store.persistFlowResult(run.runId, result);      // incremental persistence
      // Evidence: capture the flow's final-state screenshot and upload it. Best-effort — an upload failure
      // (incl. a missing artifact bucket) is logged and never fails the run, whose decision is deterministic.
      if (deps.artifacts) {
        try {
          const shot = await session.page.captureScreenshot();
          if (shot) await deps.artifacts.saveScreenshot(run.runId, flow.flowId, shot);
        } catch (e) { log({ worker_id: deps.workerId, run_id: run.runId, flow_run_id: flow.flowId, event: "artifact_save_failed", result: (e as Error).message.slice(0, 80) }); }
      }
      log({ worker_id: deps.workerId, run_id: run.runId, flow_run_id: flow.flowId, event: "flow_done", result: result.state });
    }

    await deps.store.setState(run.runId, "analyzing");
    const { decision, summary } = decideRun(results, run.flows, run.fullCoverage !== false);
    await deps.store.finalizeRun(run.runId, decision, summary);   // atomic: decision + charge-on-completion
    log({ worker_id: deps.workerId, run_id: run.runId, event: "run_finalized", result: decision });
  } catch (e) {
    // Cancels / lost leases keep their exact codes; everything else is classified into a coarse, owner-safe
    // failure code (classifyProviderError NEVER puts a raw provider string in the code). The truncated real
    // message still rides along as failure_message, which is stored server-side only.
    const code = e instanceof CancelledError ? "cancelled" : e instanceof LeaseLostError ? "lease_lost" : e instanceof TargetMismatchError ? "target_mismatch" : classifyProviderError(e).code;
    // A failed cleanup must never strand the run: failRun requeues (attempts remain) or fails terminally,
    // and refunds the reservation when no flow ran.
    await deps.store.failRun(run.runId, code, (e as Error).message.slice(0, 200), executedAny);
    log({ worker_id: deps.workerId, run_id: run.runId, event: "run_failed", result: code });
  } finally {
    // Always close the provider session; a close failure is logged, never thrown (would strand the run).
    if (session) { try { await session.close(); } catch (e) { log({ worker_id: deps.workerId, run_id: run.runId, event: "session_close_failed", result: (e as Error).message.slice(0, 80) }); } }
  }
}
