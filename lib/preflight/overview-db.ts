// Owner-wide reads for the restructured signed-in product: Production Passes (/passes), Issues
// (/issues), Repairs (/repairs), and the dashboard counts. Everything is service-role scoped by
// user_id = lowercased email (the same ownership model as v-applications.ts / runs-db.ts) and degrades to
// [] / 0 when the tables are unmigrated or a read fails, so no page ever fabricates data. Server-only.
// NEVER returns a storage path, provider session id, lease field, or billing internal.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { apiTargetIdsForOwner, webRuntimeFilter } from "./runtime/targets-db";
import { internalAppIdsForOwner } from "../v-applications";

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

// WEB Production Passes only — EXCLUDE the owner's api-kind targets (a web run is null-or-web-target; the
// migration-12 optional UPDATE may have set historical web runs non-null, so we exclude api targets rather
// than require NULL). API runs are shown in the API surface, never in the web passes list.
export async function listAllRuns(owner: string, limit = 50): Promise<PassRow[]> {
  if (!isDatabaseConfigured()) return [];
  const filter = webRuntimeFilter(await apiTargetIdsForOwner(owner));
  const internalApps = await internalAppIdsForOwner(owner);
  let q = db().from("v_preflight_runs")
    // parent_run_id (migration 3) is what makes a run a REVERIFICATION of an earlier one. It was read below
    // through a cast but never selected, so PassRow.parentRunId was unconditionally null and every surface
    // that shows the repair relationship has silently shown nothing since the column was added.
    .select("id, application_id, state, decision, summary, deployment_url, parent_run_id, created_at, completed_at")
    .eq("user_id", norm(owner));
  if (filter) q = q.or(filter);
  // Also exclude runs on the internal canary app (e.g. its seeded web-baseline run), so no internal pass
  // shows in the customer Production Passes list.
  if (internalApps.length) q = q.not("application_id", "in", `(${internalApps.join(",")})`);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
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

export async function listAllIssues(owner: string, opts: { status?: "open" | "resolved"; applicationId?: string; limit?: number; webOnly?: boolean } = {}): Promise<IssueRow[]> {
  if (!isDatabaseConfigured()) return [];
  let q = db().from("v_issues")
    .select("id, application_id, severity, category, title, status, first_seen_run, last_seen_run, resolved_run, flow_id, created_at")
    .eq("user_id", norm(owner)).order("created_at", { ascending: false }).limit(opts.limit ?? 100);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.applicationId) q = q.eq("application_id", opts.applicationId);
  // webOnly EXCLUDES api-kind targets so an API-runtime issue never surfaces as a web launch blocker. (A web
  // issue is null-or-web-target; the migration-12 optional UPDATE may have set historical web issues non-null,
  // so we exclude api targets rather than require NULL.) Default off — existing callers keep today's behavior.
  if (opts.webOnly) {
    const filter = webRuntimeFilter(await apiTargetIdsForOwner(owner));
    if (filter) q = q.or(filter);
    // Also exclude internal-canary app issues from the customer web blocker list.
    const internalApps = await internalAppIdsForOwner(owner);
    if (internalApps.length) q = q.not("application_id", "in", `(${internalApps.join(",")})`);
  }
  const { data, error } = await q;
  if (error || !data) return [];
  let rows = data as Record<string, unknown>[];

  // AN ISSUE IS ONLY AS GOOD AS THE RUN THAT SAW IT. When a verdict is invalidated because Vraelis's own
  // defect produced it, the findings that verdict generated are invalidated with it: they describe our bug,
  // not the customer's software. Leaving them would keep the same false story on the dashboard through a
  // different surface, since the critical counts and the needs-attention list are built from issues rather
  // than from runs.
  //
  // Keyed on last_seen_run, the run that most recently OBSERVED the issue. An issue seen again by a valid
  // later run is real and stays, even if some earlier sighting was invalidated.
  const seenRuns = [...new Set(rows.map((r) => String(r.last_seen_run ?? "")).filter(Boolean))];
  if (seenRuns.length) {
    const inv = await db().from("v_preflight_runs").select("id")
      .eq("user_id", norm(owner)).in("id", seenRuns).not("invalidated_at", "is", null);
    // Pre-migration the column does not exist and the query errors; nothing is excluded, which is exactly
    // the behaviour before invalidation existed.
    if (inv.error) {
      if (/invalidated_at/i.test(inv.error.message ?? "")) {
        console.warn("listAllIssues: v_preflight_runs.invalidated_at is missing. Apply sql/vraelis-preflight-24-run-invalidation.sql (migration 24). Verifier-defect findings will still be counted.");
      }
    } else {
      const dead = new Set(((inv.data as { id: string }[] | null) ?? []).map((r) => r.id));
      if (dead.size) rows = rows.filter((r) => !dead.has(String(r.last_seen_run ?? "")));
    }
  }

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
  // Web-scoped: keep NULL/web-target rows, exclude the owner's api-kind targets AND internal-app rows, so
  // neither API runs/issues nor internal-canary scaffolding inflate the web badges.
  const filter = webRuntimeFilter(await apiTargetIdsForOwner(owner));
  const internalApps = await internalAppIdsForOwner(owner);
  const web = (q: { or: (e: string) => unknown; not: (c: string, o: string, v: string) => unknown }) => {
    let out = q;
    if (filter) out = out.or(filter) as typeof out;
    if (internalApps.length) out = out.not("application_id", "in", `(${internalApps.join(",")})`) as typeof out;
    return out;
  };
  const [openCriticalIssues, runningPasses, verifiedRepairs] = await Promise.all([
    count(web(db().from("v_issues").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "open").in("severity", ["critical", "high"])) as never),
    count(web(db().from("v_preflight_runs").select("id", { count: "exact", head: true }).eq("user_id", uid).in("state", ["queued", "discovering", "running", "analyzing"])) as never),
    count(db().from("v_repairs").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "verified")),
  ]);
  return { openCriticalIssues, runningPasses, verifiedRepairs };
}
