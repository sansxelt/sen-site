// Deployment identity (V1.1 workstream S4). Server-only, owner-scoped like the rest of the data plane
// (service-role client, every query filters user_id = lowercased email).
//
// v_deployments (sql/vraelis-preflight-8-deployments.sql) records the EXACT deployment a Production Pass
// tested: url, environment, provider, project, repo, branch, commit, provider deployment id, source, and
// when it was seen. Every new run pins the deployment row it launched against (v_preflight_runs.
// deployment_id), so a READY decision ties to ONE deployment forever; when a newer deployment appears the
// application shows "New deployment unverified" instead of silently carrying READY forward.
//
// MIGRATION RULE (migration 8 is not applied yet): every touch of v_deployments FAILS CLEARLY when the
// table is missing (console.warn naming the sql file, return null/[]), but NEVER breaks the parent
// operation. Run launch, the run report, and the application overview must all succeed today, without
// deployment identity; nothing here throws. Mirrors lib/preflight/context-snapshots.ts (S3).
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// ── Shapes ─────────────────────────────────────────────────────────────────────────────────────────────

export type DeploymentSource = "manual" | "github_webhook" | "vercel_webhook";

export type Deployment = {
  id: string; application_id: string; url: string;
  environment: string | null; provider: string | null; project: string | null;
  repo: string | null; branch: string | null; commit_sha: string | null;
  provider_deployment_id: string | null;               // restricted to Technical details in the UI
  source: string; deployed_at: string | null; detected_at: string;
};

export type DeploymentInput = {
  url: string;                                          // required; everything else best-effort
  environment?: string | null; provider?: string | null; project?: string | null;
  repo?: string | null; branch?: string | null; commit_sha?: string | null;
  provider_deployment_id?: string | null;
  source?: DeploymentSource; deployed_at?: string | null;
};

// The minimum a comparison needs; a full Deployment row satisfies it, and so does the URL + commit
// snapshot a pre-migration-8 run row carries.
export type DeploymentIdentity = {
  url: string;
  environment?: string | null; repo?: string | null; branch?: string | null; commit_sha?: string | null;
};

const DEPLOYMENT_COLUMNS = "id, application_id, url, environment, provider, project, repo, branch, commit_sha, provider_deployment_id, source, deployed_at, detected_at";

function rowToDeployment(r: Record<string, unknown>): Deployment {
  return {
    id: String(r.id), application_id: String(r.application_id), url: String(r.url ?? ""),
    environment: (r.environment as string) ?? null, provider: (r.provider as string) ?? null,
    project: (r.project as string) ?? null, repo: (r.repo as string) ?? null,
    branch: (r.branch as string) ?? null, commit_sha: (r.commit_sha as string) ?? null,
    provider_deployment_id: (r.provider_deployment_id as string) ?? null,
    source: String(r.source ?? "manual"), deployed_at: (r.deployed_at as string) ?? null,
    detected_at: String(r.detected_at ?? ""),
  };
}

// ── Pure core: canonical identity + comparison (no DB; the test suite exercises these directly) ────────

// Canonical form of a deployment URL for identity comparison: trimmed, scheme + host lowercased (the URL
// parser does both), default port dropped, a bare root path reduced to nothing so "https://App.example.com"
// and "https://app.example.com/" are the same deployment. Path case and query are PRESERVED (they are
// routing-significant). An unparseable value falls back to its trimmed self, never throws.
export function canonicalDeploymentUrl(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) return "";
  try {
    const u = new URL(t);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.protocol}//${u.host}${path}${u.search}`;
  } catch { return t; }
}

function normCommit(c: string | null | undefined): string { return (c ?? "").trim().toLowerCase(); }
function shortCommit(c: string | null | undefined): string { return normCommit(c).slice(0, 10); }

