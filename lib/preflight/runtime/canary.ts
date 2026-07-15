// Live API canary orchestration — Phase 4 of the controlled integration (founder-approved plan).
//
// Runs the first-party fixture flows through the REAL production execution chain — safeFetch over live
// HTTPS, the pure api-adapter state machine, decideRuntime — and persists REAL rows at the migration-12
// decision grain: v_runtime_targets (api/canary), v_builds, v_preflight_runs (inserted terminal-state so the
// Railway worker's queue claim can NEVER pick an API run up as a browser job), v_platform_decisions (full
// binding: target+build+environment+contract_version+matrix+adapter), v_issues (lineage scoped by
// runtime_target per the redline), and v_cost_ledger (exactly one usage row per executed run).
//
// Every dependency (fetcher, store, clock, base URL) is injected so the whole thing rehearses OFFLINE with
// zero network and zero DB writes (scripts/preflight-api-canary-surface-verify.ts) before it ever runs live.
//
// Phases map to the founder's required proofs:
//   broken     -> genuine failing persistence assertion -> BLOCKED + issue opened (product failure)
//   repair     -> targeted rerun of ONLY the failed flow -> REPAIR VERIFIED (never a false READY) + issue resolved
//   fixed      -> full matrix passes -> READY (full coverage)
//   capability -> an unsupported (browser) step is rejected BEFORE any request or billing
//   infra      -> unreachable host -> INFRA FAILURE (never a counterfeit product BLOCKED), no billing
//   cancel     -> a run settles as cancelled: no decision row, no usage row

import { runApiFlow, API_CAPABILITIES, type ApiStep, type ApiFetch } from "./api-adapter";
import { decideRuntime } from "./decide";
import type { Decision, FailureClass, FlowResult, StepObservation } from "./core";

export type CanaryPhase = "broken" | "repair" | "fixed" | "capability" | "infra" | "cancel";
export const CANARY_PHASES: readonly CanaryPhase[] = ["broken", "repair", "fixed", "capability", "infra", "cancel"];
export const CANARY_ADAPTER_VERSION = API_CAPABILITIES.version;   // "api-1"
export const CANARY_CONTRACT_VERSION = 1;
export const CANARY_APP_NAME = "API Canary (internal)";
// A machine marker no human-created app carries — the canary matches its own app on THIS, never on name
// alone (a founder could coincidentally name a real app "API Canary (internal)"; they'd never set this URL).
export const CANARY_APP_URL = "https://internal.vraelis.local/__api-canary__";

// ── The canary contract: requirements expressed as flows over the first-party fixture ────────────────
// A step may be an ApiStep OR an intentionally-unsupported step (the capability phase) — the gate below
// rejects anything whose action the API adapter does not declare, BEFORE any request is made.
type CanaryStep = ApiStep | { action: string };
export type CanaryFlow = { id: string; title: string; critical: boolean; steps: CanaryStep[] };

const AUTH_PREFIX: ApiStep[] = [
  { action: "http_request", method: "POST", path: "/login", body: { password: "{{secret:CANARY_PASSWORD}}" } },
  { action: "assert_status", equals: 200 },
  { action: "extract", path: "$.token", into: "TOKEN" },
  { action: "set_header", name: "Authorization", value: "Bearer {{var:TOKEN}}" },
];

