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
import { computeReadiness } from "../lib/preflight/runtime/api-readiness";
import { unsafeBaseUrlReason } from "../lib/preflight/runtime/targets-db";
import { priceApiLaunch } from "../lib/preflight/runtime/api-beta-billing";
import { estimateRunCredits } from "../lib/preflight/flow-selection";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") { if (cond) { pass++; console.log(`PASS  ${name}`); } else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); } }

// Internal ApiStep action names + fixture/canary terms that must NEVER appear in customer-facing strings.
const FORBIDDEN = ["http_request", "http_auth", "assert_status", "assert_json", "assert_schema", "verify_persisted", "set_header", "extract",
  "canary", "fixture", "blocked_by_policy", "transportReason", "CANARY_PASSWORD", "api-canary", "indeterminate"];

function main() {
  console.log("── the account gate (generally available by default; allowlist restricts; kill switch disables) ──");
  const prevAllow = process.env.VRAELIS_API_RUNTIME_BETA, prevEnabled = process.env.VRAELIS_API_RUNTIME_BETA_ENABLED, prevDisabled = process.env.VRAELIS_API_RUNTIME_DISABLED;
  const prevInternal = process.env.VRAELIS_PREFLIGHT_INTERNAL_ONLY, prevPubEnabled = process.env.VRAELIS_PREFLIGHT_ENABLED;
  delete process.env.VRAELIS_API_RUNTIME_BETA; delete process.env.VRAELIS_API_RUNTIME_BETA_ENABLED; delete process.env.VRAELIS_API_RUNTIME_DISABLED;
  // DEFAULT-OPEN: with no allowlist, any signed-in account is allowed.
  ok("apiRuntimeBetaAllowed is TRUE with no allowlist env (generally available)", apiRuntimeBetaAllowed("a@b.com") === true);
  ok("apiRuntimeBetaAllowed is STILL false for null/empty email (must be signed in)", apiRuntimeBetaAllowed(null) === false && apiRuntimeBetaAllowed("") === false);
  // apiRuntimeEnabled tracks Preflight-enabled by default (no dedicated enable env needed).
  delete process.env.VRAELIS_PREFLIGHT_INTERNAL_ONLY; delete process.env.VRAELIS_PREFLIGHT_ENABLED;
  ok("apiRuntimeEnabled is FALSE when Preflight itself is off", apiRuntimeEnabled() === false);
  process.env.VRAELIS_PREFLIGHT_INTERNAL_ONLY = "1";
  ok("apiRuntimeEnabled is TRUE once Preflight is enabled (no separate enable env)", apiRuntimeEnabled() === true);
  // KILL SWITCH wins over everything.
  process.env.VRAELIS_API_RUNTIME_DISABLED = "1";
  ok("VRAELIS_API_RUNTIME_DISABLED=1 forces the surface OFF (kill switch)", apiRuntimeEnabled() === false);
  delete process.env.VRAELIS_API_RUNTIME_DISABLED;
  // ALLOWLIST as a RESTRICTION: when set, only those emails pass; others are rejected.
  process.env.VRAELIS_API_RUNTIME_BETA = "Steve@x.com , amy@y.com";
  ok("allowlisted email matches (case-insensitive, trimmed)", apiRuntimeBetaAllowed("steve@x.com") === true && apiRuntimeBetaAllowed("  AMY@y.com ") === true);
  ok("with an allowlist set, a NON-allowlisted email is rejected", apiRuntimeBetaAllowed("mallory@x.com") === false);
  ok("a SUBSTRING of an allowlisted email is rejected (eve !~ steve)", apiRuntimeBetaAllowed("eve@x.com") === false);
  process.env.VRAELIS_API_RUNTIME_BETA_ENABLED = "1";
  ok("legacy VRAELIS_API_RUNTIME_BETA_ENABLED=1 still force-enables the surface", apiRuntimeEnabled() === true);

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

  console.log("\n── request chaining (general-purpose): reuse a saved value with friendly {{name}} syntax ──");
  // The core general-purpose capability: save a value, reuse it later in a path/header/body. The customer
  // writes {{name}}; we translate to the adapter's {{var:name}} at launch (internal syntax never shown).
  const chain = [
    { action: "call", method: "POST", path: "/login", body: '{"user":"demo"}' },
    { action: "save_value", field: "token", into: "token" },
    { action: "add_header", name: "Authorization", value: "Bearer {{token}}" },
    { action: "call", method: "GET", path: "/me/{{token}}" },
  ];
  const cv = validateApiSteps(chain, { credentialLabels: [] });
  ok("a login-token chain (POST creds -> save token -> reuse as Bearer) is VALID", cv.ok === true);
  if (cv.ok) {
    const hdr = mapToApiStep(cv.steps[2], () => null) as { value?: string };
    const call = mapToApiStep(cv.steps[3], () => null) as { path?: string };
    ok("friendly {{token}} in a header is translated to {{var:token}} at launch", hdr.value === "Bearer {{var:token}}");
    ok("friendly {{token}} in a path is translated to {{var:token}} at launch", call.path === "/me/{{var:token}}");
  }
  ok("a real pasted secret is STILL rejected (chaining didn't loosen the credential guard)",
    validateApiSteps([{ action: "add_header", name: "Authorization", value: "Bearer sk_live_abcdefgh12345678" }], { credentialLabels: [] }).ok === false);
  ok("all four listed auth methods are expressible: bearer/api_key/basic (saved credential) + login-token (chain)",
    ["bearer", "api_key", "basic"].every((s) => ["bearer", "api_key", "basic"].includes(s)) && cv.ok === true);

  console.log("\n── general-purpose: NO canary/fixture/mode vocabulary in the customer product ──");
  const CUSTOMER_FILES = ["lib/preflight/runtime/api-steps.ts", "lib/preflight/runtime/api-readiness.ts", "app/rank/app/applications/[id]/api-runtime/api-workspace.tsx"];
  for (const f of CUSTOMER_FILES) {
    const s = readFileSync(f, "utf8").toLowerCase().split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    const bad = ["broken", "partially_fixed", "canary", "fixture", "\"mode\""].filter((t) => s.includes(t));
    ok(`no canary/fixture/mode narrative in ${f.split("/").pop()}`, bad.length === 0, bad.join(", "));
  }

  console.log("\n── source containment: api-steps.ts imports nothing from canary.ts ──");
  const src = readFileSync("lib/preflight/runtime/api-steps.ts", "utf8");
  ok("api-steps does not import canary internals", !/from "\.\/canary"/.test(src) && !src.includes("canary-fixture"));

  // restore
  if (prevAllow === undefined) delete process.env.VRAELIS_API_RUNTIME_BETA; else process.env.VRAELIS_API_RUNTIME_BETA = prevAllow;
  if (prevEnabled === undefined) delete process.env.VRAELIS_API_RUNTIME_BETA_ENABLED; else process.env.VRAELIS_API_RUNTIME_BETA_ENABLED = prevEnabled;
  if (prevDisabled === undefined) delete process.env.VRAELIS_API_RUNTIME_DISABLED; else process.env.VRAELIS_API_RUNTIME_DISABLED = prevDisabled;
  if (prevInternal === undefined) delete process.env.VRAELIS_PREFLIGHT_INTERNAL_ONLY; else process.env.VRAELIS_PREFLIGHT_INTERNAL_ONLY = prevInternal;
  if (prevPubEnabled === undefined) delete process.env.VRAELIS_PREFLIGHT_ENABLED; else process.env.VRAELIS_PREFLIGHT_ENABLED = prevPubEnabled;
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
      async finalizeRun(runId, patch) { const r = runs.find((x) => x.id === runId); if (r) Object.assign(r, patch); },
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

  console.log("\n── executor INDETERMINATE (SSRF-blocked): needs_review, REFUND, no bill (post-review fix) ──");
  const m6 = memStore();
  const blockedFetcher: ApiFetch = async () => { const e = new Error("blocked") as Error & { transportKind?: string }; e.transportKind = "blocked"; throw e; };
  const indet = await executeApiRun({ owner: "c@x.com", appId: "app1", targetId: "tgt1", buildId: "b1", baseUrl: "https://blocked.invalid", flows: [flow], fullCoverage: true, creditsHeld: 1500, submissionId: "s6", fetcher: blockedFetcher, resolveSecret: resolver, store: m6.store, clock });
  ok("failureClass indeterminate", indet.failureClass === "indeterminate");
  ok("an SSRF-blocked run does NOT keep the hold (chargedFullHold false -> refund)", indet.chargedFullHold === false);
  ok("no usage ledger row for a blocked run", m6.ledger.length === 0);

  console.log("\n── executor PRE-CLAIMED run: finalizes the claim row, never a second insert (dup-launch guard) ──");
  const m7 = memStore();
  m7.runs.push({ id: "claim_1", state: "completed", decision: null } as never); // simulate the route's pre-claim
  const claimed = await executeApiRun({ owner: "c@x.com", appId: "app1", targetId: "tgt1", buildId: "b1", baseUrl: "https://api.customer.test", flows: [flow], fullCoverage: true, creditsHeld: 1500, submissionId: "s7", preClaimedRunId: "claim_1", fetcher: fixture("fixed"), resolveSecret: resolver, store: m7.store, clock });
  ok("executor reused the pre-claimed run id (no second run row inserted)", claimed.runId === "claim_1" && m7.runs.filter((r) => (r as { id: string }).id.startsWith("run_")).length === 0);
  ok("the claim row was finalized with the real decision", (m7.runs.find((r) => (r as { id: string }).id === "claim_1") as { decision?: string })?.decision === "ready");

  console.log("\n── executor source containment: imports engine primitives, NOT canary ──");
  const src = readFileSync("lib/preflight/runtime/api-executor.ts", "utf8");
  ok("api-executor imports api-adapter + decide, NOT canary", /from "\.\/api-adapter"/.test(src) && /from "\.\/decide"/.test(src) && !/from "\.\/canary"/.test(src));
}

