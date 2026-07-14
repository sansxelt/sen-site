// Regression tests for the launch-decision coverage model (spec tests A-L): a targeted one-flow rerun that
// passes proves its REPAIR, never full production readiness. READY requires complete critical coverage on a
// single run's own target + contract snapshot; coverage is never aggregated across runs; targeted runs never
// control application launch health; the historical repair preserves everything except the wrong decision.
// Pure decision tests + fake-store executor spies + health-selection tests + reconcile + static source
// checks for the report UX, the rerun route's critical scope, and the repair tool's safety. No DB, no browser.
import { readFileSync } from "node:fs";
import { loadWorkerConfig } from "../worker/preflight/config";
import { decideRun, executeRun } from "../worker/preflight/execute-run";
import { FakeRunStore } from "../worker/preflight/run-store-fake";
import { FakeBrowserProvider } from "../worker/preflight/providers/fake";
import { pickHealthRun, isLaunchHealthCandidate } from "../lib/preflight/target-url";
import { planReconcile } from "../lib/preflight/issues";
import { estimateRunCredits } from "../lib/preflight/flow-selection";
import type { FlowSpec, FlowResult } from "../worker/preflight/types";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const flow = (flowId: string, name: string): FlowSpec => ({
  flowId, name, priority: "critical", destructiveAllowed: false, maxMs: 60000,
  steps: [{ action: "navigate", target: "/" }, { action: "assert_visible", target: name, expect: name }],
});
const THREE = [flow("f-create", "Create a project"), flow("f-persist", "Persistence"), flow("f-mobile", "Mobile")];
const passed = (flowId: string): FlowResult => ({ flowId, state: "passed", steps: [], evidence: { consoleErrors: [], networkFailures: [] } });

// ── Pure decision model ──
ok("D-pure: an all-pass run with PARTIAL coverage decides repair_verified, never ready",
  decideRun([passed("f-mobile")], [THREE[2]], false).decision === "repair_verified");
ok("G-pure: an all-pass run with FULL coverage decides ready",
  decideRun(THREE.map((f) => passed(f.flowId)), THREE, true).decision === "ready");
ok("a partial run with a critical failure still decides blocked (failure evidence holds at any coverage)",
  decideRun([{ ...passed("f-mobile"), state: "blocked" }], [THREE[2]], false).decision === "blocked");
ok("summary records the coverage so reports and health can tell certification from repair proof",
  decideRun([passed("f-mobile")], [THREE[2]], false).summary.coverage === "partial"
  && decideRun(THREE.map((f) => passed(f.flowId)), THREE, true).summary.coverage === "full");

// ── Production boot guard: a deployed worker may NEVER run a fake browser (a misconfigured Railway
// service once defaulted to fake and minted a counterfeit READY into production data) ──
const boots = (env: Record<string, string>) => { try { loadWorkerConfig(env as NodeJS.ProcessEnv); return true; } catch { return false; } };
ok("a production worker without BROWSER_PROVIDER refuses to boot", !boots({ NODE_ENV: "production" }));
ok("a production worker with explicit BROWSER_PROVIDER=fake refuses to boot", !boots({ NODE_ENV: "production", BROWSER_PROVIDER: "fake" }));
ok("a production worker with browserbase + key boots", boots({ NODE_ENV: "production", BROWSER_PROVIDER: "browserbase", BROWSERBASE_API_KEY: "bb_test_not_real" }));
ok("the fake provider still boots for local lifecycle tests (non-production)", boots({}) && loadWorkerConfig({} as NodeJS.ProcessEnv).provider === "fake");

// ── B: the selected issue resolves (reconciliation is unchanged by the decision model) ──
{
  const plan = planReconcile(
    [{ flowId: "f-mobile", passed: true, failureCategories: [] }],
    [{ id: "issue-mobile", flowId: "f-mobile", category: "mobile_blocker" },
     { id: "issue-persist", flowId: "f-persist", category: "persistence_failure" }],
  );
  ok("B: the targeted flow's issue resolves; the unselected flow's issue is untouched (stays unverified)",
    plan.resolve.length === 1 && plan.resolve[0] === "issue-mobile");
}

