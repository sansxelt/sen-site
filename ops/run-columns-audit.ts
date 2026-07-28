// WHAT A RUN ACTUALLY RECORDS, read from production rather than from a type.
//
// The key detail page and /usage are about to report per-key and per-account statistics. Every figure on
// them has to come from a column that exists and is populated. A type declares intent; a row is evidence.
// This prints the columns present on a real run, how many runs carry a value in each, and the distinct
// decisions, so a stat can be designed against what is there instead of what was meant to be.
//
// Reads only.
//   npx tsx ops/run-columns-audit.ts
import { readFileSync } from "node:fs";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

async function main() {
  const { getSupabaseAdminClient, isDatabaseConfigured } = await import("../lib/supabase-admin");
  if (!isDatabaseConfigured()) { console.log("no database configured"); return; }
  const db = getSupabaseAdminClient();

  const { data, error } = await db.from("v_preflight_runs" as never).select("*").limit(500);
  if (error) { console.log("read failed:", error.message); return; }
  const rows = (data ?? []) as Record<string, unknown>[];
  if (!rows.length) { console.log("no runs"); return; }

  const cols = Object.keys(rows[0]).sort();
  console.log(`── v_preflight_runs: ${rows.length} rows, ${cols.length} columns ──`);
  const populated = (c: string) => rows.filter((r) => r[c] !== null && r[c] !== undefined && r[c] !== "").length;
  const interesting = cols.filter((c) => /time|at$|_at|duration|second|ms$|cent|credit|flow|unit|decision|state|key|verdict|invalid/i.test(c));
  for (const c of interesting) {
    const n = populated(c);
    const sample = rows.find((r) => r[c] != null)?.[c];
    console.log(`  ${c.padEnd(28)} ${String(n).padStart(4)}/${rows.length}  e.g. ${JSON.stringify(sample)?.slice(0, 40)}`);
  }
  console.log("\n  all columns:", cols.join(", "));

  const tally = (c: string) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(String(r[c] ?? "(null)"), (m.get(String(r[c] ?? "(null)")) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  console.log("\n── decisions ──"); for (const [k, n] of tally("decision")) console.log(`  ${String(k).padEnd(20)} ${n}`);
  console.log("\n── states ──");    for (const [k, n] of tally("state")) console.log(`  ${String(k).padEnd(20)} ${n}`);

  const keyed = rows.filter((r) => r["api_key_id"]);
  console.log(`\n── attribution ──\n  runs launched by an API key: ${keyed.length} of ${rows.length}`);

  // Is there any real duration to report, or only the flow-count derivation?
  const withBoth = rows.filter((r) => r["created_at"] && (r["completed_at"] || r["finished_at"]));
  console.log(`  runs with a start AND an end timestamp: ${withBoth.length}`);
  if (withBoth.length) {
    const secs = withBoth.map((r) => (Date.parse(String(r["completed_at"] ?? r["finished_at"])) - Date.parse(String(r["created_at"]))) / 1000)
      .filter((s) => Number.isFinite(s) && s > 0).sort((a, b) => a - b);
    if (secs.length) console.log(`  real wall-clock duration: median ${Math.round(secs[Math.floor(secs.length / 2)])}s, range ${Math.round(secs[0])}-${Math.round(secs[secs.length - 1])}s`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
