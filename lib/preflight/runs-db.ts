// Owner-scoped data layer for Vraelis Preflight RUNS; the RUN half of the vertical loop (the discovery
// half lives in discovery-db.ts). Service-role client scoped by user_id = lowercased email, the same
// ownership model as lib/v-applications.ts (RLS is only a deny-anon backstop). Every read/write degrades to
// null / [] / a coarse code when the run tables are not migrated yet, so the route stack compiles and
// cleanly no-ops before the run migration is applied. Server-only. The reads here are the POLLING payload
// for a live run: the run header, its per-flow steps, and the deterministic issues. They NEVER surface a
// provider session id, a storage path, a signed URL, a lease field, or any billing internal; owner-safe
// fields only. Browser execution / decisions live on the worker; this is just the run read plane + the two
// cooperative mutations the owner is allowed to make (request cancel; mint a signed artifact URL).
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { listRuns, listFlows, type RunSummary } from "../v-applications";
import { dedupBlocksReplacement, submissionIdForAttempt, submissionPayloadOf } from "./flow-selection";
import { snapshotIfChanged } from "./context-snapshots";
import { deploymentForRun } from "./deployments-db";
import type { Issue } from "./issues";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// Run lifecycle (mirrors worker/preflight/run-store-postgres.ts). A cancel request is only meaningful
// before a terminal state; the worker observes cancel_requested_at on its next heartbeat and aborts.
export type RunState = "draft" | "queued" | "discovering" | "running" | "analyzing" | "completed" | "failed" | "cancelled";
const TERMINAL_RUN_STATES: RunState[] = ["completed", "failed", "cancelled"];
function isTerminalRun(state: string): boolean { return (TERMINAL_RUN_STATES as string[]).includes(state); }

// ── Polling payload (owner-safe fields only) ──
export type RunStep = { idx: number; action: string | null; target: string | null; observed: string | null; status: string | null; ms: number | null };
// The authenticated-flow summary shown on the report (never a secret): role labels, the account LABEL (from
// meta.label, never a username), environment, the resolved credential state, whether session reuse is on,
// the last verified-auth time, and any auth failure classification. Present only on authenticated flows.
export type RunFlowAuth = {
  requiresAuth: true; roles: string[]; accountLabel: string | null; environment: string | null;
  credentialState: "active" | "missing" | "revoked"; sessionReuse: boolean;
  verifiedAuthAt: string | null; authFailure?: string;
};
export type RunFlow = { name: string; state: string; severity: string | null; steps: RunStep[]; auth: RunFlowAuth | null };

// Safely parse the persisted auth blob into the owner-safe RunFlowAuth. Anything unexpected -> null (no
// authenticated-flow panel rendered). NEVER surfaces a username/password/token — the worker only ever wrote
// role labels + an account label, but this defensively drops any field that is not on the allowlist.
function parseFlowAuth(raw: unknown): RunFlowAuth | null {
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;
  if (a.requiresAuth !== true) return null;
  const cred = a.credentialState;
  const credentialState: RunFlowAuth["credentialState"] = cred === "missing" || cred === "revoked" ? cred : "active";
  return {
    requiresAuth: true,
    roles: Array.isArray(a.roles) ? a.roles.filter((x): x is string => typeof x === "string").slice(0, 12) : [],
    accountLabel: typeof a.accountLabel === "string" ? a.accountLabel.slice(0, 80) : null,
    environment: typeof a.environment === "string" ? a.environment.slice(0, 40) : null,
    credentialState, sessionReuse: a.sessionReuse === true,
    verifiedAuthAt: typeof a.verifiedAuthAt === "string" ? a.verifiedAuthAt : null,
    authFailure: typeof a.authFailure === "string" ? a.authFailure.slice(0, 60) : undefined,
  };
}
export type RunHeader = {
  state: string; decision: string | null; summary: Record<string, unknown>;
  deployment_url: string | null; commit_sha: string | null; created_at: string; completed_at: string | null;
  // Coarse, owner-safe failure enum set by the worker (worker/preflight/provider-errors.ts), e.g.
  // provider_capacity / session_timeout. Never a raw provider message (that stays in failure_message,
  // which is server-side only and deliberately NOT selected here).
  failure_code: string | null;
  // Provenance extras behind additive migrations 3 + 4; null when unmigrated. selected_flow_ids is the
  // run snapshot's authoritative flow selection (what "Targeted rerun — 2 flows selected" reads).
  parent_run_id: string | null;
  selected_flow_ids: string[] | null;
};
export type RunIssue = {
  id: string; flow_id: string | null; severity: string; category: string | null; title: string;
  expected: string | null; observed: string | null; repro: unknown; evidence: unknown;
  likely_cause: string | null; confidence: number | null; suggested_areas: string | null; repair_prompt: string | null;
  status: string; first_seen_run: string | null; last_seen_run: string | null; resolved_run: string | null;
};
export type RunDetail = { run: RunHeader; flows: RunFlow[]; issues: RunIssue[] };

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