// Two records describe the SAME deployment when their canonical URLs match and their commits match
// (both absent counts as a match: "the same URL, no commit either time" is one deployment, not two).
// This is the dedupe rule recordDeployment applies.
export function sameDeploymentIdentity(
  a: { url: string; commit_sha?: string | null },
  b: { url: string; commit_sha?: string | null },
): boolean {
  return canonicalDeploymentUrl(a.url) === canonicalDeploymentUrl(b.url)
    && normCommit(a.commit_sha) === normCommit(b.commit_sha);
}

// Looser match for VERIFICATION display: did this run test this deployment? URL must match; commits must
// match only when BOTH sides recorded one (a pre-enrichment run without a commit still verified the URL
// it opened). Never used for dedupe, which stays strict.
export function runTestedDeployment(
  run: { deployment_url: string | null; commit_sha: string | null },
  d: DeploymentIdentity,
): boolean {
  if (!run.deployment_url) return false;
  if (canonicalDeploymentUrl(run.deployment_url) !== canonicalDeploymentUrl(d.url)) return false;
  const rc = normCommit(run.commit_sha); const dc = normCommit(d.commit_sha);
  return !rc || !dc || rc === dc;
}

// Human-readable lines describing how deployment b (newer) differs from deployment a (older/tested):
// url, commit, repo, branch, environment. Pure; empty array when the recorded fields agree.
export function compareDeployments(a: DeploymentIdentity, b: DeploymentIdentity): string[] {
  const lines: string[] = [];
  const field = (label: string, va: string, vb: string) => {
    if (va === vb) return;
    if (va && vb) lines.push(`${label} changed from ${va} to ${vb}`);
    else if (vb) lines.push(`${label} ${vb} recorded (the previous deployment had none)`);
    else lines.push(`${label} no longer recorded (was ${va})`);
  };
  if (canonicalDeploymentUrl(a.url) !== canonicalDeploymentUrl(b.url)) {
    lines.push(`URL changed from ${(a.url ?? "").trim()} to ${(b.url ?? "").trim()}`);
  }
  field("Commit", shortCommit(a.commit_sha), shortCommit(b.commit_sha));
  field("Repository", (a.repo ?? "").trim(), (b.repo ?? "").trim());
  field("Branch", (a.branch ?? "").trim(), (b.branch ?? "").trim());
  field("Environment", (a.environment ?? "").trim().toLowerCase(), (b.environment ?? "").trim().toLowerCase());
  return lines;
}

export type UnverifiedNewer = { deployment: Deployment; changes: string[] };

// The decision core of unverifiedNewerDeployment, pure so the suite can prove it with injected rows:
// the newest recorded deployment is "unverified newer" exactly when it is a DIFFERENT deployment
// identity than the one the health run tested AND it was detected AFTER that test. Anything missing or
// unparseable answers null (never a speculative banner).
export function pickUnverifiedNewer(
  newest: Deployment | null,
  tested: DeploymentIdentity | null,
  testedAt: string | null,
): UnverifiedNewer | null {
  if (!newest || !tested || !(tested.url ?? "").trim()) return null;
  if (sameDeploymentIdentity(newest, tested)) return null;
  const newestAt = Date.parse(newest.detected_at);
  const testedAtMs = Date.parse(testedAt ?? "");
  if (!Number.isFinite(newestAt) || !Number.isFinite(testedAtMs) || newestAt <= testedAtMs) return null;
  return { deployment: newest, changes: compareDeployments(tested, newest) };
}

// ── Missing-migration detection (the migration rule made concrete) ─────────────────────────────────────

const MIGRATION_FILE = "sql/vraelis-preflight-8-deployments.sql";

// PostgREST reports an unapplied migration 8 as 42P01 (relation does not exist) or PGRST205 (table not in
// the schema cache), depending on where the miss happens.
function missingDeploymentsTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message ?? "";
  return /v_deployments/i.test(msg) && /(does not exist|schema cache|find the table)/i.test(msg);
}

function warnUnmigrated(where: string): void {
  console.warn(`${where}: v_deployments is missing. Apply ${MIGRATION_FILE} (migration 8). Deployment identity was NOT recorded; the parent operation is unaffected.`);
}

