// The run executor. Given a claimed run, it opens ONE isolated browser session via the provider, executes
// each approved flow's bounded semantic steps, records DETERMINISTIC observations (never an AI verdict),
// derives each flow's pass/fail and the run decision by explainable rules, persists incrementally, and
// finalizes. The session is always closed in a finally, and a lost lease / requested cancel aborts
// browser work immediately (checked before every step via the ownership-checked heartbeat). No AI here.
import type { BrowserProvider, RunStore, ClaimedRun, FlowResult, FlowSpec, RunDecision, StepObservation } from "./types";
import { log } from "./redaction";

export type ExecLimits = { leaseSecs: number; maxRunMs: number; maxFlowMs: number; maxStepsPerFlow: number };
export type ExecDeps = { store: RunStore; provider: BrowserProvider; workerId: string; limits: ExecLimits; now?: () => number };

export class LeaseLostError extends Error { constructor() { super("lease_lost"); } }
export class CancelledError extends Error { constructor() { super("cancelled"); } }

async function runFlow(flow: FlowSpec, page: import("./types").PreflightPage, deps: ExecDeps, runId: string, runDeadline: number): Promise<FlowResult> {
  const now = deps.now ?? (() => Date.now());
  const steps: StepObservation[] = [];
  const flowDeadline = Math.min(now() + flow.maxMs, runDeadline);
  const boundedSteps = flow.steps.slice(0, deps.limits.maxStepsPerFlow);
  let state: FlowResult["state"] = "passed";

  for (const step of boundedSteps) {
    // Heartbeat BEFORE each step: extends the lease if we still own it, aborts if we lost it / cancel.
    if (!(await deps.store.heartbeat(runId, deps.workerId, deps.limits.leaseSecs))) {
      throw (await deps.store.cancelRequested(runId)) ? new CancelledError() : new LeaseLostError();
    }
    if (now() > flowDeadline) { steps.push({ action: step.action, ok: false, detail: "flow_timeout", ms: 0 }); state = "blocked"; break; }
    let obs: StepObservation;
    try {
      obs = await page.perform(step);
    } catch (e) {
      obs = { action: step.action, target: step.target, ok: false, detail: `step_error: ${(e as Error).message}`.slice(0, 120), ms: 0 };
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
export function decideRun(results: FlowResult[], flows: FlowSpec[]): { decision: RunDecision; summary: Record<string, unknown> } {
  const critById = new Map(flows.map((f) => [f.flowId, f.priority === "critical"]));
  const criticalTotal = flows.filter((f) => f.priority === "critical").length;
  const criticalPassed = results.filter((r) => critById.get(r.flowId) && r.state === "passed").length;
  const criticalFailed = results.some((r) => critById.get(r.flowId) && (r.state === "failed" || r.state === "blocked"));
  const anyFailed = results.some((r) => r.state === "failed" || r.state === "blocked");
  const decision: RunDecision = criticalFailed ? "blocked" : anyFailed ? "needs_review" : "ready";
  return { decision, summary: { critical_total: criticalTotal, critical_passed: criticalPassed, flows_total: flows.length, flows_passed: results.filter((r) => r.state === "passed").length, blockers: results.filter((r) => critById.get(r.flowId) && r.state !== "passed").length } };
}

export async function executeRun(run: ClaimedRun, deps: ExecDeps): Promise<void> {
  const now = deps.now ?? (() => Date.now());
  const runDeadline = now() + deps.limits.maxRunMs;
  let executedAny = false;
  let session: Awaited<ReturnType<BrowserProvider["createSession"]>> | null = null;

  try {
    await deps.store.setState(run.runId, "running");
    session = await deps.provider.createSession({ runId: run.runId, environment: run.environment, workerId: deps.workerId });
    await deps.store.setProviderSession(run.runId, deps.provider.name, session.providerSessionId);
    log({ worker_id: deps.workerId, run_id: run.runId, provider_session_id: session.providerSessionId, event: "session_created", result: "ok" });

    const results: FlowResult[] = [];
    for (const flow of run.flows) {
      if (await deps.store.cancelRequested(run.runId)) throw new CancelledError();
      executedAny = true;
      const result = await runFlow(flow, session.page, deps, run.runId, runDeadline);
      results.push(result);
      await deps.store.persistFlowResult(run.runId, result);      // incremental persistence
      log({ worker_id: deps.workerId, run_id: run.runId, flow_run_id: flow.flowId, event: "flow_done", result: result.state });
    }

    await deps.store.setState(run.runId, "analyzing");
    const { decision, summary } = decideRun(results, run.flows);
    await deps.store.finalizeRun(run.runId, decision, summary);   // atomic: decision + charge-on-completion
    log({ worker_id: deps.workerId, run_id: run.runId, event: "run_finalized", result: decision });
  } catch (e) {
    const code = e instanceof CancelledError ? "cancelled" : e instanceof LeaseLostError ? "lease_lost" : "run_error";
    // A failed cleanup must never strand the run: failRun requeues (attempts remain) or fails terminally,
    // and refunds the reservation when no flow ran.
    await deps.store.failRun(run.runId, code, (e as Error).message.slice(0, 200), executedAny);
    log({ worker_id: deps.workerId, run_id: run.runId, event: "run_failed", result: code });
  } finally {
    // Always close the provider session; a close failure is logged, never thrown (would strand the run).
    if (session) { try { await session.close(); } catch (e) { log({ worker_id: deps.workerId, run_id: run.runId, event: "session_close_failed", result: (e as Error).message.slice(0, 80) }); } }
  }
}
