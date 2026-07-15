// API beta customer-surface safety proof — pure/offline (no network, no DB, no spend). Grows as the beta
// surfaces land. Phase 1: the account gate + the customer step vocabulary (validation, credential-shape
// guard, internal-name containment, launch-time translation).

import { apiRuntimeBetaAllowed } from "../lib/v-entitlements";
import { apiRuntimeEnabled } from "../lib/v-preflight-flags";
import {
  validateApiSteps, mapToApiStep, apiFlowRequiresAuth, apiFlowCredentials,
  API_FLOW_ACTIONS, API_ACTION_LABELS, MAX_API_STEPS, type ApiFlowStep, type ResolvedCredential,
} from "../lib/preflight/runtime/api-steps";
import { executeApiRun, type ApiRunStore, type SecretResolver, type ApiCustomerFlow } from "../lib/preflight/runtime/api-executor";
import type { ApiFetch } from "../lib/preflight/runtime/api-adapter";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") { if (cond) { pass++; console.log(`PASS  ${name}`); } else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); } }

// Internal ApiStep action names + fixture/canary terms that must NEVER appear in customer-facing strings.
const FORBIDDEN = ["http_request", "http_auth", "assert_status", "assert_json", "assert_schema", "verify_persisted", "set_header", "extract",
  "canary", "fixture", "blocked_by_policy", "transportReason", "CANARY_PASSWORD", "api-canary", "indeterminate"];

