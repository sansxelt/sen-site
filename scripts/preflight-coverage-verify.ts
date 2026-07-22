// Claim coverage + execution coverage: the two gates that must both pass before a paid browser run.
//
// The property under test, across many claims: a strong REQUIREMENT with weak EXECUTION is rejected, a weak
// requirement is rejected, and only strong requirements with a complete executable path are accepted. This
// is the safeguard the first production run needed — it preserved the Pro persistence requirement but never
// built a flow that paid, checked the account, signed out, signed back in, and asserted Pro again.
import {
  analyzeClaim, checkClaimCoverage, checkExecutionCoverage, coverageReport, classifyStep,
  type StepLite, type FlowLite,
} from "../lib/preflight/coverage";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

// Tiny step builders so the flows read like journeys.
const nav = (t: string): StepLite => ({ action: "navigate", target: t });
const click = (t: string): StepLite => ({ action: "click", target: t });
const fill = (t: string, v: string): StepLite => ({ action: "fill", target: t, value: v });
const assertText = (t: string, e: string): StepLite => ({ action: "assert_text", target: t, expect: e });
const assertVisible = (t: string): StepLite => ({ action: "assert_visible", target: t });
const refresh = (): StepLite => ({ action: "refresh" });
const flow = (...steps: StepLite[]): FlowLite => ({ steps });

const FIXTURE_CLAIM = "A customer can upgrade to Pro, receive access immediately, and retain Pro after signing out and signing back in with the same account";

console.log("── the claim is understood ──");
{
  const a = analyzeClaim(FIXTURE_CLAIM);
  ok("the named value Pro is extracted", a.namedValues.map((v) => v.toLowerCase()).includes("pro"));
  ok("persistence is detected (retain / after signing back in)", a.persistence);
  ok("the same-identity condition is detected", a.identity);
  ok("an action is detected (upgrade / pay)", a.hasAction);
}

console.log("\n── step classification distinguishes navigation, action, assertion, sign-in/out ──");
ok("assert_text is an assertion", classifyStep(assertText("plan", "Pro")) === "assert");
ok("a click on Upgrade to Pro is a purchase action", classifyStep(click("Upgrade to Pro")) === "purchase");
ok("a click on Pay is a purchase action", classifyStep(click("Pay $20 and start Pro")) === "purchase");
ok("a click on Sign out is a sign-out", classifyStep(click("Sign out")) === "signout");
ok("a click on Sign in is a sign-in", classifyStep(click("Sign in")) === "signin");
ok("a plain navigate is navigation", classifyStep(nav("/account")) === "navigate");

console.log("\n── CLAIM COVERAGE: the requirement set must preserve the claim ──");
const STRONG_REQS = [
  "A customer who completes checkout must be granted Pro access",
  "The account must show Pro after upgrading, and must still show Pro after signing out and signing back in with the same account",
];
const WEAK_REQS = [
  "The account page must display the current plan",
  "Users must be able to sign in with email and password",
];
ok("strong requirements cover the claim", checkClaimCoverage(FIXTURE_CLAIM, STRONG_REQS).ok);
ok("weak requirements are rejected: Pro is dropped", (() => {
  const c = checkClaimCoverage(FIXTURE_CLAIM, WEAK_REQS);
  return !c.ok && c.missing.some((m) => /"Pro"/.test(m));
})());
// The actual production run's requirement 1 WAS strong. Claim coverage must recognize that, not over-reject.
const REAL_RUN_REQS = [
  "A customer who purchases Pro access must retain Pro status after signing out and signing in again in the same session or across new sessions",
  "The account page must display the current plan status",
];
ok("a strong requirement passes even when a broader one sits beside it (the real run's set)",
  checkClaimCoverage(FIXTURE_CLAIM, REAL_RUN_REQS).ok);

console.log("\n── EXECUTION COVERAGE: a runnable flow must actually prove it ──");
// The complete journey: pay, check the account shows Pro, sign out, sign back in, check Pro again.
const completePlan = [flow(
  nav("/"), click("Upgrade to Pro"), click("Pay $20 and start Pro"),
  nav("/account"), assertText("plan", "Pro"),
  click("Sign out"), nav("/signin"), fill("Email", "demo@example.com"), click("Sign in"),
  nav("/account"), assertText("plan", "Pro"),
)];
ok("the complete pay-to-entitlement-and-back journey passes", checkExecutionCoverage(FIXTURE_CLAIM, completePlan).ok);

