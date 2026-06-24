// Evaluation workspace: projects + the dashboard/library aggregation that makes
// Vraelis feel like a place you manage creative decisions over time (not one-off).
// Everything is scoped by user_id; no cross-user reads. Tolerant of a missing
// v_projects table / project_id column (pre-migration) — degrades to "no projects".

import { getSupabaseAdminClient, isDatabaseConfigured } from "./supabase-admin";
import { OPTION_LETTERS, type VTest, type VReport } from "./v-db";
import { evaluationIntelligence, evaluationHealth } from "./v-intelligence";
import { logEvent } from "./v-events";
import { getOrCreatePersonalWorkspace } from "./v-workspace";

const norm = (e: string) => e.trim().toLowerCase();

export type Project = { id: string; user_id?: string; name: string; description: string | null; created_at: string; updated_at: string; evaluation_count?: number };

export type EvalRow = {
  id: string; title: string; status: string; project_id: string | null; project_name: string | null;
  votes_valid: number; votes_target: number; created_at: string; completed_at: string | null;
  share_enabled: boolean; share_token: string | null;
  recommended: string | null; confidence: string | null; health: string | null;
  followup_type?: string | null;
};

export type WorkspaceStats = { total: number; active: number; completed: number; validJudgments: number };

// ── Projects CRUD ──────────────────────────────────────────────────────────
export async function createProject(userId: string, name: string, description?: string): Promise<{ ok: boolean; id?: string }> {
  if (!userId || !isDatabaseConfigured()) return { ok: false };
  const nm = (name || "").trim().slice(0, 120);
  if (!nm) return { ok: false };
  const s = getSupabaseAdminClient();
  // New projects belong to the creator's personal workspace (null pre-migration so
  // old paths keep working). Retry without workspace_id if the column isn't there yet.
  const ws = await getOrCreatePersonalWorkspace(userId);
  const base = { user_id: norm(userId), name: nm, description: (description || "").trim().slice(0, 600) || null };
  let res = await s.from("v_projects" as never).insert((ws ? { ...base, workspace_id: ws.id } : base) as never).select("id").single();
  if (res.error && ws) res = await s.from("v_projects" as never).insert(base as never).select("id").single();
  const { data, error } = res;
  if (error || !data) { console.error("createProject:", error?.message); return { ok: false }; }
  const id = (data as unknown as { id: string }).id;
  await logEvent({ userId: norm(userId), eventType: "project_created", actorType: "owner", source: "app", metadata: { project_id: id } });
  if (ws) await logEvent({ userId: norm(userId), eventType: "project_added_to_workspace", actorType: "owner", source: "app", metadata: { project_id: id, workspace_id: ws.id } });
  return { ok: true, id };
}

export async function updateProject(userId: string, id: string, patch: { name?: string; description?: string }): Promise<{ ok: boolean }> {
  if (!userId || !id || !isDatabaseConfigured()) return { ok: false };
  const s = getSupabaseAdminClient();
  // Ownership: only update rows that belong to this user.
  const set: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.name === "string" && patch.name.trim()) set.name = patch.name.trim().slice(0, 120);
  if (typeof patch.description === "string") set.description = patch.description.trim().slice(0, 600) || null;
  const { data, error } = await s.from("v_projects" as never).update(set as never).eq("id", id).eq("user_id", norm(userId)).select("id");
  if (error || !data || (data as unknown[]).length === 0) return { ok: false };
  await logEvent({ userId: norm(userId), eventType: "project_updated", actorType: "owner", source: "app", metadata: { project_id: id } });
  return { ok: true };
}

export async function getProject(userId: string, id: string): Promise<Project | null> {
  if (!userId || !id || !isDatabaseConfigured()) return null;
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_projects" as never)
      .select("id,name,description,created_at,updated_at").eq("id", id).eq("user_id", norm(userId)).maybeSingle();
    if (error || !data) return null;
    return data as unknown as Project;
  } catch { return null; }
}

