// READ-ONLY BACKUP of everything the provenance correction can write.
//
// Supabase's managed backups are a paid feature and this project is on the free plan, so the usual
// "take a snapshot first" step is not available. A full pg_dump would need the database password, which is
// not in this environment. What IS available is a complete row-level export over PostgREST, and that turns
// out to be well matched to the risk: the correction writes exactly two tables, and both are tiny.
//
//   v_contract_requirements   153 rows   every provenance column, plus order_index
//   v_production_contracts     ~25 rows  legacy_approval_class
//
// This is not a substitute for a database backup in general. It IS a complete, restorable capture of every
// row and column the correction is capable of changing, which is the actual exposure being covered.
//
// Two artifacts, both written outside version control:
//   backup-<stamp>.json   every row of both tables, every column, exactly as read
//   restore-<stamp>.sql   UPDATE statements that put every touched column back, runnable in the SQL editor
//
// The restore file is generated, not executed. Nothing here writes to the database.
//
// Usage:  npx tsx scripts/provenance-backup.ts
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n\r]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !key) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// Every column the correction is capable of writing, per table. A column absent from this list is a column
// the restore file would silently fail to put back, so this list IS the safety guarantee.
const REQ_COLUMNS = [
  "source", "origin", "review_state", "approved", "review_basis",
  "approved_by", "approved_at", "reviewed_plan_id", "legacy_review_class", "review_identity", "order_index",
] as const;
const CONTRACT_COLUMNS = ["legacy_approval_class"] as const;

type Row = Record<string, unknown>;

async function readAll(table: string): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await db.from(table).select("*").range(from, from + 999);
    if (r.error) { console.error(`read failed on ${table}: ${r.error.message}`); process.exit(1); }
    const page = (r.data ?? []) as Row[];
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

