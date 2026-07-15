// Regression tests for S3 — the versioned application context graph: canonical JSON determinism,
// hash-based change detection, secret-freedom of the graph (content hashes, never content; summaries,
// never masks), the pure diff, snapshot immutability + owner scoping (static), and the migration rule
// (migration 7 unapplied must fail clearly at every trigger point without ever breaking the parent
// operation: app create, contract approval, and run launch all still succeed).
// Pure unit tests + static source checks; no DB, no network, no browser.
// Pattern follows scripts/preflight-connections-manage-verify.ts: PASS/FAIL counters, exit 1 on any FAIL.
import { readFileSync } from "node:fs";
import {
  assembleContextGraph, canonicalGraphJson, graphHash, sha256Hex, diffGraphs,
  type ContextGraph, type GraphBuildInput,
} from "../lib/preflight/context-snapshots";
import type { TestBoundaries } from "../lib/preflight/connections-db";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const read = (p: string) => readFileSync(p, "utf8");
// Blank out // and /* */ comments so string checks never match documentation.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

// ── Fixtures ──
const BOUNDARIES: TestBoundaries = {
  allowed_domains: ["app.example.com"],
  permit_account_creation: true, permit_db_writes: false, permit_email: false,
  permit_test_purchases: false, permit_file_upload: false,
};
const SECRET_CONTENT = "TOP SECRET build prompt with sk_live_abcdEFGH12345678 inside";
function baseInput(): GraphBuildInput {
  return {
    identity: { name: "Acme Dash", app_url: "https://acme.example.com", environment: "staging", builder: "cursor" },
    identityRecordedAt: "2026-07-01T10:00:00.000Z",
    extrasRecordedAt: "2026-07-02T10:00:00.000Z",
    sources: [
      { kind: "prompt", name: "prompt", chars: SECRET_CONTENT.length, added_at: "2026-07-01T10:01:00.000Z", content: SECRET_CONTENT },
      { kind: "summary", name: "summary", chars: 11, added_at: "2026-07-01T10:02:00.000Z", content: "A dashboard" },
    ],
    boundaries: BOUNDARIES,
    connections: [
      { provider: "github", meta: { repo: "acme/dash", branch: "main" }, created_at: "2026-07-01T10:03:00.000Z" },
      { provider: "test_account", meta: { label: "Standard user", username_mask: "st****er", scope: "signed-in flows only" }, created_at: "2026-07-01T10:04:00.000Z" },
    ],
    contract: { id: "c-1", version: 1, status: "draft", created_at: "2026-07-01T10:00:30.000Z" },
  };
}
const { graph: G } = assembleContextGraph(baseInput());
function graphWith(mutate: (g: ContextGraph) => void): ContextGraph {
  const g = JSON.parse(JSON.stringify(G)) as ContextGraph;
  mutate(g);
  return g;
}

// ── Canonical JSON: deterministic regardless of key order ──
console.log("── canonical JSON ──");
ok("key order never changes the canonical string",
  canonicalGraphJson({ b: 2, a: 1 }) === canonicalGraphJson({ a: 1, b: 2 }));
ok("nested key order never changes the canonical string",
  canonicalGraphJson({ x: { m: [{ z: 1, a: 2 }], k: null } }) === canonicalGraphJson({ x: { k: null, m: [{ a: 2, z: 1 }] } }));
ok("array ORDER is significant (arrays are already deterministic by construction)",
  canonicalGraphJson({ a: [1, 2] }) !== canonicalGraphJson({ a: [2, 1] }));
ok("assembled graphs canonicalize identically across two independent builds",
  canonicalGraphJson(assembleContextGraph(baseInput()).graph) === canonicalGraphJson(G));
ok("connection order in the INPUT never changes the graph (assembler sorts deterministically)", (() => {
  const flipped = baseInput();
  flipped.connections.reverse();
  return graphHash(assembleContextGraph(flipped).graph) === graphHash(G);
})());

