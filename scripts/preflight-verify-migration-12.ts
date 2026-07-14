// READ-ONLY verification that migration 12 (multi-runtime foundation) applied correctly against the LIVE
// database. Same safety discipline as preflight-verify-db.ts: service-role client, ONLY .select() reads
// (no insert/update/delete, no writing RPC). Computes DATA-SHAPE assertions in JS because PostgREST cannot
// run arbitrary joins/aggregates.
//
// SCOPE (important — read before trusting a PASS): this script proves the DATA is consistent with a correct
// migration. It CANNOT prove schema-object existence via PostgREST — it cannot see whether an index, a
// foreign-key constraint, a NOT-NULL constraint, or a column's TYPE is present. Those are proven by the SQL
// verifier sql/vraelis-preflight-verify-12.sql, which queries pg_indexes / information_schema in the Supabase
// SQL editor. Run BOTH; neither alone is sufficient. This split is deliberate after an adversarial audit that
// showed a data-only check can false-PASS on a schema whose objects are missing.
//
// FAIL-LOUD design (the audit's core lesson): the dangerous failure is a false PASS. So this script FAILS if
//   - the apps read returns zero rows (wrong project / RLS / empty DB — nothing to verify, not "all clean"),
//   - ANY dataset read errors (not just apps/targets) — downstream assertions never run on truncated data,
//   - any table exceeds the in-memory cap (bails to "verify via SQL", never silent-passes a partial scan),
//   - a paged read looks truncated by a server row cap.
//
// DATA-SHAPE assertions:
//   POP  Population sanity: >0 apps visible, and web-target count EQUALS app count (backfill covered all).
//   COLS New columns/tables are selectable by NAME (name only — type is proven by the SQL verifier).
//   C    Every existing application has EXACTLY ONE web runtime target.
//   D    No duplicate web target per application in the CURRENT data (index existence proven by SQL verifier).
//   KIND No target carries an unexpected kind; every app's target set is exactly one canonical web target.
//   E    No orphaned build rows (target resolves) AND no null runtime_target_id (NOT NULL bypass) in builds.
//   F    No orphaned platform_decision rows (target + build resolve) AND no null runtime_target_id.
//   G    Existing runs resolve to their app's web target (null allowed = the app's web target).
//   H    Existing issues resolve to their app's web target (null allowed).
//   OWN  Web target owner matches its application owner (tenancy integrity).
//   LBL  Backfilled web targets are canonical (label 'Web').

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("FAIL  Supabase env not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"); process.exit(2); }
const s = createClient(url, key, { auth: { persistSession: false } });

const JSON_MODE = process.argv.includes("--json");
const MAX_ROWS = 200_000;         // in-memory cap per table; above this we bail to the SQL verifier (never silent-pass)
const PAGE = 1000;
const KNOWN_KINDS = new Set(["web", "api", "android", "ios", "electron", "windows", "macos"]);

let failCount = 0; const results: { id: string; label: string; pass: boolean; note: string }[] = [];
function assert(id: string, label: string, pass: boolean, note = "") {
  results.push({ id, label, pass, note });
  if (!pass) failCount++;
  if (!JSON_MODE) console.log(`${pass ? "PASS" : "FAIL"}  [${id}] ${label}${note ? `  — ${note}` : ""}`);
}
// A hard stop that guarantees a non-zero exit and prints why. Used for conditions where continuing would
// evaluate assertions over untrustworthy data (empty/errored/truncated reads).
function hardFail(id: string, label: string, note: string) { assert(id, label, false, note); finish(); }

