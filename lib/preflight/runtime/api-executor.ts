// Customer API-runtime executor (API beta) — runs a real customer's API verification INLINE (like the
// founder canary route, but parameterized for a real app/target/flows), then persists a terminal-state run at
// the migration-12 decision grain. It does NOT import canary.ts: it composes the SAME proven primitives
// directly (runApiFlow + decideRuntime + the safe-fetch fetcher pattern), so the founder canary and the
// customer path share the engine, not the orchestration.
//
// Everything is dependency-injected (fetcher, secret resolver, store, clock) so the whole flow rehearses
// OFFLINE with zero network / zero DB / zero spend (scripts/preflight-api-beta-verify.ts). In production the
// route injects safeFetch, the vault resolver, and the Supabase store.
//
// SAFETY the executor guarantees:
//   * Secrets are resolved to the adapter's in-memory secret map ONLY; never persisted, logged, or returned.
//   * Evidence is already redacted by the adapter (maskHeaders/sanitizeBody/growing secretValues) before it
//     reaches the store; the executor never un-redacts.
//   * A run is ALWAYS inserted terminal-state (completed/failed) — never "queued" — so the Railway worker's
//     v_preflight_claim (state='queued') can never pick a customer API run up as a browser job.
//   * Failure classification: transport "unreachable" -> infra (never a counterfeit BLOCKED, never billed);
//     "blocked" (safe-fetch SSRF guard) -> indeterminate; else product. Identical rule to the canary.

import { runApiFlow, type ApiStep, type ApiFetch } from "./api-adapter";
import { decideRuntime } from "./decide";
import type { Decision, FailureClass, FlowResult, StepObservation } from "./core";
import { mapToApiStep, type ApiFlowStep, type ResolvedCredential } from "./api-steps";

export const API_BETA_ADAPTER_VERSION = "api-1";
export const API_BETA_CONTRACT_VERSION = 1;

// One authored customer flow to execute.
export type ApiCustomerFlow = {
  id: string;                 // v_test_flows id
  name: string;
  critical: boolean;          // priority === "critical"
  steps: ApiFlowStep[];       // CUSTOMER vocabulary (translated to ApiStep at launch, here)
};

// Resolves a credential LABEL to the adapter's secretRef + scheme + the ACTUAL secret value. The secretRef is
// what the adapter's ApiStep carries; the value is injected into the adapter's `secrets` map keyed by that
// ref. The value never leaves this executor's scope.
export type CredentialResolution = ResolvedCredential & { value: string };
export type SecretResolver = (label: string) => CredentialResolution | null;

// The persistence surface (injected). The live implementation writes migration-12 rows for a REAL app/target;
// the test implementation records in memory. Deliberately NOT the canary's CanaryStore (that is scoped to the
// synthetic founder app) — a thin sibling addressed to the customer's own app/target.
export type ApiRunStore = {
  insertTerminalRun(row: {
    owner: string; appId: string; targetId: string; buildId: string; state: "completed" | "failed";
    decision: Decision | null; summary: Record<string, unknown>; deploymentUrl: string; submissionId: string;
    creditsHeld: number;
  }): Promise<string>;
  insertStepRows(runId: string, flows: { flowId: string; name: string; state: FlowResult["state"]; steps: StepObservation[] }[]): Promise<void>;
  insertDecision(row: {
    owner: string; appId: string; targetId: string; buildId: string; runId: string;
    decision: Decision; failureClass: FailureClass | null; matrixHash: string; summary: Record<string, unknown>;
  }): Promise<string>;
  openIssues(appId: string, targetId: string): Promise<{ id: string; category: string | null }[]>;
  openIssue(row: { owner: string; appId: string; targetId: string; runId: string; category: string; title: string; expected: string; observed: string; evidence: Record<string, unknown> }): Promise<string>;
  resolveIssue(issueId: string, runId: string): Promise<void>;
  continueIssue(issueId: string, runId: string): Promise<void>;
  recordUsage(owner: string, runId: string, apiRequests: number): Promise<void>;
};