// ── Hashing: stability + change detection ──
console.log("\n── graph hash ──");
ok("graphHash is a sha256 hex string", /^[0-9a-f]{64}$/.test(graphHash(G)));
ok("graphHash is stable across recomputation", graphHash(G) === graphHash(JSON.parse(JSON.stringify(G))));
ok("any field change changes the hash", graphHash(G) !== graphHash(graphWith((g) => { g.identity.environment = "production"; })));
ok("a source content change (different sha) changes the hash",
  graphHash(G) !== graphHash(graphWith((g) => { g.sources[0].content_sha256 = sha256Hex("edited"); })));
ok("a connection add changes the hash",
  graphHash(G) !== graphHash(graphWith((g) => { g.connections.push({ provider: "supabase", summary: "https://x.supabase.co", created_at: "2026-07-03T00:00:00.000Z" }); })));

// ── Secret-freedom: the graph carries hashes and summaries, never content or masks ──
console.log("\n── secret-freedom ──");
const canon = canonicalGraphJson(G);
ok("source CONTENT never appears in the graph (sha256 of it does)",
  !canon.includes("TOP SECRET") && !canon.includes("sk_live_") && canon.includes(sha256Hex(SECRET_CONTENT)));
ok("graph sources carry kind/name/chars/added_at/content_sha256 only",
  G.sources.every((s) => JSON.stringify(Object.keys(s).sort()) === JSON.stringify(["added_at", "chars", "content_sha256", "kind", "name"])));
ok("test_account summarizes to null: no mask, no label, no credential in the graph",
  G.connections.find((c) => c.provider === "test_account")?.summary === null
  && !canon.includes("username_mask") && !canon.includes("st****er") && !canon.includes("Standard user"));
ok("encrypted_ref can never appear in a graph", !canon.includes("encrypted_ref"));
ok("github connection reduces to the safe display summary",
  G.connections.find((c) => c.provider === "github")?.summary === "acme/dash @ main");

// ── Provenance: per-field source map with timestamps ──
console.log("\n── provenance ──");
const { provenance: P } = assembleContextGraph(baseInput());
ok("each source maps to its kind with its added_at",
  P["sources[0]"]?.source === "prompt" && P["sources[0]"]?.recorded_at === "2026-07-01T10:01:00.000Z" && P["sources[1]"]?.source === "summary");
ok("each connection maps to connection:<kind> with its created_at", (() => {
  const entries = Object.entries(P).filter(([k]) => k.startsWith("connections["));
  return entries.length === 2 && entries.every(([, v]) => v.source.startsWith("connection:") && !!v.recorded_at);
})());
ok("identity, environment, boundaries, contract all carry a provenance entry",
  P.identity?.source === "manual" && P["identity.environment"]?.source === "manual"
  && P.boundaries?.source === "manual" && P.contract?.source === "contract");
ok("provenance carries no source content and no mask",
  !JSON.stringify(P).includes("TOP SECRET") && !JSON.stringify(P).includes("st****er"));

// ── diffGraphs: pure, human-readable ──
console.log("\n── diff ──");
const same = diffGraphs(G, JSON.parse(JSON.stringify(G)));
ok("identical graphs diff to nothing", same.added.length === 0 && same.removed.length === 0 && same.changed.length === 0 && same.summaries.length === 0);
const envDiff = diffGraphs(G, graphWith((g) => { g.identity.environment = "production"; }));
ok("identity change: section flagged + from/to line",
  envDiff.changed.includes("identity") && envDiff.summaries.some((s) => s === "Identity: environment changed from staging to production"));