type Read<T> = { rows: T[]; error: string | null; capped: boolean; truncated: boolean };
// Page through a table read-only. Uses { count: "exact" } so the server reports the TRUE total row count in
// Content-Range; after paging we compare rows read vs that total. `truncated` fires when we read fewer rows
// than the server says exist and we did NOT stop for the MAX_ROWS cap — the signature of a server db-max-rows
// limit silently capping each page (the exact false-negative the audit flagged). All calls are
// .select()/.range() — nothing mutates.
async function readAll<T>(table: string, cols: string): Promise<Read<T>> {
  const out: T[] = []; let total: number | null = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error, count } = await s.from(table).select(cols, { count: "exact" }).range(from, from + PAGE - 1);
    if (error) return { rows: out, error: error.message, capped: false, truncated: false };
    if (count != null) total = count;               // server's true total (stable across pages)
    const chunk = (data ?? []) as T[];
    out.push(...chunk);
    if (out.length > MAX_ROWS) return { rows: out, error: null, capped: true, truncated: false };
    if (chunk.length < PAGE) break;                 // a short page ends paging (no more rows on the server)
  }
  // If the server says more rows exist than we managed to read (and we didn't cap), a per-page server limit
  // truncated the reads — we cannot trust the data. Flag it so the caller hard-fails to the SQL verifier.
  const truncated = total != null && out.length < total;
  return { rows: out, error: null, capped: false, truncated };
}