// True when v_deployments exists (migration 8 applied). UI surfaces use this to render the honest
// one-line notice instead of pretending an empty history means "no deployments".
export async function deploymentStoreReady(owner: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { error } = await db().from("v_deployments").select("id").eq("user_id", norm(owner)).limit(1);
  return !missingDeploymentsTable(error);
}

// ── Enrichment (owner-scoped, best-effort) ─────────────────────────────────────────────────────────────

const clip = (v: unknown, n: number): string | null => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, n) : null;
};
const validEnv = (v: unknown): string | null => {
  const e = typeof v === "string" ? v.trim().toLowerCase() : "";
  return e === "preview" || e === "staging" || e === "production" ? e : null;
};

type EnrichedFields = {
  environment: string | null; provider: string | null; project: string | null;
  repo: string | null; branch: string | null; commit_sha: string | null;
};

// Fill the identity fields the caller did not supply from what the application already knows: the
// github / custom_deploy / vercel connection metadata (same safe-metadata read as setup-read.ts
// sourceConnectionsByApp; encrypted_ref is never selected) and v_applications.environment. Explicit
// input always wins; everything degrades to null on any error (pre-migration-5 schemas included).
async function enrichDeploymentInput(uid: string, applicationId: string, input: DeploymentInput, url: string): Promise<EnrichedFields> {
  let repo = clip(input.repo, 200);
  let branch = clip(input.branch, 120);
  let commit = clip(input.commit_sha, 64)?.toLowerCase() ?? null;
  let provider = clip(input.provider, 40)?.toLowerCase() ?? null;
  let project = clip(input.project, 120);
  let environment = validEnv(input.environment);

  if (!repo || !branch || !commit || !provider || !project) {
    const { data } = await db().from("v_app_connections")
      .select("provider, meta")
      .eq("user_id", uid).eq("application_id", applicationId)
      .in("provider", ["github", "custom_deploy", "vercel"])
      .order("created_at", { ascending: true });
    const conns = (data as { provider?: string; meta?: Record<string, unknown> }[] | null) ?? [];
    const metaOf = (p: string): Record<string, unknown> | null =>
      conns.find((c) => c.provider === p)?.meta ?? null;
    const github = metaOf("github"); const custom = metaOf("custom_deploy"); const vercel = metaOf("vercel");

    if (!repo && github) repo = clip(github.repo, 200);
    if (!branch) branch = clip(github?.branch, 120) ?? clip(custom?.branch, 120);
    if (!commit) commit = (clip(github?.commit, 64) ?? clip(custom?.commit, 64))?.toLowerCase() ?? null;
    if (!project && vercel) project = clip(vercel.project, 120);
    if (!provider) {
      let host = "";
      try { host = new URL(url).hostname.toLowerCase(); } catch { host = ""; }
      if (host.endsWith(".vercel.app") || vercel) provider = "vercel";
      else provider = clip(custom?.provider_name, 40)?.toLowerCase() ?? null;
    }
  }

  if (!environment) {
    // Defensive split like setup-read.ts: the environment column is migration-5 additive, so its own
    // query degrades to null instead of failing the record.
    const { data: envRow } = await db().from("v_applications")
      .select("environment").eq("user_id", uid).eq("id", applicationId).maybeSingle();
    environment = validEnv((envRow as { environment?: unknown } | null)?.environment);
  }

  return { environment, provider, project, repo, branch, commit_sha: commit };
}

// ── Writes ─────────────────────────────────────────────────────────────────────────────────────────────

export type RecordDeploymentResult = { deployment: Deployment; existing: boolean } | null;