function main() {
  console.log("── the account gate (fail-closed, default OFF) ──");
  const prevAllow = process.env.VRAELIS_API_RUNTIME_BETA, prevEnabled = process.env.VRAELIS_API_RUNTIME_BETA_ENABLED;
  delete process.env.VRAELIS_API_RUNTIME_BETA; delete process.env.VRAELIS_API_RUNTIME_BETA_ENABLED;
  ok("apiRuntimeBetaAllowed is FALSE with no allowlist env", apiRuntimeBetaAllowed("a@b.com") === false);
  ok("apiRuntimeEnabled is FALSE with no env", apiRuntimeEnabled() === false);
  ok("apiRuntimeBetaAllowed is FALSE for null/empty email", apiRuntimeBetaAllowed(null) === false && apiRuntimeBetaAllowed("") === false);
  process.env.VRAELIS_API_RUNTIME_BETA = "Steve@x.com , amy@y.com";
  ok("allowlisted email matches (case-insensitive, trimmed)", apiRuntimeBetaAllowed("steve@x.com") === true && apiRuntimeBetaAllowed("  AMY@y.com ") === true);
  ok("a NON-allowlisted email is rejected", apiRuntimeBetaAllowed("mallory@x.com") === false);
  ok("a SUBSTRING of an allowlisted email is rejected (eve !~ steve)", apiRuntimeBetaAllowed("eve@x.com") === false);
  process.env.VRAELIS_API_RUNTIME_BETA_ENABLED = "1";
  ok("apiRuntimeEnabled true only at =1", apiRuntimeEnabled() === true);

  console.log("\n── the customer vocabulary contains NO internal names or fixture terms ──");
  const actionsBlob = JSON.stringify([...API_FLOW_ACTIONS, ...Object.values(API_ACTION_LABELS)]).toLowerCase();
  ok("no internal ApiStep name or fixture term in action ids/labels",
    FORBIDDEN.every((t) => !actionsBlob.includes(t.toLowerCase())), FORBIDDEN.filter((t) => actionsBlob.includes(t.toLowerCase())).join(", "));
  ok("every action has a plain-English label", API_FLOW_ACTIONS.every((a) => (API_ACTION_LABELS as Record<string, string>)[a]?.length > 0));

  console.log("\n── validation: a well-formed API flow is accepted + normalized ──");
  const good: unknown[] = [
    { action: "sign_in", credentialLabel: "API token" },
    { action: "call", method: "post", path: "/projects", body: '{"name":"x"}' },
    { action: "expect_status", status: 201 },
    { action: "save_value", field: "$.id", into: "PID" },
    { action: "confirm_saved", path: "/projects/x", field: "persisted", value: "true" },
  ];
  const v = validateApiSteps(good, { credentialLabels: ["API token"] });
  ok("valid flow accepted", v.ok === true);
  if (v.ok) {
    ok("method is upper-cased on normalize", v.steps[1].method === "POST");
    ok("apiFlowRequiresAuth detects the sign_in step", apiFlowRequiresAuth(v.steps) === true);
    ok("apiFlowCredentials returns the label", apiFlowCredentials(v.steps).join() === "API token");
  }

  console.log("\n── credential-shape guard: a recognized credential can never be typed into a step ──");
  // The guard rejects every RECOGNIZED credential shape (Stripe/GitHub/JWT/AWS/PEM/password=). Opaque
  // tokens with no recognizable shape are an inherent limit of shape detection (same as the web flow editor);
  // the real defense for those is the vault + execution-time evidence masking (adapter SECRET_JSON_KEYS +
  // growing secretValues), asserted in the canary suite. Here we prove the recognized shapes are stopped.
  for (const secret of [
    "sk_live_abcdefgh12345678", "ghp_abcdefghijklmnopqrstuvwxyz1234",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0", "AKIAIOSFODNN7EXAMPLE", "password: hunter2",
  ]) {
    ok(`a ${secret.slice(0, 10)}...-shaped value is REJECTED in a step field`,
      validateApiSteps([{ action: "add_header", name: "Authorization", value: secret }], { credentialLabels: [] }).ok === false);
  }

  console.log("\n── validation rejects malformed / unsafe steps ──");
  ok("unknown action rejected", validateApiSteps([{ action: "delete_database" }], { credentialLabels: [] }).ok === false);
  ok("sign_in with unknown credential label rejected", validateApiSteps([{ action: "sign_in", credentialLabel: "nope" }], { credentialLabels: ["real"] }).ok === false);
  ok("call to a full URL (other origin) rejected", validateApiSteps([{ action: "call", method: "GET", path: "https://evil.example/x" }], { credentialLabels: [] }).ok === false);
  ok("call to a protocol-relative path rejected", validateApiSteps([{ action: "call", method: "GET", path: "//evil.example/x" }], { credentialLabels: [] }).ok === false);
  ok("invalid JSON body rejected", validateApiSteps([{ action: "call", method: "POST", path: "/x", body: "{not json" }], { credentialLabels: [] }).ok === false);
  ok("empty list rejected", validateApiSteps([], { credentialLabels: [] }).ok === false);
  ok("over-long list rejected", validateApiSteps(Array.from({ length: MAX_API_STEPS + 1 }, () => ({ action: "call", method: "GET", path: "/x" })), { credentialLabels: [] }).ok === false);
  ok("bad status code rejected", validateApiSteps([{ action: "expect_status", status: 42 }], { credentialLabels: [] }).ok === false);
  ok("save_value with a bad variable name rejected", validateApiSteps([{ action: "call", method: "GET", path: "/x" }, { action: "save_value", field: "$.id", into: "1-bad name!" }], { credentialLabels: [] }).ok === false);

  console.log("\n── launch-time translation to internal ApiStep (internal names appear ONLY here, never stored) ──");
  const resolver = (label: string): ResolvedCredential | null => label === "API token" ? { secretRef: "conn_123", scheme: "bearer" } : null;
  const steps = (validateApiSteps(good, { credentialLabels: ["API token"] }) as { ok: true; steps: ApiFlowStep[] }).steps;
  const mapped = steps.map((s) => mapToApiStep(s, resolver));
  ok("sign_in -> http_auth with the resolved secretRef (never the raw secret)",
    mapped[0]?.action === "http_auth" && (mapped[0] as { secretRef: string }).secretRef === "conn_123");
  ok("call -> http_request with parsed body", mapped[1]?.action === "http_request");
  ok("expect_status -> assert_status", mapped[2]?.action === "assert_status");
  ok("save_value -> extract with $-prefixed path", mapped[3]?.action === "extract" && (mapped[3] as { path: string }).path === "$.id");
  ok("confirm_saved -> verify_persisted with coerced boolean equals", mapped[4]?.action === "verify_persisted" && (mapped[4] as { equals: unknown }).equals === true);
  ok("an unresolvable credential maps to null (flow can't run with a missing credential)",
    mapToApiStep({ action: "sign_in", credentialLabel: "gone" }, resolver) === null);
  ok("the STORED step shape carries the customer vocabulary, never an internal action name",
    !FORBIDDEN.some((t) => JSON.stringify(steps).toLowerCase().includes(t.toLowerCase())));

  console.log("\n── source containment: api-steps.ts imports nothing from canary.ts ──");
  const src = readFileSync("lib/preflight/runtime/api-steps.ts", "utf8");
  ok("api-steps does not import canary internals", !/from "\.\/canary"/.test(src) && !src.includes("canary-fixture"));

  // restore
  if (prevAllow === undefined) delete process.env.VRAELIS_API_RUNTIME_BETA; else process.env.VRAELIS_API_RUNTIME_BETA = prevAllow;
  if (prevEnabled === undefined) delete process.env.VRAELIS_API_RUNTIME_BETA_ENABLED; else process.env.VRAELIS_API_RUNTIME_BETA_ENABLED = prevEnabled;
}