// Postgres literal. Nulls stay null; everything else is single-quoted with quotes doubled. Numbers and
// booleans are emitted bare so the column types are respected on the way back in.
function lit(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join("ops", "backups");
  mkdirSync(dir, { recursive: true });

  console.log(`target: ${url.replace(/https:\/\/([a-z0-9]{6})[a-z0-9]*/, "https://$1***")}`);
  console.log("reading every row of both tables the correction can write\n");

  const reqs = await readAll("v_contract_requirements");
  const contracts = await readAll("v_production_contracts");
  // Not written by the correction, but required to RECONSTRUCT its classification: lane membership comes
  // from v_applications.builder, and group A from the run -> reviewed-plan binding. Captured so the
  // rehearsal seed can be generated from real structure instead of hand-authored guesses, which have now
  // produced three false passes in a row.
  const apps = (await readAll("v_applications")).map((a) => ({ id: a.id, builder: a.builder }));
  const runs = (await readAll("v_preflight_runs")).map((r) => ({ id: r.id, contract_id: r.contract_id }));
  const plans = (await readAll("v_reviewed_plans")).map((p) => ({
    id: p.id, run_id: p.run_id, approval_state: p.approval_state,
    approved_by: p.approved_by, approved_at: p.approved_at,
  }));
  console.log(`  v_contract_requirements   ${String(reqs.length).padStart(4)} rows`);
  console.log(`  v_production_contracts    ${String(contracts.length).padStart(4)} rows`);
  console.log(`  (structure for rehearsal: ${apps.length} applications, ${runs.length} runs, ${plans.length} reviewed plans)`);

  // A row missing a column means the export could not capture it, which would make the restore incomplete.
  const missing = REQ_COLUMNS.filter((c) => reqs.length > 0 && !(c in reqs[0]));
  if (missing.length) {
    console.error(`\nABORT: v_contract_requirements is missing ${missing.join(", ")}.`);
    console.error("Migration 19 may not be applied. A partial backup is worse than none, because it looks like one.");
    process.exit(1);
  }

  const jsonPath = join(dir, `backup-${stamp}.json`);
  writeFileSync(jsonPath, JSON.stringify({
    captured_at: new Date().toISOString(),
    target: url.replace(/https:\/\/([a-z0-9]{6})[a-z0-9]*/, "https://$1***"),
    note: "Complete row-level capture of every table the provenance correction can write.",
    v_contract_requirements: reqs,
    v_production_contracts: contracts,
    // Structure only, for rehearsal-seed generation. Not restored by restore-<stamp>.sql.
    v_applications: apps,
    v_preflight_runs: runs,
    v_reviewed_plans: plans,
  }, null, 2), "utf8");

  const sql: string[] = [
    "-- RESTORE the provenance state captured before the correction ran.",
    `-- Captured ${new Date().toISOString()}.  ${reqs.length} requirement rows, ${contracts.length} contract rows.`,
    "--",
    "-- Every column the correction is capable of writing is restored explicitly, including the ones it would",
    "-- have left alone, so the result does not depend on which stages ran before it was interrupted.",
    "--",
    "-- Two constraints forbid the state being restored, so both are dropped and re-added NOT VALID around it,",
    "-- exactly as their migrations created them:",
    "--   chk_v_req_approved_has_basis              approved rows with a null review_basis",
    "--   chk_v_req_approved_matches_review_state   approved rows with the vestigial boolean false",
    "",
    "begin;",
    "",
    "alter table v_contract_requirements drop constraint if exists chk_v_req_approved_has_basis;",
    "alter table v_contract_requirements drop constraint if exists chk_v_req_approved_matches_review_state;",
    "",
  ];
  for (const r of reqs) {
    const sets = REQ_COLUMNS.map((c) => `${c} = ${lit(r[c])}`).join(", ");
    sql.push(`update v_contract_requirements set ${sets} where id = ${lit(r.id)};`);
  }
  sql.push("");
  for (const c of contracts) {
    const sets = CONTRACT_COLUMNS.map((col) => `${col} = ${lit(c[col])}`).join(", ");
    sql.push(`update v_production_contracts set ${sets} where id = ${lit(c.id)};`);
  }
  sql.push(
    "",
    "alter table v_contract_requirements add constraint chk_v_req_approved_has_basis",
    "  check (review_state <> 'approved' or review_basis is not null) not valid;",
    "alter table v_contract_requirements add constraint chk_v_req_approved_matches_review_state",
    "  check (approved is not distinct from (review_state = 'approved')) not valid;",
    "",
    "-- Confirm before committing: this must report 136 for a restore to the pre-correction state.",
    "select count(*) as restored_false_triple",
    "  from v_contract_requirements r",
    "  join v_production_contracts c on c.id = r.contract_id",
    "  join v_applications a         on a.id = c.application_id",
    " where a.builder = 'vraelis_api'",
    "   and r.source = 'manual' and r.origin = 'user' and r.review_state = 'approved';",
    "",
    "-- commit;   (or)   rollback;",
    "",
  );
  const sqlPath = join(dir, `restore-${stamp}.sql`);
  writeFileSync(sqlPath, sql.join("\n"), "utf8");

  // What the restore would put back, so the operator can see the capture is of the PRE-correction state.
  //
  // SCOPED TO THE LANE, because that is what the census counts and what the correction changes. A global
  // count reads 137, not 136: one NON-LANE contract holds a single row that happens to carry the same
  // manual/user/approved shape. It is out of scope and the correction never touches it. Reporting the
  // global number here would look like drift in the one report that has to be trustworthy.
  const laneAppRes = await db.from("v_applications").select("id").eq("builder", "vraelis_api");
  const laneApps = new Set(((laneAppRes.data ?? []) as { id: string }[]).map((a) => a.id));
  const laneContracts = new Set(contracts.filter((c) => laneApps.has(String(c.application_id))).map((c) => String(c.id)));
  const hasTriple = (r: Row) => r.source === "manual" && r.origin === "user" && r.review_state === "approved";
  const laneTriple = reqs.filter((r) => laneContracts.has(String(r.contract_id)) && hasTriple(r)).length;
  const allTriple = reqs.filter(hasTriple).length;
  console.log(`\n  lane rows captured carrying the false triple:  ${laneTriple}`);
  console.log(`  (136 = captured before the correction, 0 = captured after)`);
  console.log(`  all rows carrying that shape, lane or not:     ${allTriple}   (137 expected: 136 lane + 1 non-lane, out of scope)`);
  console.log(`\nwritten:\n  ${jsonPath}\n  ${sqlPath}`);
  console.log("\nBoth are gitignored: requirement text is customer content and does not belong in the repo.");
}

main().catch((e) => { console.error(e); process.exit(1); });