// Record a deployment for an owned application. IDEMPOTENT against the newest row: when the newest
// recorded deployment for the app has the same identity (canonical URL + commit), that row is returned
// instead of inserting a duplicate, so a rerun against an unchanged deployment never inflates history.
// Enrichment fills repo/branch/commit/provider/project/environment the caller omitted from the app's
// connection metadata and environment. Best-effort per the migration rule: any failure, including the
// unapplied migration 8 (warned clearly, naming the sql file), returns null and never throws.
export async function recordDeployment(owner: string, applicationId: string, input: DeploymentInput): Promise<RecordDeploymentResult> {
  try {
    if (!isDatabaseConfigured()) return null;
    const uid = norm(owner);
    const url = (input.url ?? "").trim().slice(0, 2000);
    if (!url) return null;

    // Ownership gate: the application row must belong to this owner before anything is read or written.
    const { data: app } = await db().from("v_applications")
      .select("id").eq("user_id", uid).eq("id", applicationId).maybeSingle();
    if (!app) return null;

    const enriched = await enrichDeploymentInput(uid, applicationId, input, url);

    const { data: newestRows, error: readErr } = await db().from("v_deployments")
      .select(DEPLOYMENT_COLUMNS)
      .eq("user_id", uid).eq("application_id", applicationId)
      .order("detected_at", { ascending: false }).limit(1);
    if (readErr) {
      if (missingDeploymentsTable(readErr)) warnUnmigrated("recordDeployment");
      return null;
    }
    const newestRow = ((newestRows as Record<string, unknown>[] | null) ?? [])[0];
    if (newestRow) {
      const newest = rowToDeployment(newestRow);
      if (sameDeploymentIdentity({ url, commit_sha: enriched.commit_sha }, newest)) {
        return { deployment: newest, existing: true };
      }
    }

    const deployedAt = input.deployed_at && Number.isFinite(Date.parse(input.deployed_at)) ? input.deployed_at : null;
    const { data, error } = await db().from("v_deployments").insert({
      application_id: applicationId, user_id: uid, url,
      environment: enriched.environment, provider: enriched.provider, project: enriched.project,
      repo: enriched.repo, branch: enriched.branch, commit_sha: enriched.commit_sha,
      provider_deployment_id: clip(input.provider_deployment_id, 120),
      source: input.source ?? "manual", deployed_at: deployedAt,
    } as never).select(DEPLOYMENT_COLUMNS).single();
    if (error || !data) {
      if (missingDeploymentsTable(error)) warnUnmigrated("recordDeployment");
      return null;
    }
    return { deployment: rowToDeployment(data as Record<string, unknown>), existing: false };
  } catch {
    // The migration rule: deployment identity must never break the parent operation, whatever went wrong.
    return null;
  }
}

// At run creation: record (or dedupe onto) the deployment identity of the run's target URL and hand back
// the id to pin on the run row. Best-effort by design: null (recordDeployment already warned clearly if
// migration 8 is missing) and the launch proceeds unpinned.
export async function deploymentForRun(owner: string, applicationId: string, deploymentUrl: string): Promise<string | null> {
  try {
    const r = await recordDeployment(owner, applicationId, { url: deploymentUrl, source: "manual" });
    return r?.deployment.id ?? null;
  } catch { return null; }
}

// ── Reads (owner-scoped; null / empty and a clear warn when unmigrated) ────────────────────────────────

// One deployment by id, owner-scoped. Null when not owned / not found / unmigrated.
export async function getDeployment(owner: string, id: string): Promise<Deployment | null> {
  if (!isDatabaseConfigured()) return null;
  const { data, error } = await db().from("v_deployments")
    .select(DEPLOYMENT_COLUMNS).eq("user_id", norm(owner)).eq("id", id).maybeSingle();
  if (error) { if (missingDeploymentsTable(error)) warnUnmigrated("getDeployment"); return null; }
  return data ? rowToDeployment(data as Record<string, unknown>) : null;
}

// The newest recorded deployment for an application, owner-scoped. Null when none / unmigrated.
export async function latestDeployment(owner: string, applicationId: string): Promise<Deployment | null> {
  if (!isDatabaseConfigured()) return null;
  const { data, error } = await db().from("v_deployments")
    .select(DEPLOYMENT_COLUMNS)
    .eq("user_id", norm(owner)).eq("application_id", applicationId)
    .order("detected_at", { ascending: false }).limit(1).maybeSingle();
  if (error) { if (missingDeploymentsTable(error)) warnUnmigrated("latestDeployment"); return null; }
  return data ? rowToDeployment(data as Record<string, unknown>) : null;
}

