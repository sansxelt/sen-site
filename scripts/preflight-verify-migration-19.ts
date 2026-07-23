// READ-ONLY verification that migration 19 (guarantees) applied correctly against the LIVE database. Same
// safety discipline as preflight-verify-migration-12.ts: service-role client, ONLY .select() reads (no
// insert/update/delete). Computes DATA-SHAPE assertions in JS.
//
// SCOPE (read before trusting a PASS): this proves the DATA is consistent with a correct migration. It CANNOT
// prove schema objects (index / FK / NOT-NULL / column TYPE) via PostgREST — those are proven by
// sql/vraelis-preflight-verify-19.sql in the Supabase SQL editor. Run BOTH; neither alone is sufficient.
//
// Unlike migration 12, an EMPTY v_guarantees is the expected initial state (guarantees start at zero), so this
// script does NOT fail on zero rows. The hard gate is name resolution: v_guarantees and the new
// v_preflight_runs.guarantee_id column must resolve. Data-shape checks then pass vacuously on an empty table.
//
// DATA-SHAPE assertions:
//   COLS  New table/column selectable by NAME (type proven by the SQL verifier).
//   FK    Every guarantee's application_id resolves to an application of the SAME owner (tenancy integrity).
//   LINK  Every run carrying a guarantee_id resolves to a guarantee of the SAME owner.
//   PS    Every guarantee's plan_state is one of draft | ok | review_required.

import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("FAIL  Supabase env not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"); process.exit(2); }
const s = createClient(url, key, { auth: { persistSession: false } });

const JSON_MODE = process.argv.includes("--json");
const MAX_ROWS = 200_000;
const PAGE = 1000;
const VALID_PLAN_STATES = new Set(["draft", "ok", "review_required"]);

let failCount = 0; const results: { id: string; label: string; pass: boolean; note: string }[] = [];
function assert(id: string, label: string, pass: boolean, note = "") {
  results.push({ id, label, pass, note });
  if (!pass) failCount++;
  if (!JSON_MODE) console.log(`${pass ? "PASS" : "FAIL"}  [${id}] ${label}${note ? `  — ${note}` : ""}`);
}
function hardFail(id: string, label: string, note: string) { assert(id, label, false, note); finish(); }

type Read<T> = { rows: T[]; error: string | null; capped: boolean; truncated: boolean };
async function readAll<T>(table: string, cols: string): Promise<Read<T>> {
  const out: T[] = []; let total: number | null = null;
  for (let from = 0; ; from += PAGE) {
    const { data, error, count } = await s.from(table).select(cols, { count: "exact" }).range(from, from + PAGE - 1);
    if (error) return { rows: out, error: error.message, capped: false, truncated: false };
    if (count != null) total = count;
    const chunk = (data ?? []) as T[];
    out.push(...chunk);
    if (out.length > MAX_ROWS) return { rows: out, error: null, capped: true, truncated: false };
    if (chunk.length < PAGE) break;
  }
  const truncated = total != null && out.length < total;
  return { rows: out, error: null, capped: false, truncated };
}

async function main() {
  // ── COLS gate: the new table and column must resolve by name before any data check is meaningful. ──
  const colProbe: [string, string, string][] = [
    ["COLS.g", "v_guarantees", "id,user_id,application_id,title,scope,criticality,approved_claim,approved_plan,approved_plan_hash,approved_role_refs,plan_version,plan_approved_by,plan_approved_at,plan_state,last_evaluated_at,status,created_at,updated_at"],
    ["COLS.r", "v_preflight_runs", "guarantee_id"],
  ];
  for (const [id, table, cols] of colProbe) {
    const { error } = await s.from(table).select(cols).limit(1);
    assert(id, `column names resolve: ${table}`, !error, error?.message?.slice(0, 90) ?? "(name-only; type verified by SQL)");
  }
  if (failCount > 0) return hardFail("COLS.gate", "v_guarantees + v_preflight_runs.guarantee_id must resolve before data checks", "a required name is missing; apply migration 19 then re-run");

  const apps = await readAll<{ id: string; user_id: string }>("v_applications", "id,user_id");
  const guarantees = await readAll<{ id: string; user_id: string; application_id: string; plan_state: string }>(
    "v_guarantees", "id,user_id,application_id,plan_state");
  const runs = await readAll<{ id: string; user_id: string; guarantee_id: string | null }>(
    "v_preflight_runs", "id,user_id,guarantee_id");

  const datasets: [string, Read<unknown>][] = [["v_applications", apps], ["v_guarantees", guarantees], ["v_preflight_runs", runs]];
  for (const [name, ds] of datasets) {
    if (ds.error) return hardFail("READ", `read ${name} (no data assertion may run on an errored read)`, ds.error.slice(0, 90));
    if (ds.capped) return hardFail("CAP", `${name} exceeds ${MAX_ROWS} rows — verify via sql/vraelis-preflight-verify-19.sql`, "in-memory check declines large tables");
    if (ds.truncated) return hardFail("TRUNC", `${name} read looks server-truncated — verify via SQL`, "PostgREST db-max-rows may be below the page size");
  }

  const appOwner = new Map(apps.rows.map((a) => [a.id, a.user_id]));
  const guaranteeOwner = new Map(guarantees.rows.map((g) => [g.id, g.user_id]));

  // ── FK. Every guarantee resolves to an application of the same owner. Vacuous PASS on an empty table. ──
  const badFk = guarantees.rows.filter((g) => !appOwner.has(g.application_id) || appOwner.get(g.application_id) !== g.user_id);
  assert("FK", "every guarantee.application_id resolves to an application of the same owner",
    badFk.length === 0, `${guarantees.rows.length} guarantees; ${badFk.length} mis-owned/orphaned`);

  // ── LINK. Every run carrying a guarantee_id resolves to a guarantee of the same owner (null = plain run). ──
  const linkedRuns = runs.rows.filter((r) => r.guarantee_id != null);
  const badLink = linkedRuns.filter((r) => !guaranteeOwner.has(String(r.guarantee_id)) || guaranteeOwner.get(String(r.guarantee_id)) !== r.user_id);
  assert("LINK", "every run.guarantee_id resolves to a guarantee of the same owner (or null = plain run)",
    badLink.length === 0, `${linkedRuns.length} guarantee-tagged runs; ${badLink.length} mis-owned/orphaned`);

  // ── PS. plan_state is always one of the three canonical values. ──
  const badPs = guarantees.rows.filter((g) => !VALID_PLAN_STATES.has(String(g.plan_state)));
  assert("PS", "every guarantee.plan_state is draft | ok | review_required",
    badPs.length === 0, badPs.length ? `${badPs.length} guarantees with an unexpected plan_state` : "");

  finish();
}

function finish() {
  const checks = results.length, passed = results.filter((r) => r.pass).length;
  if (JSON_MODE) { console.log(JSON.stringify({ ready: failCount === 0, checks, passed, failed: results.filter((r) => !r.pass).map((r) => r.id) })); }
  else {
    console.log(`\n${passed}/${checks} DATA-SHAPE assertions PASS`);
    console.log(failCount === 0
      ? "\nMIGRATION 19 DATA: consistent. NOTE: schema objects (indexes, FK, NOT NULL, column types) are proven separately by sql/vraelis-preflight-verify-19.sql — run it in the Supabase SQL editor for full coverage."
      : "\nMIGRATION 19: NOT verified — resolve the FAILs above before merge.");
  }
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((e) => { console.error("verify error:", (e as Error).message); process.exit(2); });
