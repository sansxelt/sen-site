// Versioned application context graph (V1.1 workstream S3). Server-only, owner-scoped like the rest of
// the data plane (service-role client, every query filters user_id = lowercased email).
//
// The GRAPH is the normalized, secret-free picture of everything Vraelis knows about an application:
// identity (name / URL / environment / builder), product-definition sources (kind/name/size + a sha256 of
// each source's CONTENT, never the content itself, so the graph stays small and can never leak a pasted
// document), test boundaries, the safe connection summaries (provider + display summary only; NEVER
// encrypted_ref, NEVER masks), and the latest contract's id/version/status. Canonical JSON (sorted keys)
// makes the sha256 hash deterministic, so "did context change" is one string compare.
//
// SNAPSHOTS (v_context_snapshots, sql/vraelis-preflight-7-context-snapshots.sql) are IMMUTABLE: this
// module only ever INSERTs rows for that table, never updates or deletes one. A change produces version
// n+1; contracts and runs pin the exact snapshot they were derived from.
//
// MIGRATION RULE (migration 7 is not applied yet): every write here FAILS CLEARLY when the table is
// missing (console.warn naming the sql file, return null) but NEVER breaks the parent operation. App
// creation, contract approval, and run launch must all succeed today, unversioned; nothing here throws.
import { createHash } from "node:crypto";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../supabase-admin";
import { listConnections, normalizeBoundaries, type TestBoundaries } from "./connections-db";
import { metaSummary } from "./connection-display";

function norm(e: string): string { return e.trim().toLowerCase(); }
function db() { return getSupabaseAdminClient(); }

// ── Graph shape ────────────────────────────────────────────────────────────────────────────────────────

export type GraphIdentity = { name: string; app_url: string; environment: string | null; builder: string | null };
export type GraphSource = { kind: string; name: string; chars: number; added_at: string; content_sha256: string };
export type GraphConnection = { provider: string; summary: string | null; created_at: string };
export type GraphContract = { id: string; version: number; status: string } | null;
export type ContextGraph = {
  identity: GraphIdentity;
  sources: GraphSource[];
  boundaries: TestBoundaries | null;
  connections: GraphConnection[];
  contract: GraphContract;
};
// Field -> where it came from (kind for a pasted/typed source, connection:<kind>, manual, contract) plus
// the moment that piece of context was recorded. Stored alongside the graph, never inside it.
export type GraphProvenance = Record<string, { source: string; recorded_at: string | null }>;

export type SnapshotVersion = { id: string; version: number; hash: string; author: string; created_at: string };
export type ContextSnapshot = SnapshotVersion & { application_id: string; graph: ContextGraph; provenance: GraphProvenance };
export type SnapshotResult = { id: string; version: number; unchanged: boolean } | null;

// ── Pure core (no DB): assembly, canonical JSON, hashing ───────────────────────────────────────────────

export function sha256Hex(s: string): string { return createHash("sha256").update(s, "utf8").digest("hex"); }

// Recursively sort object keys so JSON.stringify is order-invariant; arrays keep their (already
// deterministic) order. The canonical string is what gets hashed.
function canonicalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) out[k] = canonicalize((v as Record<string, unknown>)[k]);
    return out;
  }
  return v;
}
export function canonicalGraphJson(graph: unknown): string { return JSON.stringify(canonicalize(graph)); }
export function graphHash(graph: unknown): string { return sha256Hex(canonicalGraphJson(graph)); }

export type GraphBuildInput = {
  identity: GraphIdentity;
  identityRecordedAt: string | null;                       // application row created_at
  extrasRecordedAt: string | null;                         // application row updated_at (env/boundaries edits)
  sources: { kind: string; name: string; chars?: number | null; added_at?: string | null; content: string }[];
  boundaries: TestBoundaries | null;
  connections: { provider: string; meta: Record<string, unknown>; created_at: string }[];
  contract: { id: string; version: number; status: string; created_at?: string | null } | null;
};

