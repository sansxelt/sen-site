// Offline rehearsal of the ENTIRE live-canary surface — zero network, zero DB writes, zero spend.
//
// Wires the pure fixture handler (canary-fixture-http) directly as the adapter's fetcher and an in-memory
// CanaryStore, then runs every phase through the REAL orchestration (runCanaryPhase -> runApiFlow ->
// decideRuntime) and asserts the exact proofs the founder's Phase-4 plan demands. If this is green, the only
// deltas in production are safeFetch (already 148-suite proven) and Supabase persistence (schema verified by
// migration-12's two verifiers).

import { handleFixture, type FixtureMode } from "../lib/preflight/runtime/canary-fixture-http";
import {
  runCanaryPhase, canaryMatrixHash, CANARY_FLOWS, CANARY_ADAPTER_VERSION,
  type CanaryStore, type CanaryDeps, type CanaryIssueRow, type CanaryPhaseResult,
} from "../lib/preflight/runtime/canary";
import { runApiFlow, type ApiFetch, type ApiStep } from "../lib/preflight/runtime/api-adapter";
import { safeFetch, isBlockedFetchError, blockedFetchReason } from "../lib/safe-fetch";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); }
}

const PASSWORD = "rehearsal-pass-8f2k";
let now = 1_752_000_000_000;
const clock = () => (now += 7);

// ── fetcher: parse the URL and call the pure fixture handler directly (no sockets) ──
const FIXTURE_ORIGIN = "https://canary.rehearsal.test";
const fixtureFetcher: ApiFetch = async (url, init) => {
  const u = new URL(url);
  // Mirror the LIVE route's fetcher (safeFetch + isBlockedFetchError tagging): the TEST-NET infra target
  // resolves-as-public but never answers -> transport:"unreachable" (infra); the non-resolving ssrf target
  // trips the safe-fetch guard -> transport:"blocked" (indeterminate). Any other non-fixture host defaults
  // to unreachable.
  if (u.origin !== FIXTURE_ORIGIN) {
    const e = new Error("blocked") as Error & { transportKind?: string; transportReason?: string | null };
    if (u.hostname.endsWith(".invalid")) { e.transportKind = "blocked"; e.transportReason = "unresolved_host"; }
    else { e.transportKind = "unreachable"; e.transportReason = null; }
    throw e;
  }
  const m = /^\/api\/canary-fixture\/([a-z_]+)(\/.*)?$/.exec(u.pathname);
  if (!m) return { status: 404, headers: {}, text: "" };
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(init.headers)) headers[k.toLowerCase()] = v;
  const res = handleFixture({
    mode: m[1] as FixtureMode, method: init.method,
    path: `${m[2] ?? "/"}${u.search}`, headers, body: init.body, password: PASSWORD, clock,
  });
  return { status: res.status, headers: res.headers, text: res.body };
};