// ── executor: inline run -> terminal-state persistence, no-leak, refund logic (offline) ──────────────
async function executorTests() {
  const SECRET = "sk_live_customertoken12345678";   // a recognized shape, so we can assert it never persists
  let clockT = 1_752_000_000_000; const clock = () => (clockT += 5);

  // In-memory store recording everything for assertions.
  function memStore() {
    let seq = 0; const id = (p: string) => `${p}_${++seq}`;
    const runs: Record<string, unknown>[] = [], decisions: Record<string, unknown>[] = [], stepRows: Record<string, unknown>[] = [];
    const issues: { id: string; category: string | null; status: string }[] = [], ledger: Record<string, unknown>[] = [];
    const store: ApiRunStore = {
      async insertTerminalRun(r) { const row = { id: id("run"), ...r }; runs.push(row); return row.id; },
      async insertStepRows(runId, flows) { stepRows.push({ runId, flows }); },
      async insertDecision(r) { const row = { id: id("dec"), ...r }; decisions.push(row); return row.id; },
      async openIssues() { return issues.filter((i) => i.status === "open"); },
      async openIssue(r) { const row = { id: id("iss"), category: r.category, status: "open" }; issues.push(row); return row.id; },
      async resolveIssue(iid) { const i = issues.find((x) => x.id === iid); if (i) i.status = "resolved"; },
      async continueIssue() {},
      async recordUsage(owner, runId) { ledger.push({ runId }); },
    };
    return { store, runs, decisions, stepRows, issues, ledger };
  }
  const resolver: SecretResolver = (label) => label === "API token" ? { secretRef: "conn_9", scheme: "bearer", value: SECRET } : null;

  // A fixture fetcher: BROKEN mode 404s the read-back; FIXED persists. Echoes the token in a header + body so
  // the leak scan has something real to catch (the adapter must redact it).
  function fixture(mode: "broken" | "fixed"): ApiFetch {
    return async (url, init) => {
      const u = new URL(url);
      const path = u.pathname;
      if (path.endsWith("/login")) return { status: 200, headers: {}, text: JSON.stringify({ token: SECRET }) };
      if (path.endsWith("/projects") && init.method === "POST") return { status: 201, headers: {}, text: JSON.stringify({ id: "p1", persisted: mode === "fixed" }) };
      if (/\/projects\/p1/.test(path)) return mode === "broken" ? { status: 404, headers: {}, text: JSON.stringify({ error: "nf" }) } : { status: 200, headers: {}, text: JSON.stringify({ id: "p1", persisted: true }) };
      return { status: 404, headers: {}, text: "" };
    };
  }

  const flow: ApiCustomerFlow = {
    id: "flow_persist", name: "Projects persist", critical: true,
    steps: [
      { action: "sign_in", credentialLabel: "API token" },
      { action: "add_header", name: "Idempotency-Key", value: "k1" },
      { action: "call", method: "POST", path: "/projects", body: '{"name":"x"}' },
      { action: "expect_status", status: 201 },
      { action: "save_value", field: "$.id", into: "PID" },
      { action: "confirm_saved", path: "/projects/p1", field: "persisted", value: "true" },
    ],
  };

  console.log("\n── executor BROKEN: a real persistence failure -> BLOCKED, terminal-state, issue opened, billed ──");
  const m1 = memStore();
  const broken = await executeApiRun({ owner: "c@x.com", appId: "app1", targetId: "tgt1", buildId: "b1", baseUrl: "https://api.customer.test", flows: [flow], fullCoverage: true, creditsHeld: 1500, submissionId: "s1", fetcher: fixture("broken"), resolveSecret: resolver, store: m1.store, clock });
  ok("decision BLOCKED", broken.decision === "blocked", String(broken.decision));
  ok("run inserted TERMINAL (completed), never queued", m1.runs[0]?.state === "completed");
  ok("an issue was opened", broken.issues.opened.length === 1);
  ok("productive work -> hold KEPT (charged)", broken.chargedFullHold === true);
  ok("exactly one usage ledger row", m1.ledger.length === 1);
  ok("leak scan clean (token never in persisted evidence/summary)", broken.leakScan === "clean");
  ok("the raw secret is NOT in any persisted row",
    ![...m1.runs, ...m1.decisions, ...m1.stepRows].some((r) => JSON.stringify(r).includes(SECRET)));

  console.log("\n── executor FIXED: full pass -> READY ──");
  const m2 = memStore();
  const fixed = await executeApiRun({ owner: "c@x.com", appId: "app1", targetId: "tgt1", buildId: "b1", baseUrl: "https://api.customer.test", flows: [flow], fullCoverage: true, creditsHeld: 1500, submissionId: "s2", fetcher: fixture("fixed"), resolveSecret: resolver, store: m2.store, clock });
  ok("decision READY", fixed.decision === "ready", String(fixed.decision));
  ok("no issue opened on a clean pass", fixed.issues.opened.length === 0);

  console.log("\n── executor REPAIR: partial coverage never mints READY ──");
  const m3 = memStore();
  const repair = await executeApiRun({ owner: "c@x.com", appId: "app1", targetId: "tgt1", buildId: "b1", baseUrl: "https://api.customer.test", flows: [flow], fullCoverage: false, creditsHeld: 1500, submissionId: "s3", fetcher: fixture("fixed"), resolveSecret: resolver, store: m3.store, clock });
  ok("decision REPAIR_VERIFIED (partial coverage)", repair.decision === "repair_verified", String(repair.decision));

  console.log("\n── executor MISSING CREDENTIAL: no requests, REFUND, no bill ──");
  const m4 = memStore();
  const noCred = await executeApiRun({ owner: "c@x.com", appId: "app1", targetId: "tgt1", buildId: "b1", baseUrl: "https://api.customer.test", flows: [flow], fullCoverage: true, creditsHeld: 1500, submissionId: "s4", fetcher: fixture("fixed"), resolveSecret: () => null, store: m4.store, clock });
  ok("zero requests made (flow couldn't resolve its credential)", noCred.apiRequests === 0);
  ok("hold NOT kept -> route must REFUND", noCred.chargedFullHold === false);
  ok("no usage ledger row", m4.ledger.length === 0);
  ok("still terminal-state (never queued)", m4.runs[0]?.state === "completed");

  console.log("\n── executor INFRA: unreachable transport -> infra_failure, refund, no bill, no issue ──");
  const m5 = memStore();
  const infraFetcher: ApiFetch = async () => { const e = new Error("blocked") as Error & { transportKind?: string }; e.transportKind = "unreachable"; throw e; };
  const infra = await executeApiRun({ owner: "c@x.com", appId: "app1", targetId: "tgt1", buildId: "b1", baseUrl: "https://192.0.2.1", flows: [flow], fullCoverage: true, creditsHeld: 1500, submissionId: "s5", fetcher: infraFetcher, resolveSecret: resolver, store: m5.store, clock });
  ok("decision infra_failure", infra.decision === "infra_failure", String(infra.decision));
  ok("failureClass infra", infra.failureClass === "infra");
  ok("hold NOT kept (infra costs nothing) -> REFUND", infra.chargedFullHold === false);
  ok("no usage, no issue", m5.ledger.length === 0 && infra.issues.opened.length === 0);
  ok("run state failed (not a product BLOCKED)", m5.runs[0]?.state === "failed" && infra.decision !== "blocked");

  console.log("\n── executor source containment: imports engine primitives, NOT canary ──");
  const src = readFileSync("lib/preflight/runtime/api-executor.ts", "utf8");
  ok("api-executor imports api-adapter + decide, NOT canary", /from "\.\/api-adapter"/.test(src) && /from "\.\/decide"/.test(src) && !/from "\.\/canary"/.test(src));
}

async function run() {
  main();
  await executorTests();
  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail > 0) process.exit(1);
}
run();
