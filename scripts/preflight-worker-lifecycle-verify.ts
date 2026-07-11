// Deterministic integration test of the ENTIRE preflight worker lifecycle using the in-memory FakeRunStore
// + FakeBrowserProvider (no DB, no browser, no credentials, no migration). Proves: claim -> lease ->
// session -> flows -> incremental persistence -> explainable decision -> charge-on-completion -> session
// close -> worker idle; plus the failure/recovery cases where NO run may be left permanently stuck.
// Run: npx tsx scripts/preflight-worker-lifecycle-verify.ts
import { FakeRunStore } from "../worker/preflight/run-store-fake";
import { FakeBrowserProvider } from "../worker/preflight/providers/fake";
import { PreflightWorker } from "../worker/preflight/worker";
import type { WorkerConfig } from "../worker/preflight/config";
import type { FlowSpec } from "../worker/preflight/types";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const CFG: WorkerConfig = { workerId: "w1", provider: "fake", pollMs: 5, leaseSecs: 90, heartbeatSecs: 999, maxRunMs: 60000, maxFlowMs: 30000, maxStepsPerFlow: 30, maxConcurrentRuns: 1 };
const flow = (id: string, priority: FlowSpec["priority"], assertTarget: string): FlowSpec => ({
  flowId: id, name: id, priority, startPath: "/", destructiveAllowed: false, maxMs: 30000,
  steps: [{ action: "navigate", target: "https://fixture.local/x" }, { action: "assert_visible", target: assertTarget, expect: assertTarget }],
});

