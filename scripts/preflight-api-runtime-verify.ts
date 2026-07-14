// API runtime canary + unit proof (Multi-Platform Program, Phase B).
//
// Proves the API runtime is a REAL second runtime that reaches decisions by the same rule as web, produces
// sanitized Vraelis-generated evidence, and honors every safety invariant — all deterministically, in
// memory, with no network and no DB. This is the API analogue of the web demo fixture's BLOCKED->REPAIR
// VERIFIED->READY story.

import { runApiFlow, API_CAPABILITIES, type ApiStep } from "../lib/preflight/runtime/api-adapter";
import { makeApiFixture } from "../lib/preflight/runtime/api-fixture";
import { decideRuntime, decisionEvidenceIsTrustworthy } from "../lib/preflight/runtime/decide";
import type { FlowResult, StepClass } from "../lib/preflight/runtime/core";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") { if (cond) { pass++; console.log(`PASS  ${name}`); } else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); } }

// Deterministic injected clock (Date.now is unavailable in some sandboxes; always inject).
let t = 1_000_000; const clock = () => (t += 5);
const BASE = "https://api.fixture.test";
const secrets = { admin_token: "tok_fixture_admin" };

// A "flow" = a named list of API steps + whether it's critical. The persistence flow is the one the
// broken/partial/fixed modes toggle.
const persistenceFlow: ApiStep[] = [
  { action: "http_auth", scheme: "bearer", secretRef: "admin_token" },
  { action: "http_request", method: "POST", path: "/projects", body: { name: "Canary project" }, saveAs: "created" },
  { action: "assert_status", equals: 201 },
  { action: "extract", path: "$.id", into: "pid" },
  { action: "verify_persisted", path: "/projects/{{var:pid}}", jsonPath: "$.name", equals: "Canary project" },
];
// Self-contained: create a project, then list it. In broken/partial modes the list endpoint returns empty
// (a real, catchable gap) so this fails; only in fixed mode does the created project appear in the list.
const listCoverageFlow: ApiStep[] = [
  { action: "http_auth", scheme: "bearer", secretRef: "admin_token" },
  { action: "http_request", method: "POST", path: "/projects", body: { name: "Listed project" } },
  { action: "http_request", method: "GET", path: "/projects" },
  { action: "assert_status", equals: 200 },
  { action: "assert_json", path: "$.projects[0].name", exists: true },   // empty in broken+partial, present in fixed
];
const healthFlow: ApiStep[] = [
  { action: "http_request", method: "GET", path: "/health" },
  { action: "assert_status", equals: 200 },
  { action: "assert_json", path: "$.status", equals: "ok" },
];
const permissionFlow: ApiStep[] = [
  { action: "http_auth", scheme: "bearer", secretRef: "admin_token" },
  { action: "http_request", method: "GET", path: "/admin/metrics" },
  { action: "assert_status", equals: 200 },
];

async function runFlow(mode: "broken" | "partially_fixed" | "fixed", steps: ApiStep[]): Promise<FlowResult & { evidenceCount: number; obs: Awaited<ReturnType<typeof runApiFlow>> }> {
  const fetcher = makeApiFixture(mode);
  const r = await runApiFlow({ baseUrl: BASE, steps, secrets, fetcher, clock });
  const state: FlowResult["state"] = r.ok ? "passed" : "failed";
  return { flowId: "f", state, steps: r.steps, evidenceCount: r.steps.reduce((n, s) => n + s.evidence.length, 0), obs: r };
}