const srcAdd = diffGraphs(G, graphWith((g) => { g.sources.push({ kind: "prd", name: "launch spec", chars: 1200, added_at: "", content_sha256: sha256Hex("prd") }); }));
ok("source added", srcAdd.changed.includes("sources") && srcAdd.summaries.some((s) => s.includes('Source added: prd "launch spec"')));
const srcGone = diffGraphs(G, graphWith((g) => { g.sources = g.sources.filter((s) => s.kind !== "prompt"); }));
ok("source removed", srcGone.summaries.some((s) => s.includes('Source removed: prompt "prompt"')));
const srcEdit = diffGraphs(G, graphWith((g) => { g.sources[0].content_sha256 = sha256Hex("edited"); }));
ok("source content change detected by hash", srcEdit.summaries.some((s) => s.includes('Source content changed: prompt "prompt"')));
const permitDiff = diffGraphs(G, graphWith((g) => { if (g.boundaries) g.boundaries.permit_db_writes = true; }));
ok("boundary permit toggle", permitDiff.changed.includes("boundaries") && permitDiff.summaries.some((s) => s.includes('permit "test database writes" turned on')));
const domainDiff = diffGraphs(G, graphWith((g) => { if (g.boundaries) g.boundaries.allowed_domains = ["app.example.com", "api.example.com"]; }));
ok("allowed-domains change", domainDiff.summaries.some((s) => s.includes("Allowed domains changed to app.example.com, api.example.com")));
const bAdded = diffGraphs(graphWith((g) => { g.boundaries = null; }), G);
ok("boundaries recorded: reported as an ADDED section", bAdded.added.includes("boundaries") && bAdded.summaries.some((s) => s === "Test boundaries recorded"));
const connDiff = diffGraphs(G, graphWith((g) => {
  g.connections = g.connections.filter((c) => c.provider !== "github");
  g.connections.push({ provider: "supabase", summary: "https://x.supabase.co", created_at: "2026-07-03T00:00:00.000Z" });
}));
ok("connection add + remove", connDiff.summaries.some((s) => s === "Connection added: supabase (https://x.supabase.co)")
  && connDiff.summaries.some((s) => s === "Connection removed: github (acme/dash @ main)"));
const contractDiff = diffGraphs(G, graphWith((g) => { g.contract = { id: "c-2", version: 2, status: "approved" }; }));
ok("contract movement", contractDiff.summaries.some((s) => s === "Contract changed: v1 draft to v2 approved"));
const firstContract = diffGraphs(graphWith((g) => { g.contract = null; }), G);
ok("first contract recorded", firstContract.added.includes("contract") && firstContract.summaries.some((s) => s === "Contract recorded: v1 (draft)"));

// ── Static: the snapshot module is insert-only, owner-scoped, and warns by name ──
console.log("\n── context-snapshots static ──");
const MODULE = "lib/preflight/context-snapshots.ts";
const mod = stripComments(read(MODULE));
const snapshotChains = [...mod.matchAll(/from\("v_context_snapshots"\)[\s\r\n]*\.(\w+)/g)].map((m) => m[1]);
ok("v_context_snapshots is only ever SELECTed or INSERTed (immutability: no update, no delete, ever)",
  snapshotChains.length >= 4 && snapshotChains.every((m) => m === "select" || m === "insert"));
ok("every v_context_snapshots query is owner-scoped (eq user_id, or user_id in the inserted row)",
  [...mod.matchAll(/from\("v_context_snapshots"\)/g)].every((m) => {
    const window = mod.slice(m.index, m.index + 450);
    return window.includes('eq("user_id"') || window.includes("user_id: uid");
  }));
