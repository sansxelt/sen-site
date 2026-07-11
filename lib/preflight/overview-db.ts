// Owner-wide reads for the restructured signed-in product: Production Passes (/app/passes), Issues
// (/app/issues), Repairs (/app/repairs), and the dashboard counts. Everything is service-role scoped by
// user_id = lowercased email (the same ownership model as v-applications.ts / runs-db.ts) and degrades to
// [] / 0 when the tables are unmigrated or a read fails, so no page ever fabricates data. Server-only.
// NEVER returns a storage path, provider session id, lease field, or billing internal.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// App id -> name for a set of ids (one query; missing ids simply resolve to null).
async function appNames(owner: string, ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return out;
  const { data } = await db().from("v_applications").select("id, name").eq("user_id", norm(owner)).in("id", unique);
  for (const r of (data as Record<string, unknown>[] | null) ?? []) out.set(String(r.id), String(r.name ?? ""));
  return out;
}

// ── Production Passes (owner-wide run history) ────────────────────────────────────────────────────────
export type PassRow = {
  id: string; applicationId: string; applicationName: string;
  state: string; decision: string | null;                       // ready | needs_review | blocked | null
  deploymentUrl: string | null; parentRunId: string | null;
  createdAt: string; completedAt: string | null;
  flowsTotal: number; flowsPassed: number; criticalTotal: number; criticalPassed: number;
};

export async function listAllRuns(owner: string, limit = 50): Promise<PassRow[]> {
  if (!isDatabaseConfigured()) return [];
  const { data, error } = await db().from("v_preflight_runs")
    .select("id, application_id, state, decision, summary, deployment_url, created_at, completed_at")
    .eq("user_id", norm(owner)).order("created_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  const rows = data as Record<string, unknown>[];
  const names = await appNames(owner, rows.map((r) => String(r.application_id ?? "")));
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
  return rows.map((r) => {
    const s = (r.summary as Record<string, unknown>) ?? {};
    return {
      id: String(r.id), applicationId: String(r.application_id ?? ""),
      applicationName: names.get(String(r.application_id ?? "")) ?? "",
      state: String(r.state ?? "draft"), decision: (r.decision as string) ?? null,
      deploymentUrl: (r.deployment_url as string) ?? null,
      parentRunId: (r as { parent_run_id?: string }).parent_run_id ?? null, // present after migration 3
      createdAt: String(r.created_at ?? ""), completedAt: (r.completed_at as string) ?? null,
      flowsTotal: num(s.flows_total), flowsPassed: num(s.flows_passed),
      criticalTotal: num(s.critical_total), criticalPassed: num(s.critical_passed),
    };
  });
}

// ── Issues (owner-wide blockers) ──────────────────────────────────────────────────────────────────────
export type IssueRow = {
  id: string; applicationId: string; applicationName: string;
  severity: string; category: string | null; title: string; status: string;   // open | resolved
  firstSeenRun: string | null; lastSeenRun: string | null; resolvedRun: string | null;
  flowId: string | null; createdAt: string;
};

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export async function listAllIssues(owner: string, opts: { status?: "open" | "resolved"; applicationId?: string; limit?: number } = {}): Promise<IssueRow[]> {
  if (!isDatabaseConfigured()) return [];
  let q = db().from("v_issues")
    .select("id, application_id, severity, category, title, status, first_seen_run, last_seen_run, resolved_run, flow_id, created_at")
    .eq("user_id", norm(owner)).order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.applicationId) q = q.eq("application_id", opts.applicationId);
  const { data, error } = await q;
  if (error || !data) return [];
  const rows = data as Record<string, unknown>[];
  const names = await appNames(owner, rows.map((r) => String(r.application_id ?? "")));
  return rows.map((r) => ({
    id: String(r.id), applicationId: String(r.application_id ?? ""),
    applicationName: names.get(String(r.application_id ?? "")) ?? "",
    severity: String(r.severity ?? "medium"), category: (r.category as string) ?? null,
    title: String(r.title ?? ""), status: String(r.status ?? "open"),
    firstSeenRun: (r.first_seen_run as string) ?? null, lastSeenRun: (r.last_seen_run as string) ?? null,
    resolvedRun: (r.resolved_run as string) ?? null, flowId: (r.flow_id as string) ?? null,
    createdAt: String(r.created_at ?? ""),
  })).sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));
}

// ── Repairs (real v_repairs rows only; no invented automation) ────────────────────────────────────────
export type RepairRow = {
  id: string; status: string;                                    // suggested | applied_by_user | verified | failed
  issueId: string; issueTitle: string; issueSeverity: string;
  applicationId: string; applicationName: string;
  verificationRunId: string | null; fixPrompt: string | null; createdAt: string;
};

export async function listRepairs(owner: string, limit = 100): Promise<RepairRow[]> {
  if (!isDatabaseConfigured()) return [];
  const uid = norm(owner);
  const { data, error } = await db().from("v_repairs")
    .select("id, issue_id, status, fix_prompt, verification_run_id, created_at")
    .eq("user_id", uid).order("created_at", { ascending: false }).limit(limit);
  if (error || !data) return [];
  const rows = data as Record<string, unknown>[];
  if (!rows.length) return [];
  // Join issue title/severity/application in one query, then app names.
  const issueIds = Array.from(new Set(rows.map((r) => String(r.issue_id ?? "")).filter(Boolean)));
  const issueById = new Map<string, { title: string; severity: string; applicationId: string }>();
  if (issueIds.length) {
    const { data: iss } = await db().from("v_issues").select("id, title, severity, application_id").eq("user_id", uid).in("id", issueIds);
    for (const i of (iss as Record<string, unknown>[] | null) ?? []) {
      issueById.set(String(i.id), { title: String(i.title ?? ""), severity: String(i.severity ?? "medium"), applicationId: String(i.application_id ?? "") });
    }
  }
  const names = await appNames(owner, Array.from(issueById.values()).map((i) => i.applicationId));
  return rows.map((r) => {
    const iss = issueById.get(String(r.issue_id ?? ""));
    return {
      id: String(r.id), status: String(r.status ?? "suggested"),
      issueId: String(r.issue_id ?? ""), issueTitle: iss?.title ?? "", issueSeverity: iss?.severity ?? "medium",
      applicationId: iss?.applicationId ?? "", applicationName: iss ? (names.get(iss.applicationId) ?? "") : "",
      verificationRunId: (r.verification_run_id as string) ?? null,
      fixPrompt: (r.fix_prompt as string) ?? null, createdAt: String(r.created_at ?? ""),
    };
  });
}

// ── Dashboard counts (cheap head-count queries; each degrades to 0) ───────────────────────────────────
export type OverviewCounts = { openCriticalIssues: number; runningPasses: number; verifiedRepairs: number };
export async function overviewCounts(owner: string): Promise<OverviewCounts> {
  if (!isDatabaseConfigured()) return { openCriticalIssues: 0, runningPasses: 0, verifiedRepairs: 0 };
  const uid = norm(owner);
  const count = async (q: PromiseLike<{ count: number | null; error: unknown }>) => {
    try { const { count: c, error } = await q; return error ? 0 : (c ?? 0); } catch { return 0; }
  };
  const [openCriticalIssues, runningPasses, verifiedRepairs] = await Promise.all([
    count(db().from("v_issues").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "open").in("severity", ["critical", "high"])),
    count(db().from("v_preflight_runs").select("id", { count: "exact", head: true }).eq("user_id", uid).in("state", ["queued", "discovering", "running", "analyzing"])),
    count(db().from("v_repairs").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "verified")),
  ]);
  return { openCriticalIssues, runningPasses, verifiedRepairs };
}