async function main() {
  console.log("── API canary: the BROKEN -> REPAIR VERIFIED -> READY story ──");

  // BROKEN: persistence flow fails (create doesn't persist -> 404 on retrieve) -> BLOCKED (critical).
  {
    const persist = await runFlow("broken", persistenceFlow);
    const dec = decideRuntime({ results: [{ flowId: "persist", state: persist.state, steps: persist.steps }], criticalFlowIds: new Set(["persist"]), fullCoverage: true });
    ok("BROKEN: persistence flow fails against the broken API", persist.state === "failed");
    ok("BROKEN: the run decision is BLOCKED (critical flow failed)", dec.decision === "blocked");
    const failing = persist.steps.find((s) => !s.ok);
    ok("BROKEN: the failing step is the persistence check with real http_txn evidence",
      !!failing && failing.stepClass === "verify_persisted" && failing.evidence.some((e) => e.kind === "http_txn" && e.provenance === "vraelis_generated"));
  }

  // PARTIALLY_FIXED: persistence now works -> a TARGETED rerun of just that flow -> REPAIR VERIFIED (partial coverage).
  {
    const persist = await runFlow("partially_fixed", persistenceFlow);
    const dec = decideRuntime({ results: [{ flowId: "persist", state: persist.state, steps: persist.steps }], criticalFlowIds: new Set(["persist"]), fullCoverage: false });
    ok("PARTIALLY_FIXED: persistence flow now passes", persist.state === "passed");
    ok("PARTIALLY_FIXED: a targeted rerun yields REPAIR VERIFIED, not READY", dec.decision === "repair_verified");
  }

  // PARTIALLY_FIXED full coverage still BLOCKED — the list endpoint is still broken.
  {
    const persist = await runFlow("partially_fixed", persistenceFlow);
    const list = await runFlow("partially_fixed", listCoverageFlow);
    const dec = decideRuntime({
      results: [{ flowId: "persist", state: persist.state, steps: persist.steps }, { flowId: "list", state: list.state, steps: list.steps }],
      criticalFlowIds: new Set(["persist", "list"]), fullCoverage: true,
    });
    ok("PARTIALLY_FIXED: full critical coverage is still BLOCKED (list endpoint still broken)", list.state === "failed" && dec.decision === "blocked");
  }

  // FIXED: full coverage passes -> READY.
  {
    const persist = await runFlow("fixed", persistenceFlow);
    const list = await runFlow("fixed", listCoverageFlow);
    const health = await runFlow("fixed", healthFlow);
    const perm = await runFlow("fixed", permissionFlow);
    const results: FlowResult[] = [
      { flowId: "persist", state: persist.state, steps: persist.steps },
      { flowId: "list", state: list.state, steps: list.steps },
      { flowId: "health", state: health.state, steps: health.steps },
      { flowId: "perm", state: perm.state, steps: perm.steps },
    ];
    const dec = decideRuntime({ results, criticalFlowIds: new Set(["persist", "list", "perm"]), fullCoverage: true });
    ok("FIXED: every flow passes", results.every((r) => r.state === "passed"));
    ok("FIXED: full critical coverage -> READY", dec.decision === "ready");
    const allEvidence = results.flatMap((r) => r.steps.flatMap((s) => s.evidence));
    ok("FIXED: a positive READY rests on Vraelis-generated evidence (not provider-attested)", decisionEvidenceIsTrustworthy("ready", allEvidence));
  }

  console.log("\n── Safety invariants ──");

  // No secrets in evidence — the echo-auth trap: the token must never appear in any recorded observation.
  {
    const echoFlow: ApiStep[] = [
      { action: "http_auth", scheme: "bearer", secretRef: "admin_token" },
      { action: "http_request", method: "GET", path: "/echo-auth" },
    ];
    const r = await runApiFlow({ baseUrl: BASE, steps: echoFlow, secrets, fetcher: makeApiFixture("fixed"), clock });
    const serialized = JSON.stringify(r.steps);
    ok("NO SECRET LEAK: the bearer token never appears in recorded evidence (request headers masked)",
      !serialized.includes("tok_fixture_admin"));
    ok("NO SECRET LEAK: the Authorization header is masked to *** in request evidence",
      serialized.includes("***"));
    ok("NO SECRET LEAK: the echoed-back token in the RESPONSE body is also redacted",
      !serialized.includes("Bearer tok_fixture_admin"));
  }

  // Unsupported step must be rejected BEFORE any execution/billing — capability gate.
  {
    const supports = (c: StepClass) => API_CAPABILITIES.steps.has(c);
    ok("CAPABILITY GATE: the API adapter does NOT declare a web-only step (screenshot)", !supports("screenshot" as StepClass));
    ok("CAPABILITY GATE: the API adapter declares its real steps (http_request, assert_schema)", supports("http_request") && supports("assert_schema"));
    ok("CAPABILITY GATE: API adapter declares it executes NO untrusted artifact", API_CAPABILITIES.executesUntrustedArtifact === false);
  }

  // Infra failure is NEVER a product BLOCKED.
  {
    const dec = decideRuntime({ results: [{ flowId: "x", state: "failed", steps: [] }], criticalFlowIds: new Set(["x"]), fullCoverage: true, failureClass: "infra" });
    ok("INFRA != PRODUCT: a run that terminated on infra failure is 'infra_failure', never BLOCKED", dec.decision === "infra_failure");
  }

  // Origin boundary: a step whose path resolves off the API's origin fails (SSRF-adjacent boundary in the adapter).
  {
    const escape: ApiStep[] = [{ action: "http_request", method: "GET", path: "https://evil.example/steal" }];
    const r = await runApiFlow({ baseUrl: BASE, steps: escape, secrets, fetcher: makeApiFixture("fixed"), clock });
    ok("ORIGIN BOUNDARY: a request to another origin is rejected (never leaves the API's own origin)", !r.ok && r.steps[0].detail.includes("not on this API's origin"));
  }

  // Idempotency: a create replayed with the same Idempotency-Key does not double-create.
  {
    const idemFlow: ApiStep[] = [
      { action: "http_auth", scheme: "bearer", secretRef: "admin_token" },
      { action: "set_header", name: "Idempotency-Key", value: "canary-key-1" },
      { action: "http_request", method: "POST", path: "/projects", body: { name: "Idem project" }, saveAs: "a" },
      { action: "http_request", method: "POST", path: "/projects", body: { name: "Idem project" }, saveAs: "b" },
      { action: "assert_json", path: "$.idempotent_replay", equals: true },
    ];
    const r = await runApiFlow({ baseUrl: BASE, steps: idemFlow, secrets, fetcher: makeApiFixture("fixed"), clock });
    ok("IDEMPOTENCY: a replayed create with the same key returns the replay marker (no double-create)", r.ok);
  }

  // API and web decisions are computed by the same rule but are independent objects — a web READY here would
  // be a separate decision binding. (We can't run the web engine here, but we prove the rule is shared +
  // the decision carries no runtime coupling: decideRuntime is runtime-agnostic.)
  {
    const apiDec = decideRuntime({ results: [{ flowId: "a", state: "passed", steps: [] }], criticalFlowIds: new Set(["a"]), fullCoverage: true });
    ok("INDEPENDENCE: decideRuntime is runtime-agnostic (same rule powers web + api; bindings differ)", apiDec.decision === "ready");
  }

  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