// A user's projects, newest-touched first, each with its evaluation count.
export async function listProjects(userId: string): Promise<Project[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const { data, error } = await s.from("v_projects" as never)
      .select("id,name,description,created_at,updated_at").eq("user_id", norm(userId))
      .order("updated_at", { ascending: false }).limit(100);
    if (error) return [];
    const projects = (data as unknown as Project[]) ?? [];
    if (!projects.length) return projects;
    // Batch the per-project evaluation count in one query (user-scoped).
    let { data: tests, error: tErr } = await s.from("v_tests" as never).select("project_id,is_sandbox").eq("user_id", norm(userId));
    if (tErr) ({ data: tests } = await s.from("v_tests" as never).select("project_id").eq("user_id", norm(userId))); // pre-migration
    const counts: Record<string, number> = {};
    for (const t of (tests as unknown as { project_id: string | null; is_sandbox?: boolean }[]) ?? []) if (t.project_id && !t.is_sandbox) counts[t.project_id] = (counts[t.project_id] ?? 0) + 1;
    return projects.map((p) => ({ ...p, evaluation_count: counts[p.id] ?? 0 }));
  } catch { return []; }
}

// Move an evaluation into a project (or out, with projectId=null). Verifies the
// user owns BOTH the evaluation and the target project. Logs a safe event.
export async function assignTestToProject(userId: string, testId: string, projectId: string | null): Promise<{ ok: boolean }> {
  if (!userId || !testId || !isDatabaseConfigured()) return { ok: false };
  const s = getSupabaseAdminClient();
  const uid = norm(userId);
  if (projectId) {
    const { data: proj } = await s.from("v_projects" as never).select("id").eq("id", projectId).eq("user_id", uid).maybeSingle();
    if (!proj) return { ok: false }; // not the user's project
  }
  const { data, error } = await s.from("v_tests" as never).update({ project_id: projectId } as never).eq("id", testId).eq("user_id", uid).select("id");
  if (error || !data || (data as unknown[]).length === 0) return { ok: false }; // not the user's test
  await logEvent({ userId: uid, eventType: "evaluation_assigned_to_project", actorType: "owner", source: "app", metadata: { test_id: testId, project_id: projectId ?? "none", action: projectId ? "assigned" : "removed" } });
  return { ok: true };
}