// Full polling payload for one run, owner-scoped. Returns null when the run is not owned / not found / the
// tables are not migrated. NEVER includes provider_session_id, a storage_path, a signed URL, or any
// lease / billing field; the SELECTs enumerate only owner-safe columns.
export async function getRun(owner: string, runId: string): Promise<RunDetail | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(owner);

  const { data: runRow } = await db().from("v_preflight_runs")
    .select("state, decision, summary, deployment_url, commit_sha, created_at, completed_at, failure_code")
    .eq("user_id", uid).eq("id", runId).maybeSingle();
  if (!runRow) return null;                                        // not owned / not found / not migrated
  const rr = runRow as Record<string, unknown>;

  // Provenance extras behind additive migrations 3 (parent_run_id) + 4 (flow_ids), read separately so a
  // pre-migration schema only loses these fields (data null on the column error), never the whole payload.
  let parentRunId: string | null = null;
  let selectedFlowIds: string[] | null = null;
  const { data: extras } = await db().from("v_preflight_runs")
    .select("parent_run_id, flow_ids").eq("user_id", uid).eq("id", runId).maybeSingle();
  const ex = extras as { parent_run_id?: string | null; flow_ids?: unknown } | null;
  if (ex) {
    parentRunId = (ex.parent_run_id as string) ?? null;
    selectedFlowIds = Array.isArray(ex.flow_ids) ? (ex.flow_ids as unknown[]).map(String) : null;
  }

  // Flow runs (owner-scoped), stable oldest-first. observed carries the sanitized evidence + the S6 auth
  // metadata (never a secret: role labels, account label, credential state) for authenticated flows.
  const { data: flowRows } = await db().from("v_flow_runs")
    .select("id, name, state, severity, observed, created_at")
    .eq("user_id", uid).eq("preflight_run_id", runId)
    .order("created_at", { ascending: true });
  const flowList = (flowRows as Record<string, unknown>[] | null) ?? [];

  // Steps for every flow run in ONE query. v_run_steps has no user_id column, so it is only reachable via a
  // flow_run_id that came from the owner-scoped read above (transitive ownership). Grouped in memory.
  const flowIds = flowList.map((f) => String(f.id));
  const stepsByFlow = new Map<string, RunStep[]>();
  if (flowIds.length) {
    const { data: stepRows } = await db().from("v_run_steps")
      .select("flow_run_id, idx, action, target, observed, status, ms")
      .in("flow_run_id", flowIds)
      .order("idx", { ascending: true });
    for (const s of (stepRows as Record<string, unknown>[] | null) ?? []) {
      const fid = String(s.flow_run_id);
      const arr = stepsByFlow.get(fid) ?? [];
      arr.push({
        idx: Number(s.idx), action: (s.action as string) ?? null, target: (s.target as string) ?? null,
        observed: (s.observed as string) ?? null, status: (s.status as string) ?? null,
        ms: s.ms == null ? null : Number(s.ms),
      });
      stepsByFlow.set(fid, arr);
    }
  }
  const flows: RunFlow[] = flowList.map((f) => ({
    name: String(f.name ?? ""), state: String(f.state ?? "pending"), severity: (f.severity as string) ?? null,
    steps: stepsByFlow.get(String(f.id)) ?? [],
    auth: parseFlowAuth((f.observed as Record<string, unknown> | null)?.auth),
  }));

  // Deterministic issues for this run, most severe first. evidence here is the sanitized deterministic
  // payload (console/network summary, current_url); it carries no storage path or secret.
  const { data: issueRows } = await db().from("v_issues")
    .select("id, flow_id, severity, category, title, expected, observed, repro, evidence, likely_cause, confidence, suggested_areas, repair_prompt, status, first_seen_run, last_seen_run, resolved_run")
    .eq("user_id", uid).eq("run_id", runId);
  const issues: RunIssue[] = ((issueRows as Record<string, unknown>[] | null) ?? []).map((i) => ({
    id: String(i.id), flow_id: (i.flow_id as string) ?? null, severity: String(i.severity ?? "medium"),
    category: (i.category as string) ?? null, title: String(i.title ?? ""), expected: (i.expected as string) ?? null,
    observed: (i.observed as string) ?? null, repro: i.repro ?? [], evidence: i.evidence ?? {},
    likely_cause: (i.likely_cause as string) ?? null, confidence: i.confidence == null ? null : Number(i.confidence),
    suggested_areas: (i.suggested_areas as string) ?? null, repair_prompt: (i.repair_prompt as string) ?? null,
    status: String(i.status ?? "open"), first_seen_run: (i.first_seen_run as string) ?? null,
    last_seen_run: (i.last_seen_run as string) ?? null, resolved_run: (i.resolved_run as string) ?? null,
  })).sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));

  const run: RunHeader = {
    state: String(rr.state ?? "draft"), decision: (rr.decision as string) ?? null,
    summary: (rr.summary as Record<string, unknown>) ?? {}, deployment_url: (rr.deployment_url as string) ?? null,
    commit_sha: (rr.commit_sha as string) ?? null, created_at: String(rr.created_at ?? ""), completed_at: (rr.completed_at as string) ?? null,
    failure_code: (rr.failure_code as string) ?? null,
    parent_run_id: parentRunId, selected_flow_ids: selectedFlowIds,
  };
  return { run, flows, issues };
}

