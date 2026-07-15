// The LIVE (Supabase) implementation of the executor's ApiRunStore, for CUSTOMER API runs. Writes the
// migration-12 decision grain for a REAL customer app/target, plus v_flow_runs / v_run_steps (with the
// migration-13 `evidence` jsonb) so the EXISTING read paths (getRun / listFlowRunMeta) work for API runs with
// no read-path change. Service-role, owner-scoped. NOT the canary store (that is the synthetic founder app).
// No canary import.

import type { SupabaseClient } from "@supabase/supabase-js";
import { API_BETA_ADAPTER_VERSION, API_BETA_CONTRACT_VERSION, type ApiRunStore } from "./api-executor";

// ── Sanitized customer-facing read of one API run ─────────────────────────────────────────────────────
// Returns ONLY what a customer may see: decision, per-flow states, and per-step sanitized evidence (method,
// path, status, duration, the assertion + expected/observed as owner-safe text). NEVER raw headers/body/
// tokens — the adapter already redacted the http_txn ref, but this reader ALSO refuses to surface the raw
// ref by default (only the sanitized meta), so a body is never shown unless explicitly field-selected.
// Map the stored internal step class back to a customer-safe label so a run report NEVER shows an internal
// ApiStep name. Anything unmapped falls back to a neutral "Step".
const STEP_CLASS_LABEL: Record<string, string> = {
  http_auth: "Sign in", set_header: "Add a request header", http_request: "Call an endpoint",
  assert_status: "Check the response status", assert_json: "Check a response value",
  assert_schema: "Check response fields exist", extract: "Save a value from the response",
  verify_persisted: "Confirm it was saved",
};
function stepLabel(cls: string): string { return STEP_CLASS_LABEL[cls] ?? "Step"; }

export type ApiRunStep = { action: string; ok: boolean; detail: string; ms: number; txns: { method?: string; path?: string; status?: string }[] };
export type ApiRunFlow = { name: string; state: string; steps: ApiRunStep[] };
export type ApiRunView = {
  runId: string; decision: string | null; state: string; summary: Record<string, unknown>;
  createdAt: string | null; flows: ApiRunFlow[];
} | null;

export async function readApiRun(s: SupabaseClient, owner: string, appId: string, targetId: string, runId: string): Promise<ApiRunView> {
  const { data: runRow } = await s.from("v_preflight_runs")
    .select("id,decision,state,summary,created_at,runtime_target_id,application_id,user_id")
    .eq("id", runId).eq("user_id", owner).eq("application_id", appId).eq("runtime_target_id", targetId).maybeSingle();
  const run = runRow as { id: string; decision: string | null; state: string; summary: Record<string, unknown>; created_at: string } | null;
  if (!run) return null;

  const { data: frRows } = await s.from("v_flow_runs").select("id,name,state").eq("preflight_run_id", runId);
  const flowRuns = (frRows as { id: string; name: string; state: string }[] | null) ?? [];
  const flows: ApiRunFlow[] = [];
  for (const fr of flowRuns) {
    const { data: stepRows } = await s.from("v_run_steps").select("action,observed,status,ms,evidence,idx").eq("flow_run_id", fr.id).order("idx", { ascending: true });
    const steps: ApiRunStep[] = ((stepRows as { action: string; observed: string; status: string; ms: number; evidence: unknown }[] | null) ?? []).map((sr) => {
      // Surface ONLY the sanitized meta (method/path/status) of each http_txn — never the raw ref (headers/body).
      const txns = Array.isArray(sr.evidence)
        ? (sr.evidence as { kind?: string; meta?: { method?: string; path?: string; status?: string } }[])
            .filter((e) => e.kind === "http_txn").map((e) => ({ method: e.meta?.method, path: e.meta?.path, status: e.meta?.status }))
        : [];
      return { action: stepLabel(String(sr.action ?? "")), ok: sr.status === "ok", detail: String(sr.observed ?? ""), ms: Number(sr.ms ?? 0), txns };
    });
    flows.push({ name: fr.name, state: fr.state, steps });
  }
  return { runId: run.id, decision: run.decision, state: run.state, summary: run.summary ?? {}, createdAt: run.created_at, flows };
}

// List the API runs for a target (newest first) — the run history / repair lineage view.
export async function listApiRuns(s: SupabaseClient, owner: string, appId: string, targetId: string, limit = 50): Promise<{ runId: string; decision: string | null; state: string; createdAt: string | null }[]> {
  const { data } = await s.from("v_preflight_runs").select("id,decision,state,created_at")
    .eq("user_id", owner).eq("application_id", appId).eq("runtime_target_id", targetId)
    .order("created_at", { ascending: false }).limit(limit);
  return ((data as { id: string; decision: string | null; state: string; created_at: string }[] | null) ?? [])
    .map((r) => ({ runId: r.id, decision: r.decision, state: r.state, createdAt: r.created_at }));
}