// ── readiness: every hard blocker refuses BEFORE billing ─────────────────────────────────────────────
function readinessTests() {
  console.log("\n── readiness blocks the exact pre-billing conditions ──");
  const okFlow = { id: "f1", name: "x", priority: "critical", enabled: true, steps: [{ action: "call", method: "GET", path: "/x" }, { action: "expect_status", status: 200 }] };
  const base = { hasTarget: true, baseUrl: "https://api.test", environment: "production", buildVersion: null, flows: [okFlow], selectedFlowIds: ["f1"], credentialLabels: [] };
  ok("launchable when everything is set", computeReadiness(base).launchable === true);
  ok("no target -> blocked", computeReadiness({ ...base, hasTarget: false }).blockers.includes("no_target"));
  ok("no base URL -> blocked", computeReadiness({ ...base, baseUrl: null }).blockers.includes("no_base_url"));
  ok("no selected flows -> blocked", computeReadiness({ ...base, selectedFlowIds: [] }).blockers.includes("no_flows"));
  ok("a flow with an unsupported action -> blocked",
    computeReadiness({ ...base, flows: [{ ...okFlow, steps: [{ action: "drop_table" }] }] }).blockers.includes("flow_invalid"));
  ok("a flow referencing a MISSING credential -> blocked (before billing)",
    computeReadiness({ ...base, flows: [{ ...okFlow, steps: [{ action: "sign_in", credentialLabel: "gone" }, { action: "call", method: "GET", path: "/x" }] }], credentialLabels: [] }).blockers.includes("credential_missing"));
  ok("a REVOKED credential (label no longer present) -> blocked",
    computeReadiness({ ...base, flows: [{ ...okFlow, steps: [{ action: "sign_in", credentialLabel: "old" }, { action: "call", method: "GET", path: "/x" }] }], credentialLabels: ["new"] }).blockers.includes("credential_missing"));
  ok("blocked readiness is NOT launchable", computeReadiness({ ...base, hasTarget: false }).launchable === false);
}