// Recorded deployments for an application, newest first, owner-scoped. Empty when unmigrated.
export async function listDeployments(owner: string, applicationId: string, limit = 20): Promise<Deployment[]> {
  if (!isDatabaseConfigured()) return [];
  const { data, error } = await db().from("v_deployments")
    .select(DEPLOYMENT_COLUMNS)
    .eq("user_id", norm(owner)).eq("application_id", applicationId)
    .order("detected_at", { ascending: false }).limit(limit);
  if (error) { if (missingDeploymentsTable(error)) warnUnmigrated("listDeployments"); return []; }
  return ((data as Record<string, unknown>[] | null) ?? []).map(rowToDeployment);
}

// The additive version pins on a run row, each read in its OWN single-column query so the two additive
// migrations degrade independently: context_snapshot_id (migration 7) and deployment_id (migration 8).
// A missing deployment_id column warns clearly (naming migration 8's sql file); the report renders on.
export async function runVersionPins(owner: string, runId: string): Promise<{ contextSnapshotId: string | null; deploymentId: string | null }> {
  const out: { contextSnapshotId: string | null; deploymentId: string | null } = { contextSnapshotId: null, deploymentId: null };
  if (!isDatabaseConfigured()) return out;
  const uid = norm(owner);
  const [ctx, dep] = await Promise.all([
    db().from("v_preflight_runs").select("context_snapshot_id").eq("user_id", uid).eq("id", runId).maybeSingle(),
    db().from("v_preflight_runs").select("deployment_id").eq("user_id", uid).eq("id", runId).maybeSingle(),
  ]);
  const ctxRow = ctx.data as { context_snapshot_id?: string | null } | null;
  if (ctxRow?.context_snapshot_id) out.contextSnapshotId = String(ctxRow.context_snapshot_id);
  if (dep.error && /deployment_id/i.test(dep.error.message ?? "")) {
    console.warn(`runVersionPins: v_preflight_runs.deployment_id is missing. Apply ${MIGRATION_FILE} (migration 8). The report renders without a deployment pin.`);
  }
  const depRow = dep.data as { deployment_id?: string | null } | null;
  if (depRow?.deployment_id) out.deploymentId = String(depRow.deployment_id);
  return out;
}

// ── "New deployment unverified" (the health-page question) ─────────────────────────────────────────────

export type HealthRunRef = {
  id: string; deployment_url: string | null; commit_sha: string | null;
  created_at: string; completed_at: string | null;
};

// Is the newest recorded deployment NEWER than (and DIFFERENT from) the deployment the health run
// tested? Returns the newer deployment plus the human-readable change lines, or null. The tested
// deployment is the run's pinned v_deployments row when migration 8 stamped one; a pre-pin run falls
// back to the URL + commit snapshot on its own row, so old decisions stay comparable. Best-effort:
// any failure (including the unapplied migration 8) answers null and the overview renders as before.
export async function unverifiedNewerDeployment(owner: string, applicationId: string, healthRun: HealthRunRef | null): Promise<UnverifiedNewer | null> {
  try {
    if (!isDatabaseConfigured() || !healthRun) return null;
    const newest = await latestDeployment(owner, applicationId);
    if (!newest) return null;

    let tested: DeploymentIdentity | null = null;
    let testedAt: string | null = healthRun.completed_at ?? healthRun.created_at;
    const pins = await runVersionPins(owner, healthRun.id);
    if (pins.deploymentId) {
      const pinned = await getDeployment(owner, pins.deploymentId);
      if (pinned) {
        if (pinned.id === newest.id) return null;      // the newest row IS the tested one
        tested = pinned;
        testedAt = pinned.detected_at || testedAt;
      }
    }
    if (!tested && healthRun.deployment_url) {
      tested = { url: healthRun.deployment_url, commit_sha: healthRun.commit_sha };
    }
    return pickUnverifiedNewer(newest, tested, testedAt);
  } catch { return null; }
}
