// Enable or disable named flows on a contract. Read-only until --apply, and it prints the exact command
// that reverses it.
//
// WHY A TOOL AND NOT A ONE-OFF. Turning a flow off changes what a verification claims to have checked, so
// it is exactly the kind of edit that should leave a record of who did it and how to undo it. Deleting the
// row would destroy the flow's history and its issue links; `enabled=false` keeps both and is what the run
// route already filters on, so a disabled flow is simply not selected.
//
// THE CASE THIS WAS BUILT FOR. demo@vraelis.com/Notewell runs five flows, four of which sign in. The app
// behind it rate-limits repeated sign-ins: measured across six runs, the third and fourth sign-in in a run
// are the ones that fail, they hang for 22-23s before being rejected (a pass takes 2-6s), and they come back
// as auth_rejected_by_app. That is the deployment's rate limiter, not a defect in the notes app, but the
// verdict a reviewer sees says BLOCKED either way. Fewer sign-ins per run is the difference between a demo
// that proves something and a demo that looks broken for a reason nobody can see.
import { loadLocalEnv } from "../worker/preflight/local-env";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../lib/supabase-admin";

loadLocalEnv();

const ARG = (f: string): string | null => {
  const i = process.argv.indexOf(f);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
};
const APPLY = process.argv.includes("--apply");
const OWNER = ARG("--owner");
const CONTRACT = ARG("--contract");
const NAMES = (ARG("--flows") ?? "").split("|").map((s) => s.trim()).filter(Boolean);
const ENABLE = ARG("--set") === "on";

async function main() {
  if (!OWNER || !CONTRACT || !NAMES.length || !["on", "off"].includes(ARG("--set") ?? "")) {
    console.log(`
  npx tsx scripts/preflight-flow-toggle.ts --owner EMAIL --contract UUID --set on|off --flows "NAME|NAME" [--apply]

    Enables or disables flows BY NAME on one contract. Dry run unless --apply.
    Names are pipe-separated and matched exactly.
`);
    process.exitCode = 2; return;
  }
  if (!isDatabaseConfigured()) {
    console.error("No database configured. Run: vercel env pull .env.local --environment=production");
    process.exitCode = 2; return;
  }
  const s = getSupabaseAdminClient();
  const owner = OWNER.trim().toLowerCase();

  const q = await s.from("v_test_flows" as never)
    .select("id, name, enabled, priority, review_state")
    .eq("contract_id", CONTRACT).eq("user_id", owner).order("order_index");
  if (q.error) { console.error(`read failed: ${q.error.message}`); process.exitCode = 1; return; }
  const flows = (q.data as { id: string; name: string; enabled: boolean; priority: string; review_state: string }[]) ?? [];
  if (!flows.length) { console.error(`no flows on contract ${CONTRACT} for ${owner}`); process.exitCode = 1; return; }

  const targets = flows.filter((f) => NAMES.includes(f.name));
  const missing = NAMES.filter((n) => !flows.some((f) => f.name === n));
  for (const m of missing) console.error(`  NOT FOUND on this contract: "${m}"`);
  if (missing.length) { process.exitCode = 1; return; }        // never half-apply a selection

  console.log(`\ncontract ${CONTRACT}`);
  for (const f of flows) {
    const hit = targets.some((t) => t.id === f.id);
    const after = hit ? ENABLE : f.enabled;
    console.log(`  ${after ? "ON " : "off"}  [${f.priority.padEnd(11)}] ${f.name}${hit && after !== f.enabled ? `   <-- ${f.enabled ? "DISABLING" : "ENABLING"}` : ""}`);
  }
  const enabledAfter = flows.filter((f) => (targets.some((t) => t.id === f.id) ? ENABLE : f.enabled)).length;
  const critAfter = flows.filter((f) => (targets.some((t) => t.id === f.id) ? ENABLE : f.enabled) && f.priority === "critical").length;
  console.log(`\n  ${enabledAfter} flow(s) would be selectable, ${critAfter} of them critical`);
  if (!critAfter) console.log(`  WARNING: no critical flow left enabled — a verification would have nothing critical to decide on.`);

  if (!APPLY) { console.log(`\nDRY RUN. Re-run with --apply.`); return; }

  let n = 0;
  for (const t of targets) {
    const u = await s.from("v_test_flows" as never)
      .update({ enabled: ENABLE } as never).eq("id", t.id).eq("user_id", owner);
    if (u.error) { console.error(`  failed ${t.name}: ${u.error.message}`); continue; }
    n++;
  }
  console.log(`\nupdated ${n} of ${targets.length} flow(s)`);
  console.log(`reverse it with:\n  npx tsx scripts/preflight-flow-toggle.ts --owner ${OWNER} --contract ${CONTRACT} --set ${ENABLE ? "off" : "on"} --flows "${NAMES.join("|")}" --apply`);
  process.exitCode = n === targets.length ? 0 : 1;
}

void main();