export type CancelResult = "ok" | "not_found" | "unavailable";

// Cooperatively request cancellation of an owned run: set cancel_requested_at=now while it is still
// NON-TERMINAL. Never force-terminates; the worker sees the flag on its next ownership-checked heartbeat
// and aborts browser work itself. Idempotent: a re-request or an already-terminal run is a harmless no-op.
// Returns "not_found" (route 404s) when the run is not owned, so existence is never leaked.
export async function requestRunCancel(owner: string, runId: string): Promise<CancelResult> {
  if (!isDatabaseConfigured()) return "unavailable";
  const uid = norm(owner);
  const { data: runRow } = await db().from("v_preflight_runs")
    .select("state, cancel_requested_at").eq("user_id", uid).eq("id", runId).maybeSingle();
  if (!runRow) return "not_found";
  const rr = runRow as { state?: string; cancel_requested_at?: string | null };
  // Already terminal or already requested -> nothing to do (safe idempotent no-op).
  if (isTerminalRun(String(rr.state ?? "")) || rr.cancel_requested_at) return "ok";
  // Guarded flip: only sets the flag while it is still unset AND the run is non-terminal, so a race with the
  // worker finalizing the run cannot resurrect a cancel on an already-completed run.
  const { error } = await db().from("v_preflight_runs")
    .update({ cancel_requested_at: new Date().toISOString() } as never)
    .eq("user_id", uid).eq("id", runId).is("cancel_requested_at", null)
    .not("state", "in", `(${TERMINAL_RUN_STATES.join(",")})`);
  return error ? "unavailable" : "ok";
}

// Owner + run + artifact ownership check for a single evidence artifact. Returns the PRIVATE storage path
// only when all three hold: the run is owned, the artifact is owned by the same user, and the artifact
// belongs to that run. Null on any mismatch (the route 404s). The path is never returned to the client -
// the route mints a short-TTL signed URL from it and hands out only that.
export async function getRunArtifactPath(owner: string, runId: string, artifactId: string): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(owner);
  // Owner-check the run first (defense in depth; the artifact row is also user-scoped below).
  const { data: runRow } = await db().from("v_preflight_runs").select("id").eq("user_id", uid).eq("id", runId).maybeSingle();
  if (!runRow) return null;
  const { data: art } = await db().from("v_run_artifacts")
    .select("storage_path").eq("user_id", uid).eq("id", artifactId).eq("preflight_run_id", runId).maybeSingle();
  const path = (art as { storage_path?: string } | null)?.storage_path;
  return typeof path === "string" && path.length > 0 ? path : null;
}