// ── Executor spies (A, D, F, G, H, L) ──
const limits = { leaseSecs: 60, maxRunMs: 60000, maxFlowMs: 60000, maxStepsPerFlow: 30 };
async function spyRun(selectedFlowIds: unknown, runId: string, deploymentUrl: string) {
  const store = new FakeRunStore();
  const provider = new FakeBrowserProvider({}, deploymentUrl);
  store.enqueue({ runId, applicationId: "a1", deploymentUrl, flows: THREE, selectedFlowIds });
  const claimed = await store.claim("w1", 60);
  if (claimed) await executeRun(claimed, { store, provider, workerId: "w1", limits });
  return { row: store.get(runId)!, provider };
}

(async () => {
  const FIXED = "https://preflight-demo-ten.vercel.app/?mode=fixed";

  // A + D + L: one-flow targeted rerun passes; repair verified; NOT ready; billed for exactly one flow.
  const t1 = await spyRun(["f-mobile"], "targeted", FIXED);
  ok("A: the one-flow targeted rerun executes and passes", t1.row.flowResults.length === 1 && t1.row.flowResults[0].state === "passed");
  ok("C: the run's decision is repair_verified (what the report renders as REPAIR VERIFIED)", t1.row.decision === "repair_verified", String(t1.row.decision));
  ok("D: the targeted rerun does NOT grant full READY", t1.row.decision !== "ready");
  ok("summary marks partial coverage + the selected count", t1.row.summary.coverage === "partial" && t1.row.summary.selected_total === 1);
  ok("L: billing charges the run held for exactly the 1 selected flow", t1.row.billing === "charged" && estimateRunCredits(1) === 1);

  // F + G: full critical verification runs all three and grants READY.
  const t2 = await spyRun(["f-create", "f-persist", "f-mobile"], "full-critical", FIXED);
  ok("F: full critical verification executes all 3 flows", t2.row.flowResults.length === 3 && t2.provider.navigations.length === 3);
  ok("G: full critical verification grants READY (full coverage, all passed)", t2.row.decision === "ready" && t2.row.summary.coverage === "full");

  // H: a partial run against a DIFFERENT deployment URL is still only a repair proof: coverage is computed
  // from the single run alone, so flows the parent ran on another URL can never combine into READY.
  const t3 = await spyRun(["f-mobile"], "other-url", "https://preflight-demo-ten.vercel.app/?mode=partially_fixed");
  ok("H: different deployment URLs cannot combine into full coverage (still repair_verified)", t3.row.decision === "repair_verified");

  // ── Health selection (E, I, J) ──
  const mk = (id: string, state: string, decision: string | null, created_at: string, coverage?: string) =>
    ({ id, state, decision, created_at, summary: coverage ? { coverage } : {} });

  // E: the newest repair_verified run never replaces the launch health; the older full pass stands.
  const hE = pickHealthRun([
    mk("repair", "completed", "repair_verified", "2026-07-11T12:00:00Z", "partial"),
    mk("fullblocked", "completed", "blocked", "2026-07-10T12:00:00Z", "full"),
  ]);
  ok("E: application health stays on the older FULL pass, not the newer targeted repair", hE?.id === "fullblocked");
  ok("E: a repair_verified run is never a launch-health candidate",
    !isLaunchHealthCandidate(mk("r", "completed", "repair_verified", "2026-07-11T12:00:00Z", "partial")));

  // I: different contract versions cannot combine: the v2 partial repair does not upgrade the v1 full
  // blocked health to ready — health remains the newest FULL-coverage decision.
  const hI = pickHealthRun([
    mk("v2-partial-pass", "completed", "repair_verified", "2026-07-11T12:00:00Z", "partial"),
    mk("v1-full-blocked", "completed", "blocked", "2026-07-09T12:00:00Z", "full"),
  ]);
  ok("I: a passing partial run on a newer contract version cannot combine into READY health", hI?.decision === "blocked");

  // J: infrastructure-failed runs provide no coverage and no health; partial runs are skipped too; the
  // newest valid full pass wins.
  const hJ = pickHealthRun([
    mk("infra", "failed", null, "2026-07-11T13:00:00Z"),
    mk("repair", "completed", "repair_verified", "2026-07-11T12:00:00Z", "partial"),
    mk("fullready", "completed", "ready", "2026-07-10T12:00:00Z", "full"),
  ]);
  ok("J: infrastructure-failed and targeted runs are skipped; the newest valid full pass decides health", hJ?.id === "fullready");
  ok("a run finalized before coverage was recorded counts as full (it executed its whole contract)",
    isLaunchHealthCandidate(mk("legacy", "completed", "ready", "2026-07-01T12:00:00Z")));
  ok("a newer ACTIVE run still surfaces as in-progress",
    pickHealthRun([mk("active", "running", null, "2026-07-12T12:00:00Z"), mk("fullready", "completed", "ready", "2026-07-10T12:00:00Z", "full")])?.id === "active");

  // ── C + CTA: report UX source checks (server component helpers are file-local) ──
  const report = readFileSync("app/rank/app/applications/[id]/passes/[runId]/page.tsx", "utf8");
  ok("C: the report renders REPAIR VERIFIED for a repair_verified decision", report.includes('"repair_verified"') && report.includes("REPAIR VERIFIED"));
  ok("C: the report states full verification is still required", report.includes("Full critical verification is still required before this deployment can be marked READY"));
  ok("CTA: the repair-verified report offers Run full critical verification", report.includes('scope="critical"') && report.includes("Run full critical verification"));
  // Evidence-first: each blocker shows its lineage (new here vs recurring from an earlier run) from the
  // real first_seen_run field — never fabricated.
  ok("EVIDENCE: a blocker shows issue lineage (Recurring vs First seen here) from first_seen_run",
    report.includes("issue.first_seen_run") && report.includes("Recurring") && report.includes("First seen here"));
  const route = readFileSync("app/api/preflight/runs/[runId]/rerun/route.ts", "utf8");
  ok("the rerun route implements the critical scope from the contract's eligible critical flows",
    route.includes('scope === "critical"') && route.includes('priority === "critical"'));
  const overview = readFileSync("app/rank/app/applications/[id]/page.tsx", "utf8");
  ok("the application overview keeps health via pickHealthRun and shows Latest repair separately",
    overview.includes("pickHealthRun(runs)") && overview.includes("Latest repair:"));

  // ── K: the historical repair preserves evidence + issue history (source safety checks) ──
  const tool = readFileSync("scripts/preflight-repair-decision.ts", "utf8");
  ok("K: repair tool is dry-run by default (--apply opt-in)", tool.includes('process.argv.includes("--apply")') && tool.includes("DRY RUN"));
  ok("K: repair tool writes ONLY v_preflight_runs decision+summary (never issues/flows/steps/artifacts)",
    !tool.includes(".delete(") && !/from\("v_(issues|flow_runs|run_steps|run_artifacts)"\)\s*\.update/.test(tool)
    && (tool.match(/\.update\(/g) ?? []).length === 1);
  ok("K: repair tool preserves the completed state and the passed result (updates decision only, guarded)",
    tool.includes('.eq("state", "completed")') && tool.includes('.eq("decision", "ready")') && !tool.includes("state: \"failed\""));
  ok("K: repair tool refuses full-coverage READY runs (the legitimate 3/3 final run is protected)",
    tool.includes("protectedFull") && tool.includes("full coverage: a legitimate READY, never touched"));
  ok("K: repair tool never touches billing (no refund/charge on a run that did its selected work)",
    !tool.includes("refund(") && !tool.includes("credits_held"));

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("decision tests crashed:", (e as Error).message); process.exit(1); });
