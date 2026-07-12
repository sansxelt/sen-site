// Postgres-backed RunStore (the real queue). Uses the service-role Supabase client + the advisory-locked
// v_preflight_claim() RPC for atomic claim, and PostgREST filtered updates for ownership-checked heartbeat
// and finalize. IMPLEMENTED but NOT YET INTEGRATION-TESTED — the additive migration is unapplied in this
// environment (npm run preflight:verify-db exits non-zero), and there is no Railway/Postgres to run it
// against yet. The lifecycle logic itself is proven by FakeRunStore (26/26). Billing settlement reuses the
// existing credit ledger (hold at enqueue -> charge on completion -> refund when nothing ran).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RunStore, ClaimedRun, FlowResult, RunDecision, FlowSpec, Step, StepObservation, FlowEvidence } from "./types";
import { refund } from "../../lib/v-credits";
import { planFlowSelection } from "../../lib/preflight/flow-selection";
import { issuesFromRun, planReconcile, type Issue, type OpenIssueRef, type ReconcileFlow } from "../../lib/preflight/issues";

// Owner + billing fields read once per settlement. Missing columns / absent table => null (degrade).
type RunSettlementRow = {
  user_id?: string | null; application_id?: string | null; contract_id?: string | null;
  credits_held?: number | null; cost_reservation_id?: string | null;
  state?: string | null; attempts?: number | null; max_attempts?: number | null;
};

// Internal escape hatch for staging/internal runs: skip every ledger charge/refund (still warns). Honored
// ONLY outside production — matches the web routes' billingBypassAllowed() EXACTLY (flag === "1" AND not
// NODE_ENV/VERCEL_ENV production). This is load-bearing for safety: in production the enqueue route always
// takes the real hold, so if the worker skipped settlement it would leave the refund path un-run and
// permanently strand a customer's escrowed credits. Guarding to non-prod makes that impossible.
function billingBypassed(): boolean {
  return process.env.PREFLIGHT_INTERNAL_BILLING_BYPASS === "1"
    && process.env.NODE_ENV !== "production"
    && process.env.VERCEL_ENV !== "production";
}