// ── Dashboard / library aggregation ────────────────────────────────────────
// Enriched evaluation rows: tests + their reports (batched) + project names, with
// the recommended output letter and directional confidence derived per row. Two
// reads total (tests, reports) — fine at current volume.
export async function listEvaluations(userId: string, opts: { projectId?: string; limit?: number } = {}): Promise<EvalRow[]> {
  if (!userId || !isDatabaseConfigured()) return [];
  try {
    const s = getSupabaseAdminClient();
    const uid = norm(userId);
    const lim = Math.min(opts.limit ?? 60, 100);
    const COLS_FULL = "id,title,status,project_id,votes_valid,votes_target,created_at,completed_at,share_enabled,share_token,is_sandbox,followup_type";
    const COLS_NOFOLLOWUP = "id,title,status,project_id,votes_valid,votes_target,created_at,completed_at,share_enabled,share_token,is_sandbox";
    const run = (cols: string) => { let q = s.from("v_tests" as never).select(cols).eq("user_id", uid).order("created_at", { ascending: false }).limit(lim); if (opts.projectId) q = q.eq("project_id", opts.projectId); return q; };
    let { data: testsData, error } = await run(COLS_FULL);
    if (error) ({ data: testsData, error } = await run(COLS_NOFOLLOWUP)); // followup_type column absent (pre-this-migration) — keep project filter
    if (error) {
      // Pre-migration: project_id may not exist yet. Fall back without it so a
      // user's existing evaluations still list (just unfiled). A project filter
      // can't apply without the column, so it returns empty in that case.
      if (opts.projectId) return [];
      ({ data: testsData, error } = await s.from("v_tests" as never)
        .select("id,title,status,votes_valid,votes_target,created_at,completed_at,share_enabled,share_token")
        .eq("user_id", uid).order("created_at", { ascending: false }).limit(lim));
      if (error) return [];
    }
    // Exclude developer sandbox evaluations from the library (undefined = production).
    const tests = ((testsData as unknown as VTest[]) ?? []).filter((t) => !t.is_sandbox);
    if (!tests.length) return [];

    const completedIds = tests.filter((t) => t.status === "complete").map((t) => t.id);
    const reportByTest: Record<string, VReport["results"]> = {};
    if (completedIds.length) {
      const { data: reps } = await s.from("v_reports" as never).select("test_id,results").in("test_id", completedIds);
      for (const r of (reps as unknown as { test_id: string; results: VReport["results"] }[]) ?? []) reportByTest[r.test_id] = r.results;
    }
    const projById: Record<string, string> = {};
    const projectIds = [...new Set(tests.map((t) => t.project_id).filter(Boolean) as string[])];
    if (projectIds.length) {
      const { data: projs } = await s.from("v_projects" as never).select("id,name").eq("user_id", uid).in("id", projectIds);
      for (const p of (projs as unknown as { id: string; name: string }[]) ?? []) projById[p.id] = p.name;
    }

    return tests.map((t) => {
      let recommended: string | null = null, confidence: string | null = null;
      let health: string | null = t.status === "active" ? "Collecting" : null;
      const results = reportByTest[t.id];
      if (results) {
        const intel = evaluationIntelligence(results, t.votes_target);
        recommended = intel.recommendedOption ? `Option ${intel.recommendedOption}` : null;
        confidence = intel.confidenceLabel === "None" ? null : intel.confidenceLabel;
        health = evaluationHealth("complete", intel);
      }
      return {
        id: t.id, title: t.title, status: t.status, project_id: t.project_id ?? null,
        project_name: t.project_id ? projById[t.project_id] ?? null : null,
        votes_valid: t.votes_valid, votes_target: t.votes_target, created_at: t.created_at, completed_at: t.completed_at,
        share_enabled: !!t.share_enabled, share_token: t.share_token ?? null,
        recommended, confidence, health,
        followup_type: (t as unknown as { followup_type?: string | null }).followup_type ?? null,
      };
    });
  } catch { return []; }
}

export async function workspaceStats(userId: string): Promise<WorkspaceStats> {
  const empty: WorkspaceStats = { total: 0, active: 0, completed: 0, validJudgments: 0 };
  if (!userId || !isDatabaseConfigured()) return empty;
  try {
    const s = getSupabaseAdminClient();
    let { data, error } = await s.from("v_tests" as never).select("status,votes_valid,is_sandbox").eq("user_id", norm(userId));
    if (error) ({ data, error } = await s.from("v_tests" as never).select("status,votes_valid").eq("user_id", norm(userId))); // pre-migration
    if (error) return empty;
    const rows = ((data as unknown as { status: string; votes_valid: number; is_sandbox?: boolean }[]) ?? []).filter((r) => !r.is_sandbox);
    return {
      total: rows.length,
      active: rows.filter((r) => r.status === "active").length,
      completed: rows.filter((r) => r.status === "complete").length,
      validJudgments: rows.reduce((a, r) => a + (r.votes_valid || 0), 0),
    };
  } catch { return empty; }
}

// Project detail stats + the project's evaluations.
export async function projectStats(userId: string, projectId: string): Promise<{ evaluations: number; completed: number; validJudgments: number; rows: EvalRow[] }> {
  const rows = await listEvaluations(userId, { projectId, limit: 100 });
  return {
    evaluations: rows.length,
    completed: rows.filter((r) => r.status === "complete").length,
    validJudgments: rows.reduce((a, r) => a + (r.votes_valid || 0), 0),
    rows,
  };
}

export { OPTION_LETTERS };
