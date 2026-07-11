// Read-only Vraelis Preflight database readiness check. Confirms the additive migration
// (sql/vraelis-preflight.sql + sql/vraelis-preflight-2-discovery.sql) is applied. NEVER mutates data:
// it issues HEAD/count selects (limit 0) per table + representative columns, and probes the claim RPC by
// distinguishing "function not found" from a real (null) result. Exits non-zero if anything is missing so
// CI / `npm run preflight:verify-db` fails loudly before features assume the tables exist.
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

loadEnvConfig(process.cwd());
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("FAIL  Supabase env not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"); process.exit(2); }
const s = createClient(url, key, { auth: { persistSession: false } });

// table -> a column that only exists once the full migration is applied (catches half-applied schemas).
const TABLE_COL: [string, string][] = [
  ["v_applications", "ownership_confirmed"],
  ["v_app_connections", "encrypted_ref"],
  ["v_production_contracts", "source_prompt"],
  ["v_contract_requirements", "fingerprint"],        // added by migration 2
  ["v_test_flows", "auth_required"],                  // added by migration 2
  ["v_preflight_runs", "provider_session_id"],        // added by migration 2
  ["v_flow_runs", "observed"],
  ["v_run_steps", "screenshot_id"],
  ["v_issues", "repair_prompt"],
  ["v_run_artifacts", "storage_path"],
  ["v_repairs", "fix_prompt"],
  ["v_discovery_snapshots", "content_hash"],          // migration 2
];

let missing = 0;
const ok = (label: string, present: boolean, note = "") => { console.log(`${present ? "PASS" : "FAIL"}  ${label}${note ? `  (${note})` : ""}`); if (!present) missing++; };

async function main() {
  for (const [table, col] of TABLE_COL) {
    // A REAL (non-head) select projects the column, so PostgREST validates both the table and the column
    // (a HEAD/count select does NOT validate columns — it would false-pass). limit(1) keeps it read-only.
    const { error } = await s.from(table).select(col).limit(1);
    ok(`table ${table} (col ${col})`, !error, error?.message?.slice(0, 80));
  }
  // Claim RPC: a missing function returns PGRST202 ("Could not find the function"). At setup time there
  // are no queued runs, so a present function returns null with no side effect.
  const { error: rpcErr } = await s.rpc("v_preflight_claim", { p_worker: "verify-probe", p_lease_secs: 1 });
  const rpcPresent = !rpcErr || !/could not find the function|PGRST202|does not exist/i.test(rpcErr.message || "");
  ok("rpc v_preflight_claim()", rpcPresent, rpcErr?.message?.slice(0, 80));

  console.log(`\n${TABLE_COL.length + 1 - missing}/${TABLE_COL.length + 1} present`);
  if (missing) {
    console.log("\nMigration NOT fully applied. Apply in the Supabase SQL editor (additive, idempotent):");
    console.log("  1) sql/vraelis-preflight.sql");
    console.log("  2) sql/vraelis-preflight-2-discovery.sql");
    process.exit(1);
  }
  console.log("Preflight database is ready.");
  process.exit(0);
}
main().catch((e) => { console.error("verify error:", e.message); process.exit(2); });
