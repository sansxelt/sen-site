// API beta customer-surface safety proof — pure/offline (no network, no DB, no spend). Grows as the beta
// surfaces land. Phase 1: the account gate + the customer step vocabulary (validation, credential-shape
// guard, internal-name containment, launch-time translation).

import { apiRuntimeBetaAllowed } from "../lib/v-entitlements";
import { apiRuntimeEnabled } from "../lib/v-preflight-flags";
import {
  validateApiSteps, mapToApiStep, apiFlowRequiresAuth, apiFlowCredentials,
  API_FLOW_ACTIONS, API_ACTION_LABELS, MAX_API_STEPS, type ApiFlowStep, type ResolvedCredential,
} from "../lib/preflight/runtime/api-steps";
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

  console.log(`\n${pass}/${pass + fail} passed`);
  if (fail > 0) process.exit(1);
}
main();
