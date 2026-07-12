// Regression tests for the two targeted-rerun correctness bugs:
//
//   ISSUE 1 — the run snapshot's SELECTED flow set is authoritative. scope=failed executes exactly the
//   selected failed flows (never every approved contract flow); a missing/invalid selection fails as an
//   internal configuration error BEFORE any browser session (never billable, nothing to reconcile).
//
//   ISSUE 2 — rerun deduplication: an invalidated / cancelled / infrastructure-failed occupant of a
//   submission id never blocks a legitimate replacement; in-flight and completed-valid runs still do.
//
// Pure rules + a full executor spy (fake store + fake provider, no DB, no browser, no credentials): the
// provider-side navigation log proves how many flow executions actually reached the page layer.
import {
  planFlowSelection, selectFailedFlows, dedupBlocksReplacement, submissionIdForAttempt, estimateRunCredits,
} from "../lib/preflight/flow-selection";
import { executeRun } from "../worker/preflight/execute-run";
import { FakeRunStore } from "../worker/preflight/run-store-fake";
import { FakeBrowserProvider } from "../worker/preflight/providers/fake";
import type { FlowSpec } from "../worker/preflight/types";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

// ── planFlowSelection: the stored selection validated against the approved contract snapshot ──
const APPROVED = ["f-create", "f-persist", "f-mobile"];
{
  const p = planFlowSelection(["f-persist", "f-mobile"], APPROVED);
  ok("selection of 2 approved flows is honored, order preserved", p.ok && p.ids.join(",") === "f-persist,f-mobile");
}
{
  const p = planFlowSelection(["f-persist", "f-persist", "f-mobile"], APPROVED);
  ok("duplicate selected ids collapse (not an error)", p.ok && p.ids.length === 2);
}
ok("missing selection (null) is invalid", !planFlowSelection(null, APPROVED).ok);
ok("missing selection (undefined) is invalid", !planFlowSelection(undefined, APPROVED).ok);
ok("non-array selection is invalid", !planFlowSelection("f-persist", APPROVED).ok);
ok("empty selection is invalid", !planFlowSelection([], APPROVED).ok);
ok("non-string entry is invalid", !planFlowSelection(["f-persist", 7], APPROVED).ok);
{
  const p = planFlowSelection(["f-persist", "f-rogue"], APPROVED);
  ok("an id outside the approved contract snapshot is invalid, named in the reason", !p.ok && !p.ok && (p as { reason: string }).reason.includes("f-rogue"));
}

// ── selectFailedFlows: the shared 'failed' rerun scope (route + fixture driver) ──
const parentFlows = [
  { testFlowId: "f-create", state: "passed" },
  { testFlowId: "f-persist", state: "failed" },
  { testFlowId: "f-mobile", state: "blocked" },
];
ok("failed scope selects exactly the two failed/blocked flows",
  selectFailedFlows(parentFlows).join(",") === "f-persist,f-mobile");
ok("failed scope of an all-passed parent selects nothing",
  selectFailedFlows(parentFlows.map((f) => ({ ...f, state: "passed" }))).length === 0);

// ── estimateRunCredits: billing reads the same selected set ──
ok("2 selected flows -> 2 credits held", estimateRunCredits(2) === 2);
ok("3 selected flows -> 3 credits held", estimateRunCredits(3) === 3);
ok("floor of 1 credit", estimateRunCredits(0) === 1);

// ── dedupBlocksReplacement: which occupants of a submission id refuse a replacement ──
ok("queued blocks (double-click protection)", dedupBlocksReplacement("queued"));
ok("discovering blocks", dedupBlocksReplacement("discovering"));
ok("running blocks", dedupBlocksReplacement("running"));
ok("analyzing blocks", dedupBlocksReplacement("analyzing"));
ok("completed-valid blocks (idempotent replay returns it)", dedupBlocksReplacement("completed"));
ok("invalidated run (failed/target_mismatch) does NOT block a replacement", !dedupBlocksReplacement("failed"));
ok("infrastructure-failed run does NOT block a replacement", !dedupBlocksReplacement("failed"));
ok("cancelled run does NOT block a replacement", !dedupBlocksReplacement("cancelled"));
ok("an unknown state blocks (fail-safe)", dedupBlocksReplacement("someday_new_state"));
ok("replacement submission ids are deterministic: base, base-r2, base-r3",
  submissionIdForAttempt("rerun-fixed-failed-b833713d", 0) === "rerun-fixed-failed-b833713d"
  && submissionIdForAttempt("rerun-fixed-failed-b833713d", 1) === "rerun-fixed-failed-b833713d-r2"
  && submissionIdForAttempt("rerun-fixed-failed-b833713d", 2) === "rerun-fixed-failed-b833713d-r3");

