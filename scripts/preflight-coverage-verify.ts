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
const reset = (): StepLite => ({ action: "reset_context" });
const signInAs = (role: string): StepLite => ({ action: "sign_in_as", target: role });
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
// Identity phrasing the deterministic gate must recognize, or the correction loop false-blocks a valid fix.
// These are the exact shapes the first production dry-run surfaced: an intervening word before the identity
// noun, and the plural verb "signs back in".
ok('identity is credited with an intervening word ("same customer identity")',
  checkClaimCoverage(FIXTURE_CLAIM, [
    "The account shows Pro after upgrading",
    "Pro persists for the same customer identity across sign out and sign in",
  ]).ok);
ok('identity is credited with the plural verb ("customer signs back in")',
  checkClaimCoverage(FIXTURE_CLAIM, [
    "The account shows Pro after upgrading",
    "Pro is retained when the customer signs back in",
  ]).ok);
// The bar is not lowered: an unrelated "same" and a plain "sign in" (no back / no again) do NOT carry identity.
ok('identity is NOT credited by an unrelated "same" or a plain sign-in',
  !checkClaimCoverage(FIXTURE_CLAIM, [
    "The account shows Pro after upgrading and still shows Pro on reload",
    "Users sign in with email and password at the same time each day",
  ]).covered.includes("identity"));

console.log("\n── EXECUTION COVERAGE: the full ordered contract, not three loose questions ──");
// The COMPLETE journey the contract requires: reach purchase, submit payment, observe success, open the
// account, assert the EXACT plan is Pro, explicitly sign out (reset the session), sign back in with
// credentials (email then password then submit), open the account again, assert the exact plan is Pro again.
const completePlan = [flow(
  nav("/"), click("Upgrade to Pro"), click("Pay $20 and start Pro"),
  assertVisible("Payment successful"),
  nav("/account"), assertText("Current plan", "Pro"),
  reset(),
  nav("/signin"), fill("Email", "demo@example.com"), fill("Password", "test-pass-123"), click("Sign in"),
  nav("/account"), assertText("Current plan", "Pro"),
)];
ok("the complete pay-to-entitlement-and-back journey passes", checkExecutionCoverage(FIXTURE_CLAIM, completePlan).ok);

// The same journey but signing in via a sealed test account (sign_in_as) also satisfies the contract.
const completeViaRole = [flow(
  click("Upgrade to Pro"), click("Pay $20 and start Pro"), assertVisible("Payment successful"),
  nav("/account"), assertText("Current plan", "Pro"),
  reset(), signInAs("customer"),
  nav("/account"), assertText("Current plan", "Pro"),
)];
ok("the complete journey with sign_in_as (sealed test account) passes", checkExecutionCoverage(FIXTURE_CLAIM, completeViaRole).ok);

// The robust journey the corrector should now prefer: pay, go straight to the account, assert the exact value.
// It never asserts a success screen (which the crawler cannot see and the model would otherwise guess at), and
// it must PASS — proving entitlement is the contract; the success screen is optional.
const noSuccessScreen = [flow(
  nav("/"), click("Upgrade to Pro"), click("Pay $20 and start Pro"),
  nav("/account"), assertText("Current plan", "Pro"),
  reset(),
  nav("/signin"), fill("Email", "demo@example.com"), fill("Password", "test-pass-123"), click("Sign in"),
  nav("/account"), assertText("Current plan", "Pro"),
)];
ok("a journey that skips the success screen but proves entitlement passes (success is optional)", checkExecutionCoverage(FIXTURE_CLAIM, noSuccessScreen).ok);

// Weak execution 1: stops at the checkout success page. Vraelis' actual first run effectively did this.
const stopsAtCheckout = [flow(
  nav("/"), click("Upgrade to Pro"), click("Pay $20 and start Pro"), assertVisible("Payment successful"),
)];
ok("a plan that stops at checkout success is rejected (never asserts Pro on the account)", !checkExecutionCoverage(FIXTURE_CLAIM, stopsAtCheckout).ok);

// Weak execution 2: only checks that a plan label is present, never the specific value, and never buys.
const onlyDisplaysPlan = [flow(nav("/account"), assertVisible("Current plan"))];
ok("a plan that only checks 'displays a plan' is rejected", !checkExecutionCoverage(FIXTURE_CLAIM, onlyDisplaysPlan).ok);

// Weak execution 3: a GENERIC visible-text assertion of "Pro" is not an exact account-plan assertion.
const genericProText = [flow(
  click("Upgrade to Pro"), click("Pay $20 and start Pro"), assertVisible("Payment successful"),
  nav("/account"), assertVisible("Pro"),
  reset(), nav("/signin"), fill("Email", "e"), fill("Password", "p"), click("Sign in"),
  nav("/account"), assertVisible("Pro"),
)];
ok("a generic visible-text 'Pro' assertion does NOT satisfy entitlement coverage",
  (() => { const c = checkExecutionCoverage(FIXTURE_CLAIM, genericProText); return !c.ok && (c.checklist ?? []).some((x) => x.weak); })());

// Weak execution 4: navigating to the sign-in page is treated as sign-out, and submit is clicked with no fills.
const navAsSignout = [flow(
  click("Upgrade to Pro"), click("Pay $20 and start Pro"), assertVisible("Payment successful"),
  nav("/account"), assertText("Current plan", "Pro"),
  nav("/signin"), click("Sign in"),
  nav("/account"), assertText("Current plan", "Pro"),
)];
ok("navigating to sign-in is not a sign out, and a bare submit is not a credentialed sign-in",
  (() => { const c = checkExecutionCoverage(FIXTURE_CLAIM, navAsSignout); return !c.ok && c.missing.some((m) => /sign out|stored credentials/i.test(m)); })());

