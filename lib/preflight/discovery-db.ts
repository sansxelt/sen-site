// Owner-scoped data layer for Vraelis Preflight DISCOVERY. Service-role client scoped by user_id =
// lowercased email (the same ownership model as lib/v-applications.ts); every read/write degrades to
// null / [] / false / no-op when the Phase-2 tables (v_discovery_snapshots + the provenance columns on
// v_contract_requirements / v_test_flows) are not migrated yet, so the route stack still compiles and
// cleanly no-ops before sql/vraelis-preflight-2-discovery.sql is applied. Server-only. It NEVER deletes a
// prior row: a failed run marks its own snapshot 'failed' and leaves the last successful discovery + all
// existing requirements intact.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import type { PageSnapshot } from "./discover-extract";
import { fingerprint } from "./contract-merge";
import type { MergePlan, MergeReq, SourceRef, ReqOrigin, ReqState } from "./contract-merge";
import type { Severity } from "../v-applications";
import type { Synthesis } from "./discover-synthesis";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// Discovery lifecycle. Terminal states end a run; anything else means a run is still active. The DB column
// is plain text (no CHECK), so the richer intermediate states persist fine even though migration 1 only
// documents the coarse set.
export type DiscoveryState =
  | "pending" | "running" | "fetching" | "extracting" | "synthesizing" | "persisting"
  | "completed" | "partial" | "failed" | "cancelled";
const TERMINAL: DiscoveryState[] = ["completed", "partial", "failed", "cancelled"];
const ACTIVE: DiscoveryState[] = ["pending", "running", "fetching", "extracting", "synthesizing", "persisting"];
function isTerminal(s: DiscoveryState): boolean { return TERMINAL.includes(s); }

export type DiscoveryRow = {
  id: string; application_id: string; user_id: string; version: number; state: DiscoveryState;
  pages: unknown; failures: { url: string; reason: string }[]; content_hash: string | null;
  source_url: string | null; pages_count: number; started_at: string; completed_at: string | null; error: string | null;
};

// Latest RECENT non-terminal snapshot for the app (the "one active per app" guard), else null. Bounded to
// the last 15 minutes so an interrupted run (worker crash / redeploy mid-after()) auto-clears instead of
// locking discovery for the app forever.
const ACTIVE_WINDOW_MS = 15 * 60 * 1000;
export async function getActiveDiscovery(owner: string, appId: string): Promise<DiscoveryRow | null> {
  if (!isDatabaseConfigured()) return null;
  const { data } = await db().from("v_discovery_snapshots").select("*")
    .eq("user_id", norm(owner)).eq("application_id", appId)
    .in("state", ACTIVE as string[])
    .gt("started_at", new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString())
    .order("version", { ascending: false }).limit(1).maybeSingle();
  return (data as unknown as DiscoveryRow) ?? null;
}

// Latest snapshot by version (any state) — what the GET status endpoint reads.
export async function getLatestDiscovery(owner: string, appId: string): Promise<DiscoveryRow | null> {
  if (!isDatabaseConfigured()) return null;
  const { data } = await db().from("v_discovery_snapshots").select("*")
    .eq("user_id", norm(owner)).eq("application_id", appId)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  return (data as unknown as DiscoveryRow) ?? null;
}

// Insert a fresh discovery row (version = max(existing)+1, state 'running'). Never touches prior rows. The
// idempotency key is persisted; a partial-unique index on active-state rows is the DB backstop that makes a
// concurrent double-submit collide here (insert error -> null -> the route re-checks + returns 409).
export async function createDiscovery(owner: string, appId: string, idempotencyKey?: string): Promise<{ id: string; version: number } | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(owner);
  const latest = await getLatestDiscovery(uid, appId);
  const version = (latest?.version ?? 0) + 1;
  const { data, error } = await db().from("v_discovery_snapshots").insert({
    application_id: appId, user_id: uid, version, state: "running", started_at: new Date().toISOString(),
    ...(idempotencyKey ? { idempotency_key: idempotencyKey.slice(0, 100) } : {}),
  } as never).select("id, version").single();
  if (error || !data) return null;
  const row = data as unknown as { id: string; version: number };
  return { id: row.id, version: row.version };
}

// Advance a run's lifecycle state (sets completed_at when the new state is terminal).
export async function setDiscoveryState(owner: string, id: string, state: DiscoveryState): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const fields: Record<string, unknown> = { state };
  if (isTerminal(state)) fields.completed_at = new Date().toISOString();
  const { error } = await db().from("v_discovery_snapshots").update(fields as never)
    .eq("user_id", norm(owner)).eq("id", id);
  return !error;
}

// Persist the deterministic crawl result onto the run row (the durable last-success snapshot).
export async function persistDiscoverySnapshot(owner: string, id: string, snap: {
  pages: PageSnapshot[]; failures: { url: string; reason: string }[]; contentHash: string; pagesCount: number; sourceUrl: string; state: DiscoveryState;
}): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const fields: Record<string, unknown> = {
    pages: snap.pages, failures: snap.failures, content_hash: snap.contentHash,
    pages_count: snap.pagesCount, source_url: snap.sourceUrl, state: snap.state,
  };
  if (isTerminal(snap.state)) fields.completed_at = new Date().toISOString();
  const { error } = await db().from("v_discovery_snapshots").update(fields as never)
    .eq("user_id", norm(owner)).eq("id", id);
  return !error;
}