// ── Run list + enqueue (the RUN launch plane) ──────────────────────────────────────────────────────────

// Recent runs for an application (lightweight RunSummary rows; no flow/step/issue payload) for the detail
// page. Reuses the owner-scoped, degrade-safe listRuns from the applications data layer rather than
// duplicating the query; one summary shape across the shell.
export async function listRunsForApp(owner: string, appId: string, limit = 20): Promise<RunSummary[]> {
  return listRuns(owner, appId, limit); // transitive ownership: listRuns filters eq("user_id") itself
}

// Count of the owner's runs in a NON-terminal state; the per-owner concurrency cap. Degrades to 0 on a
// missing table / transient error: the caller has already passed preflightDbReady (so the table exists on
// any live path), and the credit hold is the hard abuse limit, so a fail-open blip here is bounded.
export async function ownerActiveRunCount(owner: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const { count, error } = await db().from("v_preflight_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", norm(owner))
    .not("state", "in", `(${TERMINAL_RUN_STATES.join(",")})`);
  if (error) return 0;
  return count ?? 0;
}

// Count of the owner's runs created since UTC midnight; the per-owner DAILY cap (spend/worker-load velocity
// guard). Degrades to 0 on a missing table / transient error for the same reason as ownerActiveRunCount:
// the route has already passed preflightDbReady, and the credit hold remains the hard spend limit, so a
// fail-open blip here is bounded.
export async function ownerRunsToday(owner: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const utcMidnight = new Date();
  utcMidnight.setUTCHours(0, 0, 0, 0);
  const { count, error } = await db().from("v_preflight_runs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", norm(owner))
    .gte("created_at", utcMidnight.toISOString());
  if (error) return 0;
  return count ?? 0;
}

// Titles of the issues a run RESOLVED (owner-scoped; degrades to []). Powers the application overview's
// "Latest repair: <blocker> verified as resolved" line for a targeted repair-verified run.
export async function issuesResolvedByRun(owner: string, runId: string, limit = 5): Promise<string[]> {
  if (!isDatabaseConfigured()) return [];
  const { data } = await db().from("v_issues")
    .select("title").eq("user_id", norm(owner)).eq("resolved_run", runId).limit(limit);
  return ((data as { title?: string }[] | null) ?? []).map((r) => String(r.title ?? "")).filter(Boolean);
}

// A flow is run-eligible exactly as the worker's claim() filters it: enabled AND review_state 'approved'
// (review_state defaults to 'approved' in migration 2; treat an absent column as approved).
function flowApprovedEnabled(f: { enabled: boolean; review_state?: string }): boolean {
  return f.enabled && ((f.review_state ?? "approved") === "approved");
}

export type CreateRunInput = {
  applicationId: string; contractId: string; contractVersion: number | null;
  deploymentUrl: string; submissionId: string; flowIds: string[];
  creditsHeld: number; reservationId: string | null;
  /** Which API key launched this run, for the per-key spend ceiling and audit. Null for a browser session. */
  apiKeyId?: string | null;
};
export type CreateRunResult =
  | { runId: string; flowCount: number }
  | { conflict: true; runId: string | null }
  | null;

// Queue a run: insert exactly ONE v_preflight_runs row (state 'queued') after RE-READING the currently
// eligible flows for the contract (TOCTOU guard; the client's flowIds are trusted only as far as they
// intersect what is enabled+approved right now). The eligible selection is STORED on the row (flow_ids) —
// the worker executes exactly that set, never the whole contract. Deliberately inserts NO child rows: the
// worker creates v_flow_runs / v_run_steps as it executes (worker/preflight/run-store-postgres.ts), so
// pre-creating them here would double them. NEVER executes a browser.
//
// Submission dedup: unique (user_id, submission_id) protects against double-click / concurrent-tab
// duplicates. But an INVALID prior run (invalidated target_mismatch, cancelled, infrastructure failure)
// must not occupy the key forever, so on a collision the existing run's state decides
// (dedupBlocksReplacement): in-flight or completed-valid -> { conflict, runId } (idempotent replay);
// failed/cancelled -> retry with a deterministic replacement id (base-r2, -r3, ...), keeping the
// historical row untouched. Returns null when nothing is eligible or the tables are unmigrated.
const MAX_SUBMISSION_REPLACEMENTS = 5;

