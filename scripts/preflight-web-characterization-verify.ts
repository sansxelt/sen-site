// Web characterization test (Multi-Platform Program) — proves the new neutral decision rule is a FAITHFUL
// generalization of the proven web decideRun, so the web decision path is not perturbed by the expansion.
//
// The strongest, most direct characterization: run the SAME input matrix through the live web decideRun
// (worker/preflight/execute-run.ts) and the new neutral decideRuntime (lib/preflight/runtime/decide.ts) and
// assert they produce the IDENTICAL decision on every case. If they agree across the matrix, the neutral
// rule mirrors web exactly — and the eventual web adapter (which will WRAP the untouched worker) is safe.
//
// This does NOT modify the worker; it only reads its exported pure function. Pure, no DB, no network.

import { decideRun } from "../worker/preflight/execute-run";
import type { FlowResult as WebFlowResult, FlowSpec } from "../worker/preflight/types";
import { decideRuntime } from "../lib/preflight/runtime/decide";
import type { FlowResult as CoreFlowResult, FlowState as CoreFlowState } from "../lib/preflight/runtime/core";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") { if (cond) { pass++; console.log(`PASS  ${name}`); } else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); } }

// The web FlowResult.state union: passed | failed | blocked | skipped | blocked_by_policy | auth_config_failed.
// The neutral FlowState union uses auth_not_ready in place of auth_config_failed (same meaning: a
// role-requiring flow that couldn't authenticate for a worker/config reason). Map web -> neutral for the
// comparison so both rules see the same semantics.
const WEB_TO_CORE: Record<string, CoreFlowState> = {
  passed: "passed", failed: "failed", blocked: "blocked", skipped: "skipped",
  blocked_by_policy: "blocked_by_policy", auth_config_failed: "auth_not_ready",
};

type Case = { name: string; states: { crit: boolean; state: string }[]; fullCoverage: boolean };

// Cover the whole decision matrix decideRun exercises.
const CASES: Case[] = [
  { name: "all critical pass, full coverage", states: [{ crit: true, state: "passed" }, { crit: true, state: "passed" }], fullCoverage: true },
  { name: "one critical failed", states: [{ crit: true, state: "passed" }, { crit: true, state: "failed" }], fullCoverage: true },
  { name: "one critical blocked", states: [{ crit: true, state: "blocked" }], fullCoverage: true },
  { name: "non-critical failed only", states: [{ crit: true, state: "passed" }, { crit: false, state: "failed" }], fullCoverage: true },
  { name: "critical policy-blocked -> needs_review", states: [{ crit: true, state: "blocked_by_policy" }], fullCoverage: true },
  { name: "critical auth-config-failed -> needs_review", states: [{ crit: true, state: "auth_config_failed" }], fullCoverage: true },
  { name: "all pass but PARTIAL coverage -> repair_verified", states: [{ crit: true, state: "passed" }], fullCoverage: false },
  { name: "mixed pass + skipped, full coverage -> ready", states: [{ crit: true, state: "passed" }, { crit: false, state: "skipped" }], fullCoverage: true },
];

function webResult(i: number, s: { crit: boolean; state: string }): WebFlowResult {
  return { flowId: `f${i}`, name: `f${i}`, state: s.state as WebFlowResult["state"], steps: [], severity: undefined } as WebFlowResult;
}
function webSpec(i: number, s: { crit: boolean; state: string }): FlowSpec {
  return { flowId: `f${i}`, name: `f${i}`, priority: s.crit ? "critical" : "informational", steps: [], maxMs: 120000, destructiveAllowed: false };
}
function coreResult(i: number, s: { crit: boolean; state: string }): CoreFlowResult {
  return { flowId: `f${i}`, state: WEB_TO_CORE[s.state], steps: [] };
}

console.log("── web decideRun vs neutral decideRuntime: identical decisions across the matrix ──");
for (const c of CASES) {
  // NB: helper signature is (index, state); map yields (element, index) — call explicitly to avoid arg-swap.
  const web = decideRun(c.states.map((s, i) => webResult(i, s)), c.states.map((s, i) => webSpec(i, s)), c.fullCoverage);
  const critIds = new Set(c.states.map((s, i) => (s.crit ? `f${i}` : "")).filter(Boolean));
  const core = decideRuntime({ results: c.states.map((s, i) => coreResult(i, s)), criticalFlowIds: critIds, fullCoverage: c.fullCoverage });
  ok(`"${c.name}" -> both decide "${web.decision}"`, web.decision === core.decision, `web=${web.decision} core=${core.decision}`);
  // Coverage summary must also agree on the critical counts + coverage label.
  ok(`"${c.name}" -> same critical_total/critical_passed/coverage`,
    web.summary.critical_total === core.summary.critical_total
      && web.summary.critical_passed === core.summary.critical_passed
      && web.summary.coverage === core.summary.coverage,
    `web=${JSON.stringify({ ct: web.summary.critical_total, cp: web.summary.critical_passed, cov: web.summary.coverage })} core=${JSON.stringify({ ct: core.summary.critical_total, cp: core.summary.critical_passed, cov: core.summary.coverage })}`);
}

console.log("\n── the web decision RULE itself is unchanged (source characterization) ──");
import { readFileSync } from "node:fs";
const exec = readFileSync("worker/preflight/execute-run.ts", "utf8");
ok("web decideRun still uses the exact critical-fail -> blocked / coverage-gate -> ready rule",
  /criticalFailed \? "blocked"/.test(exec) && /decision === "ready" && !fullCoverage\) decision = "repair_verified"/.test(exec));

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