// Loud, once, at import: if the flag is set in production it is IGNORED (real charge/refund still runs), so
// an accidental prod setting is obvious rather than silently doing nothing.
if (process.env.PREFLIGHT_INTERNAL_BILLING_BYPASS === "1"
    && (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production")) {
  console.warn("[preflight] PREFLIGHT_INTERNAL_BILLING_BYPASS is set but IGNORED in production; real credit settlement (charge + refund) stays active.");
}

export class PostgresRunStore implements RunStore {
  private s: SupabaseClient;
  private lastReapMs = 0;
  constructor(url: string, serviceKey: string) { this.s = createClient(url, serviceKey, { auth: { persistSession: false } }); }

  // Queue recovery: a run whose worker died mid-flight stays 'running' with an expired lease, and the claim
  // RPC only picks up 'queued' rows, so without this it would be stranded forever. Every claim cycle (at
  // most every 30s) each expired-lease running run is routed through the SAME failRun semantics as a live
  // failure: attempts left -> requeued (hold kept for the retry); attempts exhausted -> terminal 'failed'
  // with the reservation refunded when no flow ever executed. Concurrent workers reaping the same row are
  // harmless: failRun is idempotent for an already-terminal run and a double-requeue is the same write.
  private async reapExpiredLeases(): Promise<void> {
    const now = Date.now();
    if (now - this.lastReapMs < 30_000) return;
    this.lastReapMs = now;
    try {
      const { data } = await this.s.from("v_preflight_runs").select("id")
        .eq("state", "running").lt("lease_expires_at", new Date().toISOString()).limit(20);
      for (const row of (data as { id: string }[] | null) ?? []) {
        const { count } = await this.s.from("v_flow_runs").select("id", { count: "exact", head: true }).eq("preflight_run_id", row.id);
        await this.failRun(row.id, "lease_expired", "The worker lost its lease before finishing this run.", (count ?? 0) > 0);
      }
    } catch (e) { console.warn("preflight lease reap:", (e as Error).message); }
  }

  async claim(workerId: string, leaseSecs: number): Promise<ClaimedRun | null> {
    await this.reapExpiredLeases();
    const { data: runId, error } = await this.s.rpc("v_preflight_claim", { p_worker: workerId, p_lease_secs: leaseSecs });
    if (error || !runId) return null;
    const { data: run, error: runErr } = await this.s.from("v_preflight_runs").select("id,application_id,deployment_url,contract_id,lease_expires_at,flow_ids,environment:provider").eq("id", runId).maybeSingle();
    if (runErr || !run) {
      // A missing flow_ids column (migration 4 unapplied) errors this select; say so instead of hanging.
      if (runErr) console.error(`preflight claim read (${String(runId)}): ${runErr.message} — if this names flow_ids, apply sql/vraelis-preflight-4-selected-flows.sql`);
      return null; // lease expiry reaps the claimed-but-unread run through failRun
    }
    const r = run as Record<string, unknown>;
    const { data: flowRows } = await this.s.from("v_test_flows").select("id,name,priority,start_path,steps,max_ms,destructive_allowed,mobile_relevant").eq("contract_id", r.contract_id as string).eq("enabled", true).eq("review_state", "approved").order("order_index", { ascending: true });
    const approved = (flowRows as Record<string, unknown>[]) ?? [];

    // The run snapshot's stored selection is AUTHORITATIVE: execute exactly those flows, in contract order.
    // The worker never "reloads every approved flow" — that was the targeted-rerun bug (scope=failed
    // selected 2 flows, the browser ran 3). A missing/empty selection, or one referencing a flow outside
    // the enabled+approved contract snapshot, is an internal configuration error and fails the run HERE,
    // before any browser session exists: terminal, never billable (failRun refunds — no flow executed),
    // and with zero flow results there is nothing for issue reconciliation to act on.
    const plan = planFlowSelection(r.flow_ids, approved.map((f) => String(f.id)));
    if (!plan.ok) {
      await this.failRun(String(r.id), "flow_selection_invalid", `Internal configuration error: ${plan.reason}. No browser session was started.`, false);
      return null;
    }
    const selected = new Set(plan.ids);
    const flows: FlowSpec[] = approved.filter((f) => selected.has(String(f.id))).map((f) => ({
      flowId: String(f.id), name: String(f.name), priority: (f.priority as FlowSpec["priority"]) ?? "important",
      startPath: (f.start_path as string) ?? undefined, steps: Array.isArray(f.steps) ? (f.steps as Step[]) : [],
      maxMs: Number(f.max_ms) || 120000, destructiveAllowed: !!f.destructive_allowed,
      viewport: f.mobile_relevant ? { width: 390, height: 844 } : { width: 1280, height: 800 },
    }));
    // Coverage from THIS run's own contract snapshot only (never aggregated across runs): full means every
    // enabled+approved CRITICAL flow is in the selection. Partial runs can verify a repair, never grant READY.
    const fullCoverage = approved.filter((f) => (f.priority as string) === "critical").every((f) => selected.has(String(f.id)));
    return { runId: String(r.id), applicationId: String(r.application_id), deploymentUrl: String(r.deployment_url ?? ""), environment: "preview", flows, fullCoverage, leaseExpiresAt: new Date(String(r.lease_expires_at)).getTime() };
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
    // Settle billing + persist deterministic issues. Best-effort: the run is already 'completed', so a
    // ledger blip / unapplied migration must never throw and strand it. Idempotent (guarded below).
    try {
      const run = await this.loadRunSettlement(runId);
      if (run) await this.settleCompletion(runId, run);
    } catch (e) { console.warn(`preflight finalize settlement (${runId}):`, (e as Error).message); }
  }
  async failRun(runId: string, code: string, message: string, executedAnyFlow: boolean): Promise<void> {
    const run = await this.loadRunSettlement(runId);
    // A run already settled as completed (charged) must never be resurrected to queued/failed or refunded.
    if (run && run.state === "completed") return;
    // cancelled, target_mismatch, and flow_selection_invalid are deterministic (a retry cannot change
    // them) -> terminal immediately.
    const terminal = code === "cancelled" || code === "target_mismatch" || code === "flow_selection_invalid" || (run?.attempts ?? 0) >= (run?.max_attempts ?? 3);
    await this.s.from("v_preflight_runs").update({ state: terminal ? "failed" : "queued", failure_code: code, failure_message: message.slice(0, 500), lease_owner: null, lease_expires_at: null }).eq("id", runId);
    // Refund the FULL reservation ONLY on a terminal failure where no flow executed (discovery / queue /
    // provider-fail-before-browser). A requeue keeps the hold for the retry; a cancel or lease-loss AFTER
    // work began is charged by retaining the hold ("settle completed work; release the rest" -- the per-run
    // cost is flat, so there is no separate remainder to release).
    if (run && terminal && !executedAnyFlow) {
      try { await this.refundReservation(run, runId); } catch (e) { console.warn(`preflight refund (${runId}):`, (e as Error).message); }
    }
  }

  // ── settlement helpers ───────────────────────────────────────────────────────────────────────────
  private async loadRunSettlement(runId: string): Promise<RunSettlementRow | null> {
    const { data } = await this.s.from("v_preflight_runs")
      .select("user_id,application_id,contract_id,credits_held,cost_reservation_id,state,attempts,max_attempts")
      .eq("id", runId).maybeSingle();
    return (data as RunSettlementRow | null) ?? null;
  }

  private async settleCompletion(runId: string, run: RunSettlementRow): Promise<void> {
    if (!run.user_id) return;
    // Rebuild the executed flow results from the persisted rows (deterministic; no browser, no model).
    const { data: flowRunRows } = await this.s.from("v_flow_runs")
      .select("id,test_flow_id,state,severity,observed").eq("preflight_run_id", runId).eq("user_id", String(run.user_id));
    const frRows = (flowRunRows as Record<string, unknown>[] | null) ?? [];

    // Charge on completion IFF a flow actually executed; retaining the enqueue hold IS the charge (no
    // second debit -- that would double-charge). If finalize was somehow reached with zero executed flows
    // (degenerate empty run), release the hold instead of charging for nothing, then stop.
    if (frRows.length === 0) { await this.refundReservation(run, runId); return; }
    await this.chargeReservation(run);
    await this.persistIssues(runId, run, frRows);
  }

  // Persist one uploaded artifact (evidence) for a run: looks up the owner + the flow-run row so the report
  // can attach the screenshot to its flow. Called by the worker's artifact sink; best-effort at the call site.
  async persistArtifact(runId: string, flowId: string, storagePath: string, kind: string): Promise<void> {
    const { data: run } = await this.s.from("v_preflight_runs").select("user_id").eq("id", runId).maybeSingle();
    const userId = (run as { user_id?: string } | null)?.user_id;
    if (!userId) return;
    let flowRunId: string | null = null;
    if (flowId) {
      const { data: fr } = await this.s.from("v_flow_runs").select("id").eq("preflight_run_id", runId).eq("test_flow_id", flowId).maybeSingle();
      flowRunId = (fr as { id?: string } | null)?.id ?? null;
    }
    await this.s.from("v_run_artifacts").insert({
      preflight_run_id: runId, user_id: userId, kind, storage_path: storagePath, flow_run_id: flowRunId, meta: { flow_id: flowId },
    } as never);
  }

  // Escrow settlement: v-credits.hold() DEBITED these credits at enqueue. Pricing is flat per run, so a
  // completed run KEEPS that full hold as the charge -- there is deliberately no positive ledger op here (a
  // second spend() would double-charge) and no partial remainder to release. Mirrors the proven FakeRunStore
  // contract (billing held -> charged retains the reservation). No ledger write on the charge path.
  private async chargeReservation(run: RunSettlementRow): Promise<void> {
    const amount = Number(run.credits_held) || 0;
    if (amount <= 0) return;                       // nothing was reserved
    if (billingBypassed()) { console.warn(`preflight billing bypass: charge skipped (reservation ${run.cost_reservation_id ?? "run"}, ${amount} credits)`); return; }
    // hold retained == charge settled; nothing else to write.
  }

  private async refundReservation(run: RunSettlementRow, runId: string): Promise<void> {
    const amount = Number(run.credits_held) || 0;
    if (amount <= 0 || !run.user_id) return;
    // Reservation key = the ref_id the enqueue hold() used (stored as cost_reservation_id); fall back to
    // the run id. Must match hold() exactly so refund() finds the escrowed rows.
    const key = (run.cost_reservation_id ? String(run.cost_reservation_id) : "") || runId;
    if (billingBypassed()) { console.warn(`preflight billing bypass: refund skipped (reservation ${key}, ${amount} credits)`); return; }
    // v-credits.refund() reverses the hold to its originating bucket(s); idempotent per reservation via
    // ext_ref (refund:<key>:p / :m), so a retry or a duplicate failRun never double-refunds.
    await refund(String(run.user_id), key, amount);
  }

  private async persistIssues(runId: string, run: RunSettlementRow, frRows: Record<string, unknown>[]): Promise<void> {
    const userId = String(run.user_id);
    const applicationId = run.application_id ? String(run.application_id) : null;
    const contractId = run.contract_id ? String(run.contract_id) : null;
    if (!applicationId || frRows.length === 0) return;

    // Idempotency: if this run already touched any issue (opened, continued, or resolved), a prior finalize
    // reconciled it -- do not repeat.
    const { data: touched } = await this.s.from("v_issues").select("id")
      .eq("user_id", userId).or(`first_seen_run.eq.${runId},last_seen_run.eq.${runId},resolved_run.eq.${runId}`).limit(1);
    if (Array.isArray(touched) && touched.length > 0) return;

    // Reconstruct FlowResult[] from v_flow_runs (+ v_run_steps) -- the exact shape issuesFromRun expects.
    const results: FlowResult[] = [];
    for (const fr of frRows) {
      const { data: stepRows } = await this.s.from("v_run_steps")
        .select("idx,action,target,observed,status,ms").eq("flow_run_id", String(fr.id)).order("idx", { ascending: true });
      const steps: StepObservation[] = ((stepRows as Record<string, unknown>[] | null) ?? []).map((st) => ({
        action: st.action as StepObservation["action"], target: (st.target as string) ?? undefined,
        ok: st.status === "ok", detail: (st.observed as string) ?? "", ms: Number(st.ms) || 0,
      }));
      const observed = (fr.observed as { evidence?: FlowEvidence } | null) ?? null;
      results.push({
        flowId: String(fr.test_flow_id ?? ""), state: fr.state as FlowResult["state"],
        severity: (fr.severity as FlowResult["severity"]) ?? undefined, steps,
        evidence: observed?.evidence ?? { consoleErrors: [], networkFailures: [] },
      });
    }

    // Load the flows for classification, repro, and requirement refs (same source as claim()).
    const flows: FlowSpec[] = [];
    const refs: Record<string, string[]> = {};
    if (contractId) {
      const { data: flowRows } = await this.s.from("v_test_flows")
        .select("id,name,priority,start_path,steps,max_ms,destructive_allowed,requirement_ids")
        .eq("contract_id", contractId).eq("user_id", userId);
      for (const f of (flowRows as Record<string, unknown>[] | null) ?? []) {
        const id = String(f.id);
        flows.push({ flowId: id, name: String(f.name), priority: (f.priority as FlowSpec["priority"]) ?? "important",
          startPath: (f.start_path as string) ?? undefined, steps: Array.isArray(f.steps) ? (f.steps as Step[]) : [],
          maxMs: Number(f.max_ms) || 120000, destructiveAllowed: !!f.destructive_allowed });
        refs[id] = Array.isArray(f.requirement_ids) ? (f.requirement_ids as unknown[]).map(String) : [];
      }
    }
    if (flows.length === 0) return;

    // Reconcile against the application's currently OPEN issues via the PURE, tested planReconcile
    // (lib/preflight/issues.ts) — correlation identity is (application, flow, category). A flow that PASSED
    // resolves its open issue(s); a flow that still FAILED continues the existing open issue (bumped
    // last_seen_run, refreshed evidence) or opens a new one (a regression); a flow that did not run is
    // untouched (left unverified). Resolution is a status transition, never a delete — history is preserved.
    const { data: openRows } = await this.s.from("v_issues")
      .select("id, flow_id, category").eq("user_id", userId).eq("application_id", applicationId).eq("status", "open");
    const open: OpenIssueRef[] = ((openRows as Record<string, unknown>[] | null) ?? [])
      .filter((o) => o.flow_id)
      .map((o) => ({ id: String(o.id), flowId: String(o.flow_id), category: o.category ? String(o.category) : null }));

    // This run's failures as fresh Issue payloads, keyed by flow|category (planReconcile decides what to do
    // with each; the payloads carry the evidence either way).
    const ran: ReconcileFlow[] = [];
    const freshByFlowCat = new Map<string, Issue>();
    for (const result of results) {
      if (!result.flowId) continue;
      if (result.state === "passed") { ran.push({ flowId: result.flowId, passed: true, failureCategories: [] }); continue; }
      const fresh = issuesFromRun([result], flows, refs);
      for (const issue of fresh) freshByFlowCat.set(`${result.flowId}|${issue.category ?? ""}`, issue);
      ran.push({ flowId: result.flowId, passed: false, failureCategories: fresh.map((i) => i.category ?? "") });
    }

    const plan = planReconcile(ran, open);
    for (const id of plan.resolve) {
      await this.s.from("v_issues").update({ status: "resolved", resolved_run: runId, last_seen_run: runId } as never)
        .eq("user_id", userId).eq("id", id);
    }
    for (const cont of plan.continueExisting) {
      const issue = freshByFlowCat.get(`${cont.flowId}|${cont.category ?? ""}`);
      if (!issue) continue;
      await this.s.from("v_issues").update({
        last_seen_run: runId, observed: issue.observed, expected: issue.expected, repro: issue.repro,
        evidence: { ...issue.evidence, requirement_refs: issue.requirement_refs }, severity: issue.severity,
      } as never).eq("user_id", userId).eq("id", cont.id);
    }
    for (const reg of plan.openNew) {
      const issue = freshByFlowCat.get(`${reg.flowId}|${reg.category ?? ""}`);
      if (!issue) continue;
      const { error } = await this.s.from("v_issues").insert({
        user_id: userId, application_id: applicationId, run_id: runId, flow_id: reg.flowId,
        severity: issue.severity, category: issue.category, title: issue.title,
        expected: issue.expected, observed: issue.observed, repro: issue.repro,
        evidence: { ...issue.evidence, requirement_refs: issue.requirement_refs },
        status: "open", first_seen_run: runId, last_seen_run: runId,
      } as never);
      if (error) console.warn(`preflight open issue (${runId}):`, error.message);
    }
  }
}