export async function createRun(owner: string, input: CreateRunInput): Promise<CreateRunResult> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(owner);

  const requested = new Set(input.flowIds);
  const eligible = (await listFlows(uid, input.contractId))
    .filter((f) => requested.has(f.id) && flowApprovedEnabled(f as { enabled: boolean; review_state?: string }));
  if (!eligible.length) return null;
  const selectedFlowIds = eligible.map((f) => f.id);

  // Pin the context version this run launches under (S3). Best-effort per the migration rule:
  // snapshotIfChanged warns (naming migration 7's sql file) and returns null while v_context_snapshots
  // is missing, and the insert below only carries the column when a snapshot id was actually obtained,
  // retrying without it on a column-missing error, so a launch NEVER fails over context versioning.
  let contextSnapshotId: string | null = null;
  try { contextSnapshotId = (await snapshotIfChanged(uid, input.applicationId, "owner"))?.id ?? null; } catch { contextSnapshotId = null; }
  let pinContext = contextSnapshotId !== null;

  // Pin the deployment identity this run tests (S4), the same best-effort way: deploymentForRun records
  // (or dedupes onto) the v_deployments row for the run's target URL, warning clearly while migration 8
  // is missing, and the insert carries deployment_id only when a row id was actually obtained.
  // api_key_id is additive (migration 16) and follows the SAME best-effort pin pattern as context and
  // deployment: carried only when present, dropped on a column-missing error, never failing the launch.
  // A run that loses its key attribution is a weaker audit trail, not a broken run.
  let pinApiKey = !!input.apiKeyId;

  let deploymentId: string | null = null;
  try { deploymentId = await deploymentForRun(uid, input.applicationId, input.deploymentUrl); } catch { deploymentId = null; }
  let pinDeployment = deploymentId !== null;

  for (let attempt = 0; attempt < MAX_SUBMISSION_REPLACEMENTS; attempt++) {
    const submissionId = submissionIdForAttempt(input.submissionId, attempt);
    const baseRow = {
      user_id: uid, application_id: input.applicationId, contract_id: input.contractId,
      contract_version: input.contractVersion, submission_id: submissionId,
      deployment_url: input.deploymentUrl, state: "queued", flow_ids: selectedFlowIds,
      credits_held: input.creditsHeld, cost_reservation_id: input.reservationId,
    };
    const rowFor = () => {
      let row: Record<string, unknown> = pinContext ? { ...baseRow, context_snapshot_id: contextSnapshotId } : baseRow;
      if (pinDeployment) row = { ...row, deployment_id: deploymentId };
      if (pinApiKey) row = { ...row, api_key_id: input.apiKeyId };
      return row;
    };
    let { data, error } = await db().from("v_preflight_runs").insert(rowFor() as never).select("id").single();
    // ONE combined retry path for BOTH additive pin columns (context_snapshot_id, migration 7;
    // deployment_id, migration 8). A missing column fails the whole insert atomically (nothing was
    // written), so re-inserting the SAME submission id after dropping the named pin can never create a
    // duplicate run. At most one retry per pin; the run itself must always queue.
    while (error && (pinContext || pinDeployment || pinApiKey)) {
      const msg = (error as { message?: string }).message ?? "";
      if (pinContext && /context_snapshot_id/i.test(msg)) {
        console.warn("createRun: v_preflight_runs.context_snapshot_id is missing. Apply sql/vraelis-preflight-7-context-snapshots.sql (migration 7). Run queued without a context pin.");
        pinContext = false;
      } else if (pinApiKey && /api_key_id/i.test(msg)) {
        console.warn("createRun: v_preflight_runs.api_key_id is missing. Apply sql/vraelis-preflight-16-key-spend-ceiling.sql (migration 16). Run queued without key attribution.");
        pinApiKey = false;
      } else if (pinDeployment && /deployment_id/i.test(msg)) {
        console.warn("createRun: v_preflight_runs.deployment_id is missing. Apply sql/vraelis-preflight-8-deployments.sql (migration 8). Run queued without a deployment pin.");
        pinDeployment = false;
      } else break;
      ({ data, error } = await db().from("v_preflight_runs").insert(rowFor() as never).select("id").single());
    }

    if (!error) return { runId: (data as unknown as { id: string }).id, flowCount: selectedFlowIds.length };

    // unique (user_id, submission_id) -> a run for this submission id already exists.
    if ((error as { code?: string }).code === "23505") {
      const { data: existing } = await db().from("v_preflight_runs").select("id, state")
        .eq("user_id", uid).eq("submission_id", submissionId).maybeSingle();
      const ex = existing as { id?: string; state?: string } | null;
      // In flight or completed-valid: the duplicate is refused and the caller gets the existing run.
      if (!ex?.id || dedupBlocksReplacement(String(ex.state ?? ""))) {
        return { conflict: true, runId: ex?.id ?? null };
      }
      continue; // invalid/cancelled occupant: try the next replacement submission id
    }

    // Fail-closed, loudly: an unapplied migration 4 must be an actionable error, never a silent
    // fall-back to "run everything" (that is exactly the targeted-rerun bug this column fixes).
    if (/flow_ids/i.test((error as { message?: string }).message ?? "")) {
      console.error("createRun: v_preflight_runs.flow_ids is missing — apply sql/vraelis-preflight-4-selected-flows.sql");
    }
    return null;
  }
  return null; // replacement budget exhausted (pathological; nothing was inserted this attempt)
}