ok("missing-table failures warn NAMING the migration file", (() => {
  const raw = read(MODULE);
  return raw.includes("sql/vraelis-preflight-7-context-snapshots.sql") && /console\.warn\([\s\S]{0,200}MIGRATION_FILE/.test(raw);
})());
ok("snapshotIfChanged catches everything and returns null (never throws into a parent operation)",
  /export async function snapshotIfChanged[\s\S]*?try \{[\s\S]*?\} catch \{[\s\S]{0,200}return null;[\s\S]{0,30}\}/.test(mod));
ok("missing-table detection covers 42P01 and PGRST205", mod.includes('"42P01"') && mod.includes('"PGRST205"'));
ok("the module never touches the vault or the ciphertext",
  !mod.includes("encrypted_ref") && !mod.includes("openTestAccount") && !mod.includes("secret-vault"));
ok("pinSnapshotToContract updates ONLY the contract pin, owner-scoped, and warns on the missing column",
  /pinSnapshotToContract[\s\S]*?from\("v_production_contracts"\)[\s\S]*?update\(\{ context_snapshot_id: snapshotId \}[\s\S]*?eq\("user_id"/.test(mod)
  && /pinSnapshotToContract[\s\S]*?console\.warn/.test(read(MODULE)));
ok("reads (getSnapshot / listSnapshotVersions / latestSnapshot / snapshotStoreReady) are all owner-scoped",
  ["getSnapshot", "listSnapshotVersions", "latestSnapshot", "snapshotStoreReady"].every((fn) => {
    const i = mod.indexOf(`export async function ${fn}`);
    if (i === -1) return false;
    const j = mod.indexOf("export async function", i + 10);
    return mod.slice(i, j === -1 ? mod.length : j).includes('eq("user_id"');
  }));
ok("listSnapshotVersions selects metadata only (no graph payload in the history list)",
  /listSnapshotVersions[\s\S]*?select\("id, version, hash, author, created_at"\)/.test(mod));

// ── Static: parent-operation safety at every trigger point ──
console.log("\n── trigger points static ──");
const runsDb = stripComments(read("lib/preflight/runs-db.ts"));
ok("createRun obtains the snapshot id inside its own try/catch (a snapshot failure never blocks a launch)",
  /try \{ contextSnapshotId = \(await snapshotIfChanged\(uid, input\.applicationId, "owner"\)\)\?\.id \?\? null; \} catch/.test(runsDb));
ok("createRun pins context_snapshot_id ONLY when a snapshot id was obtained",
  runsDb.includes("pinContext ? { ...baseRow, context_snapshot_id: contextSnapshotId } : baseRow"));
ok("createRun retries the insert WITHOUT the column on a column-missing error, warning clearly", (() => {
  const raw = read("lib/preflight/runs-db.ts");
  // Since S4 the retry is ONE combined path shared with the deployment_id pin (migration 8): the
  // column-missing error drops the named pin and re-inserts the same submission id.
  return /context_snapshot_id\/i\.test/.test(raw)
    && raw.includes("createRun: v_preflight_runs.context_snapshot_id is missing. Apply sql/vraelis-preflight-7-context-snapshots.sql")
    && /pinContext = false;[\s\S]{0,700}insert\(rowFor\(\) as never\)/.test(raw);
})());

const appsRoute = stripComments(read("app/api/preflight/apps/route.ts"));
ok("app POST snapshots AFTER extras + connections, inside try/catch (a connect never fails over versioning)",
  /try \{ await snapshotIfChanged\(email, appId, "owner"\); \} catch/.test(appsRoute)
  && appsRoute.indexOf("snapshotIfChanged(") > appsRoute.indexOf("applySetupExtras(")
  && appsRoute.indexOf("snapshotIfChanged(") > appsRoute.indexOf("addConnection("));

const connCollection = stripComments(read("app/api/preflight/apps/[id]/connections/route.ts"));
ok("connection add snapshots on a NEW row only (deduped re-adds change no context), inside try/catch",
  /if \(!r\.existing\) \{[\s\S]*?try \{ await snapshotIfChanged\(g\.owner, g\.appId, "owner"\); \} catch/.test(connCollection));
const connSingle = stripComments(read("app/api/preflight/apps/[id]/connections/[connId]/route.ts"));
ok("connection edit AND disconnect both snapshot, inside try/catch",
  (connSingle.match(/try \{ await snapshotIfChanged\(g\.owner, g\.appId, "owner"\); \} catch/g) ?? []).length === 2);
const secretsRoute = stripComments(read("app/api/preflight/apps/[id]/secrets/route.ts"));
ok("test-account add AND revoke both snapshot, inside try/catch",
  (secretsRoute.match(/try \{ await snapshotIfChanged\(g\.owner, g\.appId, "owner"\); \} catch/g) ?? []).length === 2);
ok("secrets route snapshots AFTER the sealed store (plaintext never flows toward the snapshot call)",
  secretsRoute.indexOf("snapshotIfChanged(") > secretsRoute.indexOf("addTestAccount("));

const reqRoute = stripComments(read("app/api/preflight/requirements/route.ts"));
ok("contract approval snapshots + pins inside try/catch, only AFTER approveContract succeeded",
  /const ok = await approveContract\(email, contractId\);[\s\S]*?if \(ok && contract\) \{[\s\S]*?try \{[\s\S]*?snapshotIfChanged\(email, contract\.application_id, "owner"\)[\s\S]*?pinSnapshotToContract\(email, contractId, snap\.id\)[\s\S]*?\} catch/.test(reqRoute));
ok("approval outcome is decided by approveContract alone (pin failure can never turn ok into an error)",
  reqRoute.indexOf("return ok ? NextResponse.json({ ok: true })") > reqRoute.indexOf("pinSnapshotToContract("));

// ── Static: the Context tab is honest about migration 7 and the design rules ──
console.log("\n── context tab static ──");
const PAGE = "app/rank/app/applications/[id]/context/page.tsx";
const page = read(PAGE);
ok("migration-7 notice present, word for word",
  page.includes("Context versioning is not active yet: apply")
  && page.includes("sql/vraelis-preflight-7-context-snapshots.sql")
  && page.includes("(migration 7)")
  && page.includes("Nothing is lost; the current context below is live but unversioned."));
ok("the live context still renders beneath the notice (sections are not gated on versioningActive)", (() => {
  const notice = page.indexOf("Context versioning is not active yet");
  const identity = page.indexOf('aria-label="Identity"');
  return notice !== -1 && identity > notice && !/\{versioningActive[\s\S]{0,120}aria-label="Identity"/.test(page);
})());
ok("stale-context notice with the diff", page.includes("Context has changed since the approved contract") && page.includes("<DiffList diff={staleDiff}"));
ok("contract pin surfaces as 'Used by contract vN'", page.includes("Used by contract v"));
ok("changes since previous version + first-version honesty",
  page.includes("Changes since previous version") && page.includes("This is the first recorded version"));
ok("version history renders id-free metadata (version, short hash, author, date)",
  page.includes("Version history") && page.includes("shortHash(v.hash)") && page.includes("AUTHOR_LABELS[v.author]"));
ok("versioned-vs-empty states stay distinct (No versions recorded yet only when the store is ready)",
  page.includes("No versions recorded yet") && page.includes("snapshotStoreReady("));
ok("missing recommended context section with real gaps", page.includes("Missing recommended context") && page.includes("No source connection"));
ok("owner/member-gated server component (requirePreflightAppAccess or requirePreflightOwner, + getApplication)",
  (page.includes("requirePreflightAppAccess(") || page.includes("requirePreflightOwner(")) && page.includes("getApplication("));
ok("all twelve source kinds are labeled", ["prompt", "prd", "requirements", "readme", "risks", "roles", "summary", "goal", "workflows", "data", "auth_expect", "billing_expect"].every((k) => new RegExp(`${k}: "`).test(page)));
ok("no em dash, no middle dot, no emoji in the tab copy",
  !page.includes("—") && !page.includes("·") && !/[\u{1F300}-\u{1FAFF}]/u.test(page));
const tabs = read("app/rank/app/applications/[id]/app-tabs.tsx");
ok("app tabs include Context -> /context", tabs.includes('label: "Context"') && tabs.includes('path: "/context"'));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