// ── Executor + provider spy: the selection is what actually executes ──
const BASE = "https://preflight-demo-ten.vercel.app";
const flow = (flowId: string, name: string, marker: string): FlowSpec => ({
  flowId, name, priority: "critical", destructiveAllowed: false, maxMs: 60000,
  steps: [{ action: "navigate", target: "/" }, { action: "assert_visible", target: marker, expect: marker }],
});
const THREE_FLOWS = [flow("f-create", "Create a project", "Created"), flow("f-persist", "Persistence", "Persisted"), flow("f-mobile", "Mobile", "Reachable")];
const limits = { leaseSecs: 60, maxRunMs: 60000, maxFlowMs: 60000, maxStepsPerFlow: 30 };

async function spyRun(selectedFlowIds: unknown, runId: string) {
  const store = new FakeRunStore();
  const provider = new FakeBrowserProvider({}, `${BASE}/?mode=fixed`);
  store.enqueue({ runId, applicationId: "a1", deploymentUrl: `${BASE}/?mode=fixed`, flows: THREE_FLOWS, selectedFlowIds });
  const claimed = await store.claim("w1", 60);
  if (claimed) await executeRun(claimed, { store, provider, workerId: "w1", limits });
  return { row: store.get(runId)!, provider, claimed };
}

(async () => {
  // scope=failed: exactly the 2 selected flows execute; the unselected passing flow never runs.
  const failedSel = selectFailedFlows(parentFlows);
  const t1 = await spyRun(failedSel, "rerun-failed");
  ok("worker executes exactly the 2 selected flows", t1.row.flowResults.length === 2, `${t1.row.flowResults.length} executed`);
  ok("executed flow ids ARE the selection", t1.row.flowResults.map((f) => f.flowId).join(",") === "f-persist,f-mobile");
  ok("the unselected passing flow (Create a project) was NOT executed", !t1.row.flowResults.some((f) => f.flowId === "f-create"));
  ok("provider transport saw exactly 2 flow executions (2 navigations)", t1.provider.navigations.length === 2, `${t1.provider.navigations.length} navigations`);
  ok("every navigation the provider saw targeted the run's deployment", t1.provider.navigations.every((u) => u === `${BASE}/?mode=fixed`));
  ok("billing charges the run whose hold was estimated from the same 2-flow set",
    t1.row.billing === "charged" && estimateRunCredits(failedSel.length) === 2, `billing=${t1.row.billing}`);
  ok("run completes with a decision", t1.row.state === "completed" && t1.row.decision !== null);

  // scope=critical: all three selected critical flows execute.
  const t2 = await spyRun(["f-create", "f-persist", "f-mobile"], "rerun-critical");
  ok("critical scope executes all 3 selected flows", t2.row.flowResults.length === 3, `${t2.row.flowResults.length} executed`);
  ok("provider saw 3 navigations for the critical rerun", t2.provider.navigations.length === 3);

  // Malformed selection: fails safely BEFORE any browser session; terminal; refunded; nothing to reconcile.
  const t3 = await spyRun(["f-persist", "not-a-real-flow"], "rerun-malformed");
  ok("malformed selection is never claimed (claim returns null)", t3.claimed === null);
  ok("malformed selection fails the run as flow_selection_invalid",
    t3.row.state === "failed" && t3.row.failureCode === "flow_selection_invalid", `${t3.row.state}/${t3.row.failureCode}`);
  ok("no browser session was ever created for the malformed selection", t3.provider.sessionsCreated() === 0);
  ok("zero flow results (nothing for issue reconciliation to act on)", t3.row.flowResults.length === 0);
  ok("the reservation was refunded (a configuration error is never billable)", t3.row.billing === "refunded");

  // Empty selection: same fail-closed path.
  const t4 = await spyRun([], "rerun-empty");
  ok("empty selection fails as flow_selection_invalid before the browser",
    t4.row.state === "failed" && t4.row.failureCode === "flow_selection_invalid" && t4.provider.sessionsCreated() === 0);

  // Legacy enqueue without a selection (older lifecycle tests): the whole flow list still runs.
  const t5 = await spyRun(undefined, "legacy-all");
  ok("legacy enqueue without selectedFlowIds still runs all flows (fake back-compat)", t5.row.flowResults.length === 3);

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("scope tests crashed:", (e as Error).message); process.exit(1); });