export const CANARY_FLOWS: CanaryFlow[] = [
  {
    id: "health", title: "API reports healthy", critical: true,
    steps: [
      { action: "http_request", method: "GET", path: "/health" },
      { action: "assert_status", equals: 200 },
      { action: "assert_json", path: "$.ok", equals: true },
    ],
  },
  {
    id: "auth", title: "Authenticated requests are accepted", critical: true,
    steps: [
      ...AUTH_PREFIX,
      { action: "http_request", method: "GET", path: "/echo-auth" },
      { action: "assert_status", equals: 200 },
      { action: "assert_json", path: "$.authed", equals: true },
    ],
  },
  {
    id: "persistence", title: "Created projects persist", critical: true,
    steps: [
      ...AUTH_PREFIX,
      { action: "set_header", name: "Idempotency-Key", value: "canary-persist-1" },
      { action: "http_request", method: "POST", path: "/projects", body: { name: "Canary Project" } },
      { action: "assert_status", equals: 201 },
      { action: "extract", path: "$.id", into: "PID" },
      { action: "extract", path: "$.sig", into: "SIG" },
      { action: "verify_persisted", path: "/projects/{{var:PID}}?sig={{var:SIG}}", jsonPath: "$.persisted", equals: true },
    ],
  },
  {
    id: "authz", title: "Admin surface requires authorization", critical: false,
    steps: [
      { action: "http_request", method: "GET", path: "/admin/metrics" },
      { action: "assert_status", equals: 401 },
      ...AUTH_PREFIX,
      { action: "http_request", method: "GET", path: "/admin/metrics" },
      { action: "assert_status", equals: 200 },
    ],
  },
  {
    id: "redirect_containment", title: "Redirects are surfaced, never followed", critical: false,
    steps: [
      ...AUTH_PREFIX,
      { action: "http_request", method: "GET", path: "/redirect-away" },
      { action: "assert_status", equals: 302 },
    ],
  },
];
// A browser-only flow the API adapter must reject at the capability gate (never executed, never billed).
const CAPABILITY_PROBE: CanaryFlow = {
  id: "browser_click_probe", title: "Browser step against the API runtime (must be rejected)", critical: true,
  steps: [{ action: "click" }, { action: "assert_visible" }],
};

// Stable hash of what this matrix covers (flows + adapter) — part of the decision binding.
export function canaryMatrixHash(flowIds: string[]): string {
  const s = JSON.stringify([CANARY_ADAPTER_VERSION, ...flowIds]);
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `mx_${(h >>> 0).toString(16)}`;
}

// ── Injected persistence (live = Supabase service role; rehearsal = in-memory) ──────────────────────
export type CanaryIssueRow = {
  id: string; category: string | null; status: string;
  first_seen_run: string | null; last_seen_run: string | null; resolved_run: string | null;
};
export type CanaryStore = {
  ensureApp(owner: string): Promise<string>;
  ensureApiTarget(owner: string, appId: string): Promise<string>;
  insertBuild(owner: string, targetId: string, baseUrl: string, phase: CanaryPhase): Promise<string>;
  insertTerminalRun(row: {
    owner: string; appId: string; targetId: string; phase: CanaryPhase; state: "completed" | "cancelled";
    decision: Decision | null; summary: Record<string, unknown>; deploymentUrl: string; submissionId: string;
  }): Promise<string>;
  insertDecision(row: {
    owner: string; appId: string; targetId: string; buildId: string; runId: string;
    decision: Decision; failureClass: FailureClass | null; contractVersion: number; matrixHash: string;
    summary: Record<string, unknown>;
  }): Promise<string>;
  openIssues(appId: string, targetId: string): Promise<CanaryIssueRow[]>;
  openIssue(row: {
    owner: string; appId: string; targetId: string; runId: string; category: string; title: string;
    expected: string; observed: string; evidence: Record<string, unknown>;
  }): Promise<string>;
  resolveIssue(issueId: string, runId: string): Promise<void>;
  continueIssue(issueId: string, runId: string): Promise<void>;
  recordUsage(owner: string, runId: string, apiRequests: number): Promise<void>;
  ledgerCount(runId: string): Promise<number>;
  webSnapshot(appId: string, apiTargetId: string): Promise<{ runId: string; decision: string | null } | null>;
};

export type CanaryDeps = {
  owner: string;                                   // lowercased founder email (tenancy key)
  fetcher: ApiFetch;                               // live = safeFetch wrapper; rehearsal = fixture direct-call
  store: CanaryStore;
  clock: () => number;
  fixtureBase: (mode: "broken" | "fixed") => string;   // absolute base URL of the fixture for a mode
  secrets: Record<string, string>;                 // { CANARY_PASSWORD } — decrypted/injected ONLY here, at execution time
};

