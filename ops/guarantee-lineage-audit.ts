// READ-ONLY audit: which historical runs can have their guarantee lineage PROVEN?
//
// NOT A BACKFILL, and deliberately not runnable as one. The founder's instruction was explicit: do not link
// historical runs by text similarity, plan_hash, URL, timestamp, nearest guarantee or newest guarantee. Only
// EXACT, recorded lineage may ever be written, and everything else stays null and is called what it is — a
// legacy unlinked verification.
//
// This exists so that "we did not guess" is a checked statement rather than a promise. It SELECTs only; it
// contains no insert, update or delete, and it lives in ops/ rather than sql/ so no migration runner can
// reach it.
//
//   npx tsx ops/guarantee-lineage-audit.ts
import { readFileSync } from "node:fs";

function loadEnv() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnv();
  const { createClient } = await import("@supabase/supabase-js");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) { console.log("no supabase config"); return; }
  const s = createClient(url, key, { auth: { persistSession: false } });

  console.log("GUARANTEE LINEAGE AUDIT (read-only)\n");

  // 1. Could any guarantee have existed to be linked TO? Archived rows count: a run could legitimately
  //    prove a guarantee that was archived afterwards.
  const g = await s.from("v_guarantees").select("id,status,created_at,application_id,title");
  const guarantees = g.data ?? [];
  console.log(`guarantees, including archived: ${g.error ? "ERR " + g.error.message : guarantees.length}`);
  if (guarantees.length) for (const x of guarantees.slice(0, 10)) console.log(`   ${x.id}  ${x.status}  ${String(x.title).slice(0, 50)}`);

  // 2. Runs, and how many already carry a link.
  const r = await s.from("v_preflight_runs")
    .select("id,user_id,created_at,guarantee_id,application_id,state,decision")
    .order("created_at", { ascending: false }).limit(5000);
  const runs = r.data ?? [];
  const linked = runs.filter((x) => x.guarantee_id);
  console.log(`\nruns: ${r.error ? "ERR " + r.error.message : runs.length}`);
  console.log(`  already carrying guarantee_id: ${linked.length}`);

  // 3. The ONLY relationship that is recorded rather than inferred: a reviewed plan carries the guarantee it
  //    was minted for, and carries the run that consumed it. Where both are present, the lineage is a fact.
  //    Anything else is a guess and is not attempted.
  const p = await s.from("v_reviewed_plans")
    .select("id,guarantee_id,run_id,approval_state,execution_state,claim,created_at");
  const plans = p.data ?? [];
  console.log(`\nreviewed plans: ${p.error ? "ERR " + p.error.message : plans.length}`);
  const provable = plans.filter((x) => x.guarantee_id && x.run_id);
  console.log(`  carrying BOTH a guarantee_id and a consumed run_id (provable lineage): ${provable.length}`);
  for (const x of provable) console.log(`   run ${x.run_id} <- plan ${x.id} <- guarantee ${x.guarantee_id}`);

  const planWithRunOnly = plans.filter((x) => !x.guarantee_id && x.run_id).length;
  console.log(`  consumed by a run but carrying NO guarantee (plain verifications): ${planWithRunOnly}`);

  // 4. The verdict, stated so it can be quoted rather than remembered.
  const unlinkable = runs.length - linked.length - provable.filter((x) => runs.some((y) => y.id === x.run_id && !y.guarantee_id)).length;
  console.log("\n── VERDICT ──");
  console.log(`  runs with lineage already recorded:            ${linked.length}`);
  console.log(`  runs whose lineage is PROVABLE and unwritten:  ${provable.filter((x) => runs.some((y) => y.id === x.run_id && !y.guarantee_id)).length}`);
  console.log(`  runs that are LEGACY UNLINKED VERIFICATIONS:   ${Math.max(0, unlinkable)}`);
  console.log("\n  Legacy unlinked runs stay null. There is no query that could tell which guarantee they");
  console.log("  proved, because at the time they ran, none existed to prove. Labelling them is honest;");
  console.log("  attaching them to the nearest plausible guarantee would be inventing history.");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