async function main() {
  // ── A. Happy path with a critical failure -> BLOCKED, charged, session closed, results persisted ──
  {
    const store = new FakeRunStore();
    const provider = new FakeBrowserProvider({ "assert_visible:Dashboard": { ok: true }, "assert_visible:Acme": { ok: false, detail: "data disappeared after refresh", consoleError: "TypeError: x" } });
    const worker = new PreflightWorker(CFG, store, provider);
    store.enqueue({ runId: "r1", applicationId: "a1", deploymentUrl: "https://fixture.local", flows: [flow("f-auth", "critical", "Dashboard"), flow("f-persist", "critical", "Acme")] });
    const did = await worker.tick();
    const r = store.get("r1")!;
    ok("A: run claimed + executed", did === true);
    ok("A: provider session recorded", r.providerSessionId?.startsWith("fake-r1") === true);
    ok("A: both flow results persisted", r.flowResults.length === 2);
    ok("A: passing critical flow passed", r.flowResults.find((f) => f.flowId === "f-auth")?.state === "passed");
    ok("A: failing critical flow failed", r.flowResults.find((f) => f.flowId === "f-persist")?.state === "failed");
    ok("A: decision BLOCKED (critical failed)", r.decision === "blocked");
    ok("A: summary counts critical 1/2", r.summary.critical_passed === 1 && r.summary.critical_total === 2);
    ok("A: charged on completion", r.billing === "charged");
    ok("A: provider session closed (none open)", provider.openSessions() === 0);
    ok("A: worker idle after run", worker.health().active === 0);
    ok("A: deterministic evidence captured (console error)", (r.flowResults.find((f) => f.flowId === "f-persist")?.evidence?.consoleErrors.length ?? 0) >= 1);
  }

  // ── B. All critical flows pass -> READY ──
  {
    const store = new FakeRunStore();
    const provider = new FakeBrowserProvider({ "assert_visible:Dashboard": { ok: true } });
    const worker = new PreflightWorker(CFG, store, provider);
    store.enqueue({ runId: "r2", applicationId: "a1", deploymentUrl: "https://fixture.local", flows: [flow("f-auth", "critical", "Dashboard")] });
    await worker.tick();
    const r = store.get("r2")!;
    ok("B: all-pass -> READY", r.decision === "ready" && r.billing === "charged" && provider.openSessions() === 0);
  }

  // ── C. Provider creation fails -> run not stuck, no session leaked, refunded (no flow ran) ──
  {
    const store = new FakeRunStore();
    const provider = new FakeBrowserProvider({}); provider.createShouldThrow = true;
    const worker = new PreflightWorker(CFG, store, provider);
    store.enqueue({ runId: "r3", applicationId: "a1", deploymentUrl: "https://fixture.local", flows: [flow("f-auth", "critical", "Dashboard")], maxAttempts: 3 });
    await worker.tick();
    const r = store.get("r3")!;
    ok("C: provider-create-fail requeued (not stuck)", r.state === "queued" && r.failureCode === "run_error");
    ok("C: no browser session leaked", provider.openSessions() === 0);
    ok("C: refunded (no flow executed)", r.billing === "refunded");
  }

  // ── D. Cancellation requested -> terminal 'cancelled', refunded, session closed ──
  {
    const store = new FakeRunStore();
    const provider = new FakeBrowserProvider({ "assert_visible:Dashboard": { ok: true } });
    const worker = new PreflightWorker(CFG, store, provider);
    store.enqueue({ runId: "r4", applicationId: "a1", deploymentUrl: "https://fixture.local", flows: [flow("f-auth", "critical", "Dashboard")] });
    store.requestCancel("r4");
    await worker.tick();
    const r = store.get("r4")!;
    ok("D: cancellation -> terminal failed(cancelled)", r.state === "failed" && r.failureCode === "cancelled");
    ok("D: cancellation refunded + session closed", r.billing === "refunded" && provider.openSessions() === 0);
  }

  // ── E. Lease lost mid-run -> abort, requeued, session closed (never continue after ownership loss) ──
  {
    const store = new FakeRunStore();
    const provider = new FakeBrowserProvider({ "assert_visible:Dashboard": { ok: true } });
    const worker = new PreflightWorker(CFG, store, provider);
    store.enqueue({ runId: "r5", applicationId: "a1", deploymentUrl: "https://fixture.local", flows: [flow("f-auth", "critical", "Dashboard")] });
    // Simulate losing ownership by making the per-step heartbeat report false (as the Postgres store would
    // when another worker stole the lease). The executor must abort before running any step.
    store.heartbeat = (async () => false) as typeof store.heartbeat;
    await worker.tick();
    const r = store.get("r5")!;
    ok("E: lease lost mid-run -> requeued (not stuck)", r.state === "queued" && r.failureCode === "lease_lost");
    ok("E: session closed after lease loss", provider.openSessions() === 0);
  }

  // ── F. Provider close throws -> run still finalizes, worker idle (cleanup failure never strands run) ──
  {
    const store = new FakeRunStore();
    const provider = new FakeBrowserProvider({ "assert_visible:Dashboard": { ok: true } }); provider.closeShouldThrow = true;
    const worker = new PreflightWorker(CFG, store, provider);
    store.enqueue({ runId: "r6", applicationId: "a1", deploymentUrl: "https://fixture.local", flows: [flow("f-auth", "critical", "Dashboard")] });
    await worker.tick();
    const r = store.get("r6")!;
    ok("F: close-throws still finalizes decision", r.decision === "ready" && r.state === "completed");
    ok("F: worker idle despite close failure", worker.health().active === 0);
  }

  // ── G. Requeue then re-claim succeeds (recovery) ──
  {
    const store = new FakeRunStore();
    const provider = new FakeBrowserProvider({ "assert_visible:Dashboard": { ok: true } }); provider.createShouldThrow = true;
    const worker = new PreflightWorker(CFG, store, provider);
    store.enqueue({ runId: "r7", applicationId: "a1", deploymentUrl: "https://fixture.local", flows: [flow("f-auth", "critical", "Dashboard")], maxAttempts: 3 });
    await worker.tick(); // attempt 1 fails (create throws) -> requeued
    ok("G: after failure, run is reclaimable", store.get("r7")!.state === "queued" && store.get("r7")!.attempts === 1);
    provider.createShouldThrow = false;                        // provider recovers
    await worker.tick();                                       // attempt 2 succeeds
    ok("G: recovered run completes", store.get("r7")!.state === "completed" && store.get("r7")!.decision === "ready");
  }

  // ── H. Duplicate claim: nothing to claim when none queued ──
  {
    const store = new FakeRunStore();
    const worker = new PreflightWorker(CFG, store, new FakeBrowserProvider());
    ok("H: empty queue -> tick returns false (no double work)", (await worker.tick()) === false);
  }

  // ── I. Max attempts exhausted -> terminal failed, refunded, never re-claimed ──
  {
    const store = new FakeRunStore();
    const provider = new FakeBrowserProvider({}); provider.createShouldThrow = true;
    const worker = new PreflightWorker(CFG, store, provider);
    store.enqueue({ runId: "r8", applicationId: "a1", deploymentUrl: "https://fixture.local", flows: [flow("f-auth", "critical", "Dashboard")], maxAttempts: 2 });
    await worker.tick(); await worker.tick(); // 2 attempts, both fail
    const r = store.get("r8")!;
    ok("I: exhausted attempts -> terminal failed", r.state === "failed" && r.attempts === 2);
    ok("I: no run left permanently claimable", (await worker.tick()) === false);
  }

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
