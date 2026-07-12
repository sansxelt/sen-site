// Operator repair tool for the linked-rerun target bug: finds completed runs whose EXECUTED first
// navigation conflicts with the run's own snapshot target (e.g. the run said mode=fixed but the browser
// opened mode=broken) and marks them INVALID as infrastructure failures. Dry-run by default; --apply writes.
//
// What --apply does per affected run (audit history preserved, nothing deleted):
//   - v_preflight_runs: state 'failed', decision null, failure_code 'target_mismatch' (an invalid run can
//     never be, or remain, an application's launch decision; pickHealthRun already skips it)
//   - v_issues resolved by the run: reopened (status 'open', resolved_run null) — a wrongful verification
//     must not stand
//   - v_issues first seen in the run: status 'invalidated' — findings born from an invalid execution are
//     not real product findings (rows kept for audit; they leave the open/resolved views)
//   - billing: the held/charged reservation is refunded (a Vraelis harness failure is never billable);
//     refund() is idempotent per reservation, and credits_held = 0 runs no-op
//
// Run (dry-run):  PREFLIGHT_SEED_RUN=1 npm run preflight:invalidate -- --owner=you@example.com
// Apply:          PREFLIGHT_SEED_RUN=1 npm run preflight:invalidate -- --owner=you@example.com --apply
// Limit to runs:  ... --runs=<id1>,<id2>
import { loadLocalEnv } from "../worker/preflight/local-env";
import { getSupabaseAdminClient, isDatabaseConfigured } from "../lib/supabase-admin";
import { executedTargetMismatch } from "../lib/preflight/target-url";
import { refund } from "../lib/v-credits";

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
  // Same pre-.env-load production stance as the other drivers: a local shell is never production because
  // .env.local carries VERCEL_ENV; a genuine prod runtime still requires the explicit override.
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
    .select("id, deployment_url, state, decision, credits_held, cost_reservation_id, created_at")
    .eq("user_id", owner).eq("state", "completed").order("created_at", { ascending: false }).limit(200);
  if (only.length) q = q.in("id", only);
  const { data: runs, error } = await q;
  if (error) { console.error("Query failed:", error.message); process.exit(1); }

  type Affected = { id: string; target: string; executed: string; creditsHeld: number; reservation: string | null; decision: string | null };
  const affected: Affected[] = [];
  for (const r of (runs as Record<string, unknown>[]) ?? []) {
    const target = (r.deployment_url as string) || "";
    if (!target) continue;
    // The executed first navigation lives in the run's first flow_run's first navigate step: `target` holds
    // the URL the browser was actually told to open (pre-fix: the stale stored URL, which is the bug).
    const { data: frs } = await s.from("v_flow_runs").select("id").eq("preflight_run_id", r.id as string).order("created_at", { ascending: true }).limit(1);
    const firstFlow = (frs as { id: string }[] | null)?.[0];
    if (!firstFlow) continue;
    const { data: steps } = await s.from("v_run_steps").select("action, target").eq("flow_run_id", firstFlow.id).order("idx", { ascending: true }).limit(5);
    const nav = ((steps as { action: string; target: string | null }[]) ?? []).find((st) => st.action === "navigate");
    if (!nav?.target) continue;
    if (executedTargetMismatch(target, nav.target)) {
      affected.push({
        id: String(r.id), target, executed: nav.target,
        creditsHeld: Number(r.credits_held) || 0, reservation: (r.cost_reservation_id as string) ?? null,
        decision: (r.decision as string) ?? null,
      });
    }
  }

  console.log(`\n${APPLY ? "APPLY" : "DRY RUN"}: ${affected.length} completed run(s) executed a URL that conflicts with their snapshot target.\n`);
  for (const a of affected) {
    console.log(`  run ${a.id}`);
    console.log(`    target:   ${a.target}`);
    console.log(`    executed: ${a.executed}`);
    console.log(`    decision: ${a.decision ?? "(none)"}   credits held: ${a.creditsHeld}`);
  }
  if (!affected.length || !APPLY) {
    if (!APPLY && affected.length) console.log("\nRe-run with --apply to invalidate these runs (marks failed/target_mismatch, reopens wrongly-resolved issues, invalidates issues born here, refunds any held credits).");
    process.exit(0);
  }

  for (const a of affected) {
    await s.from("v_preflight_runs").update({
      state: "failed", decision: null, failure_code: "target_mismatch",
      failure_message: "Invalidated by operator repair: the executed navigation did not honor the run's snapshot target (Vraelis harness bug, not an application result).",
    } as never).eq("user_id", owner).eq("id", a.id);

    const { data: reopened } = await s.from("v_issues").update({ status: "open", resolved_run: null } as never)
      .eq("user_id", owner).eq("resolved_run", a.id).select("id");
    const { data: invalidated } = await s.from("v_issues").update({ status: "invalidated" } as never)
      .eq("user_id", owner).eq("first_seen_run", a.id).select("id");

    let refunded = 0;
    if (a.creditsHeld > 0) {
      try { await refund(owner, a.reservation || a.id, a.creditsHeld); refunded = a.creditsHeld; }
      catch (e) { console.warn(`  refund failed for ${a.id}: ${(e as Error).message}`); }
    }
    console.log(`  applied ${a.id}: invalidated; issues reopened ${(reopened ?? []).length}, issues invalidated ${(invalidated ?? []).length}, credits refunded ${refunded}`);
  }
  console.log("\nDone. Application health now falls back to the newest VALID completed pass (pickHealthRun).");
  process.exit(0);
}

main().catch((e) => { console.error(`invalidate-runs crashed: ${(e as Error).message}`); process.exit(1); });