// Weak execution 5: correct actions, WRONG order — credentials submitted before they are filled.
const credWrongOrder = [flow(
  click("Upgrade to Pro"), click("Pay $20 and start Pro"), assertVisible("Payment successful"),
  nav("/account"), assertText("Current plan", "Pro"),
  reset(), nav("/signin"), click("Sign in"), fill("Email", "e"), fill("Password", "p"),
  nav("/account"), assertText("Current plan", "Pro"),
)];
ok("credentials submitted BEFORE being filled fails (order is validated)", !checkExecutionCoverage(FIXTURE_CLAIM, credWrongOrder).ok);

// Weak execution 6: asserts Pro but only BEFORE paying.
const assertsBeforePaying = [flow(
  nav("/pricing"), assertText("Current plan", "Pro"), click("Upgrade to Pro"), click("Pay $20 and start Pro"),
)];
ok("a plan that asserts Pro only before the action is rejected", !checkExecutionCoverage(FIXTURE_CLAIM, assertsBeforePaying).ok);

// Static-copy protection: an exact "Pro" assertion read on the PRICING page (marketing copy) does not count.
const proOnPricing = [flow(
  click("Upgrade to Pro"), click("Pay $20 and start Pro"), assertVisible("Payment successful"),
  nav("/pricing"), assertText("Pro plan", "Pro"),
  reset(), nav("/signin"), fill("Email", "e"), fill("Password", "p"), click("Sign in"),
  nav("/pricing"), assertText("Pro plan", "Pro"),
)];
ok("an exact 'Pro' assertion on the pricing page (not the account) does NOT satisfy entitlement",
  !checkExecutionCoverage(FIXTURE_CLAIM, proOnPricing).ok);

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
// Admin role retained after signing back in (non-purchase identity+persistence claim).
{
  const claim = "An admin grants a role and the user retains Admin access after signing back in with the same account";
  const complete = [flow(
    click("Grant admin"), nav("/account"), assertText("role", "Admin"),
    reset(), signInAs("admin"), nav("/account"), assertText("role", "Admin"),
  )];
  const noRecheck = [flow(click("Grant admin"), nav("/account"), assertText("role", "Admin"), reset(), signInAs("admin"), nav("/account"))];
  const bareSignin = [flow(click("Grant admin"), nav("/account"), assertText("role", "Admin"), nav("/signin"), click("Sign in"), nav("/account"), assertText("role", "Admin"))];
  ok("admin-role: complete passes", checkExecutionCoverage(claim, complete).ok);
  ok("admin-role: signs back in without re-asserting Admin is rejected", !checkExecutionCoverage(claim, noRecheck).ok);
  ok("admin-role: a bare sign-in click (no sign-out, no credentials) is rejected", !checkExecutionCoverage(claim, bareSignin).ok);
}
// Form submission creates a record that remains after reload.
{
  const claim = "A form submission creates a record that remains visible after reload";
  const complete = [flow(fill("Title", "My note"), click("Create"), refresh(), assertVisible("My note"))];
  const noReload = [flow(fill("Title", "My note"), click("Create"), assertVisible("My note"))];
  ok("form-record: complete (assert after reload) passes", checkExecutionCoverage(claim, complete).ok);
  ok("form-record: no reload check is rejected", !checkExecutionCoverage(claim, noReload).ok);
}

console.log("\n── REGRESSION: the exact two flows the false-positive dry run installed must FAIL ──");
// These reproduce the two flows that produced would_launch true when the validator was too weak. The first is
// the read-only "view account plan status". The second is the installed 11-step flow whose deficiencies were:
// no checkout completion signal, no success observation, no explicit sign out (it navigated to the sign-in
// page), the submit clicked before any credentials, no password, and generic assertions. Both MUST now fail.
{
  const readOnly = [flow(nav("/account"), assertVisible("Current plan"), assertVisible("Free"))];
  ok("regression A (read-only 'view account plan status') fails execution coverage", !checkExecutionCoverage(FIXTURE_CLAIM, readOnly).ok);

  const weakInstalled = [flow(
    nav("/"), click("Upgrade to Pro"),                 // reaches, but never completes checkout / observes success
    nav("/account"), assertVisible("Pro"),             // generic visible-text, not an exact account-plan assertion
    nav("/signin"), click("Sign in"),                  // navigate-to-signin as "sign out"; bare submit, no fills
    nav("/account"), assertVisible("Pro"),
  )];
  const c = checkExecutionCoverage(FIXTURE_CLAIM, weakInstalled);
  ok("regression B (the installed 11-step flow) fails execution coverage", !c.ok);
  ok("regression B is rejected for missing payment submit", c.missing.some((m) => /submits payment|completes checkout/i.test(m)));
  ok("regression B is rejected for missing exact account assertion", c.missing.some((m) => /exact "Pro"/i.test(m)));
  ok("regression B is rejected for missing explicit sign out", c.missing.some((m) => /sign out/i.test(m)));
  ok("regression B is rejected for missing credentialed sign-in", c.missing.some((m) => /stored credentials/i.test(m)));

  // And exactly one fully ordered journey passes.
  ok("regression: only the fully ordered journey passes", checkExecutionCoverage(FIXTURE_CLAIM, completePlan).ok);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