// Weak execution 1: stops at the checkout success page. Vraelis' actual first run effectively did this.
const stopsAtCheckout = [flow(
  nav("/"), click("Upgrade to Pro"), click("Pay $20 and start Pro"), assertVisible("Payment successful"),
)];
ok("a plan that stops at checkout success is rejected (never asserts Pro)", !checkExecutionCoverage(FIXTURE_CLAIM, stopsAtCheckout).ok);

// Weak execution 2: only checks that a plan label is present, never the specific value.
const onlyDisplaysPlan = [flow(nav("/account"), assertVisible("Current plan"))];
ok("a plan that only checks 'displays a plan' is rejected (no Pro assertion)", !checkExecutionCoverage(FIXTURE_CLAIM, onlyDisplaysPlan).ok);

// Weak execution 3: signs back in but never checks Pro afterward.
const signsBackNoCheck = [flow(
  click("Upgrade to Pro"), click("Pay"), nav("/account"), assertText("plan", "Pro"),
  click("Sign out"), nav("/signin"), click("Sign in"), nav("/account"),
)];
ok("a plan that signs back in but never re-checks Pro is rejected (persistence unproven)",
  (() => { const c = checkExecutionCoverage(FIXTURE_CLAIM, signsBackNoCheck); return !c.ok && c.missing.some((m) => /signing back in/i.test(m)); })());

// Weak execution 4: asserts Pro but only BEFORE paying.
const assertsBeforePaying = [flow(
  nav("/pricing"), assertText("plan", "Pro"), click("Upgrade to Pro"), click("Pay"),
)];
ok("a plan that asserts Pro only before the action is rejected", !checkExecutionCoverage(FIXTURE_CLAIM, assertsBeforePaying).ok);

console.log("\n── the combined gate ──");
ok("strong requirements + complete execution => ready to launch",
  coverageReport(FIXTURE_CLAIM, STRONG_REQS, completePlan).readyToLaunch);
ok("strong requirements + weak execution => NOT ready (this is exactly what happened)",
  !coverageReport(FIXTURE_CLAIM, STRONG_REQS, stopsAtCheckout).readyToLaunch);
ok("weak requirements + complete execution => NOT ready",
  !coverageReport(FIXTURE_CLAIM, WEAK_REQS, completePlan).readyToLaunch);

console.log("\n── broader cases, so the gate is not fixture-specific ──");
// Email change persists after reload. No lexicon value; the persistence boundary is a reload.
{
  const claim = "A user changes their email and it remains changed after reload";
  const complete = [flow(nav("/settings"), fill("Email", "new@example.com"), click("Save"), refresh(), assertText("Email", "new@example.com"))];
  const noReloadCheck = [flow(nav("/settings"), fill("Email", "new@example.com"), click("Save"), assertVisible("Saved"))];
  ok("email-change: complete (assert after reload) passes", checkExecutionCoverage(claim, complete).ok);
  ok("email-change: no assertion after reload is rejected", !checkExecutionCoverage(claim, noReloadCheck).ok);
}
// Admin role retained after signing back in.
{
  const claim = "An admin grants a role and the user retains Admin access after signing back in with the same account";
  const complete = [flow(click("Grant admin"), assertText("role", "Admin"), click("Sign out"), nav("/signin"), click("Sign in"), assertText("role", "Admin"))];
  const noRecheck = [flow(click("Grant admin"), assertText("role", "Admin"), click("Sign out"), nav("/signin"), click("Sign in"))];
  ok("admin-role: complete passes", checkExecutionCoverage(claim, complete).ok);
  ok("admin-role: signs back in without re-asserting Admin is rejected", !checkExecutionCoverage(claim, noRecheck).ok);
}
// Form submission creates a record that remains after reload.
{
  const claim = "A form submission creates a record that remains visible after reload";
  const complete = [flow(fill("Title", "My note"), click("Create"), refresh(), assertVisible("My note"))];
  const noReload = [flow(fill("Title", "My note"), click("Create"), assertVisible("My note"))];
  ok("form-record: complete (assert after reload) passes", checkExecutionCoverage(claim, complete).ok);
  ok("form-record: no reload check is rejected", !checkExecutionCoverage(claim, noReload).ok);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