// ── in-memory store (mirrors the Supabase store's semantics; records everything for assertions) ──
type Row = Record<string, unknown>;
function makeMemoryStore() {
  let seq = 0;
  const id = (p: string) => `${p}_${++seq}`;
  const runs: Row[] = [], decisions: Row[] = [], issues: (CanaryIssueRow & { runtime_target_id: string })[] = [], ledger: Row[] = [], builds: Row[] = [];
  let appId: string | null = null, targetId: string | null = null;
  // A pre-existing WEB run so runtime-independence is assertable (its decision must never change).
  const WEB_RUN = { id: "run_web_baseline", decision: "ready", runtime_target_id: null as string | null };
  const store: CanaryStore = {
    async ensureApp() { return (appId ??= id("app")); },
    async ensureApiTarget() { return (targetId ??= id("tgt")); },
    async insertBuild(owner, tgt, baseUrl, phase) { const b = { id: id("bld"), tgt, baseUrl, phase }; builds.push(b); return b.id as string; },
    async insertTerminalRun(r) { const row = { id: id("run"), ...r }; runs.push(row); return row.id as string; },
    async insertDecision(r) { const row = { id: id("dec"), ...r }; decisions.push(row); return row.id as string; },
    async openIssues(app, tgt) { return issues.filter((i) => i.status === "open" && i.runtime_target_id === tgt); },
    async openIssue(r) {
      const row = { id: id("iss"), category: r.category, status: "open", first_seen_run: r.runId, last_seen_run: r.runId, resolved_run: null, runtime_target_id: r.targetId };
      issues.push(row); return row.id;
    },
    async resolveIssue(issueId, runId) { const i = issues.find((x) => x.id === issueId)!; i.status = "resolved"; i.resolved_run = runId; i.last_seen_run = runId; },
    async continueIssue(issueId, runId) { const i = issues.find((x) => x.id === issueId)!; i.last_seen_run = runId; },
    async recordUsage(owner, runId) { ledger.push({ run_id: runId, estimated_cents: 0 }); },
    async ledgerCount(runId) { return ledger.filter((l) => l.run_id === runId).length; },
    async webSnapshot() { return { runId: WEB_RUN.id, decision: WEB_RUN.decision }; },
    async ensureWebBaseline() { return { runId: WEB_RUN.id, decision: WEB_RUN.decision }; },
  };
  return { store, runs, decisions, issues, ledger, builds, WEB_RUN };
}

