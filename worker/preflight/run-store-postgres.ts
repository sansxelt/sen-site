// Postgres-backed RunStore (the real queue). Uses the service-role Supabase client + the advisory-locked
// v_preflight_claim() RPC for atomic claim, and PostgREST filtered updates for ownership-checked heartbeat
// and finalize. IMPLEMENTED but NOT YET INTEGRATION-TESTED — the additive migration is unapplied in this
// environment (npm run preflight:verify-db exits non-zero), and there is no Railway/Postgres to run it
// against yet. The lifecycle logic itself is proven by FakeRunStore (26/26). Billing settlement reuses the
// existing credit ledger (hold at enqueue -> charge on completion -> refund when nothing ran).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RunStore, ClaimedRun, FlowResult, RunDecision, FlowSpec, Step, StepObservation, FlowEvidence, TestAccountRef } from "./types";
import { refund } from "../../lib/v-credits";
import { normalizeBoundaries, type TestBoundaries } from "../../lib/preflight/boundaries";
import { planFlowSelection } from "../../lib/preflight/flow-selection";
import { issuesFromRun, planReconcile, type Issue, type OpenIssueRef, type ReconcileFlow } from "../../lib/preflight/issues";
import { buildRepairPrompt } from "../../lib/preflight/repair-prompt";
import { DETERMINISTIC_AUTH_FAILURE } from "./auth-executor";
import { redactString, log } from "./redaction";
import { buildVerificationPayload, dispatchVerificationWebhooks } from "../../lib/preflight/webhook-dispatch";
import { deliverVerificationCompleted, runWebhookRetries } from "../../lib/v-webhooks";

// Provider/infrastructure failure codes that feed the per-account circuit breaker (blocker 3): a burst of
// these is the refund/infra loop. This set MUST stay in sync with every code classifyProviderError()
// (provider-errors.ts) can emit — an allowlist that drifts from the classifier silently defeats the
// breaker (a 429 capacity error, the most common burst failure, would slip through). Every provider
// classifier code IS an infra failure (never an app defect: app defects are FAILED flow states like
// auth_rejected_by_app / a broken journey, which do NOT reach failRun as a code). Plus the two worker
// auth/infra codes (vault + the mid-flow provider_infra_failure) and lease_expired.
/** Did this run cover enough of its contract to CERTIFY, or only enough to prove a repair?
 *
 *  Coverage is read from THIS run's own contract snapshot, never aggregated across runs. READY is a launch
 *  decision, so it requires the full critical set; a partial selection (a targeted rerun) proves its repair
 *  and gets repair_verified instead.
 *
 *  `every` OVER AN EMPTY LIST IS TRUE, which made this vacuous for any contract with no critical flow — and
 *  non-critical is the DEFAULT, because the synthesis reserves `critical` for launch-blocking promises and a
 *  generated plan's flows come back `important`. So a targeted rerun of ONE flow computed full coverage and
 *  minted READY: a full certification for a guarantee it had re-checked a single journey of.
 *
 *  When a contract declares nothing critical there is no critical coverage to have, so the whole approved set
 *  is what must be covered instead. A complete run still certifies; a partial one is still a repair proof.
 *
 *  Exported and pure so the rule can be tested without a database — being unreachable from a test is most of
 *  why it stayed wrong. */
export function coverageIsFull(approved: { id: string; priority: string }[], selected: Set<string>): boolean {
  const criticals = approved.filter((f) => f.priority === "critical");
  const mustCover = criticals.length ? criticals : approved;
  return mustCover.length > 0 && mustCover.every((f) => selected.has(f.id));
}

