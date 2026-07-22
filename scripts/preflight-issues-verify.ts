// Tests for lib/preflight/issues.ts — deterministic issue generation from failed flow steps. Pure.
import { issuesFromRun } from "../lib/preflight/issues";
import type { FlowResult, FlowSpec, StepObservation } from "../worker/preflight/types";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const step = (action: string, ok_: boolean, over: Partial<StepObservation> = {}): StepObservation => ({ action: action as StepObservation["action"], ok: ok_, detail: over.detail ?? (ok_ ? "ok" : "assertion_failed"), ms: 1, ...over });

const persistFlow: FlowSpec = { flowId: "f-persist", name: "Create and persist a project", priority: "critical", destructiveAllowed: false, maxMs: 60000, steps: [
  { action: "navigate", target: "https://fixture/projects" }, { action: "fill", target: "Project name", value: "Vraelis Fixture Project" }, { action: "click", target: "Create project" }, { action: "assert_visible", target: "Vraelis Fixture Project" }, { action: "refresh" }, { action: "assert_visible", target: "Vraelis Fixture Project" },
] };
const mobileFlow: FlowSpec = { flowId: "f-mobile", name: "Mobile navigation does not block the primary action", priority: "critical", destructiveAllowed: false, maxMs: 60000, steps: [{ action: "navigate", target: "https://fixture/projects" }, { action: "click", target: "Create project" }] };
const passFlow: FlowSpec = { flowId: "f-auth", name: "User signs in", priority: "critical", destructiveAllowed: false, maxMs: 60000, steps: [{ action: "navigate", target: "https://fixture/login" }, { action: "assert_visible", target: "Your projects" }] };
const importantFlow: FlowSpec = { flowId: "f-search", name: "Search returns results", priority: "important", destructiveAllowed: false, maxMs: 60000, steps: [{ action: "navigate", target: "/s" }, { action: "assert_text", target: "results" }] };

const results: FlowResult[] = [
  { flowId: "f-persist", state: "failed", steps: [step("navigate", true, { url: "https://fixture/projects" }), step("fill", true), step("click", true), step("assert_visible", true), step("refresh", true), step("assert_visible", false, { detail: "not_visible", url: "https://fixture/projects" })], evidence: { consoleErrors: ["TypeError: cannot read x"], networkFailures: [{ method: "GET", path: "/api/projects", status: 200 }] } },
  { flowId: "f-mobile", state: "failed", steps: [step("navigate", true), step("click", false, { detail: "target_not_found: obscured" })], evidence: { consoleErrors: [], networkFailures: [] } },
  { flowId: "f-auth", state: "passed", steps: [step("navigate", true), step("assert_visible", true)] },
  { flowId: "f-search", state: "failed", steps: [step("navigate", true), step("assert_text", false, { detail: "text_absent" })], evidence: { consoleErrors: [], networkFailures: [] } },
];

const issues = issuesFromRun(results, [persistFlow, mobileFlow, passFlow, importantFlow], { "f-persist": ["Project data persists after refresh"] });

ok("one issue per FAILED flow (3), none for passed", issues.length === 3);
const persist = issues.find((i) => i.category === "persistence_failure");
ok("refresh-then-assert-fail -> persistence_failure (critical)", !!persist && persist.severity === "critical");
ok("persistence issue has the observational title", persist?.title === "Expected content was not visible after a refresh");
ok("persistence issue carries requirement refs", persist?.requirement_refs.includes("Project data persists after refresh") === true);
ok("persistence issue has deterministic repro steps", (persist?.repro.length ?? 0) === persistFlow.steps.length && persist!.repro[0].startsWith("1."));
ok("persistence issue captures console evidence", (persist?.evidence.console_errors.length ?? 0) >= 1);
ok("mobile flow -> mobile_blocker", issues.some((i) => i.category === "mobile_blocker" && i.severity === "critical"));
ok("important failed flow -> high (not critical)", issues.some((i) => i.requirement_refs.length === 0 && i.severity === "high" && i.category === "functional_failure"));
ok("passed flow generates NO issue", !issues.some((i) => i.title.includes("signs in")));
ok("sorted most-severe first (criticals before high)", issues[0].severity === "critical" && issues[issues.length - 1].severity === "high");
ok("no AI likely_cause is asserted as fact (issue has none)", issues.every((i) => !("likely_cause" in i)));

// The checkout entitlement shape from the real paid run: a success was confirmed, then the plan VALUE
// assertion failed. The finding must name the value (Pro), not the label (Plan), and classify as a success
// that did not deliver the outcome. This is the regression for the misleading "Expected: Plan / text_absent".
const payFlow: FlowSpec = { flowId: "f-pay", name: "Upgrade to Pro and confirm Pro on the account", priority: "critical", destructiveAllowed: false, maxMs: 60000, steps: [
  { action: "navigate", target: "/pricing.html" }, { action: "click", target: "Get Pro" }, { action: "click", target: "Pay" },
  { action: "assert_visible", target: "checkout success" }, { action: "navigate", target: "/account.html" },
  { action: "assert_text", target: "Plan", expect: "Pro" },
] };
const payResult: FlowResult = { flowId: "f-pay", state: "failed", steps: [
  step("navigate", true), step("click", true), step("click", true),
  step("assert_visible", true, { target: "checkout success", detail: "visible" }),
  step("navigate", true, { url: "https://broken-checkout.example/account.html" }),
  step("assert_text", false, { target: "Plan", detail: "text_absent", url: "https://broken-checkout.example/account.html" }),
], evidence: { consoleErrors: [], networkFailures: [] } };
const pay = issuesFromRun([payResult], [payFlow])[0];
ok("checkout entitlement failure -> fake_success", pay?.category === "fake_success");
ok("fake_success carries the success-but-missing title", pay?.title === "A success message appeared, but the expected result was not visible afterwards");
ok("expected names the VALUE Pro, not the label Plan", /"Pro"/.test(pay?.expected ?? "") && (pay?.expected ?? "").includes("Plan to show"));
ok("observed says the value was not present, not a raw code", /"Pro" was not present/.test(pay?.observed ?? "") && !/text_absent/.test(pay?.observed ?? ""));
ok("repro reads the value, Confirm Plan shows Pro", (pay?.repro ?? []).some((r) => r.includes('Confirm Plan shows "Pro"')));

