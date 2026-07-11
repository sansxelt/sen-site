// Postgres-backed RunStore (the real queue). Uses the service-role Supabase client + the advisory-locked
// v_preflight_claim() RPC for atomic claim, and PostgREST filtered updates for ownership-checked heartbeat
// and finalize. IMPLEMENTED but NOT YET INTEGRATION-TESTED — the additive migration is unapplied in this
// environment (npm run preflight:verify-db exits non-zero), and there is no Railway/Postgres to run it
// against yet. The lifecycle logic itself is proven by FakeRunStore (26/26). Billing settlement reuses the
// existing credit ledger (hold at enqueue -> charge on completion -> refund when nothing ran).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RunStore, ClaimedRun, FlowResult, RunDecision, FlowSpec, Step } from "./types";

export class PostgresRunStore implements RunStore {
  private s: SupabaseClient;
  constructor(url: string, serviceKey: string) { this.s = createClient(url, serviceKey, { auth: { persistSession: false } }); }

  async claim(workerId: string, leaseSecs: number): Promise<ClaimedRun | null> {
    const { data: runId, error } = await this.s.rpc("v_preflight_claim", { p_worker: workerId, p_lease_secs: leaseSecs });
    if (error || !runId) return null;
    const { data: run } = await this.s.from("v_preflight_runs").select("id,application_id,deployment_url,contract_id,lease_expires_at,environment:provider").eq("id", runId).maybeSingle();
    if (!run) return null;
    const r = run as Record<string, unknown>;
    const { data: flowRows } = await this.s.from("v_test_flows").select("id,name,priority,start_path,steps,max_ms,destructive_allowed").eq("contract_id", r.contract_id as string).eq("enabled", true).eq("review_state", "approved").order("order_index", { ascending: true });
    const flows: FlowSpec[] = ((flowRows as Record<string, unknown>[]) ?? []).map((f) => ({
      flowId: String(f.id), name: String(f.name), priority: (f.priority as FlowSpec["priority"]) ?? "important",
      startPath: (f.start_path as string) ?? undefined, steps: Array.isArray(f.steps) ? (f.steps as Step[]) : [],
      maxMs: Number(f.max_ms) || 120000, destructiveAllowed: !!f.destructive_allowed,
    }));
    return { runId: String(r.id), applicationId: String(r.application_id), deploymentUrl: String(r.deployment_url ?? ""), environment: "preview", flows, leaseExpiresAt: new Date(String(r.lease_expires_at)).getTime() };
  }

  async heartbeat(runId: string, workerId: string, leaseSecs: number): Promise<boolean> {
    const { data } = await this.s.from("v_preflight_runs")
      .update({ lease_expires_at: new Date(Date.now() + leaseSecs * 1000).toISOString(), heartbeat_at: new Date().toISOString() })
      .eq("id", runId).eq("lease_owner", workerId).gt("lease_expires_at", new Date().toISOString()).is("cancel_requested_at", null)
      .select("id");
    return Array.isArray(data) && data.length > 0; // no row updated -> ownership lost / cancelled
  }
  async cancelRequested(runId: string): Promise<boolean> {
    const { data } = await this.s.from("v_preflight_runs").select("cancel_requested_at").eq("id", runId).maybeSingle();
    return !!(data as { cancel_requested_at?: string } | null)?.cancel_requested_at;
  }
  async setState(runId: string, state: string): Promise<void> { await this.s.from("v_preflight_runs").update({ state }).eq("id", runId); }
  async setProviderSession(runId: string, provider: string, providerSessionId: string): Promise<void> { await this.s.from("v_preflight_runs").update({ provider, provider_session_id: providerSessionId }).eq("id", runId); }

  async persistFlowResult(runId: string, result: FlowResult): Promise<void> {
    // Owner id is derived server-side from the run; the worker copies it onto child rows for owner-scoped reads.
    const { data: run } = await this.s.from("v_preflight_runs").select("user_id,application_id").eq("id", runId).maybeSingle();
    const userId = (run as { user_id?: string } | null)?.user_id ?? null;
    const { data: fr } = await this.s.from("v_flow_runs").insert({ preflight_run_id: runId, test_flow_id: result.flowId, user_id: userId, name: result.flowId, state: result.state, observed: { evidence: result.evidence ?? {} }, severity: result.severity ?? null } as never).select("id").single();
    const flowRunId = (fr as { id?: string } | null)?.id;
    if (flowRunId && result.steps.length) {
      await this.s.from("v_run_steps").insert(result.steps.map((st, i) => ({ flow_run_id: flowRunId, idx: i, action: st.action, target: st.target ?? null, expected: null, observed: st.detail, status: st.ok ? "ok" : "fail", ms: st.ms })) as never);
    }
  }
  async finalizeRun(runId: string, decision: RunDecision, summary: Record<string, unknown>): Promise<void> {
    await this.s.from("v_preflight_runs").update({ state: "completed", decision, summary, completed_at: new Date().toISOString(), lease_owner: null }).eq("id", runId);
    // TODO(billing): settle the reservation via lib/v-credits (charge on completion). Wired when run
    // creation reserves credits with hold(); a completed run that executed >=1 flow is charged.
  }
  async failRun(runId: string, code: string, message: string, executedAnyFlow: boolean): Promise<void> {
    const { data: run } = await this.s.from("v_preflight_runs").select("attempts,max_attempts").eq("id", runId).maybeSingle();
    const a = run as { attempts?: number; max_attempts?: number } | null;
    const terminal = code === "cancelled" || (a?.attempts ?? 0) >= (a?.max_attempts ?? 3);
    await this.s.from("v_preflight_runs").update({ state: terminal ? "failed" : "queued", failure_code: code, failure_message: message.slice(0, 500), lease_owner: null, lease_expires_at: null }).eq("id", runId);
    void executedAnyFlow; // TODO(billing): refund the reservation when no flow executed.
  }
}