export type ExecuteApiRunInput = {
  owner: string;
  appId: string;
  targetId: string;
  buildId: string;
  baseUrl: string;
  flows: ApiCustomerFlow[];
  fullCoverage: boolean;              // false for a targeted rerun (a partial rerun can never mint READY)
  creditsHeld: number;               // what the route held; persisted onto the run
  submissionId: string;
  fetcher: ApiFetch;                 // production = safeFetch wrapper (SSRF-safe); test = in-memory
  resolveSecret: SecretResolver;
  store: ApiRunStore;
  clock: () => number;
};

export type ExecuteApiRunResult = {
  runId: string;
  decision: Decision | null;
  failureClass: FailureClass | null;
  state: "completed" | "failed";
  chargedFullHold: boolean;          // true = keep the hold (charge); false = the route must REFUND
  apiRequests: number;
  flows: { id: string; name: string; state: FlowResult["state"] }[];
  issues: { opened: string[]; resolved: string[]; continued: string[] };
  matrixHash: string;
  leakScan: "clean" | "LEAK_DETECTED";
};

function matrixHashFor(flowIds: string[]): string {
  const str = JSON.stringify([API_BETA_ADAPTER_VERSION, ...flowIds]);
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return `mx_${(h >>> 0).toString(16)}`;
}