async function main() {
  const mem = makeMemoryStore();
  const deps: CanaryDeps = {
    owner: "founder@rehearsal.test", fetcher: fixtureFetcher, store: mem.store, clock,
    fixtureBase: (mode) => `${FIXTURE_ORIGIN}/api/canary-fixture/${mode}`,
    secrets: { CANARY_PASSWORD: PASSWORD },
  };
  const results: Record<string, CanaryPhaseResult> = {};

  console.log("── BROKEN: genuine failing persistence assertion -> BLOCKED ──");
  const broken = (results.broken = await runCanaryPhase(deps, "broken"));
  ok("decision is BLOCKED", broken.decision === "blocked", String(broken.decision));
  ok("the failure is the persistence flow (real chained authenticated requests)",
    broken.flows.find((f) => f.id === "persistence")?.state === "failed");
  ok("health + auth + authz + redirect flows PASSED (the failure is real, not environmental)",
    ["health", "auth", "authz", "redirect_containment"].every((f) => broken.flows.find((x) => x.id === f)?.state === "passed"));
  ok("an issue was OPENED for the persistence requirement", broken.issues.opened.length === 1);
  ok("failure class is PRODUCT (not infra)", broken.failureClass === null);
  ok("decision binding carries target+build+environment+contract+matrix+adapter",
    !!broken.targetId && !!broken.buildId && broken.binding.environment === "canary"
    && broken.binding.contractVersion === 1 && broken.matrixHash === canaryMatrixHash(CANARY_FLOWS.map((f) => f.id))
    && broken.binding.adapterVersion === CANARY_ADAPTER_VERSION);
  ok("evidence is sanitized: no password, no minted token anywhere", broken.leakScan === "clean");
  ok("http_txn evidence exists for the failing flow",
    broken.evidence.find((e) => e.flowId === "persistence")!.steps.some((s) => s.evidence.some((ev) => ev.kind === "http_txn")));
  ok("exactly ONE usage ledger row for the run (no duplicate billing)", broken.ledgerRows === 1);

  console.log("\n── REPAIR: targeted rerun of ONLY the failed flow -> REPAIR VERIFIED, never READY ──");
  const repair = (results.repair = await runCanaryPhase(deps, "repair"));
  ok("decision is REPAIR_VERIFIED", repair.decision === "repair_verified", String(repair.decision));
  ok("NOT a false READY (partial coverage can never mint READY)", repair.decision !== "ready");
  ok("the SAME issue was resolved (lineage continuity)",
    repair.issues.resolved.length === 1 && repair.issues.resolved[0] === broken.issues.opened[0]);
  ok("exactly ONE usage row for the rerun", repair.ledgerRows === 1);

  console.log("\n── FIXED: full matrix passes -> READY ──");
  const fixed = (results.fixed = await runCanaryPhase(deps, "fixed"));
  ok("decision is READY", fixed.decision === "ready", String(fixed.decision));
  ok("full coverage (all 5 flows executed and passed)",
    fixed.flows.length === 5 && fixed.flows.every((f) => f.state === "passed"));
  ok("no new issues; nothing left open", fixed.issues.opened.length === 0 && (await mem.store.openIssues(fixed.appId, fixed.targetId)).length === 0);

  console.log("\n── CAPABILITY: unsupported browser step fails BEFORE any request or billing ──");
  const cap = (results.capability = await runCanaryPhase(deps, "capability"));
  ok("flow was blocked_by_policy (capability gate)", cap.flows[0]?.state === "blocked_by_policy");
  ok("ZERO requests were made", cap.apiRequests === 0, String(cap.apiRequests));
  ok("ZERO usage ledger rows (failed before billing)", cap.ledgerRows === 0);
  ok("no issue lineage from a policy-blocked flow", cap.issues.opened.length === 0);
  ok("decision reflects review, not a product verdict", cap.decision === "needs_review", String(cap.decision));
  // policy_blocked counts flows REFUSED at the capability gate (this is the ONE place it should be > 0).
  ok("policy_blocked === 1 (a flow was refused before any request)", cap.summary.policy_blocked === 1, String(cap.summary.policy_blocked));
  ok("transport_blocked === 0 (nothing ran to be transport-blocked)", cap.summary.transport_blocked === 0, String(cap.summary.transport_blocked));

  console.log("\n── INFRA: genuine transport-unreachable (TEST-NET) -> INFRASTRUCTURE FAILURE, never BLOCKED ──");
  const infra = (results.infra = await runCanaryPhase(deps, "infra"));
  ok("decision is INFRA_FAILURE", infra.decision === "infra_failure", String(infra.decision));
  ok("failure class is infra", infra.failureClass === "infra");
  ok("NOT product BLOCKED", infra.decision !== "blocked");
  ok("no issue rows from an infra run", infra.issues.opened.length === 0);
  ok("no usage recorded for transport-failed requests", infra.ledgerRows === 0);

  console.log("\n── SSRF_BLOCK: safe-fetch guard rejection -> INDETERMINATE (security signal), never free infra ──");
  const ssrf = (results.ssrf_block = await runCanaryPhase(deps, "ssrf_block"));
  ok("decision is NEEDS_REVIEW (indeterminate)", ssrf.decision === "needs_review", String(ssrf.decision));
  ok("failure class is INDETERMINATE, not infra (an SSRF block is a security signal)", ssrf.failureClass === "indeterminate");
  ok("NOT product BLOCKED", ssrf.decision !== "blocked");
  ok("NOT silently absolved as free infra (failureClass !== 'infra')", ssrf.failureClass !== "infra");
  ok("no usage recorded for a blocked request", ssrf.ledgerRows === 0);
  ok("the failing step is tagged transport:'blocked' (structural, not string-matched)",
    ssrf.evidence[0]?.steps.some((s) => s.transport === "blocked") ?? false);
  // The SSRF block is its OWN counter — policy_blocked stays 0 (the flow RAN a request), transport_blocked is 1.
  ok("policy_blocked === 0 (the flow ran a request; it was NOT policy-refused)", ssrf.summary.policy_blocked === 0, String(ssrf.summary.policy_blocked));
  ok("transport_blocked === 1 (a request was SSRF-blocked at the transport layer)", ssrf.summary.transport_blocked === 1, String(ssrf.summary.transport_blocked));
  ok("block_reasons records a SANITIZED reason class (unresolved_host here), never a destination",
    Array.isArray(ssrf.summary.block_reasons) && ssrf.summary.block_reasons.includes("unresolved_host"), JSON.stringify(ssrf.summary.block_reasons));
  ok("the recorded reason exposes NO host/IP/port (fixed enum only)",
    (ssrf.summary.block_reasons as string[]).every((r) => ["private_address","metadata_endpoint","unresolved_host","unsupported_scheme","port_not_allowed","blocked"].includes(r)));

  console.log("\n── CANCEL: a cancelled run settles with no decision row and no usage ──");
  const cancel = (results.cancel = await runCanaryPhase(deps, "cancel"));
  ok("run recorded as cancelled with NO decision", cancel.decision === null);
  ok("no decision row was inserted", !mem.decisions.some((d) => d.runId === cancel.runId));
  ok("no usage ledger row", cancel.ledgerRows === 0);

  console.log("\n── WEB_INDEPENDENCE: a known web decision is untouched by a full API run ──");
  const wi = (results.web_independence = await runCanaryPhase(deps, "web_independence"));
  ok("a web baseline decision exists BEFORE the API run", wi.web.before?.decision === "ready", JSON.stringify(wi.web.before));
  ok("the API run itself is READY (it really ran the full matrix)", wi.decision === "ready", String(wi.decision));
  ok("the web decision is IDENTICAL after the API run (positive independence proof)",
    wi.web.after?.decision === wi.web.before?.decision && wi.web.after?.runId === wi.web.before?.runId,
    `before=${JSON.stringify(wi.web.before)} after=${JSON.stringify(wi.web.after)}`);
  ok("the API run bound its decision to the API target, NOT the web baseline run",
    mem.decisions.some((d) => d.runId === wi.runId && d.runId !== wi.web.before?.runId));

  console.log("\n── cross-phase invariants ──");
  ok("web decision is COMPLETELY independent (baseline web run untouched across all phases)",
    Object.values(results).every((r) => r.web.before?.decision === "ready" && r.web.after?.decision === "ready"));
  ok("every executed phase's run is TERMINAL at insert (worker can never claim an API run)",
    mem.runs.every((r) => r.state === "completed" || r.state === "cancelled"));
  ok("every decision row is bound to the API target (api READY can never certify web)",
    mem.decisions.every((d) => d.targetId === broken.targetId && d.runId !== mem.WEB_RUN.id));
  ok("no secret or token in ANY phase's full result JSON",
    !JSON.stringify(results).includes(PASSWORD) && !/cnry_\d+_[a-f0-9]{24}/.test(JSON.stringify(results)));
  ok("redirect evidence shows the 302 was surfaced and NO REQUEST was ever made to the metadata target",
    (() => {
      const red = results.fixed.evidence.find((e) => e.flowId === "redirect_containment");
      if (!red) return false;
      const txns = red.steps.flatMap((s) => s.evidence).filter((e) => e.kind === "http_txn")
        .map((e) => JSON.parse(e.ref) as { request?: { path?: string }; response?: { status?: number } });
      const saw302 = txns.some((t) => t.response?.status === 302);
      // The Location header VALUE may legitimately appear in response-header evidence (factual capture);
      // the containment proof is that no REQUEST was addressed to the metadata host.
      const requestedMetadata = txns.some((t) => (t.request?.path ?? "").includes("169.254.169.254"));
      return saw302 && !requestedMetadata;
    })());

  console.log("\n── fixture handler hardening (direct) ──");
  const disabled = handleFixture({ mode: "fixed", method: "GET", path: "/health", headers: {}, password: undefined, clock });
  ok("fixture with no password env is a uniform 404 (disabled)", disabled.status === 404);
  const badLogin = handleFixture({ mode: "fixed", method: "POST", path: "/login", headers: {}, body: JSON.stringify({ password: "wrong" }), password: PASSWORD, clock });
  ok("wrong password -> 401", badLogin.status === 401);
  const noAuth = handleFixture({ mode: "fixed", method: "GET", path: "/echo-auth", headers: {}, password: PASSWORD, clock });
  ok("no bearer -> 401", noAuth.status === 401);
  const forgedToken = handleFixture({ mode: "fixed", method: "GET", path: "/echo-auth", headers: { authorization: "Bearer cnry_9999999999999_aaaaaaaaaaaaaaaaaaaaaaaa" }, password: PASSWORD, clock });
  ok("forged token -> 401", forgedToken.status === 401);
  const badSig = handleFixture({ mode: "fixed", method: "GET", path: "/projects/proj_abc?sig=deadbeefdeadbeef", headers: { authorization: "Bearer x" }, password: PASSWORD, clock });
  ok("bad project signature -> 401/400 (never a fabricated 200)", badSig.status === 401 || badSig.status === 400);

  console.log("\n── adapter hardening regressions (post-review fixes) ──");
  // FIX (finding 4): verify_persisted must fail on a non-2xx even if the error body carries the value.
  {
    const errorBodyFetcher: ApiFetch = async () => ({ status: 404, headers: { "content-type": "application/json" }, text: JSON.stringify({ persisted: true }) });
    const r = await runApiFlow({
      baseUrl: "https://x.test", secrets: {}, fetcher: errorBodyFetcher, clock,
      steps: [{ action: "verify_persisted", path: "/projects/abc", jsonPath: "$.persisted", equals: true }] as ApiStep[],
    });
    ok("verify_persisted FAILS on a 404 whose body coincidentally has the expected value (status checked first)", !r.ok);
  }
  // FIX (finding 1/3): a safe-fetch 'blocked' rejection is a PRODUCT/security signal (transport:'blocked'),
  // distinct from an unreachable transport failure — the canary classifies it indeterminate, never free infra.
  {
    const blockedFetcher: ApiFetch = async () => { const e = new Error("blocked") as Error & { transportKind?: string }; e.transportKind = "blocked"; throw e; };
    const r = await runApiFlow({
      baseUrl: "https://x.test", secrets: {}, fetcher: blockedFetcher, clock,
      steps: [{ action: "http_request", method: "GET", path: "/health" }] as ApiStep[],
    });
    ok("a safe-fetch 'blocked' request tags transport:'blocked' (product/security, not unreachable)",
      !r.ok && r.steps[r.failedIndex!]?.transport === "blocked");
  }
  {
    const unreachableFetcher: ApiFetch = async () => { const e = new Error("boom") as Error & { transportKind?: string }; e.transportKind = "unreachable"; throw e; };
    const r = await runApiFlow({
      baseUrl: "https://x.test", secrets: {}, fetcher: unreachableFetcher, clock,
      steps: [{ action: "http_request", method: "GET", path: "/health" }] as ApiStep[],
    });
    ok("a genuine transport failure tags transport:'unreachable' (infra)",
      !r.ok && r.steps[r.failedIndex!]?.transport === "unreachable");
  }

  console.log("\n── safe-fetch sanitized block-reason classification (offline paths) ──");
  // The scheme + port rejections throw synchronously before any DNS/network, so they're testable offline.
  // Each carries message==="blocked" (unchanged) PLUS a sanitized reason class that exposes no destination.
  for (const [url, wantReason] of [
    ["http://example.com/x", "unsupported_scheme"],
    ["https://example.com:8443/x", "port_not_allowed"],
  ] as const) {
    let caught: unknown;
    try { await safeFetch(url, { method: "GET" } as RequestInit); } catch (e) { caught = e; }
    ok(`safeFetch(${url.slice(0, 28)}...) blocks with reason '${wantReason}'`,
      isBlockedFetchError(caught) && blockedFetchReason(caught) === wantReason,
      `got reason=${blockedFetchReason(caught)}`);
    ok(`  ...and message stays exactly "blocked" (existing callers unbroken)`,
      caught instanceof Error && caught.message === "blocked");
    ok(`  ...and the reason exposes no host/port (fixed enum)`,
      ["private_address","metadata_endpoint","unresolved_host","unsupported_scheme","port_not_allowed","blocked"].includes(blockedFetchReason(caught) ?? ""));
  }

  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
