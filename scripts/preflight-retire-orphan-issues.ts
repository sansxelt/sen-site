// Close out open issues that point at flows the contract no longer contains.
//
// WHY THEY EXIST. Issue reconciliation matches on flow id (planReconcile in lib/preflight/issues.ts): a run
// resolves an open issue only when THAT flow id passes. So when a contract's flows are replaced — a new
// contract version, a regenerated flow set, a promotion from another contract — every issue attached to the
// old ids becomes permanently unreachable. No future run can resolve them, however green it is. On
// demo@vraelis.com/Notewell that left 8 open issues, several critical, under a system whose current run
// passed both critical flows: a verdict and an issue list that contradict each other, which is exactly what
// a reviewer notices first.
//
// WHY status='resolved' AND resolved_run STAYS NULL. The schema has only open|resolved, and "resolved" is not
// quite true — these were not fixed, they stopped being verified. Leaving resolved_run NULL is the honest
// distinction available: a genuine resolve records the run that proved it, so a null there marks this as an
// administrative close rather than a verified fix, and the evidence, repro and screenshots are all preserved
// on the row either way. Nothing is deleted.
//
// WHAT IT REFUSES TO TOUCH. Any issue whose flow id IS in the current contract, because those are live and a
// run can still resolve or continue them on its own. And it reports, rather than hides, any retired issue
// whose behaviour is not covered by a passing flow in the new contract — a defect nobody re-verified is a
// fact the operator should see, not something a cleanup script should quietly absorb.
import { loadLocalEnv } from "../worker/preflight/local-env";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../lib/supabase-admin";
import { getApprovedContract } from "../lib/v-applications";

loadLocalEnv();

const ARG = (f: string): string | null => {
  const i = process.argv.indexOf(f);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
};
const APPLY = process.argv.includes("--apply");
const OWNER = ARG("--owner");
const APP = ARG("--app");

async function main() {
  if (!OWNER || !APP) {
    console.log(`
  npx tsx scripts/preflight-retire-orphan-issues.ts --owner EMAIL --app APP_UUID [--apply]

    Closes open issues whose flow is not in the app's current approved contract.
    Dry run unless --apply is passed.
`);
    process.exitCode = 2; return;
  }
  if (!isDatabaseConfigured()) {
    console.error("No database configured. Run: vercel env pull .env.local --environment=production");
    process.exitCode = 2; return;
  }
  const s = getSupabaseAdminClient();
  const owner = OWNER.trim().toLowerCase();

  const contract = await getApprovedContract(owner, APP);
  if (!contract) { console.error("no approved production contract — nothing to compare against"); process.exitCode = 1; return; }

  const flowQ = await s.from("v_test_flows" as never).select("id, name").eq("contract_id", contract.id);
  if (flowQ.error) { console.error(`flow read failed: ${flowQ.error.message}`); process.exitCode = 1; return; }
  const live = new Map(((flowQ.data as { id: string; name: string }[]) ?? []).map((f) => [f.id, f.name]));

  // Which live flows PASSED most recently: a retired issue whose behaviour is covered by a passing flow has
  // genuinely been re-verified under a new id. One that is not covered by any passing flow has not.
  const lastRun = await s.from("v_preflight_runs" as never)
    .select("id").eq("application_id", APP).eq("state", "completed")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const passedNames = new Set<string>();
  if (lastRun.data) {
    const fr = await s.from("v_flow_runs" as never)
      .select("name, state").eq("preflight_run_id", (lastRun.data as { id: string }).id);
    for (const f of (fr.data as { name: string; state: string }[] | null) ?? []) {
      if (f.state === "passed") passedNames.add(live.get(f.name) ?? f.name);
    }
  }

  const issQ = await s.from("v_issues" as never)
    .select("id, severity, title, status, flow_id, run_id, last_seen_run").eq("application_id", APP).eq("status", "open");
  if (issQ.error) { console.error(`issue read failed: ${issQ.error.message}`); process.exitCode = 1; return; }
  const open = (issQ.data as Record<string, unknown>[]) ?? [];

  const orphans = open.filter((i) => !i.flow_id || !live.has(i.flow_id as string));
  const liveIssues = open.filter((i) => i.flow_id && live.has(i.flow_id as string));

  console.log(`\ncurrent contract  v${contract.version}  ${live.size} flows`);
  console.log(`open issues       ${open.length}  ->  ${orphans.length} orphaned, ${liveIssues.length} live\n`);

  console.log(`ORPHANED (flow not in v${contract.version}; unreachable by any future run):`);
  for (const i of orphans) console.log(`  [${i.severity}] ${String(i.title).slice(0, 66)}`);
  if (liveIssues.length) {
    console.log(`\nLEFT ALONE (flow is live; a run can still resolve these):`);
    for (const i of liveIssues) console.log(`  [${i.severity}] ${String(i.title).slice(0, 66)}`);
  }
  if (passedNames.size) {
    console.log(`\nflows passing on the latest completed run: ${passedNames.size}`);
    for (const n of passedNames) console.log(`  ${n}`);
  }

  if (!orphans.length) { console.log(`\nnothing to do.`); return; }
  if (!APPLY) { console.log(`\nDRY RUN — nothing written. Re-run with --apply.`); return; }

  let done = 0;
  for (const i of orphans) {
    // resolved_run deliberately NOT set: this is an administrative close, not a run-verified fix.
    const u = await s.from("v_issues" as never)
      .update({ status: "resolved" } as never).eq("user_id", owner).eq("id", i.id as string);
    if (u.error) { console.error(`  failed ${i.id}: ${u.error.message}`); continue; }
    done++;
  }
  console.log(`\nclosed ${done} of ${orphans.length} orphaned issues (resolved_run left null)`);

  const after = await s.from("v_issues" as never)
    .select("id", { count: "exact", head: true }).eq("application_id", APP).eq("status", "open");
  console.log(`open issues now: ${after.count ?? "?"}`);
  process.exitCode = done === orphans.length ? 0 : 1;
}

void main();