const PROVIDER_INFRA_FAILURE: ReadonlySet<string> = new Set<string>([
  // classifyProviderError() outputs — keep exhaustive with provider-errors.ts ProviderErrorCode:
  "provider_auth_failed", "provider_quota", "provider_capacity", "provider_unavailable",
  "infra_misconfigured", "session_timeout", "run_error",
  // worker auth/infra + lease (both the reaper's lease_expired AND the executor's mid-run lease_lost —
  // a lease-flapping loop is infra churn too):
  "provider_infra_failure", "worker_vault_failure", "lease_expired", "lease_lost",
]);

// Owner + billing fields read once per settlement. Missing columns / absent table => null (degrade).
type RunSettlementRow = {
  user_id?: string | null; application_id?: string | null; contract_id?: string | null;
  credits_held?: number | null; cost_reservation_id?: string | null;
  state?: string | null; attempts?: number | null; max_attempts?: number | null;
  // Read for the repair prompt: a failure handed to a coding agent has to name the deployment it was seen
  // on, or the agent cannot tell which environment to reason about.
  deployment_url?: string | null;
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

// Redact the flow's side-channel evidence at the sink: console error lines and network-failure paths are the
// only free-text fields, and each goes through redactString (a no-op when nothing matches). Cheap — the
// arrays are already bounded + sanitized by the provider; this only scrubs an active credential that somehow
// rode along. Returns a plain object safe to JSON-serialize into `observed.evidence`.
function redactEvidence(evidence: FlowEvidence | undefined): FlowEvidence {
  const e = evidence ?? { consoleErrors: [], networkFailures: [] };
  return {
    consoleErrors: (e.consoleErrors ?? []).map((line) => redactString(String(line))),
    networkFailures: (e.networkFailures ?? []).map((n) => ({ method: n.method, path: redactString(String(n.path)), status: n.status })),
  };
}

// VALUE-level scrub of the auth metadata: run every STRING field through redactString (a no-op when nothing
// matches) while KEEPING every key + non-string value intact. Deliberately NOT redactObject — that drops by
// key and would clobber legitimate fields (e.g. credentialState, whose name contains "credential"). This is
// belt-and-suspenders only: the auth metadata is value-safe by construction (never a username/password), so
// in practice nothing changes; it exists so a future accidental echo into a string field is still scrubbed.
function redactAuthValues(auth: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(auth)) {
    out[k] = typeof v === "string" ? redactString(v) : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? redactString(x) : x)) : v;
  }
  return out;
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
    const { data: run, error: runErr } = await this.s.from("v_preflight_runs").select("id,user_id,application_id,deployment_url,contract_id,lease_expires_at,flow_ids,environment:provider").eq("id", runId).maybeSingle();
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
    //
    // `every` OVER AN EMPTY LIST IS TRUE, and that made this vacuous for any contract with no critical flow.
    // Non-critical is the DEFAULT — the synthesis reserves `critical` for launch-blocking promises, so a
    // generated plan's flows come back `important` — which meant a TARGETED RERUN of one flow computed full
    // coverage and minted READY, a full certification, for a guarantee it had re-checked one journey of.
    //
    // When a contract declares nothing critical there is no critical coverage to have, so the whole approved
    // set is what must be covered instead. A complete run still certifies; a partial one is a repair proof,
    // which is exactly the distinction this value exists to draw.
    const fullCoverage = coverageIsFull(approved.map((f) => ({ id: String(f.id), priority: String(f.priority ?? "important") })), selected);

    // Test boundaries (S5) via the run's application. DEFENSIVE by design: a pre-migration-5 schema
    // (test_boundaries column missing) errors this select, and any read failure degrades to null — the
    // MOST conservative policy (every permit off; core actions still always allowed) — never a crash and
    // never a skipped run. A recorded value is normalized so a malformed row can only tighten, not widen.
    let boundaries: TestBoundaries | null = null;
    try {
      const { data: appRow, error: appErr } = await this.s.from("v_applications")
        .select("test_boundaries").eq("id", String(r.application_id)).maybeSingle();
      const raw = !appErr && appRow ? (appRow as { test_boundaries?: unknown }).test_boundaries : null;
      if (raw != null && typeof raw === "object") boundaries = normalizeBoundaries(raw);
    } catch { /* boundaries stay null (conservative) */ }

    // Test accounts (S6): the application's approved sealed test-account connections, METADATA ONLY (id,
    // label, role, environment). Owner + application scoped, read at claim time; encrypted_ref is
    // DELIBERATELY not selected — the credential is decrypted later, only at the moment a sign_in_as step
    // executes, via openTestAccount bound to this run's owner. DEFENSIVE: a pre-migration schema (no
    // test_account rows / missing meta) degrades to an empty list — an authenticated flow then fails safe
    // with invalid_or_revoked_credential, never an unauth fallback. Never a crash, never a skipped run.
    const owner = String(r.user_id ?? "").toLowerCase();
    let testAccounts: TestAccountRef[] = [];
    try {
      if (owner) {
        const { data: taRows } = await this.s.from("v_app_connections")
          .select("id,meta,status").eq("user_id", owner).eq("application_id", String(r.application_id))
          .eq("provider", "test_account");
        testAccounts = ((taRows as Record<string, unknown>[] | null) ?? [])
          // Only active (non-revoked) accounts are offered to the executor; a deleted row simply isn't here.
          .filter((row) => (row.status ?? "connected") !== "revoked")
          .map((row) => {
            const meta = (row.meta as Record<string, unknown>) ?? {};
            const label = typeof meta.label === "string" && meta.label.trim() ? meta.label : "Standard user";
            // role comes from meta.role when present, else falls back to the label so a role target resolves.
            const role = typeof meta.role === "string" && meta.role.trim() ? meta.role : label;
            const environment = typeof meta.environment === "string" && meta.environment.trim() ? meta.environment : null;
            return { connectionId: String(row.id), label: String(label), role: String(role), environment };
          });
      }
    } catch { /* test accounts stay empty (fail safe: role-requiring flows classify invalid_or_revoked_credential) */ }

    return { runId: String(r.id), applicationId: String(r.application_id), owner, deploymentUrl: String(r.deployment_url ?? ""), environment: "preview", flows, fullCoverage, boundaries, testAccounts, leaseExpiresAt: new Date(String(r.lease_expires_at)).getTime() };
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
    // Persist the flow's auth metadata (never a secret: role labels, account label, credential state, the
    // last verified-auth time) alongside the deterministic evidence so the report can show the honest
    // authenticated-flow summary. auth is absent on unauthenticated flows and is omitted then.
    //
    // BELT-AND-SUSPENDERS REDACTION AT THE SINK (S6): the executor already scrubs active credentials before
    // an observation is recorded, but this sink independently runs every string that reaches the DB through
    // redactString. So even if some future code path echoed an active credential into a step detail or an
    // evidence line, it is scrubbed HERE too — the persistence layer is the last line and the one that
    // carries the stored guarantee. redactString is a no-op when nothing matches, so non-secret details are
    // unchanged. Only string fields are touched (evidence arrays are console/network strings). The auth
    // metadata is scrubbed VALUE-level (redactAuthValues) — NOT via redactObject, whose key-based drop would
    // clobber legitimate fields like `credentialState` (the word "credential" is not a secret here).
    const evidence = redactEvidence(result.evidence);
    const observed: Record<string, unknown> = { evidence };
    if (result.auth) observed.auth = redactAuthValues(result.auth as unknown as Record<string, unknown>);
    const { data: fr } = await this.s.from("v_flow_runs").insert({ preflight_run_id: runId, test_flow_id: result.flowId, user_id: userId, name: result.flowId, state: result.state, observed, severity: result.severity ?? null } as never).select("id").single();
    const flowRunId = (fr as { id?: string } | null)?.id;
    if (flowRunId && result.steps.length) {
      // `expected` WAS HARDCODED null, on a column that already existed for exactly this. 342 stored steps,
      // not one of them recording what the step was looking for, so no verdict in the product's history can
      // be audited after the fact: the record shows "filled" and "text_present" without ever saying with
      // what. The question that cannot be answered from that is whether an assertion was satisfied by the
      // run's own write or by a row left behind by an earlier run, which is the whole false-Verified
      // question.
      //
      // An assertion stores what it sought; a fill stores what it typed. Both are "what this step meant to
      // do", both are the RESOLVED form (the plan's {{unique}} already bound to this run's token), and both
      // are redacted on the way in like every other string here.
      const intent = (st: { expect?: string; value?: string }) => {
        const s = st.expect ?? st.value ?? "";
        return s ? redactString(s).slice(0, 400) : null;
      };
      await this.s.from("v_run_steps").insert(result.steps.map((st, i) => ({ flow_run_id: flowRunId, idx: i, action: st.action, target: st.target ?? null, expected: intent(st), observed: redactString(st.detail ?? ""), status: st.ok ? "ok" : "fail", ms: st.ms })) as never);
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
    // Cost governor (blocker 3): record the run's REAL executed provider time at settlement, in addition
    // to the conservative launch estimate. The launch estimate drives the fast trip; this reconciles the
    // ceiling toward true spend. Both rows SUM (conservative OVER-count is the safe direction for a
    // ceiling — it trips earlier, never later, than reality). Best-effort; never strands the completed run.
    try { await this.recordRealProviderCost(runId); } catch (e) { console.warn(`preflight cost record (${runId}):`, (e as Error).message); }
    // Notify the application's connected webhook endpoints with the launch decision (the one OUTPUT
    // connection). Best-effort and last: a slow or dead endpoint must never affect a completed run.
    try { await this.dispatchWebhooks(runId, decision); } catch (e) { console.warn(`preflight webhook (${runId}):`, (e as Error).message); }
    // THE END OF THE FUNNEL, AND UNTIL NOW THE ONLY STEP NOTHING RECORDED. A run being queued was logged by
    // the acceptance path; a run FINISHING was logged nowhere, because finalizing happens in this worker
    // process and it had never written an event. So the one number that says whether people who start a
    // verification actually get an answer did not exist. Best-effort and after everything that settles the
    // run: an analytics write must never be the reason a completed run is stranded.
    try { await this.logCompletion(runId, decision); } catch (e) { console.warn(`preflight funnel (${runId}):`, (e as Error).message); }
  }

  // Record the completion against the owner, with the decision it ended on, so the funnel can show not just
  // how many runs finished but how many finished Verified, Failed or Blocked. Imported lazily so the worker
  // does not pull the event writer into its startup path.
  private async logCompletion(runId: string, decision: RunDecision): Promise<void> {
    const { data } = await this.s.from("v_preflight_runs")
      .select("user_id, application_id").eq("id", runId).maybeSingle();
    const run = data as { user_id?: string; application_id?: string } | null;
    if (!run?.user_id) return;
    const [{ logEvent }, { EV_RUN_COMPLETED }] = await Promise.all([
      import("../../lib/v-events"),
      import("../../lib/funnel"),
    ]);
    await logEvent({
      userId: run.user_id, eventType: EV_RUN_COMPLETED, actorType: "system", source: "worker",
      metadata: { run_id: runId, decision: String(decision), ...(run.application_id ? { application_id: run.application_id } : {}) },
    });
  }

  // POST the decision to every webhook connection on this run's application. Owner-scoped; payload is
  // owner-safe facts only (see webhook-dispatch). Silent no-op when the app has no webhook connection.
  private async dispatchWebhooks(runId: string, decision: RunDecision): Promise<void> {
    const { data: runRow } = await this.s.from("v_preflight_runs")
      .select("user_id, application_id, deployment_url").eq("id", runId).maybeSingle();
    const run = runRow as { user_id?: string; application_id?: string; deployment_url?: string } | null;
    if (!run?.user_id || !run.application_id) return;

    // Owner-safe payload: decision + flow counts + ids + report link (flow counts are
    // deterministic and already persisted). The SAME payload feeds both delivery
    // channels below, so a receiver sees an identical verification.completed event.
    const { data: flows } = await this.s.from("v_flow_runs").select("state").eq("preflight_run_id", runId);
    const rows = (flows as { state?: string }[] | null) ?? [];
    const payload = buildVerificationPayload({
      runId,
      applicationId: run.application_id,
      decision,
      flowsTotal: rows.length,
      flowsPassed: rows.filter((r) => r.state === "passed").length,
      deploymentUrl: run.deployment_url ?? null,
      appBaseUrl: process.env.VRAELIS_APP_BASE_URL || "https://app.vraelis.com",
    });

    // (1) Per-app connection endpoints (a webhook/slack connection on THIS application).
    // Both kinds carry a destination URL in meta.url; deliverWebhook picks JSON vs Slack.
    const { data: conns } = await this.s.from("v_app_connections")
      .select("meta").eq("user_id", run.user_id).eq("application_id", run.application_id).in("provider", ["webhook", "slack"]);
    const urls = ((conns as { meta?: { url?: string } }[] | null) ?? [])
      .map((c) => c.meta?.url).filter((u): u is string => typeof u === "string" && !!u.trim());
    if (urls.length) {
      const delivered = await dispatchVerificationWebhooks(urls, payload);
      log({ run_id: runId, application_id: run.application_id, event: "webhooks_dispatched", result: `${delivered}/${urls.length}` });
    }

    // (2) Account-level developer webhook endpoints (the owner's API-console webhooks):
    // signed + retry-queued via lib/v-webhooks. Fail-soft and last: a dead endpoint or a
    // pre-migration retry column must never affect the completed run.
    try {
      await deliverVerificationCompleted(run.user_id, payload);
      await runWebhookRetries(20);
    } catch (e) { console.warn(`preflight account webhook (${runId}):`, (e as Error).message); }
  }

  // Sum the actual executed step durations for a run (real browser time) and record a provider-cost row.
  // Uses the persisted v_run_steps.ms (real per-step time), so the governor's ceiling reflects genuine
  // Browserbase seconds rather than only the flat launch estimate.
  private async recordRealProviderCost(runId: string): Promise<void> {
    const { data: run } = await this.s.from("v_preflight_runs").select("user_id").eq("id", runId).maybeSingle();
    const userId = (run as { user_id?: string } | null)?.user_id;
    if (!userId) return;
    // Real executed time = sum of step ms across this run's flow runs.
    const { data: frRows } = await this.s.from("v_flow_runs").select("id").eq("preflight_run_id", runId);
    const flowRunIds = ((frRows as { id?: string }[] | null) ?? []).map((r) => r.id).filter(Boolean) as string[];
    if (flowRunIds.length === 0) return;
    const { data: stepRows } = await this.s.from("v_run_steps").select("ms").in("flow_run_id", flowRunIds);
    const totalMs = ((stepRows as { ms?: number }[] | null) ?? []).reduce((s, r) => s + (Number(r.ms) || 0), 0);
    const seconds = Math.ceil(totalMs / 1000);
    // Rate matches the app-side default (COST_BROWSERBASE_CENTS_PER_MIN, ~2c/min) — worker cannot import
    // the app env helper cleanly, so it reads the same env var with the same default.
    const centsPerMin = Number(process.env.COST_BROWSERBASE_CENTS_PER_MIN);
    const rate = Number.isFinite(centsPerMin) && centsPerMin >= 0 ? centsPerMin : 2;
    const cents = Math.ceil(seconds / 60) * rate;
    await this.s.from("v_cost_ledger" as never).insert({
      user_id: String(userId).trim().toLowerCase(), run_id: runId,
      browserbase_seconds: seconds, ai_tokens: 0, artifact_bytes: 0, estimated_cents: cents,
    } as never);
  }
  async failRun(runId: string, code: string, message: string, executedAnyFlow: boolean): Promise<void> {
    const run = await this.loadRunSettlement(runId);
    // A run already settled as completed (charged) must never be resurrected to queued/failed or refunded.
    if (run && run.state === "completed") return;
    // cancelled, target_mismatch, flow_selection_invalid, blocked_by_policy, and the deterministic
    // worker-config auth failures are deterministic (a retry cannot change them without operator action — the
    // boundaries / missing key / revoked credential / MFA wall do not change on retry) -> terminal
    // immediately. provider_infra_failure follows the normal attempt path (a provider blip may clear).
    const terminal = code === "cancelled" || code === "target_mismatch" || code === "flow_selection_invalid"
      || code === "blocked_by_policy" || DETERMINISTIC_AUTH_FAILURE.has(code) || (run?.attempts ?? 0) >= (run?.max_attempts ?? 3);
    await this.s.from("v_preflight_runs").update({ state: terminal ? "failed" : "queued", failure_code: code, failure_message: message.slice(0, 500), lease_owner: null, lease_expires_at: null }).eq("id", runId);
    // Cost governor (blocker 3): a PROVIDER/INFRA failure feeds the per-account circuit breaker (3 in 15m
    // -> OPEN). This is the refund/infra-loop signal — recorded for EVERY infra failure (retry or terminal),
    // since a fast fail-then-refund churn is exactly what the breaker must catch. App-defect FAILED flows
    // (auth_rejected_by_app, a broken journey) are NOT infra and are never recorded here. Self-contained
    // insert via the worker's own client (no app-lib import); best-effort, never blocks settlement.
    if (run?.user_id && PROVIDER_INFRA_FAILURE.has(code)) {
      try { await this.s.from("v_provider_attempts" as never).insert({ user_id: String(run.user_id).trim().toLowerCase(), run_id: runId, outcome: "infra_failure" } as never); }
      catch (e) { console.warn(`preflight infra-attempt (${runId}):`, (e as Error).message); }
    }
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
      .select("user_id,application_id,contract_id,deployment_url,credits_held,cost_reservation_id,state,attempts,max_attempts")
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
      // A blocked_by_policy or auth_config_failed flow never verified any application behavior: both are
      // treated exactly like a flow that did not run — excluded from reconciliation entirely, so their open
      // issues stay untouched (unverified) and they can never open, continue, or resolve anything. Neither
      // a policy refusal nor a worker/config auth failure is an application defect. (auth_rejected_by_app,
      // the one real auth defect, arrives here as a normal "failed" state and IS reconciled below.)
      if (result.state === "blocked_by_policy" || result.state === "auth_config_failed") continue;
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
        // Refreshed with THIS run's evidence: a still-failing issue should hand over the latest console and
        // network detail, not the transcript of the first time it broke.
        repair_prompt: buildRepairPrompt(issue, { deploymentUrl: run.deployment_url ?? null }),
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
        // The deterministic hedge goes in the existing INTERPRETATION column, which the report already
        // renders under "Possible cause (interpretation)". The title stays observational; the guess lives
        // here, where it is visibly labelled as one. An AI cause, when there is one, overwrites this.
        likely_cause: issue.possible_explanation,
        // The paste-ready handover to whatever built the app. Deterministic, built only from what this run
        // observed. Until now this column was written by nothing, so the report's copy button never
        // appeared and a failure ended with the owner on their own.
        repair_prompt: buildRepairPrompt(issue, { deploymentUrl: run.deployment_url ?? null }),
        evidence: { ...issue.evidence, requirement_refs: issue.requirement_refs },
        status: "open", first_seen_run: runId, last_seen_run: runId,
      } as never);
      if (error) console.warn(`preflight open issue (${runId}):`, error.message);
    }
  }
}