// Mark THIS run failed (state 'failed' + error). Never deletes; the last successful discovery survives.
export async function failDiscovery(owner: string, id: string, error: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { error: err } = await db().from("v_discovery_snapshots").update({
    state: "failed", error: (error || "discovery_failed").slice(0, 500), completed_at: new Date().toISOString(),
  } as never).eq("user_id", norm(owner)).eq("id", id);
  return !err;
}

type ReqRow = {
  id: string; fingerprint: string | null; requirement: string; category: string; severity: string;
  origin: string | null; review_state: string | null; user_modified: boolean | null; stale: boolean | null;
  source_refs: unknown; discovery_version_last_suggested: number | null;
};

// Existing requirements for a contract, shaped for the pure merge planner. Rows without a stored
// fingerprint get a computed one so re-runs merge instead of duplicating.
export async function listRequirementsForMerge(owner: string, contractId: string): Promise<MergeReq[]> {
  if (!isDatabaseConfigured()) return [];
  const { data, error } = await db().from("v_contract_requirements")
    .select("id, fingerprint, requirement, category, severity, origin, review_state, user_modified, stale, source_refs, discovery_version_last_suggested")
    .eq("user_id", norm(owner)).eq("contract_id", contractId);
  if (error || !data) return []; // provenance columns not migrated yet -> treat as no existing requirements
  return (data as unknown as ReqRow[]).map((r) => ({
    id: r.id,
    fingerprint: r.fingerprint || fingerprint(r.category, r.requirement),
    requirement: r.requirement, category: r.category, severity: r.severity as Severity,
    origin: (r.origin as ReqOrigin) || "user", review_state: (r.review_state as ReqState) || "approved",
    user_modified: !!r.user_modified, stale: !!r.stale,
    source_refs: Array.isArray(r.source_refs) ? (r.source_refs as SourceRef[]) : [],
    discovery_version_last_suggested: r.discovery_version_last_suggested ?? null,
  }));
}

// Apply a merge plan: insert new discovery suggestions, patch existing rows. Best-effort per row so one
// bad row never aborts the whole merge (and a unique-fingerprint conflict from a concurrent run is a no-op).
export async function applyMergePlan(
  owner: string, contractId: string, plan: MergePlan, discoveryVersion: number, synthEnabledByFp: Record<string, boolean>,
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const uid = norm(owner);
  for (const ins of plan.inserts) {
    try {
      await db().from("v_contract_requirements").insert({
        contract_id: contractId, user_id: uid,
        category: ins.category, requirement: ins.requirement, severity: ins.severity,
        enabled: synthEnabledByFp[ins.fingerprint] ?? false,
        // S7 provenance: `source` carries the validated single-strongest-source tag (closed set in
        // discover-synthesis); `origin` is "inference" for deterministic connection-signal suggestions.
        // Both fall back to the pre-S7 value so an old-style plan still writes honest columns.
        origin: ins.origin ?? "discovery", review_state: "suggested", source: ins.source ?? "discovery",
        fingerprint: ins.fingerprint, source_refs: ins.source_refs ?? [],
        reasoning_summary: ins.reasoning_summary ?? null,
        discovery_version_created: discoveryVersion,
        discovery_version_last_suggested: ins.discovery_version_last_suggested,
      } as never);
    } catch { /* best-effort per row */ }
  }
  for (const upd of plan.updates) {
    try {
      const patch = upd.patch as Record<string, unknown>;
      const fields: Record<string, unknown> = {};
      for (const k of ["requirement", "category", "severity", "stale", "source_refs", "discovery_version_last_suggested"] as const) {
        if (k in patch && patch[k] !== undefined) fields[k] = patch[k];
      }
      if (Object.keys(fields).length === 0) continue;
      await db().from("v_contract_requirements").update(fields as never).eq("user_id", uid).eq("id", upd.id);
    } catch { /* best-effort per row */ }
  }
}

// Insert discovery-suggested test flows (disabled, review_state 'suggested'). Deduped by fingerprint via a
// select-then-insert; the unique index (contract_id, fingerprint) is the backstop for a race.
export async function insertFlowSuggestions(
  owner: string, contractId: string, synthesis: Synthesis, discoveryVersion: number,
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const uid = norm(owner);
  for (const f of (synthesis.flows || []).slice(0, 40)) {
    const fp = fingerprint(f.name, f.goal);
    try {
      const { data: existing } = await db().from("v_test_flows").select("id")
        .eq("user_id", uid).eq("contract_id", contractId).eq("fingerprint", fp).maybeSingle();
      if (existing) continue;
      const sourceRefs: SourceRef[] = [
        { type: "discovery_version", reference: String(discoveryVersion) },
        ...((f.requirement_refs || []).slice(0, 12).map((r) => ({ type: "requirement_ref", reference: r }))),
      ];
      await db().from("v_test_flows").insert({
        contract_id: contractId, user_id: uid,
        name: f.name.slice(0, 200), goal: (f.goal || "").slice(0, 500) || null,
        role: (f.role || "").slice(0, 60) || null, start_path: (f.start_path || "").slice(0, 300) || null,
        steps: f.steps ?? [], priority: f.priority, enabled: false,
        origin: "discovery", review_state: "suggested", fingerprint: fp,
        auth_required: !!f.auth_required, mobile_relevant: !!f.mobile_relevant, source_refs: sourceRefs,
      } as never);
    } catch { /* best-effort per row; unique index also guards dupes */ }
  }
}
