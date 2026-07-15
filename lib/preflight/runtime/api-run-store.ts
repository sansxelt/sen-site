// The LIVE (Supabase) implementation of the executor's ApiRunStore, for CUSTOMER API runs. Writes the
// migration-12 decision grain for a REAL customer app/target, plus v_flow_runs / v_run_steps (with the
// migration-13 `evidence` jsonb) so the EXISTING read paths (getRun / listFlowRunMeta) work for API runs with
// no read-path change. Service-role, owner-scoped. NOT the canary store (that is the synthetic founder app).
// No canary import.

import type { SupabaseClient } from "@supabase/supabase-js";
import { API_BETA_ADAPTER_VERSION, API_BETA_CONTRACT_VERSION, type ApiRunStore } from "./api-executor";

// recordProviderCost is injected (same as the canary) so this file stays free of the cost-governor's server
// deps for testing; the route wires the real one.
type RecordCost = (i: { owner: string | null; runId: string | null; apiRequests?: number; estimatedCents?: number }) => Promise<void>;

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
    async recordUsage(owner, runId, apiRequests) {
      await recordProviderCost({ owner, runId, apiRequests, estimatedCents: 0 });
    },
  };
}