// Persist a run's deterministic issues (first_seen_run = last_seen_run = runId). Best-effort: a missing
// v_issues table or a bad row degrades to a no-op and never throws into the caller. requirement_refs has no
// column of its own, so it rides inside the deterministic evidence blob to stay with the rest of the evidence.
export async function persistIssues(owner: string, runId: string, appId: string, issues: Issue[]): Promise<void> {
  if (!isDatabaseConfigured() || !issues.length) return;
  const uid = norm(owner);
  const rows = issues.map((iss) => ({
    user_id: uid, application_id: appId, run_id: runId,
    severity: iss.severity, category: iss.category, title: iss.title,
    expected: iss.expected, observed: iss.observed, repro: iss.repro,
    evidence: { ...iss.evidence, requirement_refs: iss.requirement_refs },
    status: iss.status ?? "open", first_seen_run: runId, last_seen_run: runId,
  }));
  const { error } = await db().from("v_issues").insert(rows as never);
  if (error && process.env.NODE_ENV !== "production") console.error("persistIssues:", error.message);
}

// Idempotency-key reuse check. A stored submission_id is "<keyFingerprint>#<payloadFingerprint>", optionally
// carrying createRun's "-rN" replacement suffix when an earlier attempt on the same id was cancelled. A row
// whose key half matches but whose PAYLOAD half does not means the caller reused one key for a different
// request. Answering that with the original run would tell an agent its new selection ran when it did not,
// so the route refuses it. Returns the conflicting run id, or null when the key is unused or correctly
// retried. Both fingerprints are hex, so the LIKE prefix carries no wildcards.
export async function runWithSameKeyDifferentPayload(
  owner: string,
  keyFingerprint: string,
  expectedSubmissionId: string,
): Promise<string | null> {
  if (!isDatabaseConfigured()) return null;
  const payloadOf = (id: string) => id.split("#")[1]?.replace(/-rd+$/, "") ?? "";
  const expected = payloadOf(expectedSubmissionId);
  const { data } = await db().from("v_preflight_runs")
    .select("id, submission_id")
    .eq("user_id", norm(owner))
    .like("submission_id", `${keyFingerprint}#%`)
    .limit(10);
  const rows = (data as { id: string; submission_id: string }[] | null) ?? [];
  const clash = rows.find((r) => submissionPayloadOf(String(r.submission_id)) !== expected);
  return clash ? String(clash.id) : null;
}
