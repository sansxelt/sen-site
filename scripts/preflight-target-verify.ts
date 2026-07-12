// Regression tests for the linked-rerun target bug: the run snapshot's deployment_url is AUTHORITATIVE for
// execution. Pure resolver rules + a full executor spy (fake provider + fake store, no browser, no DB)
// proving the exact URL handed to the page is the current run target, the invariant aborts as an
// infrastructure failure with a refund and no product findings, and invalid runs never control health.
import { resolveNavigationUrl, targetInvariantViolation, executedTargetMismatch, pickHealthRun } from "../lib/preflight/target-url";
import { executeRun } from "../worker/preflight/execute-run";
import { FakeRunStore } from "../worker/preflight/run-store-fake";
import { FakeBrowserProvider } from "../worker/preflight/providers/fake";
import type { FlowSpec } from "../worker/preflight/types";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const BASE = "https://preflight-demo-ten.vercel.app";

// ── Resolver rules (A, B, D, F, G) ──
ok("F: stored mode=broken LOSES to run-target mode=fixed",
  resolveNavigationUrl(`${BASE}/?mode=broken`, `${BASE}/?mode=fixed`) === `${BASE}/?mode=fixed`);
ok("B: stored broken URL rebased onto partially_fixed target",
  resolveNavigationUrl(`${BASE}/?mode=broken`, `${BASE}/?mode=partially_fixed`) === `${BASE}/?mode=partially_fixed`);
ok("G: relative path resolves onto the run target with its params",
  resolveNavigationUrl("/", `${BASE}/?mode=fixed`) === `${BASE}/?mode=fixed`);
ok("G: stored route + params preserved, run-target origin + params win (spec example)",
  resolveNavigationUrl("https://old-app.example/dashboard?tab=settings", "https://new-app.example/?preview=abc")
    === "https://new-app.example/dashboard?tab=settings&preview=abc");
ok("stored-only params survive the merge",
  resolveNavigationUrl(`${BASE}/list?filter=open`, `${BASE}/?mode=fixed`) === `${BASE}/list?filter=open&mode=fixed`);
ok("hash preserved from the stored intent",
  resolveNavigationUrl(`${BASE}/docs#setup`, `${BASE}/?mode=fixed`) === `${BASE}/docs?mode=fixed#setup`);
ok("empty stored target -> the run target itself",
  resolveNavigationUrl("", `${BASE}/?mode=fixed`) === `${BASE}/?mode=fixed`);
ok("unparseable stored target -> the run target itself (never navigate nowhere)",
  resolveNavigationUrl("not a url", `${BASE}/?mode=fixed`) === `${BASE}/?mode=fixed`);
ok("identical stored/target is a byte-for-byte no-op (existing flows unaffected)",
  resolveNavigationUrl("https://fixture.local/x", "https://fixture.local") === "https://fixture.local/x");

// ── Invariant + repair detection (I, repair) ──
ok("I: origin mismatch is an invariant violation",
  targetInvariantViolation("https://evil.example/?mode=fixed", `${BASE}/?mode=fixed`) !== null);
ok("I: missing run-target param is an invariant violation",
  targetInvariantViolation(`${BASE}/`, `${BASE}/?mode=fixed`) !== null);
ok("honored target passes the invariant",
  targetInvariantViolation(`${BASE}/?mode=fixed`, `${BASE}/?mode=fixed`) === null);
ok("repair detector: executed broken vs target fixed -> mismatch",
  executedTargetMismatch(`${BASE}/?mode=fixed`, `${BASE}/?mode=broken`) === true);
ok("repair detector: honored execution -> no mismatch",
  executedTargetMismatch(`${BASE}/?mode=fixed`, `${BASE}/?mode=fixed&extra=1`) === false);

// ── Health selection (K) ──
const healthRuns = [
  { state: "failed", decision: null, created_at: "2026-07-12T10:00:00Z" },            // invalidated, newest
  { state: "completed", decision: "blocked", created_at: "2026-07-11T10:00:00Z" },    // newest VALID
  { state: "completed", decision: "ready", created_at: "2026-07-10T10:00:00Z" },
];
ok("K: health skips the invalidated newest run and picks the newest valid completed pass",
  pickHealthRun(healthRuns)?.decision === "blocked");
ok("K: a newer ACTIVE run still surfaces as in-progress",
  pickHealthRun([{ state: "running", decision: null, created_at: "2026-07-12T11:00:00Z" }, ...healthRuns])?.state === "running");

// ── Executor spy (C, D, E, H, I, J, L) ──
const navFlow = (stored: string): FlowSpec => ({
  flowId: "f1", name: "open", priority: "critical", destructiveAllowed: false, maxMs: 60000,
  steps: [{ action: "navigate", target: stored }, { action: "assert_visible", target: "Anything", expect: "Anything" }],
});
const limits = { leaseSecs: 60, maxRunMs: 60000, maxFlowMs: 60000, maxStepsPerFlow: 30 };

async function spyRun(stored: string, target: string) {
  const store = new FakeRunStore();
  const provider = new FakeBrowserProvider({}, target);
  store.enqueue({ runId: "spy", applicationId: "a1", deploymentUrl: target, flows: [navFlow(stored)] });
  const claimed = await store.claim("w1", 60);
  if (!claimed) throw new Error("claim failed");
  await executeRun(claimed, { store, provider, workerId: "w1", limits });
  return store.get("spy")!;
}

(async () => {
  // C/D: stored broken URL, run target partially_fixed -> the page receives partially_fixed.
  const r1 = await spyRun(`${BASE}/?mode=broken`, `${BASE}/?mode=partially_fixed`);
  const nav1 = r1.flowResults[0]?.steps[0];
  ok("C/D: executed navigation target IS the partially_fixed run target", nav1?.target === `${BASE}/?mode=partially_fixed`, String(nav1?.target));
  ok("H: observation records requested vs resolved", typeof nav1?.detail === "string" && nav1.detail.includes("[requested") && nav1.detail.includes("[resolved"));
  ok("H: final browser URL equals the resolved target", nav1?.url === `${BASE}/?mode=partially_fixed`);

  // E: next linked rerun target fixed -> the page receives fixed.
  const r2 = await spyRun(`${BASE}/?mode=broken`, `${BASE}/?mode=fixed`);
  ok("E: executed navigation target IS the fixed run target", r2.flowResults[0]?.steps[0]?.target === `${BASE}/?mode=fixed`);
  ok("run with honored target completes normally", r2.state === "completed");

  // I/J/L: an unparseable run target violates the invariant BEFORE any browser work: terminal
  // infrastructure failure, zero flow results (no product findings to reconcile), reservation refunded.
  const store = new FakeRunStore();
  const provider = new FakeBrowserProvider({}, BASE);
  store.enqueue({ runId: "bad", applicationId: "a1", deploymentUrl: "not a real url", flows: [navFlow(`${BASE}/?mode=broken`)] });
  const claimed = await store.claim("w1", 60);
  await executeRun(claimed!, { store, provider, workerId: "w1", limits });
  const bad = store.get("bad")!;
  ok("I: invariant violation fails the run as target_mismatch", bad.state === "failed" && bad.failureCode === "target_mismatch", `${bad.state}/${bad.failureCode}`);
  ok("J: no flow results were produced (nothing for issue reconciliation to act on)", bad.flowResults.length === 0);
  ok("L: the customer's reservation was refunded (harness failure is never billable)", bad.billing === "refunded", bad.billing);
  ok("no browser session leaked from the aborted run", provider.openSessions() === 0);

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("target tests crashed:", (e as Error).message); process.exit(1); });