export type CanaryPhaseResult = {
  phase: CanaryPhase;
  mode: "broken" | "fixed" | "none";
  decision: Decision | null;
  failureClass: FailureClass | null;
  summary: Record<string, unknown>;
  appId: string; targetId: string; buildId: string | null; runId: string;
  matrixHash: string;
  binding: { runtimeKind: "api"; environment: "canary"; contractVersion: number; adapterVersion: string };
  flows: { id: string; state: FlowResult["state"]; failedStepDetail: string | null }[];
  issues: { opened: string[]; resolved: string[]; continued: string[] };
  apiRequests: number;
  ledgerRows: number;
  leakScan: "clean" | "LEAK_DETECTED";
  web: { before: { runId: string; decision: string | null } | null; after: { runId: string; decision: string | null } | null };
  evidence: { flowId: string; steps: StepObservation[] }[];
};

// Per-phase config: which flows run + which fixture mode. Coverage is NOT set here — it is DERIVED from the
// flows a phase actually runs vs the full critical set (see runCanaryPhase), so a partial phase can never
// accidentally be flagged full.
const PHASE_CONFIG: Record<Exclude<CanaryPhase, "cancel">, { flows: CanaryFlow[]; mode: "broken" | "fixed" }> = {
  broken: { flows: CANARY_FLOWS, mode: "broken" },
  repair: { flows: CANARY_FLOWS.filter((f) => f.id === "persistence"), mode: "fixed" },
  fixed: { flows: CANARY_FLOWS, mode: "fixed" },
  capability: { flows: [CAPABILITY_PROBE], mode: "fixed" },
  infra: { flows: CANARY_FLOWS.filter((f) => f.id === "health"), mode: "fixed" },
};