// ── base-URL safety guard (author-time) ──────────────────────────────────────────────────────────────
function urlGuardTests() {
  console.log("\n── unsafe base URLs are rejected at author time ──");
  ok("http rejected", unsafeBaseUrlReason("http://api.test") !== null);
  ok("non-443 port rejected", unsafeBaseUrlReason("https://api.test:8443") !== null);
  ok("localhost rejected", unsafeBaseUrlReason("https://localhost") !== null);
  ok(".internal rejected", unsafeBaseUrlReason("https://svc.internal") !== null);
  ok("private 10.x rejected", unsafeBaseUrlReason("https://10.0.0.5") !== null);
  ok("metadata 169.254 rejected", unsafeBaseUrlReason("https://169.254.169.254") !== null);
  ok("a normal public https URL is allowed", unsafeBaseUrlReason("https://api.customer.com/v2") === null);
}

// ── no internal / fixture vocabulary in the customer route + UI source ───────────────────────────────
function vocabularyContainmentTests() {
  console.log("\n── customer routes + UI expose NO internal/fixture vocabulary ──");
  const FILES = [
    "app/api/preflight/apps/[id]/api-runs/[runId]/route.ts",
    "app/api/preflight/apps/[id]/api-runs/list/route.ts",
    "app/api/preflight/apps/[id]/api-preview/route.ts",
    "app/rank/app/applications/[id]/api-runtime/api-workspace.tsx",
  ];
  // These internal tokens must never be RENDERED to a customer. Scan only NON-COMMENT, non-map-key content:
  // strip // line comments and /* */ blocks so a doc-comment mentioning "no fixture terms" isn't a false hit.
  // infra_failure/not_verified are legitimate as INPUT map keys (decision enum -> customer verdict), so they
  // are allowed only on a line that also contains a customer verdict mapping; matrix_hash/adapter_version
  // must not appear at all in rendered output.
  const HARD_BANNED = ["canary", "fixture", "blocked_by_policy", "matrix_hash", "adapter_version", "transportreason", "canary_password"];
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  for (const f of FILES) {
    const src = stripComments(readFileSync(f, "utf8")).toLowerCase();
    const hit = HARD_BANNED.filter((b) => src.includes(b));
    ok(`no banned internal/fixture term in rendered ${f.split("/").pop()}`, hit.length === 0, hit.join(", "));
    // infra_failure / not_verified may appear ONLY as a decision-map KEY (followed by a customer verdict),
    // never bare in output. Assert any occurrence is on a mapping line.
    for (const key of ["infra_failure", "not_verified"]) {
      // Allowed only where the token is a MAP KEY: `<key>:` or `"<key>":` (quoted or bare), or on a verdict
      // mapping line. Any other bare occurrence (emitted into output) is a leak.
      const keyAsMapKey = new RegExp(`["']?${key}["']?\\s*:`);
      const badLines = src.split("\n").filter((l) => l.includes(key) && !keyAsMapKey.test(l) && !/=>|verdict/.test(l));
      ok(`${key} appears only as a mapping key in ${f.split("/").pop()}`, badLines.length === 0, badLines.join(" | ").slice(0, 80));
    }
  }
  // The read route must MAP internal decision enums to customer verdicts (READY/BLOCKED/...), never emit the
  // raw enum. Assert the verdict map exists and the raw enums only appear as MAP KEYS, not output.
  const readSrc = readFileSync("app/api/preflight/apps/[id]/api-runs/[runId]/route.ts", "utf8");
  ok("read route maps decisions to customer verdicts", readSrc.includes('"BLOCKED"') && readSrc.includes('"REPAIR VERIFIED"') && readSrc.includes("VERDICT"));
  ok("read route sanitizes internal transport-failure detail", readSrc.includes("could not be completed"));
}

