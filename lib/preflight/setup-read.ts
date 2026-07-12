// READ side of the application setup extras (environment / context / test_boundaries on v_applications)
// plus small bulk lookups the display pages need (environments and source connections for a set of apps).
// Owner-scoped like the rest of the data plane (service-role client, eq user_id = lowercased email) and
// DEFENSIVE against a pre-migration-5 schema: the extra columns are selected in their own query, so a
// missing column degrades to nulls/empty, never an error page. Server-only. Never selects encrypted_ref.
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { normalizeBoundaries, type TestBoundaries } from "./connections-db";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// Context sources are shown as a summary only (kind/name/size); the content itself never leaves the row
// for a settings read, so a giant pasted PRD costs nothing to render.
export type ContextSourceSummary = { kind: string; name: string; chars: number };

export type AppSetupExtras = {
  environment: "preview" | "staging" | "production" | null;   // null = never recorded (pre-migration app)
  boundaries: TestBoundaries | null;                          // null = never recorded; treated as all-off
  contextSources: ContextSourceSummary[];
};
const EMPTY_EXTRAS: AppSetupExtras = { environment: null, boundaries: null, contextSources: [] };

// One application's setup extras. A pre-migration schema (columns absent -> PostgREST error) or an
// unowned id degrades to the empty shape, which every caller renders as honest "not recorded" states.
export async function getSetupExtras(owner: string, applicationId: string): Promise<AppSetupExtras> {
  if (!isDatabaseConfigured()) return EMPTY_EXTRAS;
  const { data, error } = await db().from("v_applications")
    .select("environment, context, test_boundaries")
    .eq("user_id", norm(owner)).eq("id", applicationId).maybeSingle();
  if (error || !data) return EMPTY_EXTRAS;
  const r = data as Record<string, unknown>;
  const env = typeof r.environment === "string" ? r.environment.trim().toLowerCase() : "";
  const contextSources: ContextSourceSummary[] = Array.isArray(r.context)
    ? (r.context as unknown[]).slice(0, 12).flatMap((entry) => {
        const e = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
        const kind = typeof e.kind === "string" ? e.kind : "";
        if (!kind) return [];
        return [{
          kind,
          name: (typeof e.name === "string" && e.name.trim() ? e.name : kind).slice(0, 120),
          chars: typeof e.chars === "number" ? e.chars : (typeof e.content === "string" ? e.content.length : 0),
        }];
      })
    : [];
  return {
    environment: env === "preview" || env === "staging" || env === "production" ? env : null,
    boundaries: r.test_boundaries != null && typeof r.test_boundaries === "object" ? normalizeBoundaries(r.test_boundaries) : null,
    contextSources,
  };
}

// Environment per application for a set of ids (one query; the deployments index uses this for its
// per-card environment label). Missing column / no rows -> empty map, callers just omit the label.
export async function environmentsByApp(owner: string, appIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = Array.from(new Set(appIds.filter(Boolean)));
  if (!isDatabaseConfigured() || !unique.length) return out;
  const { data, error } = await db().from("v_applications")
    .select("id, environment").eq("user_id", norm(owner)).in("id", unique);
  if (error || !data) return out;
  for (const r of data as Record<string, unknown>[]) {
    const env = typeof r.environment === "string" ? r.environment.trim().toLowerCase() : "";
    if (env === "preview" || env === "staging" || env === "production") out.set(String(r.id), env);
  }
  return out;
}

// The SOURCE half of the connection graph (github / custom_deploy) for a set of applications, one query.
// Safe metadata only (repo, branch, commit, provider_name); encrypted_ref is never selected. Unmigrated
// v_app_connections -> empty map, so pages simply omit the commit/branch line.
export type SourceConnection = { provider: string; meta: Record<string, unknown> };
export async function sourceConnectionsByApp(owner: string, appIds: string[]): Promise<Map<string, SourceConnection[]>> {
  const out = new Map<string, SourceConnection[]>();
  const unique = Array.from(new Set(appIds.filter(Boolean)));
  if (!isDatabaseConfigured() || !unique.length) return out;
  const { data, error } = await db().from("v_app_connections")
    .select("application_id, provider, meta")
    .eq("user_id", norm(owner)).in("application_id", unique).in("provider", ["github", "custom_deploy"])
    .order("created_at", { ascending: true });
  if (error || !data) return out;
  for (const r of data as Record<string, unknown>[]) {
    const appId = String(r.application_id ?? "");
    const arr = out.get(appId) ?? [];
    arr.push({ provider: String(r.provider ?? ""), meta: (r.meta as Record<string, unknown>) ?? {} });
    out.set(appId, arr);
  }
  return out;
}

// Human line for where a deployment's code comes from: "repo @ branch (commit)" from a github connection,
// else "provider, branch (commit)" from a custom_deploy one. Null when neither carries anything usable.
export function describeSource(conns: SourceConnection[] | undefined): string | null {
  if (!conns?.length) return null;
  const str = (m: Record<string, unknown>, k: string): string => (typeof m[k] === "string" ? (m[k] as string).trim() : "");
  const github = conns.find((c) => c.provider === "github");
  if (github) {
    const repo = str(github.meta, "repo");
    if (repo) {
      const branch = str(github.meta, "branch");
      const commit = str(github.meta, "commit");
      return `${repo}${branch ? ` @ ${branch}` : ""}${commit ? ` (${commit.slice(0, 10)})` : ""}`;
    }
  }
  const custom = conns.find((c) => c.provider === "custom_deploy");
  if (custom) {
    const name = str(custom.meta, "provider_name");
    if (name) {
      const branch = str(custom.meta, "branch");
      const commit = str(custom.meta, "commit");
      return `${name}${branch ? `, ${branch}` : ""}${commit ? ` (${commit.slice(0, 10)})` : ""}`;
    }
  }
  return null;
}