// Assemble the normalized graph + its provenance map from already-fetched rows. PURE (exported so the
// test suite can prove determinism and secret-freedom without a database). Source CONTENT is reduced to
// its sha256 here and never enters the graph; connection metadata is reduced to the safe display summary.
export function assembleContextGraph(input: GraphBuildInput): { graph: ContextGraph; provenance: GraphProvenance } {
  const provenance: GraphProvenance = {
    identity: { source: "manual", recorded_at: input.identityRecordedAt },
  };

  const sources: GraphSource[] = input.sources.map((s, i) => {
    const added = typeof s.added_at === "string" ? s.added_at : "";
    provenance[`sources[${i}]`] = { source: s.kind, recorded_at: added || null };
    return {
      kind: s.kind,
      name: s.name,
      chars: typeof s.chars === "number" ? s.chars : s.content.length,
      added_at: added,
      content_sha256: sha256Hex(s.content),
    };
  });

  if (input.boundaries) provenance.boundaries = { source: "manual", recorded_at: input.extrasRecordedAt };
  if (input.identity.environment) provenance["identity.environment"] = { source: "manual", recorded_at: input.extrasRecordedAt };

  // Deterministic connection order (provider, then created_at) so graph equality never depends on read
  // order. Only the safe one-line summary rides along: metaSummary is the display contract's non-secret
  // reduction, and test_account deliberately summarizes to null (no mask, no label, no credential).
  const connections: GraphConnection[] = [...input.connections]
    .map((c) => ({ provider: c.provider, summary: metaSummary(c.provider, c.meta), created_at: c.created_at }))
    .sort((a, b) => (a.provider < b.provider ? -1 : a.provider > b.provider ? 1 : a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
  connections.forEach((c, i) => { provenance[`connections[${i}]`] = { source: `connection:${c.provider}`, recorded_at: c.created_at || null }; });

  const contract: GraphContract = input.contract
    ? { id: input.contract.id, version: input.contract.version, status: input.contract.status }
    : null;
  if (input.contract) provenance.contract = { source: "contract", recorded_at: input.contract.created_at ?? null };

  return {
    graph: { identity: input.identity, sources, boundaries: input.boundaries, connections, contract },
    provenance,
  };
}

// ── Diff (pure) ────────────────────────────────────────────────────────────────────────────────────────

export type GraphDiff = { added: string[]; removed: string[]; changed: string[]; summaries: string[] };

const notSet = (v: string | null | undefined): string => (v && String(v).trim() ? String(v) : "not set");
const isEmptySection = (v: unknown): boolean => v == null || (Array.isArray(v) && v.length === 0);

const PERMIT_LABELS: Record<string, string> = {
  permit_account_creation: "account creation",
  permit_db_writes: "test database writes",
  permit_email: "test email delivery",
  permit_test_purchases: "test-mode purchases",
  permit_file_upload: "file upload",
};

// Human-readable comparison of two graphs (a = older, b = newer): which top-level sections were added,
// removed, or changed, plus per-section one-line change summaries a person can read in the Context tab.
export function diffGraphs(a: ContextGraph, b: ContextGraph): GraphDiff {
  const added: string[] = []; const removed: string[] = []; const changed: string[] = [];
  const sections = ["identity", "sources", "boundaries", "connections", "contract"] as const;
  for (const k of sections) {
    const va = a?.[k]; const vb = b?.[k];
    if (isEmptySection(va) && !isEmptySection(vb)) added.push(k);
    else if (!isEmptySection(va) && isEmptySection(vb)) removed.push(k);
    else if (canonicalGraphJson(va) !== canonicalGraphJson(vb)) changed.push(k);
  }

  const summaries: string[] = [];

  // Identity: per-field, from/to.
  for (const k of ["name", "app_url", "environment", "builder"] as const) {
    const fa = a?.identity?.[k] ?? null; const fb = b?.identity?.[k] ?? null;
    if (fa !== fb) summaries.push(`Identity: ${k.replace(/_/g, " ")} changed from ${notSet(fa)} to ${notSet(fb)}`);
  }

  // Sources: keyed by kind + name; a differing content hash is a content change.
  const srcKey = (s: GraphSource) => `${s.kind}:${s.name}`;
  const sa = new Map((a?.sources ?? []).map((s) => [srcKey(s), s]));
  const sb = new Map((b?.sources ?? []).map((s) => [srcKey(s), s]));
  for (const [k, s] of sb) if (!sa.has(k)) summaries.push(`Source added: ${s.kind} "${s.name}" (${s.chars.toLocaleString("en-US")} chars)`);
  for (const [k, s] of sa) if (!sb.has(k)) summaries.push(`Source removed: ${s.kind} "${s.name}"`);
  for (const [k, s] of sb) {
    const prev = sa.get(k);
    if (prev && prev.content_sha256 !== s.content_sha256) summaries.push(`Source content changed: ${s.kind} "${s.name}"`);
  }

  // Boundaries: recorded/cleared, per-permit toggles, domain list.
  const ba = a?.boundaries ?? null; const bb = b?.boundaries ?? null;
  if (!ba && bb) summaries.push("Test boundaries recorded");
  else if (ba && !bb) summaries.push("Test boundaries cleared");
  else if (ba && bb) {
    for (const [key, label] of Object.entries(PERMIT_LABELS)) {
      const pa = (ba as unknown as Record<string, boolean>)[key] === true;
      const pb = (bb as unknown as Record<string, boolean>)[key] === true;
      if (pa !== pb) summaries.push(`Boundary permit "${label}" turned ${pb ? "on" : "off"}`);
    }
    if (canonicalGraphJson(ba.allowed_domains) !== canonicalGraphJson(bb.allowed_domains)) {
      summaries.push(`Allowed domains changed to ${bb.allowed_domains.length ? bb.allowed_domains.join(", ") : "none"}`);
    }
  }

  // Connections: multiset keyed by provider + summary (two identical rows count twice).
  const connCounts = (list: GraphConnection[]) => {
    const m = new Map<string, number>();
    for (const c of list ?? []) { const k = `${c.provider}|${c.summary ?? ""}`; m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  };
  const ca = connCounts(a?.connections ?? []); const cb = connCounts(b?.connections ?? []);
  const describeConn = (k: string) => { const [provider, summary] = k.split("|"); return `${provider}${summary ? ` (${summary})` : ""}`; };
  for (const [k, n] of cb) for (let i = (ca.get(k) ?? 0); i < n; i++) summaries.push(`Connection added: ${describeConn(k)}`);
  for (const [k, n] of ca) for (let i = (cb.get(k) ?? 0); i < n; i++) summaries.push(`Connection removed: ${describeConn(k)}`);

  // Contract: id/version/status movement.
  const ka = a?.contract ?? null; const kb = b?.contract ?? null;
  if (!ka && kb) summaries.push(`Contract recorded: v${kb.version} (${kb.status})`);
  else if (ka && !kb) summaries.push("Contract removed");
  else if (ka && kb && (ka.id !== kb.id || ka.version !== kb.version || ka.status !== kb.status)) {
    summaries.push(`Contract changed: v${ka.version} ${ka.status} to v${kb.version} ${kb.status}`);
  }

  return { added, removed, changed, summaries };
}

// ── Missing-migration detection (the migration rule made concrete) ─────────────────────────────────────

const MIGRATION_FILE = "sql/vraelis-preflight-7-context-snapshots.sql";

// PostgREST reports an unapplied migration 7 as 42P01 (relation does not exist) or PGRST205 (table not in
// the schema cache), depending on where the miss happens.
function missingSnapshotTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message ?? "";
  return /v_context_snapshots/i.test(msg) && /(does not exist|schema cache|find the table)/i.test(msg);
}

function warnUnmigrated(where: string): void {
  console.warn(`${where}: v_context_snapshots is missing. Apply ${MIGRATION_FILE} (migration 7). Context was NOT versioned; the parent operation is unaffected.`);
}

// ── Build the live graph from the database (owner-scoped) ──────────────────────────────────────────────

// Assemble the current (live, unversioned) context graph for an owned application. Null when the app is
// not owned / not found / the database is unconfigured. The setup extras ride their own query so a
// pre-migration-5 schema degrades to empty extras instead of failing the whole build (same defensive
// split as lib/preflight/setup-read.ts). Source content is read here ONLY to be hashed; it never leaves
// this function inside the graph.
export async function buildContextGraph(owner: string, applicationId: string): Promise<{ graph: ContextGraph; provenance: GraphProvenance } | null> {
  if (!isDatabaseConfigured()) return null;
  const uid = norm(owner);

  const { data: base } = await db().from("v_applications")
    .select("id, name, app_url, builder, created_at, updated_at")
    .eq("user_id", uid).eq("id", applicationId).maybeSingle();
  if (!base) return null;
  const app = base as Record<string, unknown>;

  let environment: string | null = null;
  let rawSources: GraphBuildInput["sources"] = [];
  let boundaries: TestBoundaries | null = null;
  const { data: extras } = await db().from("v_applications")
    .select("environment, context, test_boundaries")
    .eq("user_id", uid).eq("id", applicationId).maybeSingle();
  if (extras) {
    const e = extras as Record<string, unknown>;
    const env = typeof e.environment === "string" ? e.environment.trim().toLowerCase() : "";
    environment = env === "preview" || env === "staging" || env === "production" ? env : null;
    if (Array.isArray(e.context)) {
      rawSources = (e.context as unknown[]).slice(0, 12).flatMap((entry) => {
        const s = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
        const kind = typeof s.kind === "string" ? s.kind : "";
        if (!kind) return [];
        return [{
          kind,
          name: (typeof s.name === "string" && s.name.trim() ? s.name : kind).slice(0, 120),
          chars: typeof s.chars === "number" ? s.chars : null,
          added_at: typeof s.added_at === "string" ? s.added_at : null,
          content: typeof s.content === "string" ? s.content : "",
        }];
      });
    }
    if (e.test_boundaries != null && typeof e.test_boundaries === "object") boundaries = normalizeBoundaries(e.test_boundaries);
  }

  const connections = await listConnections(uid, applicationId);

  // NEWEST PRODUCTION CONTRACT — kind='guarantee' excluded, like every other resolver of this question.
  //
  // v_production_contracts holds both the production contract and guarantee contracts, sharing one per-app
  // version sequence. Without the filter this returned whichever had the highest version, and guarantees are
  // edited far more often: on demo@vraelis.com/Notewell it answered v9 guarantee while the app's production
  // contract was v2, so the Context tab reported a contract the system does not verify against.
  //
  // Filtered inline rather than by calling getContract(): lib/v-applications.ts already imports from
  // lib/preflight/*, so importing it back here risks an import cycle. scripts/preflight-contract-kind-verify.ts
  // now scans for RAW reads like this one repo-wide, not just the two named exports — it was green over this
  // line, which is the whole reason it went unnoticed.
  const contractBase = () => db().from("v_production_contracts")
    .select("id, version, status, created_at")
    .eq("user_id", uid).eq("application_id", applicationId)
    .order("version", { ascending: false }).limit(1);
  // kind is additive with default 'production'; if the column is absent the query errors and we fall back,
  // where the unfiltered read is exactly equivalent because no guarantee can exist yet.
  const filteredContract = await contractBase().eq("kind", "production").maybeSingle();
  const contractRow = filteredContract.error ? (await contractBase().maybeSingle()).data : filteredContract.data;
  const c = contractRow as Record<string, unknown> | null;

  return assembleContextGraph({
    identity: {
      name: String(app.name ?? ""), app_url: String(app.app_url ?? ""),
      environment, builder: (app.builder as string) ?? null,
    },
    identityRecordedAt: (app.created_at as string) ?? null,
    extrasRecordedAt: (app.updated_at as string) ?? null,
    sources: rawSources,
    boundaries,
    connections: connections.map((cn) => ({ provider: cn.provider, meta: cn.meta, created_at: cn.created_at })),
    contract: c ? { id: String(c.id), version: Number(c.version ?? 0), status: String(c.status ?? "draft"), created_at: (c.created_at as string) ?? null } : null,
  });
}

// ── Snapshot writes (insert-only; immutability is the contract) ────────────────────────────────────────

// Record a new snapshot version if (and only if) the context actually changed since the newest one.
// Insert-only: an identical hash returns the existing newest version ({unchanged: true}); a different one
// inserts version newest+1. Rows are NEVER updated or deleted here. A unique-version collision (two
// concurrent triggers) re-reads and retries once with the next version. Best-effort by design: any
// failure, including the unapplied migration 7 (warned clearly, naming the sql file), returns null and
// never throws into the caller, so app creation / contract approval / run launch always survive it.
export async function snapshotIfChanged(owner: string, applicationId: string, author: "owner" | "system"): Promise<SnapshotResult> {
  try {
    if (!isDatabaseConfigured()) return null;
    const uid = norm(owner);
    const built = await buildContextGraph(uid, applicationId);
    if (!built) return null;
    const hash = graphHash(built.graph);

    for (let attempt = 0; attempt < 2; attempt++) {
      const { data: newestRows, error: readErr } = await db().from("v_context_snapshots")
        .select("id, version, hash")
        .eq("user_id", uid).eq("application_id", applicationId)
        .order("version", { ascending: false }).limit(1);
      if (readErr) {
        if (missingSnapshotTable(readErr)) warnUnmigrated("snapshotIfChanged");
        return null;
      }
      const newest = ((newestRows as Record<string, unknown>[] | null) ?? [])[0];
      if (newest && String(newest.hash) === hash) {
        return { id: String(newest.id), version: Number(newest.version), unchanged: true };
      }

      const version = (newest ? Number(newest.version) : 0) + 1;
      const { data, error } = await db().from("v_context_snapshots").insert({
        application_id: applicationId, user_id: uid, version, hash,
        graph: built.graph, provenance: built.provenance, author,
      } as never).select("id").single();
      if (!error && data) return { id: (data as { id: string }).id, version, unchanged: false };
      if (missingSnapshotTable(error)) { warnUnmigrated("snapshotIfChanged"); return null; }
      if ((error as { code?: string } | null)?.code !== "23505") return null;
      // unique (application_id, version) collision: a concurrent trigger inserted first. Loop once:
      // the re-read either matches our hash (their snapshot IS ours) or yields the next version number.
    }
    return null;
  } catch {
    // The migration rule: context versioning must never break the parent operation, whatever went wrong.
    return null;
  }
}

// Pin a snapshot id onto a contract row (called at approval). Owner-scoped update of
// v_production_contracts.context_snapshot_id ONLY; never touches a snapshot row. The column arrives with
// migration 7, so a missing column warns clearly (naming the sql file) and reports false; the approval
// itself already succeeded and stays valid.
export async function pinSnapshotToContract(owner: string, contractId: string, snapshotId: string): Promise<boolean> {
  try {
    if (!isDatabaseConfigured()) return false;
    const { error } = await db().from("v_production_contracts")
      .update({ context_snapshot_id: snapshotId } as never)
      .eq("user_id", norm(owner)).eq("id", contractId);
    if (error) {
      if (/context_snapshot_id/i.test(error.message ?? "") || (error as { code?: string }).code === "PGRST204" || (error as { code?: string }).code === "42703") {
        console.warn(`pinSnapshotToContract: v_production_contracts.context_snapshot_id is missing. Apply ${MIGRATION_FILE} (migration 7). The approval stands, unpinned.`);
      }
      return false;
    }
    return true;
  } catch { return false; }
}

// ── Snapshot reads (owner-scoped; null / empty when unmigrated) ────────────────────────────────────────

// True when v_context_snapshots exists (migration 7 applied). The Context tab uses this to distinguish
// "no versions recorded yet" from "versioning is not active yet" and render the honest notice.
export async function snapshotStoreReady(owner: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const { error } = await db().from("v_context_snapshots").select("id").eq("user_id", norm(owner)).limit(1);
  return !missingSnapshotTable(error);
}

function rowToSnapshot(r: Record<string, unknown>): ContextSnapshot {
  return {
    id: String(r.id), application_id: String(r.application_id), version: Number(r.version),
    hash: String(r.hash), author: String(r.author ?? "owner"), created_at: String(r.created_at ?? ""),
    graph: (r.graph as ContextGraph) ?? ({ identity: { name: "", app_url: "", environment: null, builder: null }, sources: [], boundaries: null, connections: [], contract: null } satisfies ContextGraph),
    provenance: (r.provenance as GraphProvenance) ?? {},
  };
}

// One snapshot by id, owner-scoped. Null when not owned / not found / unmigrated.
export async function getSnapshot(owner: string, id: string): Promise<ContextSnapshot | null> {
  if (!isDatabaseConfigured()) return null;
  const { data, error } = await db().from("v_context_snapshots")
    .select("id, application_id, version, hash, graph, provenance, author, created_at")
    .eq("user_id", norm(owner)).eq("id", id).maybeSingle();
  if (error || !data) return null;
  return rowToSnapshot(data as Record<string, unknown>);
}

// Version history, newest first: metadata only (id/version/hash/author/created_at), no graph payload.
export async function listSnapshotVersions(owner: string, applicationId: string, limit = 20): Promise<SnapshotVersion[]> {
  if (!isDatabaseConfigured()) return [];
  const { data, error } = await db().from("v_context_snapshots")
    .select("id, version, hash, author, created_at")
    .eq("user_id", norm(owner)).eq("application_id", applicationId)
    .order("version", { ascending: false }).limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id), version: Number(r.version), hash: String(r.hash),
    author: String(r.author ?? "owner"), created_at: String(r.created_at ?? ""),
  }));
}

// The newest snapshot with its full graph, owner-scoped. Null when none / unmigrated.
export async function latestSnapshot(owner: string, applicationId: string): Promise<ContextSnapshot | null> {
  if (!isDatabaseConfigured()) return null;
  const { data, error } = await db().from("v_context_snapshots")
    .select("id, application_id, version, hash, graph, provenance, author, created_at")
    .eq("user_id", norm(owner)).eq("application_id", applicationId)
    .order("version", { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return rowToSnapshot(data as Record<string, unknown>);
}