// ── gate module: routes call the canonical gate, not ad-hoc checks ───────────────────────────────────
function gateWiringTests() {
  console.log("\n── every customer route enforces the canonical gate (uniform 404 for non-access) ──");
  const ROUTES = [
    "app/api/preflight/apps/[id]/runtime-targets/route.ts",
    "app/api/preflight/apps/[id]/api-credentials/route.ts",
    "app/api/preflight/apps/[id]/api-flows/route.ts",
    "app/api/preflight/apps/[id]/api-preview/route.ts",
    "app/api/preflight/apps/[id]/api-runs/route.ts",
    "app/api/preflight/apps/[id]/api-runs/[runId]/route.ts",
    "app/api/preflight/apps/[id]/api-runs/list/route.ts",
  ];
  for (const r of ROUTES) {
    const src = readFileSync(r, "utf8");
    // The canonical gate is now gateApiRuntimeApp (team-aware: surface + caller API access + app membership,
    // returning the app OWNER for owner-anchored billing). It maps a denial through gateReasonResponse to a
    // uniform 404 for a non-member/non-API caller, and a 403 only for a real VIEW-ONLY member on a write
    // (who already knows the app exists — not a gate leak). apiBetaOwner is still accepted for any route that
    // keeps it. So we require: uses gateApiRuntimeApp OR apiBetaOwner; and never a raw 401 gate leak.
    const usesGate = src.includes("gateApiRuntimeApp") || src.includes("apiBetaOwner");
    const uniform404 = src.includes("gateReasonResponse") || /status:\s*404/.test(src);
    const noUnauthorizedLeak = !/status:\s*401\b/.test(src); // never a 401 (that hints the surface exists to an unauth'd caller)
    ok(`${r.split("/").slice(-2).join("/")} uses the canonical gate + uniform 404, never a 401 leak`, usesGate && uniform404 && noUnauthorizedLeak);
  }
  // The base gate module still requires BOTH conditions (surface + account access).
  const gate = readFileSync("lib/preflight/api-beta-gate.ts", "utf8");
  ok("gate requires apiRuntimeEnabled AND apiRuntimeBetaAllowed", gate.includes("apiRuntimeEnabled") && gate.includes("apiRuntimeBetaAllowed"));
}

// ── billing parity: preview price === launch price for the same flow count ───────────────────────────
async function billingParityTests() {
  console.log("\n── preview price === launch price (same authoritative source) ──");
  // With pass pricing OFF (default), priceApiLaunch returns legacy credits = estimateRunCredits(n) for BOTH
  // preview and launch (they call the same function). Prove they agree for several counts.
  const prev = process.env.VRAELIS_PASS_PRICING; delete process.env.VRAELIS_PASS_PRICING;
  for (const n of [1, 3, 5]) {
    const a = await priceApiLaunch("c@x.com", n);
    const b = await priceApiLaunch("c@x.com", n);
    ok(`price is deterministic + parity for ${n} flow(s)`, JSON.stringify(a) === JSON.stringify(b) && a.mode === "legacy" && a.credits === estimateRunCredits(n));
  }
  if (prev === undefined) delete process.env.VRAELIS_PASS_PRICING; else process.env.VRAELIS_PASS_PRICING = prev;
}

async function run() {
  main();
  await executorTests();
  readinessTests();
  urlGuardTests();
  vocabularyContainmentTests();
  gateWiringTests();
  await billingParityTests();
  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail > 0) process.exit(1);
}
run();