// ── Persistence vs authorization must stay distinct (regression for the "across" -> cross_account mislabel) ──
// The vrf_3fad10f5 shape: Pro is asserted after checkout (passes), the session is reset, the SAME account
// signs back in, and the second plan assertion fails. The flow name contains "across", which must NOT be read
// as "cross" -> access restriction. This is a retention failure for one identity.
const retainFlow: FlowSpec = { flowId: "f-retain", name: "Upgrade to Pro and verify Pro persists across sign out and sign back in", priority: "critical", destructiveAllowed: false, maxMs: 60000, steps: [
  { action: "navigate", target: "/pricing.html" }, { action: "click", target: "Get Pro" }, { action: "click", target: "Pay" },
  { action: "navigate", target: "/account.html" }, { action: "assert_text", target: "Plan", expect: "Pro" },
  { action: "reset_context" }, { action: "navigate", target: "/signin.html" }, { action: "sign_in_as", target: "customer" },
  { action: "verify_authenticated" }, { action: "navigate", target: "/account.html" }, { action: "assert_text", target: "Plan", expect: "Pro" },
] };
const retainResult: FlowResult = { flowId: "f-retain", state: "failed", steps: [
  step("navigate", true), step("click", true), step("click", true),
  step("navigate", true), step("assert_text", true, { target: "Plan" }),
  step("reset_context", true), step("navigate", true), step("sign_in_as", true),
  step("verify_authenticated", true), step("navigate", true),
  step("assert_text", false, { target: "Plan", detail: "text_absent" }),
], evidence: { consoleErrors: [], networkFailures: [] } };
const retain = issuesFromRun([retainResult], [retainFlow], { "f-retain": ["Pro status must be retained for the same customer identity across sign-out and sign-in sessions"] })[0];
ok("persistence across sign-in -> retention_failure", retain?.category === "retention_failure");
ok("retention is NOT an access-restriction finding", retain?.category !== "cross_account" && retain?.category !== "authorization_failure");
ok("retention title names signing back in, not access restriction", retain?.title === "Expected access did not persist after signing back in");
ok("retention expected/observed still name the value Pro", /"Pro"/.test(retain?.expected ?? "") && /"Pro" was not present/.test(retain?.observed ?? ""));

// A GENUINE access-restriction failure must still classify as one, so the two never collapse together:
// a free account reaches an admin-only surface (negative assertion fails).
const authzFlow: FlowSpec = { flowId: "f-authz", name: "A free account must not access Pro-only admin settings", priority: "critical", destructiveAllowed: false, maxMs: 60000, steps: [
  { action: "navigate", target: "/signin.html" }, { action: "sign_in_as", target: "freeuser" },
  { action: "navigate", target: "/admin.html" }, { action: "verify_unauthorized", target: "admin" },
] };
const authzResult: FlowResult = { flowId: "f-authz", state: "failed", steps: [
  step("navigate", true), step("sign_in_as", true), step("navigate", true),
  step("verify_unauthorized", false, { detail: "was_authorized" }),
], evidence: { consoleErrors: [], networkFailures: [] } };
const authz = issuesFromRun([authzResult], [authzFlow], { "f-authz": ["Pro-only admin settings must be restricted; a free account must not access them"] })[0];
ok("restriction obligation + negative assert -> authorization_failure", authz?.category === "authorization_failure");
ok("authorization stays distinct from retention", authz?.category !== "retention_failure");

// Two DISTINCT actors + a restriction obligation -> cross_account (not retention, despite the re-sign-in).
const crossFlow: FlowSpec = { flowId: "f-cross", name: "One customer must not see another customer's notebooks", priority: "critical", destructiveAllowed: false, maxMs: 60000, steps: [
  { action: "sign_in_as", target: "alice" }, { action: "navigate", target: "/n/42" }, { action: "new_context" },
  { action: "sign_in_as", target: "bob" }, { action: "navigate", target: "/n/42" }, { action: "assert_visible", target: "Alice private note" },
] };
const crossResult: FlowResult = { flowId: "f-cross", state: "failed", steps: [
  step("sign_in_as", true), step("navigate", true), step("new_context", true),
  step("sign_in_as", true), step("navigate", true), step("assert_visible", false, { detail: "unexpectedly_visible" }),
], evidence: { consoleErrors: [], networkFailures: [] } };
const cross = issuesFromRun([crossResult], [crossFlow], { "f-cross": ["A customer must not access another customer's notebooks"] })[0];
ok("two distinct actors + restriction obligation -> cross_account", cross?.category === "cross_account");
ok("cross_account is not misread as retention despite the second sign-in", cross?.category !== "retention_failure");

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