async function main() {
  // ── COLS. New tables/columns are selectable by NAME (name-resolution only; type proven by SQL verifier). ──
  const colProbe: [string, string, string][] = [
    ["COLS.rt", "v_runtime_targets", "id,user_id,application_id,kind,label,environment,created_at"],
    ["COLS.b", "v_builds", "id,user_id,runtime_target_id,kind,base_url,version,commit_sha,artifact_hash"],
    ["COLS.pd", "v_platform_decisions", "id,user_id,application_id,runtime_target_id,runtime_kind,build_id,environment,contract_version,matrix_hash,adapter_version,decision,failure_class"],
    ["COLS.i", "v_issues", "runtime_target_id"],
    ["COLS.r", "v_preflight_runs", "runtime_target_id,adapter_version"],
  ];
  for (const [id, table, cols] of colProbe) {
    const { error } = await s.from(table).select(cols).limit(1);
    assert(id, `column names resolve: ${table}`, !error, error?.message?.slice(0, 90) ?? "(name-only; type verified by SQL)");
  }
  // If a required table/column name doesn't even resolve, stop — everything downstream is meaningless.
  if (failCount > 0) return hardFail("COLS.gate", "all new tables/columns must resolve before data checks", "a required name is missing; apply migration 12 then re-run");

  // Read every dataset once. Fail LOUD on any error / cap / truncation before evaluating data assertions.
  const apps = await readAll<{ id: string; user_id: string }>("v_applications", "id,user_id");
  const targets = await readAll<{ id: string; user_id: string; application_id: string; kind: string; label: string; environment: string | null }>(
    "v_runtime_targets", "id,user_id,application_id,kind,label,environment");
  const builds = await readAll<{ id: string; runtime_target_id: string | null }>("v_builds", "id,runtime_target_id");
  const decisions = await readAll<{ id: string; runtime_target_id: string | null; build_id: string | null }>(
    "v_platform_decisions", "id,runtime_target_id,build_id");
  const runs = await readAll<{ id: string; user_id: string; application_id: string; runtime_target_id: string | null }>(
    "v_preflight_runs", "id,user_id,application_id,runtime_target_id");
  const issues = await readAll<{ id: string; user_id: string; application_id: string; runtime_target_id: string | null }>(
    "v_issues", "id,user_id,application_id,runtime_target_id");

  const datasets: [string, Read<unknown>][] = [
    ["v_applications", apps], ["v_runtime_targets", targets], ["v_builds", builds],
    ["v_platform_decisions", decisions], ["v_preflight_runs", runs], ["v_issues", issues],
  ];
  // (1) Any read error → hard fail. Downstream assertions must NEVER run over a truncated prefix.
  for (const [name, ds] of datasets) {
    if (ds.error) return hardFail("READ", `read ${name} (no data assertion may run on an errored read)`, ds.error.slice(0, 90));
  }
  // (2) Any table over the in-memory cap → bail to the SQL verifier rather than verify a partial scan.
  for (const [name, ds] of datasets) {
    if (ds.capped) return hardFail("CAP", `${name} exceeds ${MAX_ROWS} rows — verify via sql/vraelis-preflight-verify-12.sql`, "in-memory check declines large tables to avoid a partial-scan false pass");
  }
  // (3) Truncation guard (server row cap below the page size).
  for (const [name, ds] of datasets) {
    if (ds.truncated) return hardFail("TRUNC", `${name} read looks server-truncated — verify via SQL`, "PostgREST db-max-rows may be below the page size");
  }

  // ── POP. Population sanity — the anti-false-PASS gate. Zero apps means we're pointed at the wrong DB or the
  // backfill never ran; that is a FAIL, not "all clean". And the web-target count must EQUAL the app count. ──
  if (apps.rows.length === 0) return hardFail("POP", "at least one application must be visible", "zero apps visible — wrong project / RLS / empty DB; nothing to verify");
  const webTargets = targets.rows.filter((t) => t.kind === "web");
  assert("POP", "web-target count equals application count (backfill covered every app)",
    webTargets.length === apps.rows.length,
    `${apps.rows.length} apps, ${webTargets.length} web targets`);

  const targetById = new Map(targets.rows.map((t) => [t.id, t]));

  // ── C. Every application has EXACTLY ONE web target. ──
  const webByApp = new Map<string, number>();
  for (const t of webTargets) webByApp.set(t.application_id, (webByApp.get(t.application_id) ?? 0) + 1);
  const appsMissingWeb = apps.rows.filter((a) => !webByApp.has(a.id));
  assert("C", "every application has a web runtime target",
    appsMissingWeb.length === 0, `${appsMissingWeb.length} apps missing a web target`);

  // ── D. No duplicate web target per application in CURRENT data. (Index EXISTENCE is proven by the SQL
  // verifier — this is a data-snapshot check only, so its label does not overclaim "index held".) ──
  const dupWebApps = [...webByApp.entries()].filter(([, n]) => n > 1);
  assert("D", "current web data has no per-app duplicate (index existence: see SQL verifier)",
    dupWebApps.length === 0, dupWebApps.length ? `apps with >1 web target: ${dupWebApps.length}` : "");

  // ── KIND. Assert on the FULL target set (not the web-filtered subset): no unexpected kind; and every
  // backfilled app's target set is exactly one canonical web target (catches stray non-web-kind rows). ──
  const badKinds = targets.rows.filter((t) => !KNOWN_KINDS.has(t.kind));
  assert("KIND", "every runtime target has a known kind", badKinds.length === 0,
    badKinds.length ? `${badKinds.length} targets with an unexpected kind (e.g. '${badKinds[0].kind}')` : "");
  // For each app, the ONLY targets that exist right now should be its single web target (migration 12 creates
  // no non-web targets yet). A stray non-web target for an existing app is a backfill/data anomaly.
  const targetsByApp = new Map<string, { kind: string }[]>();
  for (const t of targets.rows) { const arr = targetsByApp.get(t.application_id) ?? []; arr.push(t); targetsByApp.set(t.application_id, arr); }
  const appsWithNonWeb = apps.rows.filter((a) => (targetsByApp.get(a.id) ?? []).some((t) => t.kind !== "web"));
  assert("KIND2", "no existing application has a non-web target yet (migration 12 creates web only)",
    appsWithNonWeb.length === 0, appsWithNonWeb.length ? `${appsWithNonWeb.length} apps carry a non-web target` : "");

  // ── LBL + OWN. Canonical label + tenancy integrity on web targets. ──
  const nonCanonWeb = webTargets.filter((t) => t.label !== "Web");
  assert("LBL", "web targets are canonical (label 'Web')", nonCanonWeb.length === 0,
    nonCanonWeb.length ? `${nonCanonWeb.length} web targets with a non-'Web' label` : "");
  const appOwner = new Map(apps.rows.map((a) => [a.id, a.user_id]));
  const ownerMismatch = webTargets.filter((t) => appOwner.has(t.application_id) && appOwner.get(t.application_id) !== t.user_id);
  assert("OWN", "web target owner matches its application owner", ownerMismatch.length === 0,
    ownerMismatch.length ? `${ownerMismatch.length} targets with owner != app owner` : "");

  // ── E. Builds: no null runtime_target_id (NOT NULL bypass) AND no orphan. runtime_target_id is NOT NULL in
  // the schema, so a null here means the constraint was never enforced — that is a violation, not "skip". ──
  const nullTgtBuilds = builds.rows.filter((b) => b.runtime_target_id == null);
  const orphanBuilds = builds.rows.filter((b) => b.runtime_target_id != null && !targetById.has(b.runtime_target_id));
  assert("E", "no build has a null or orphaned runtime_target_id",
    nullTgtBuilds.length === 0 && orphanBuilds.length === 0,
    `${builds.rows.length} builds; ${nullTgtBuilds.length} null, ${orphanBuilds.length} orphaned`);

  // ── F. Decisions: runtime_target_id NOT NULL (no null, no orphan); build_id is nullable (orphan-only). ──
  const buildIds = new Set(builds.rows.map((b) => b.id));
  const nullTgtDec = decisions.rows.filter((d) => d.runtime_target_id == null);
  const orphanDecTarget = decisions.rows.filter((d) => d.runtime_target_id != null && !targetById.has(d.runtime_target_id));
  const orphanDecBuild = decisions.rows.filter((d) => d.build_id != null && !buildIds.has(d.build_id));
  assert("F", "no decision has a null/orphaned target; build_id (nullable) resolves when set",
    nullTgtDec.length === 0 && orphanDecTarget.length === 0 && orphanDecBuild.length === 0,
    `${decisions.rows.length} decisions; ${nullTgtDec.length} null-target, ${orphanDecTarget.length} orphan-target, ${orphanDecBuild.length} orphan-build`);

  // ── G. Existing runs resolve to their app's web target (null = the app's web target, valid). ──
  const badRuns = runs.rows.filter((r) => {
    if (r.runtime_target_id == null) return false;
    const t = targetById.get(r.runtime_target_id);
    return !t || t.kind !== "web" || t.application_id !== r.application_id || t.user_id !== r.user_id;
  });
  const linkedRuns = runs.rows.filter((r) => r.runtime_target_id != null).length;
  assert("G", "existing runs resolve to their app's web target (or null = web)",
    badRuns.length === 0, `${runs.rows.length} runs, ${linkedRuns} linked; ${badRuns.length} mis-resolved`);

  // ── H. Existing issues resolve correctly (same rule as runs). ──
  const badIssues = issues.rows.filter((i) => {
    if (i.runtime_target_id == null) return false;
    const t = targetById.get(i.runtime_target_id);
    return !t || t.kind !== "web" || t.application_id !== i.application_id || t.user_id !== i.user_id;
  });
  const linkedIssues = issues.rows.filter((i) => i.runtime_target_id != null).length;
  assert("H", "existing issues resolve to their app's web target (or null = web)",
    badIssues.length === 0, `${issues.rows.length} issues, ${linkedIssues} linked; ${badIssues.length} mis-resolved`);

  finish();
}

function finish() {
  const checks = results.length, passed = results.filter((r) => r.pass).length;
  if (JSON_MODE) { console.log(JSON.stringify({ ready: failCount === 0, checks, passed, failed: results.filter((r) => !r.pass).map((r) => r.id) })); }
  else {
    console.log(`\n${passed}/${checks} DATA-SHAPE assertions PASS`);
    console.log(failCount === 0
      ? "\nMIGRATION 12 DATA: consistent. NOTE: schema objects (indexes, FK, NOT NULL, column types) are proven separately by sql/vraelis-preflight-verify-12.sql — run it in the Supabase SQL editor for full coverage."
      : "\nMIGRATION 12: NOT verified — resolve the FAILs above before merge.");
  }
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((e) => { console.error("verify error:", (e as Error).message); process.exit(2); });
