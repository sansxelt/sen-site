// Unit tests for the Application Command Center resolver (lib/preflight/command-center.ts). The whole
// premise is: exactly ONE dominant next action per state, derived from real state, and a ribbon of
// only-true facts. These lock the priority ladder and the ribbon's omit-when-false behavior.

import { nextAction, stateRibbon, type CommandState } from "../lib/preflight/command-center";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); }
}

// A baseline healthy-but-fresh state; each test overrides only what it exercises.
function base(over: Partial<CommandState> = {}): CommandState {
  return {
    appId: "app1", contractExists: true, contractApproved: true, requirementCount: 3, flowCount: 2,
    eligibleFlowCount: 2, criticalEligibleCount: 1, decision: null, runActive: false, latestRunId: null,
    blockerCount: 0, repairPendingFullVerify: false, newerUnverifiedDeploy: false, criticalTotal: 0,
    criticalPassed: 0, coverageFull: true, deploymentLabel: "demo.app", contractVersion: 1, ...over,
  };
}

console.log("── nextAction: the priority ladder (exactly one action wins) ──");

ok("empty contract + no flows -> Author your Production Contract",
  nextAction(base({ contractApproved: false, requirementCount: 0, flowCount: 0, eligibleFlowCount: 0 })).label === "Author your Production Contract");

ok("draft contract WITH requirements -> Review Production Contract",
  nextAction(base({ contractApproved: false, requirementCount: 3, flowCount: 0, eligibleFlowCount: 0 })).label === "Review Production Contract");

ok("approved contract but no eligible flows -> Add flows",
  nextAction(base({ eligibleFlowCount: 0 })).label === "Add flows to your contract");

ok("a run is active -> View running verification",
  nextAction(base({ runActive: true, latestRunId: "run9" })).label === "View running verification");

ok("blocked -> Inspect failure (with the run behind it)",
  (() => { const a = nextAction(base({ decision: "blocked", latestRunId: "run9", blockerCount: 2 })); return a.label === "Inspect failure" && a.href.endsWith("/passes/run9"); })());

ok("repair verified, full verification owed -> Run full critical verification (LAUNCHES critical)",
  (() => { const a = nextAction(base({ repairPendingFullVerify: true, criticalEligibleCount: 1 })); return a.label === "Run full critical verification" && a.launch?.flowIds === "critical"; })());

ok("newer unverified deployment -> Verify this deployment (LAUNCHES eligible)",
  (() => { const a = nextAction(base({ decision: "ready", newerUnverifiedDeploy: true })); return a.label === "Verify this deployment" && a.launch?.flowIds === "eligible"; })());

ok("needs review -> Review the report (NAVIGATE, no launch)",
  (() => { const a = nextAction(base({ decision: "needs_review", latestRunId: "run9" })); return a.label === "Review the report" && !a.launch; })());

ok("ready, nothing pending -> quiet 'Re-verify' (LAUNCHES eligible)",
  (() => { const a = nextAction(base({ decision: "ready" })); return a.label === "Re-verify" && a.tone === "quiet" && a.launch?.flowIds === "eligible"; })());

ok("approved + flows + no prior decision -> Verify this deployment (LAUNCHES, primary)",
  (() => { const a = nextAction(base({ decision: null })); return a.label === "Verify this deployment" && a.tone === "primary" && a.launch?.flowIds === "eligible"; })());

// The critical fix (stranded launch): every launch action carries a launch descriptor so the UI renders a
// real launch control, and every NAVIGATE action does NOT (it links somewhere that performs it).
ok("author/review/inspect/view actions are NAVIGATE (no launch descriptor)",
  !nextAction(base({ contractApproved: false, requirementCount: 0, flowCount: 0, eligibleFlowCount: 0 })).launch &&
  !nextAction(base({ contractApproved: false })).launch &&
  !nextAction(base({ decision: "blocked", latestRunId: "r", blockerCount: 1 })).launch &&
  !nextAction(base({ runActive: true, latestRunId: "r" })).launch);

console.log("\n── priority: an EARLIER gap always wins over a later one ──");
ok("blocked outranks newer-deploy (inspect the failure first)",
  nextAction(base({ decision: "blocked", latestRunId: "r", newerUnverifiedDeploy: true, blockerCount: 1 })).label === "Inspect failure");
ok("active run outranks blocked (watch the running verification)",
  nextAction(base({ runActive: true, latestRunId: "r", decision: "blocked" })).label === "View running verification");
ok("empty contract outranks everything (earliest funnel gap)",
  nextAction(base({ contractApproved: false, requirementCount: 0, flowCount: 0, eligibleFlowCount: 0, decision: "blocked", newerUnverifiedDeploy: true })).label === "Author your Production Contract");

console.log("\n── stateRibbon: only-true facts, absent ones omitted ──");
ok("a healthy verified app shows a SHORT ribbon (deploy + flows-passed [+ coverage/contract])",
  (() => { const r = stateRibbon(base({ decision: "ready", criticalTotal: 3, criticalPassed: 3 })); return r.some((f) => f.key === "verif" && f.text === "contract flows passed") && !r.some((f) => f.key === "block"); })());

ok("blockers render only when > 0",
  (() => { const r = stateRibbon(base({ decision: "blocked", blockerCount: 2 })); return r.some((f) => f.key === "block" && f.text === "2 failures" && f.tone === "bad"); })());
ok("zero blockers -> no blocker fact",
  !stateRibbon(base({ blockerCount: 0 })).some((f) => f.key === "block"));

ok("newer-deploy shows 'newer deploy unverified' (warn), not 'verified'",
  (() => { const r = stateRibbon(base({ decision: "ready", newerUnverifiedDeploy: true })); return r.some((f) => f.key === "verif" && f.text === "newer deploy unverified" && f.tone === "warn"); })());

ok("coverage fact only for a FULL-coverage pass; good tone when full",
  (() => { const r = stateRibbon(base({ criticalTotal: 3, criticalPassed: 3, coverageFull: true })); return r.some((f) => f.key === "cov" && f.text === "3/3 critical" && f.tone === "good"); })());
ok("no coverage fact when no critical flows ran",
  !stateRibbon(base({ criticalTotal: 0 })).some((f) => f.key === "cov"));
// Finding 3 fix: a PARTIAL (targeted-repair) run's subset must never be shown as coverage.
ok("no coverage fact when the run was NOT full coverage (partial repair run)",
  !stateRibbon(base({ criticalTotal: 3, criticalPassed: 3, coverageFull: false })).some((f) => f.key === "cov"));

ok("a not-tested app reads 'not tested', no coverage/blocker noise",
  (() => { const r = stateRibbon(base({ decision: null, criticalTotal: 0, blockerCount: 0 })); return r.some((f) => f.text === "not tested") && !r.some((f) => f.key === "cov" || f.key === "block"); })());

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