export async function runCanaryPhase(deps: CanaryDeps, phase: CanaryPhase): Promise<CanaryPhaseResult> {
  const appId = await deps.store.ensureApp(deps.owner);
  const targetId = await deps.store.ensureApiTarget(deps.owner, appId);
  const webBefore = await deps.store.webSnapshot(appId, targetId);
  const submissionId = `api-canary:${phase}:${deps.clock()}`;

  // ── cancel: a run settles as cancelled — no execution, no decision row, no usage row ──
  if (phase === "cancel") {
    const runId = await deps.store.insertTerminalRun({
      owner: deps.owner, appId, targetId, phase, state: "cancelled", decision: null,
      summary: { phase, cancelled: true }, deploymentUrl: deps.fixtureBase("fixed"), submissionId,
    });
    return {
      phase, mode: "none", decision: null, failureClass: null, summary: { phase, cancelled: true },
      appId, targetId, buildId: null, runId, matrixHash: canaryMatrixHash([]),
      binding: { runtimeKind: "api", environment: "canary", contractVersion: CANARY_CONTRACT_VERSION, adapterVersion: CANARY_ADAPTER_VERSION },
      flows: [], issues: { opened: [], resolved: [], continued: [] }, apiRequests: 0,
      ledgerRows: await deps.store.ledgerCount(runId), leakScan: "clean",
      web: { before: webBefore, after: await deps.store.webSnapshot(appId, targetId) }, evidence: [],
    };
  }

  const cfg = PHASE_CONFIG[phase];
  // The infra phase targets an unreachable host — a TRANSPORT failure, distinct from any product signal.
  const baseUrl = phase === "infra" ? "https://canary-unreachable.invalid" : deps.fixtureBase(cfg.mode);

  // Count real requests so "fails before billing" is provable (capability phase must show zero).
  let apiRequests = 0;
  const countingFetcher: ApiFetch = async (url, init) => { apiRequests++; return deps.fetcher(url, init); };

  const results: FlowResult[] = [];
  const evidence: { flowId: string; steps: StepObservation[] }[] = [];
  const failedDetail = new Map<string, string>();
  // The STRUCTURAL transport tag of each failing flow's failing step (never parsed from `detail`):
  //   "unreachable" -> genuine transport failure (DNS/connect) -> infra.
  //   "blocked"     -> the safe-fetch SSRF guard rejected the target (app served over http / private host)
  //                    -> a PRODUCT/security signal, classified indeterminate (needs_review), never free infra.
  //   undefined     -> a normal assertion failure -> product.
  const failedTransport = new Map<string, "unreachable" | "blocked" | undefined>();

  for (const flow of cfg.flows) {
    // Capability gate FIRST — an unsupported step rejects the flow before any request or billing.
    const unsupported = flow.steps.some((s) => !API_CAPABILITIES.steps.has(actionToClass(s.action)));
    if (unsupported) {
      results.push({ flowId: flow.id, state: "blocked_by_policy", steps: [] });
      continue;
    }
    const r = await runApiFlow({
      baseUrl, steps: flow.steps as ApiStep[], secrets: deps.secrets, fetcher: countingFetcher, clock: deps.clock,
    });
    results.push({ flowId: flow.id, state: r.ok ? "passed" : "failed", steps: r.steps });
    evidence.push({ flowId: flow.id, steps: r.steps });
    if (!r.ok && r.failedIndex != null) {
      const failedStep = r.steps[r.failedIndex];
      failedDetail.set(flow.id, failedStep?.detail ?? "failed");
      failedTransport.set(flow.id, failedStep?.transport);
    }
  }

  // ── failure classification (keyed on the STRUCTURAL transport tag, never on string-matching detail) ──
  // A run is INFRA only when EVERY failure is a genuine transport-unreachable event. A safe-fetch "blocked"
  // rejection is a product/security misconfiguration -> INDETERMINATE (needs_review), never free infra and
  // never a counterfeit product BLOCKED. Any assertion failure present keeps full product semantics.
  const failedFlows = results.filter((r) => r.state === "failed").map((r) => r.flowId);
  const transports = failedFlows.map((id) => failedTransport.get(id));
  let failureClass: FailureClass | null = null;
  if (failedFlows.length > 0) {
    if (transports.every((t) => t === "unreachable")) failureClass = "infra";
    else if (transports.every((t) => t === "unreachable" || t === "blocked")) failureClass = "indeterminate";
    // else: at least one plain assertion failure -> product (failureClass stays null)
  }

  // Critical set comes from THIS phase's flows (the capability probe is critical too — a policy-blocked
  // critical flow must read as needs_review, never as a vacuous ready).
  const criticalFlowIds = new Set(cfg.flows.filter((f) => f.critical).map((f) => f.id));
  // fullCoverage is DERIVED, never a hand-set flag: a run has full coverage only when it exercises the
  // COMPLETE canary critical set. A targeted/partial rerun (fewer critical flows) can therefore never mint
  // READY — the decision layer downgrades it to repair_verified. Computed from the contract, not config.
  const fullCriticalSet = new Set(CANARY_FLOWS.filter((f) => f.critical).map((f) => f.id));
  const fullCoverage = [...fullCriticalSet].every((id) => criticalFlowIds.has(id));
  const { decision, summary } = decideRuntime({
    results, criticalFlowIds, fullCoverage,
    failureClass: failureClass ?? undefined,
  });
  const flowIds = cfg.flows.map((f) => f.id);
  const matrixHash = canaryMatrixHash(flowIds);
  const fullSummary = {
    ...summary, phase, mode: cfg.mode, flow_ids: flowIds, api_requests: apiRequests,
    matrix_hash: matrixHash, adapter_version: CANARY_ADAPTER_VERSION,
    policy_blocked: results.filter((r) => r.state === "blocked_by_policy").length,
  };

  // ── persist: build + terminal run + decision (full binding) ──
  const buildId = await deps.store.insertBuild(deps.owner, targetId, baseUrl, phase);
  const runId = await deps.store.insertTerminalRun({
    owner: deps.owner, appId, targetId, phase, state: "completed", decision,
    summary: fullSummary, deploymentUrl: baseUrl, submissionId,
  });
  await deps.store.insertDecision({
    owner: deps.owner, appId, targetId, buildId, runId, decision, failureClass,
    contractVersion: CANARY_CONTRACT_VERSION, matrixHash, summary: fullSummary,
  });

  // ── issue lineage, scoped by (requirement, runtime_target) — PRODUCT failures only ──
  // Mirrors the worker's reconcile semantics: only flows that actually EXECUTED reconcile (policy-blocked
  // flows never open or resolve issues), and an infra run touches no lineage at all.
  const issues = { opened: [] as string[], resolved: [] as string[], continued: [] as string[] };
  if (failureClass == null) {
    const executed = results.filter((r) => r.state === "passed" || r.state === "failed");
    const open = await deps.store.openIssues(appId, targetId);
    const byCategory = new Map(open.map((i) => [i.category ?? "", i]));
    for (const r of executed) {
      const existing = byCategory.get(r.flowId);
      if (r.state === "passed" && existing) {
        await deps.store.resolveIssue(existing.id, runId);
        issues.resolved.push(existing.id);
      } else if (r.state === "failed" && existing) {
        await deps.store.continueIssue(existing.id, runId);
        issues.continued.push(existing.id);
      } else if (r.state === "failed") {
        const flow = cfg.flows.find((f) => f.id === r.flowId);
        const id = await deps.store.openIssue({
          owner: deps.owner, appId, targetId, runId, category: r.flowId,
          title: `${flow?.title ?? r.flowId} — failed on the API runtime`,
          expected: flow?.title ?? r.flowId,
          observed: failedDetail.get(r.flowId) ?? "assertion failed",
          evidence: { failed_step: failedDetail.get(r.flowId) ?? null, adapter_version: CANARY_ADAPTER_VERSION },
        });
        issues.opened.push(id);
      }
    }
  }

  // ── usage: exactly ONE ledger row per run that did PRODUCTIVE work (fails-before-billing => zero;
  // transport-failed/infra runs are never billed — an infra failure must cost the customer nothing) ──
  if (apiRequests > 0 && failureClass == null) await deps.store.recordUsage(deps.owner, runId, apiRequests);

  // ── belt-and-braces leak scan: no configured secret or harvested token may appear in the evidence ──
  const evidenceJson = JSON.stringify(evidence);
  const leaked = Object.values(deps.secrets).some((s) => s && evidenceJson.includes(s)) || /cnry_\d+_[a-f0-9]{24}/.test(evidenceJson);
  const leakScan: CanaryPhaseResult["leakScan"] = leaked ? "LEAK_DETECTED" : "clean";

  return {
    phase, mode: cfg.mode, decision, failureClass, summary: fullSummary,
    appId, targetId, buildId, runId, matrixHash,
    binding: { runtimeKind: "api", environment: "canary", contractVersion: CANARY_CONTRACT_VERSION, adapterVersion: CANARY_ADAPTER_VERSION },
    flows: results.map((r) => ({ id: r.flowId, state: r.state, failedStepDetail: failedDetail.get(r.flowId) ?? null })),
    issues, apiRequests, ledgerRows: await deps.store.ledgerCount(runId), leakScan,
    web: { before: webBefore, after: await deps.store.webSnapshot(appId, targetId) },
    evidence,
  };
}

