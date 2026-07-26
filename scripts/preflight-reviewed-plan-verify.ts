// Tests for lib/preflight/reviewed-plan.ts — the pure half of reviewed-plan binding: canonical hashing,
// deployment/claim fingerprints, role references, and the deterministic execution gate. No DB, no clock.
import {
  planHash, planRoleRefs, deploymentFingerprint, claimFingerprint, canonicalDeploymentUrl,
  evaluateForExecution, type StoredReviewedPlan, type ExecContext,
} from "../lib/preflight/reviewed-plan";
import type { PlannedVerification } from "../lib/preflight/verification-lane";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const NOW = Date.parse("2026-07-22T00:00:00Z");
const CLAIM = "A customer can upgrade to Pro, receive access immediately, and retain Pro after signing out and signing back in with the same account";
const REQS = [
  "A customer who completes checkout must be granted Pro access",
  "The account must show Pro after upgrading, and must still show Pro after signing out and signing back in with the same account",
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const s = (action: string, target?: string, extra: any = {}) => ({ action, target, ...extra });
// The complete, coverage-passing journey (purchase + persistence + identity via a sealed test account).
const STRONG_STEPS = [
  s("click", "Upgrade to Pro"), s("click", "Pay $20 and start Pro"), s("assert_visible", "Payment successful"),
  s("navigate", "/account"), s("assert_text", "Current plan", { expect: "Pro" }),
  s("reset_context"), s("sign_in_as", "customer"),
  s("navigate", "/account"), s("assert_text", "Current plan", { expect: "Pro" }),
];
const strongPlan = {
  requirements: REQS.map((text) => ({ text, category: "correctness", severity: "critical" })),
  flows: [{ name: "Upgrade and verify persistence", goal: "prove Pro persists", role: null, priority: "critical", steps: STRONG_STEPS }],
} as unknown as PlannedVerification;
// A weak plan that never asserts the entitlement on the account: fails execution coverage.
const weakPlan = {
  requirements: REQS.map((text) => ({ text, category: "correctness", severity: "critical" })),
  flows: [{ name: "Only looks at the account", goal: "x", role: null, priority: "critical", steps: [s("navigate", "/account"), s("assert_visible", "Pro")] }],
} as unknown as PlannedVerification;

const stored = (plan: PlannedVerification, over: Partial<StoredReviewedPlan> = {}): StoredReviewedPlan => ({
  id: "rvp_1", user_id: "owner@example.com",
  deployment_fp: deploymentFingerprint("https://app.example.com/"),
  claim_fp: claimFingerprint(CLAIM),
  plan_hash: planHash(plan),
  plan, role_refs: planRoleRefs(plan),
  approval_state: "approved", execution_state: "unconsumed",
  // An approved plan names its approver. Execution copies these onto every requirement row it writes, so a
  // fixture that omitted them would be modelling a plan that could not legally execute.
  approved_by: "reviewer@example.com", approved_at: new Date(NOW - 60e3).toISOString(),
  expires_at: new Date(NOW + 3600e3).toISOString(),
  ...over,
});
const ctx = (over: Partial<ExecContext> = {}): ExecContext => ({
  owner: "owner@example.com", deploymentUrl: "https://app.example.com", claim: CLAIM, availableRoles: ["customer"], nowMs: NOW, ...over,
});

console.log("── fingerprints canonicalize ──");
ok("deployment fp ignores trailing slash and host case", deploymentFingerprint("https://App.Example.com/") === deploymentFingerprint("https://app.example.com"));
ok("deployment fp ignores the fragment", deploymentFingerprint("https://app.example.com/x#section") === deploymentFingerprint("https://app.example.com/x"));
ok("deployment fp distinguishes a different path", deploymentFingerprint("https://app.example.com/a") !== deploymentFingerprint("https://app.example.com/b"));
ok("canonicalDeploymentUrl keeps the query", canonicalDeploymentUrl("https://app.example.com/x?a=1") === "https://app.example.com/x?a=1");
ok("claim fp collapses whitespace", claimFingerprint("a   b\n c") === claimFingerprint("a b c"));
ok("claim fp distinguishes a different claim", claimFingerprint(CLAIM) !== claimFingerprint("a different claim entirely here"));

console.log("\n── plan hash is stable, order-sensitive, and content-sensitive ──");
ok("same plan -> same hash", planHash(strongPlan) === planHash(strongPlan));
ok("a re-serialized deep copy hashes identically", planHash(JSON.parse(JSON.stringify(strongPlan))) === planHash(strongPlan));
ok("reordering steps changes the hash", (() => {
  const reordered = JSON.parse(JSON.stringify(strongPlan));
  reordered.flows[0].steps.reverse();
  return planHash(reordered) !== planHash(strongPlan);
})());
ok("changing an expected value changes the hash", (() => {
  const edited = JSON.parse(JSON.stringify(strongPlan));
  edited.flows[0].steps[4].expect = "Free";
  return planHash(edited) !== planHash(strongPlan);
})());
ok("adding a requirement changes the hash", (() => {
  const edited = JSON.parse(JSON.stringify(strongPlan));
  edited.requirements.push({ text: "another", category: "correctness", severity: "low" });
  return planHash(edited) !== planHash(strongPlan);
})());

console.log("\n── role references ──");
ok("role refs collect sign_in_as targets", JSON.stringify(planRoleRefs(strongPlan)) === JSON.stringify(["customer"]));
ok("role refs include a flow-level role, deduped and sorted", (() => {
  const p = JSON.parse(JSON.stringify(strongPlan));
  p.flows[0].role = "admin";
  return JSON.stringify(planRoleRefs(p)) === JSON.stringify(["admin", "customer"]);
})());

console.log("\n── execution gate: the happy path, then every refusal ──");
ok("approved + unchanged + coverage-passing -> ok", evaluateForExecution(stored(strongPlan), ctx()).ok === true);

const refusal = (v: ReturnType<typeof evaluateForExecution>) => (v.ok ? "" : v.code);
ok("wrong tenant -> not_found (never leaks existence)", refusal(evaluateForExecution(stored(strongPlan), ctx({ owner: "someone@else.com" }))) === "reviewed_plan_not_found");
ok("tampered plan (hash mismatch) -> integrity_error", refusal(evaluateForExecution(stored(strongPlan, { plan_hash: "deadbeef" }), ctx())) === "reviewed_plan_integrity_error");
ok("pending (not approved) -> reviewed_plan_pending", refusal(evaluateForExecution(stored(strongPlan, { approval_state: "pending" }), ctx())) === "reviewed_plan_pending");
ok("possession of the id is NOT approval (pending refused)", evaluateForExecution(stored(strongPlan, { approval_state: "pending" }), ctx()).ok === false);
ok("expired -> reviewed_plan_expired", refusal(evaluateForExecution(stored(strongPlan, { expires_at: new Date(NOW - 1000).toISOString() }), ctx())) === "reviewed_plan_expired");
ok("already consumed -> already_consumed", refusal(evaluateForExecution(stored(strongPlan, { execution_state: "consumed" }), ctx())) === "reviewed_plan_already_consumed");
ok("mid-consume (consuming) -> already_consumed", refusal(evaluateForExecution(stored(strongPlan, { execution_state: "consuming" }), ctx())) === "reviewed_plan_already_consumed");
ok("deployment changed -> deployment_changed", refusal(evaluateForExecution(stored(strongPlan), ctx({ deploymentUrl: "https://other.example.com" }))) === "reviewed_plan_deployment_changed");
ok("claim changed -> claim_changed", refusal(evaluateForExecution(stored(strongPlan), ctx({ claim: "A totally different claim about exports working" }))) === "reviewed_plan_claim_changed");
ok("required role no longer available -> credentials_changed", refusal(evaluateForExecution(stored(strongPlan), ctx({ availableRoles: [] }))) === "reviewed_plan_credentials_changed");
ok("coverage no longer passes -> coverage_regressed", refusal(evaluateForExecution(stored(weakPlan), ctx())) === "reviewed_plan_coverage_regressed");

console.log("\n── check ORDER: identity and integrity win over state and drift ──");
ok("wrong tenant beats every other problem", refusal(evaluateForExecution(stored(strongPlan, { approval_state: "pending", execution_state: "consumed", expires_at: new Date(NOW - 1).toISOString() }), ctx({ owner: "x@y.com" }))) === "reviewed_plan_not_found");
ok("pending beats expired (approval is checked before expiry)", refusal(evaluateForExecution(stored(strongPlan, { approval_state: "pending", expires_at: new Date(NOW - 1).toISOString() }), ctx())) === "reviewed_plan_pending");

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