// recordProviderCost is injected (same as the canary) so this file stays free of the cost-governor's server
// deps for testing; the route wires the real one. API requests are near-zero cost relative to browser
// minutes — the run-linked ledger row itself IS the usage record (its uniqueness = no-duplicate-billing).
type RecordCost = (i: { owner: string | null; runId: string | null; estimatedCents?: number }) => Promise<void>;

export function makeApiRunStore(s: SupabaseClient, recordProviderCost: RecordCost): ApiRunStore {
  const one = async (table: string, row: Record<string, unknown>): Promise<string> => {
    const { data, error } = await s.from(table).insert(row as never).select("id").single();
    if (error || !data) throw new Error(`insert ${table} failed: ${error?.message ?? "no id"}`);
    return (data as { id: string }).id;
  };
  const now = () => new Date().toISOString();

  return {
    // TERMINAL-STATE ONLY (completed|failed) — never "queued", so the worker's claim can never pick it up.
    insertTerminalRun: (r) =>
      one("v_preflight_runs", {
        user_id: r.owner, application_id: r.appId, state: r.state, decision: r.decision, summary: r.summary,
        submission_id: r.submissionId, deployment_url: r.deploymentUrl, credits_held: r.creditsHeld,
        runtime_target_id: r.targetId, adapter_version: API_BETA_ADAPTER_VERSION,
        started_at: now(), completed_at: now(),
      }),

    // One v_flow_runs row per flow + one v_run_steps row per observation, carrying the sanitized http_txn
    // evidence array in the migration-13 `evidence` jsonb. The adapter already redacted every payload.
    async insertStepRows(runId, flows) {
      for (const flow of flows) {
        const flowRunId = await one("v_flow_runs", {
          preflight_run_id: runId, user_id: null, name: flow.name,
          state: flow.state, observed: {},
        }).catch(async () => {
          // v_flow_runs.user_id is NOT NULL in the base schema; retry with a resolved owner from the run.
          const { data } = await s.from("v_preflight_runs").select("user_id").eq("id", runId).single();
          const uid = (data as { user_id: string } | null)?.user_id ?? "";
          return one("v_flow_runs", { preflight_run_id: runId, user_id: uid, name: flow.name, state: flow.state, observed: {} });
        });
        for (let i = 0; i < flow.steps.length; i++) {
          const obs = flow.steps[i];
          await one("v_run_steps", {
            flow_run_id: flowRunId, idx: i, action: obs.stepClass, observed: obs.detail.slice(0, 400),
            status: obs.ok ? "ok" : "fail", ms: Math.round(obs.ms), evidence: obs.evidence,
          });
        }
      }
    },

    insertDecision: (r) =>
      one("v_platform_decisions", {
        user_id: r.owner, application_id: r.appId, runtime_target_id: r.targetId, runtime_kind: "api",
        build_id: r.buildId, run_id: r.runId, environment: null, contract_version: API_BETA_CONTRACT_VERSION,
        matrix_hash: r.matrixHash, adapter_version: API_BETA_ADAPTER_VERSION, decision: r.decision,
        failure_class: r.failureClass, summary: r.summary,
      }),

    async openIssues(appId, targetId) {
      const { data } = await s.from("v_issues").select("id,category")
        .eq("application_id", appId).eq("runtime_target_id", targetId).eq("status", "open");
      return (data as { id: string; category: string | null }[] | null) ?? [];
    },
    openIssue: (r) =>
      one("v_issues", {
        user_id: r.owner, application_id: r.appId, run_id: r.runId, severity: "critical", category: r.category,
        title: r.title, expected: r.expected, observed: r.observed, evidence: r.evidence,
        status: "open", first_seen_run: r.runId, last_seen_run: r.runId, runtime_target_id: r.targetId,
      }),
    async resolveIssue(issueId, runId) {
      const { error } = await s.from("v_issues").update({ status: "resolved", resolved_run: runId, last_seen_run: runId } as never).eq("id", issueId);
      if (error) throw new Error(`resolve issue failed: ${error.message}`);
    },
    async continueIssue(issueId, runId) {
      const { error } = await s.from("v_issues").update({ last_seen_run: runId } as never).eq("id", issueId);
      if (error) throw new Error(`continue issue failed: ${error.message}`);
    },
    async recordUsage(owner, runId) {
      await recordProviderCost({ owner, runId, estimatedCents: 0 });
    },
  };
}