function actionToClass(action: string): never | Parameters<typeof API_CAPABILITIES.steps.has>[0] {
  // set_header rides the http_auth capability (it only stages headers); everything else maps 1:1. Unknown
  // actions map to themselves so the capability gate rejects them (the whole point of the probe).
  return (action === "set_header" ? "http_auth" : action) as Parameters<typeof API_CAPABILITIES.steps.has>[0];
}

// ── The live Supabase-backed store (service role; used only by the founder-gated internal route) ─────
// Every write is scoped by owner + the canary app/target ids this module itself created. Nothing here
// touches web rows. Same untyped-client chain style as the rest of the server libs (runs-db, verify scripts).
import type { SupabaseClient } from "@supabase/supabase-js";

export function makeSupabaseCanaryStore(
  s: SupabaseClient,
  recordProviderCost: (i: { owner: string | null; runId: string | null; estimatedCents?: number }) => Promise<void>,
): CanaryStore {
  const one = async (table: string, row: Record<string, unknown>): Promise<string> => {
    const { data, error } = await s.from(table).insert(row).select("id").single();
    if (error || !data) throw new Error(`insert ${table} failed: ${error?.message ?? "no id"}`);
    return (data as { id: string }).id;
  };
  return {
    async ensureApp(owner) {
      // Match on the machine marker app_url (never name) so a real founder-owned app named "API Canary
      // (internal)" can never be reused as the canary app and have API runs/decisions/issues attached to it.
      const { data } = await s.from("v_applications").select("id").eq("user_id", owner).eq("app_url", CANARY_APP_URL).limit(1);
      const found = (data as { id: string }[] | null)?.[0]?.id;
      if (found) return found;
      return one("v_applications", {
        user_id: owner, name: CANARY_APP_NAME, app_url: CANARY_APP_URL,
        ownership_confirmed: true, status: "connected", builder: "other",
      });
    },
    async ensureApiTarget(owner, appId) {
      const { data } = await s.from("v_runtime_targets").select("id").eq("application_id", appId).eq("kind", "api").eq("environment", "canary").limit(1);
      const found = (data as { id: string }[] | null)?.[0]?.id;
      if (found) return found;
      return one("v_runtime_targets", { user_id: owner, application_id: appId, kind: "api", label: "API", environment: "canary" });
    },
    insertBuild: (owner, targetId, baseUrl, phase) =>
      one("v_builds", { user_id: owner, runtime_target_id: targetId, kind: "api", base_url: baseUrl, version: "canary-v1", detail: { phase } }),
    insertTerminalRun: (r) =>
      one("v_preflight_runs", {
        user_id: r.owner, application_id: r.appId, state: r.state, decision: r.decision, summary: r.summary,
        submission_id: r.submissionId, deployment_url: r.deploymentUrl, credits_held: 0,
        runtime_target_id: r.targetId, adapter_version: CANARY_ADAPTER_VERSION,
        started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      }),
    insertDecision: (r) =>
      one("v_platform_decisions", {
        user_id: r.owner, application_id: r.appId, runtime_target_id: r.targetId, runtime_kind: "api",
        build_id: r.buildId, run_id: r.runId, environment: "canary", contract_version: r.contractVersion,
        matrix_hash: r.matrixHash, adapter_version: CANARY_ADAPTER_VERSION, decision: r.decision,
        failure_class: r.failureClass, summary: r.summary,
      }),
    async openIssues(appId, targetId) {
      const { data } = await s.from("v_issues").select("id,category,status,first_seen_run,last_seen_run,resolved_run")
        .eq("application_id", appId).eq("runtime_target_id", targetId).eq("status", "open");
      return (data as CanaryIssueRow[] | null) ?? [];
    },
    openIssue: (r) =>
      one("v_issues", {
        user_id: r.owner, application_id: r.appId, run_id: r.runId, severity: "critical", category: r.category,
        title: r.title, expected: r.expected, observed: r.observed, evidence: r.evidence,
        status: "open", first_seen_run: r.runId, last_seen_run: r.runId, runtime_target_id: r.targetId,
      }),
    async resolveIssue(issueId, runId) {
      const { error } = await s.from("v_issues").update({ status: "resolved", resolved_run: runId, last_seen_run: runId }).eq("id", issueId);
      if (error) throw new Error(`resolve issue failed: ${error.message}`);
    },
    async continueIssue(issueId, runId) {
      const { error } = await s.from("v_issues").update({ last_seen_run: runId }).eq("id", issueId);
      if (error) throw new Error(`continue issue failed: ${error.message}`);
    },
    async recordUsage(owner, runId) {
      // API requests are effectively free relative to browser minutes; the row itself (run-linked, 0-cent)
      // IS the usage record, and its uniqueness per run is the no-duplicate-billing proof.
      await recordProviderCost({ owner, runId, estimatedCents: 0 });
    },
    async ledgerCount(runId) {
      const { data } = await s.from("v_cost_ledger").select("id").eq("run_id", runId);
      return (data as { id: string }[] | null)?.length ?? 0;
    },
    async webSnapshot(appId, apiTargetId) {
      // The latest COMPLETED run that is NOT bound to the API canary target = the app's web history.
      const { data } = await s.from("v_preflight_runs").select("id,decision,runtime_target_id")
        .eq("application_id", appId).eq("state", "completed")
        .order("created_at", { ascending: false }).limit(50);
      const web = ((data as { id: string; decision: string | null; runtime_target_id: string | null }[] | null) ?? [])
        .find((r) => r.runtime_target_id !== apiTargetId);
      return web ? { runId: web.id, decision: web.decision } : null;
    },
  };
}
