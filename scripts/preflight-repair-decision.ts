// Operator repair tool for the launch-decision coverage bug: finds COMPLETED runs that were finalized as
// READY even though their stored flow selection did NOT cover every enabled+approved CRITICAL flow of
// their contract (a targeted rerun can verify its repair, never certify readiness), and rewrites ONLY the
// decision to 'repair_verified'. Dry-run by default; --apply writes.
//
// What --apply does per affected run — and, just as important, what it NEVER touches:
//   - v_preflight_runs: decision 'ready' -> 'repair_verified'; summary gains coverage:'partial' plus a
//     decision_repaired_from audit marker. State stays 'completed'.
//   - PRESERVED UNTOUCHED: flow runs, steps, evidence artifacts, screenshots, the passed results, every
//     issue row and its resolution (a verified repair stays verified), and billing (the run executed its
//     selected flow; the charge stands). Nothing is deleted; nothing is re-reconciled.
//   - A run with FULL critical coverage is never touched, even if passed via --runs (protects legitimate
//     READY runs like the 3/3 final verification).
//
// Dry run:  PREFLIGHT_SEED_RUN=1 npm run preflight:repair-decision -- --owner=you@example.com --runs=<id>
// Apply:    ... --apply
import { loadLocalEnv } from "../worker/preflight/local-env";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../lib/supabase-admin";

const RUNTIME = { NODE_ENV: process.env.NODE_ENV, VERCEL_ENV: process.env.VERCEL_ENV, VERCEL: process.env.VERCEL };
loadLocalEnv();

function arg(name: string): string | undefined {
  const pre = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pre));
  return hit ? hit.slice(pre.length) : undefined;
}
const APPLY = process.argv.includes("--apply");

async function main(): Promise<void> {
  if (process.env.PREFLIGHT_SEED_RUN !== "1") {
    console.error("Refusing to run: set PREFLIGHT_SEED_RUN=1 (internal operator tool)."); process.exit(2);
  }
  // Same pre-.env-load production stance as the other drivers.
  const prod = RUNTIME.NODE_ENV === "production" || RUNTIME.VERCEL_ENV === "production"
    || (RUNTIME.VERCEL === "1" && RUNTIME.VERCEL_ENV !== "development" && RUNTIME.VERCEL_ENV !== "preview");
  if (prod && process.env.PREFLIGHT_SEED_ALLOW_PROD !== "1") {
    console.error("Refusing: the process runtime looks like production (set PREFLIGHT_SEED_ALLOW_PROD=1 only deliberately)."); process.exit(2);
  }
  const owner = (arg("owner") || process.env.PREFLIGHT_SEED_OWNER || "").trim().toLowerCase();
  if (!owner.includes("@")) { console.error("An owner email is required: --owner=you@example.com"); process.exit(2); }
  if (!isDatabaseConfigured()) { console.error("Database not configured."); process.exit(2); }
  const only = (arg("runs") || "").split(",").map((s) => s.trim()).filter(Boolean);

  const s = getSupabaseAdminClient();
  let q = s.from("v_preflight_runs")
    .select("id, contract_id, flow_ids, state, decision, summary, created_at")
    .eq("user_id", owner).eq("state", "completed").eq("decision", "ready")
    .order("created_at", { ascending: false }).limit(200);
  if (only.length) q = q.in("id", only);
  const { data: runs, error } = await q;
  if (error) { console.error("Query failed:", error.message); process.exit(1); }

  type Affected = { id: string; selected: number; criticalTotal: number; missing: string[]; summary: Record<string, unknown> };
  const affected: Affected[] = [];
  let protectedFull = 0;
  for (const r of (runs as Record<string, unknown>[]) ?? []) {
    const flowIds = Array.isArray(r.flow_ids) ? (r.flow_ids as unknown[]).map(String) : null;
    if (!flowIds || !r.contract_id) continue; // pre-selection-era run: it executed its whole contract (full)
    const { data: crit } = await s.from("v_test_flows")
      .select("id, name").eq("contract_id", String(r.contract_id)).eq("user_id", owner)
      .eq("enabled", true).eq("review_state", "approved").eq("priority", "critical");
    const critical = ((crit as { id: string; name: string }[] | null) ?? []);
    const selected = new Set(flowIds);
    const missing = critical.filter((f) => !selected.has(f.id)).map((f) => f.name || f.id);
    if (!missing.length) { protectedFull++; continue; } // full coverage: a legitimate READY, never touched
    affected.push({
      id: String(r.id), selected: flowIds.length, criticalTotal: critical.length, missing,
      summary: (r.summary as Record<string, unknown>) ?? {},
    });
  }

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"}: ${affected.length} completed READY run(s) had PARTIAL critical coverage (targeted reruns wrongly certified). ${protectedFull} full-coverage READY run(s) verified and left untouched.\n`);
  for (const a of affected) {
    console.log(`  run ${a.id}`);
    console.log(`    selected flows:   ${a.selected}   critical flows in contract: ${a.criticalTotal}`);
    console.log(`    critical flows NOT run: ${a.missing.join(", ")}`);
    console.log("    repair: decision ready -> repair_verified. Preserved: state completed, flow results, evidence, screenshots, issue resolutions, billing.");
  }
  if (!affected.length || !APPLY) {
    if (!APPLY && affected.length) console.log("\nRe-run with --apply to rewrite ONLY the decision (everything else preserved).");
    process.exit(0);
  }

  for (const a of affected) {
    const { error: upErr } = await s.from("v_preflight_runs").update({
      decision: "repair_verified",
      summary: { ...a.summary, coverage: "partial", decision_repaired_from: "ready" },
    } as never).eq("user_id", owner).eq("id", a.id).eq("state", "completed").eq("decision", "ready");
    if (upErr) { console.error(`  FAILED ${a.id}: ${upErr.message}`); continue; }
    console.log(`  applied ${a.id}: decision ready -> repair_verified (run, evidence, issue history, billing untouched)`);
  }
  console.log("\nDone. Application health selection (pickHealthRun) now ignores these targeted runs; the newest valid full-coverage pass decides launch health.");
  process.exit(0);
}

main().catch((e) => { console.error(`repair-decision crashed: ${(e as Error).message}`); process.exit(1); });