export async function executeApiRun(input: ExecuteApiRunInput): Promise<ExecuteApiRunResult> {
  // Collect the secret values referenced by any sign_in step, so the leak-scan can look for them.
  const secretValues = new Set<string>();
  let apiRequests = 0;
  const countingFetcher: ApiFetch = async (url, init) => { apiRequests++; return input.fetcher(url, init); };

  const results: FlowResult[] = [];
  const evidenceByFlow: { flowId: string; name: string; state: FlowResult["state"]; steps: StepObservation[] }[] = [];
  const failedTransport = new Map<string, "unreachable" | "blocked" | undefined>();
  const failedDetail = new Map<string, string>();

  for (const flow of input.flows) {
    // Translate customer vocabulary -> internal ApiStep at LAUNCH time. A step referencing a missing
    // credential resolves to null -> the flow can't run -> it fails (auth-not-ready), never a silent pass.
    const secretsForFlow: Record<string, string> = {};
    let translationFailed = false;
    const apiSteps: ApiStep[] = [];
    for (const cs of flow.steps) {
      const step = mapToApiStep(cs, (label) => {
        const r = input.resolveSecret(label);
        if (r) { secretsForFlow[r.secretRef] = r.value; if (r.value) secretValues.add(r.value); }
        return r ? { secretRef: r.secretRef, scheme: r.scheme, ...(r.headerName ? { headerName: r.headerName } : {}) } : null;
      });
      if (step === null) { translationFailed = true; break; }
      apiSteps.push(step);
    }
    if (translationFailed) {
      results.push({ flowId: flow.id, state: "auth_not_ready", steps: [] });
      evidenceByFlow.push({ flowId: flow.id, name: flow.name, state: "auth_not_ready", steps: [] });
      continue;
    }

    const r = await runApiFlow({ baseUrl: input.baseUrl, steps: apiSteps, secrets: secretsForFlow, fetcher: countingFetcher, clock: input.clock });
    const state: FlowResult["state"] = r.ok ? "passed" : "failed";
    results.push({ flowId: flow.id, state, steps: r.steps });
    evidenceByFlow.push({ flowId: flow.id, name: flow.name, state, steps: r.steps });
    if (!r.ok && r.failedIndex != null) {
      failedDetail.set(flow.id, r.steps[r.failedIndex]?.detail ?? "failed");
      failedTransport.set(flow.id, r.steps[r.failedIndex]?.transport);
    }
  }

  // Failure classification (structural transport tag; never string-matched). Identical rule to the canary.
  const failedFlows = results.filter((r) => r.state === "failed").map((r) => r.flowId);
  const transports = failedFlows.map((id) => failedTransport.get(id));
  let failureClass: FailureClass | null = null;
  if (failedFlows.length > 0) {
    if (transports.every((t) => t === "unreachable")) failureClass = "infra";
    else if (transports.every((t) => t === "unreachable" || t === "blocked")) failureClass = "indeterminate";
  }

  const criticalFlowIds = new Set(input.flows.filter((f) => f.critical).map((f) => f.id));
  const { decision, summary } = decideRuntime({ results, criticalFlowIds, fullCoverage: input.fullCoverage, failureClass: failureClass ?? undefined });
  const flowIds = input.flows.map((f) => f.id);
  const matrixHash = matrixHashFor(flowIds);
  const fullSummary = {
    ...summary, flows_total: results.length, api_requests: apiRequests, matrix_hash: matrixHash,
    adapter_version: API_BETA_ADAPTER_VERSION,
  };

  // A run that made ZERO real requests (every flow auth-not-ready / capability-rejected) did no productive
  // work -> the route must REFUND. An infra run also refunds (an infrastructure failure costs nothing).
  const anyProductiveWork = apiRequests > 0 && failureClass !== "infra";
  const runState: "completed" | "failed" = failureClass === "infra" ? "failed" : "completed";

  // Persist terminal-state run (NEVER queued) + per-step evidence + decision.
  const runId = await input.store.insertTerminalRun({
    owner: input.owner, appId: input.appId, targetId: input.targetId, buildId: input.buildId, state: runState,
    decision, summary: fullSummary, deploymentUrl: input.baseUrl, submissionId: input.submissionId, creditsHeld: input.creditsHeld,
  });
  await input.store.insertStepRows(runId, evidenceByFlow);
  await input.store.insertDecision({
    owner: input.owner, appId: input.appId, targetId: input.targetId, buildId: input.buildId, runId,
    decision: decision ?? "not_verified", failureClass, matrixHash, summary: fullSummary,
  });

  // Issue lineage, scoped by (application, runtime_target) — PRODUCT failures only; infra touches no lineage.
  const issues = { opened: [] as string[], resolved: [] as string[], continued: [] as string[] };
  if (failureClass == null) {
    const executed = results.filter((r) => r.state === "passed" || r.state === "failed");
    const open = await input.store.openIssues(input.appId, input.targetId);
    const byCategory = new Map(open.map((i) => [i.category ?? "", i]));
    for (const r of executed) {
      const existing = byCategory.get(r.flowId);
      if (r.state === "passed" && existing) { await input.store.resolveIssue(existing.id, runId); issues.resolved.push(existing.id); }
      else if (r.state === "failed" && existing) { await input.store.continueIssue(existing.id, runId); issues.continued.push(existing.id); }
      else if (r.state === "failed") {
        const flow = input.flows.find((f) => f.id === r.flowId);
        const id = await input.store.openIssue({
          owner: input.owner, appId: input.appId, targetId: input.targetId, runId, category: r.flowId,
          title: `${flow?.name ?? r.flowId} did not pass`,
          expected: flow?.name ?? r.flowId, observed: failedDetail.get(r.flowId) ?? "a check failed",
          evidence: { failed_step: failedDetail.get(r.flowId) ?? null },
        });
        issues.opened.push(id);
      }
    }
  }

  if (anyProductiveWork) await input.store.recordUsage(input.owner, runId, apiRequests);

  // Leak scan (belt-and-braces): no referenced secret value may appear in persisted evidence/summary.
  const persistedBlob = JSON.stringify({ evidenceByFlow, fullSummary });
  const leaked = [...secretValues].some((v) => v && persistedBlob.includes(v));

  return {
    runId, decision, failureClass, state: runState, chargedFullHold: anyProductiveWork, apiRequests,
    flows: results.map((r) => ({ id: r.flowId, name: input.flows.find((f) => f.id === r.flowId)?.name ?? r.flowId, state: r.state })),
    issues, matrixHash, leakScan: leaked ? "LEAK_DETECTED" : "clean",
  };
}
