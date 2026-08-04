// THE GATE THAT DECIDES WHETHER VRAELIS TAKES YOUR MONEY.
//
// The coverage gate is the product's defining refusal: it declines to charge when it cannot build a test
// that would prove the claim. Until this change it ran on the public API only, so the console launch and
// the rerun — the two paths every human uses — spent money without ever asking the question.
//
// The failures these assertions exist to prevent, in the order they would hurt:
//
//   A GATE THAT REFUSES A WORKING CUSTOMER. checkExecutionCoverage does NOT fall open on a blank claim: with
//   no named value it applies valuelessPersistenceChecklist and demands an assertion after a sign-in or
//   reload. Feeding it "" would refuse legitimate contracts whose journeys never cross that boundary. The
//   third verdict state exists for exactly this, and these assertions pin it.
//   A GATE THAT PASSES ON EVIDENCE THAT WILL NOT RUN. Coverage is scored on the flows the run executes. If
//   it scored the whole contract, a strong journey the caller did not select could vouch for a weak one
//   they did, which is worse than no gate.
//   A SILENT PASS. "No claim" must be distinguishable from "passed", or the size of the remaining hole
//   becomes unmeasurable and then deniable.
import { readFileSync } from "node:fs";
import {
  decideLaunchCoverage, launchCoverageRefusalMessage, selectRunnableFlows, requirementsInForce,
} from "../lib/preflight/acceptance/launch-coverage";
import type { FlowLite } from "../lib/preflight/coverage";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

// "signing back in" contiguously, which is what IDENTITY_RE requires. Phrased as "signing out and back in"
// the claim reads identically to a human and selects a DIFFERENT execution contract: persistence without
// identity, whose boundary is a page refresh rather than a re-authentication. Worth knowing when writing a
// claim, and worth pinning here so this fixture keeps testing the branch it means to.
const CLAIM = "A customer can upgrade to Pro and still have Pro after signing back in";
// The REQUIREMENT has to carry the same-identity condition in a form the gate recognises too, not just the
// claim. Written as "after signing out and back in" this fixture failed claim coverage with the execution
// contract fully satisfied, which is the gate behaving correctly: a requirement that drops the identity
// condition no longer preserves the claim, however well the journey happens to be built.
const REQS = ["A customer who upgrades to Pro still has Pro after signing back in"];

// A journey that actually proves the claim: reaches checkout, submits, asserts the exact value on the
// account surface, signs out, signs back in with stored credentials, asserts it again.
const PROVING: FlowLite = {
  name: "upgrade and persist",
  steps: [
    { action: "click", target: "Upgrade to Pro" },
    { action: "click", target: "Complete purchase" },
    { action: "navigate", target: "/account" },
    { action: "assert_text", target: "plan", expect: "Pro" },
    { action: "sign_out" },
    { action: "sign_in_as", target: "customer" },
    { action: "navigate", target: "/account" },
    { action: "assert_text", target: "plan", expect: "Pro" },
  ],
};
// Touches plausible pages and proves nothing.
const WEAK: FlowLite = { name: "browse", steps: [{ action: "navigate", target: "/pricing" }] };

console.log("── the gate decides against the claim, when there is one ──");
{
  ok("a journey that proves the claim passes",
    decideLaunchCoverage({ claim: CLAIM, requirements: REQS, flows: [PROVING] }).gate === "passed");

  const weak = decideLaunchCoverage({ claim: CLAIM, requirements: REQS, flows: [WEAK] });
  ok("a journey that proves nothing is refused", weak.gate === "refused");
  ok("the refusal names what is missing", weak.gate === "refused" && weak.missing.length > 0);

  const noReqs = decideLaunchCoverage({ claim: CLAIM, requirements: [], flows: [PROVING] });
  ok("requirements that dropped the claim's value are refused even with a good journey",
    noReqs.gate === "refused");

  ok("no flows at all is refused",
    decideLaunchCoverage({ claim: CLAIM, requirements: REQS, flows: [] }).gate === "refused");
}

console.log("\n── a blank claim is a THIRD state, not a pass and not a refusal ──");
{
  // THE WHOLE REASON THIS IS NOT A TWO-STATE GATE. Each of these would be REFUSED if the claim were passed
  // straight into coverageReport, because the execution gate applies its valueless fallback contract.
  for (const [label, claim] of [["null", null], ["empty", ""], ["whitespace", "   "]] as const) {
    ok(`a ${label} claim yields no_claim rather than a refusal`,
      decideLaunchCoverage({ claim, requirements: REQS, flows: [WEAK] }).gate === "no_claim");
  }
  ok("no_claim is distinguishable from passed, so the hole stays measurable",
    decideLaunchCoverage({ claim: null, requirements: [], flows: [] }).gate !== "passed");

  // The regression this guards: someone "simplifying" the third state away by defaulting to "".
  const wouldBeRefused = decideLaunchCoverage({ claim: " ", requirements: REQS, flows: [WEAK] });
  ok("a blank claim does not fall through to the valueless persistence contract",
    wouldBeRefused.gate !== "refused");
}

console.log("\n── the strongest flow decides, and only among flows that will run ──");
{
  // coverageReport scores every flow and keeps the best. Passing a weak flow ALONGSIDE a proving one must
  // still pass; passing only the weak one must not. This is why the caller filters to the selected,
  // enabled, approved set before calling: an unselected strong journey must never vouch for a selected weak
  // one, and the filtering lives in gateLaunchCoverage so no caller can get it wrong.
  ok("a proving flow alongside a weak one still passes",
    decideLaunchCoverage({ claim: CLAIM, requirements: REQS, flows: [WEAK, PROVING] }).gate === "passed");
  ok("dropping the proving flow flips the verdict",
    decideLaunchCoverage({ claim: CLAIM, requirements: REQS, flows: [WEAK] }).gate === "refused");
}

console.log("\n── the refusal a customer reads ──");
{
  const msg = launchCoverageRefusalMessage(["reaches the purchase surface/control", "submits payment (completes checkout)"]);
  ok("it says nothing was charged rather than reporting a failure", /will not charge/i.test(msg));
  ok("it does not call the customer's software broken", !/failed|broken|error/i.test(msg));
  ok("it lists what is missing", msg.includes("reaches the purchase surface/control"));
  const many = launchCoverageRefusalMessage(["a", "b", "c", "d", "e", "f"]);
  ok("a long list is truncated with a count rather than dumped", /and 2 more/.test(many));
  ok("an empty list still gives an instruction", launchCoverageRefusalMessage([]).length > 40);
}

// ── THE MUTATIONS THAT SURVIVED THE FIRST VERSION OF THIS SUITE ───────────────────────────────────────
//
// An adversarial campaign against this change injected three edits that neuter the gate completely, and the
// suite as first written passed all three. Each is now a behavioural assertion on a pure function rather
// than a scan for a function CALL, because a scan proves something is invoked and not that it still does
// anything. The three, in the campaign's own numbering:
//
//   M2  gateLaunchCoverage passed `claim: null` on to decideLaunchCoverage  -> every launch reads no_claim
//   M3  the flow filter dropped `selected.has(f.id)`                        -> unselected journeys vouch
//   M5  the rerun call site passed a literal null as the claim              -> reruns never refuse
console.log("\n── the gate still does something (mutation kills) ──");
{
  const FLOWS = [
    { id: "f1", name: "weak", role: null, steps: [{ action: "navigate", target: "/pricing" }], enabled: true, review_state: "approved" },
    { id: "f2", name: "proving", role: null, steps: PROVING.steps, enabled: true, review_state: "approved" },
    { id: "f3", name: "unapproved", role: null, steps: PROVING.steps, enabled: true, review_state: "suggested" },
    { id: "f4", name: "disabled", role: null, steps: PROVING.steps, enabled: false, review_state: "approved" },
  ];

  // M3. Selecting only the weak flow must yield only the weak flow. If the selection filter is dropped, the
  // proving flow leaks in and the caller is told a journey they did not select proves their claim.
  const onlyWeak = selectRunnableFlows(FLOWS, ["f1"]);
  ok("M3: selecting one flow returns exactly that flow", onlyWeak.length === 1 && onlyWeak[0].name === "weak");
  ok("M3: an unselected proving flow does not leak in",
    decideLaunchCoverage({ claim: CLAIM, requirements: REQS, flows: onlyWeak }).gate === "refused");
  ok("M3: selecting the proving flow does pass",
    decideLaunchCoverage({ claim: CLAIM, requirements: REQS, flows: selectRunnableFlows(FLOWS, ["f2"]) }).gate === "passed");

  // Eligibility, the other half of the same filter.
  ok("an unreviewed flow is never runnable even when selected", selectRunnableFlows(FLOWS, ["f3"]).length === 0);
  ok("a disabled flow is never runnable even when selected", selectRunnableFlows(FLOWS, ["f4"]).length === 0);
  ok("selecting an id that does not exist yields nothing", selectRunnableFlows(FLOWS, ["nope"]).length === 0);

  // Requirements in force.
  const REQ_ROWS = [
    { requirement: "in force", enabled: true, review_state: "approved" },
    { requirement: "unreviewed", enabled: true, review_state: "suggested" },
    { requirement: "off", enabled: false, review_state: "approved" },
    { requirement: "legacy null state", enabled: true, review_state: null },
  ];
  const inForce = requirementsInForce(REQ_ROWS);
  ok("only enabled+approved requirements are in force", inForce.length === 2);
  ok("a null review_state counts as approved, as everywhere else", inForce.includes("legacy null state"));
  ok("an enabled but unreviewed requirement is not in force", !inForce.includes("unreviewed"));
}

console.log("\n── one gate, below every entrance ──");
{
  const accept = readFileSync("lib/preflight/acceptance/accept-run.ts", "utf8");
  const rerun = readFileSync("app/api/preflight/runs/[runId]/rerun/route.ts", "utf8");
  const gate = readFileSync("lib/preflight/acceptance/launch-coverage.ts", "utf8");

  for (const [label, src] of [["the acceptance service", accept], ["the rerun route", rerun]] as const) {
    ok(`${label} calls the shared gate`, /gateLaunchCoverage\(/.test(src));
    ok(`${label} does not assemble the gate input itself`, !/listRequirements\(/.test(src));
  }
  ok("the gate is the only place that filters flows for coverage",
    /flowApprovedEnabled/.test(gate));
  ok("the gate reuses coverageReport rather than restating what coverage means",
    /coverageReport\(/.test(gate));
  // Asserted on the IMPORT, not the word: the module's header explains at length why the corrective
  // resolver stays where a plan is built, and a bare word-scan fails on its own documentation.
  ok("the corrective resolver is NOT reachable from the gate",
    !/^import[^\n]*resolveCoverage/m.test(gate) && !/^import[^\n]*coverage-resolve/m.test(gate));

  // The claim is resolved server-side from the contract, never read off a request body. A caller-supplied
  // claim would let anyone name a proposition their journeys happen to satisfy.
  const runsRoute = readFileSync("app/api/preflight/apps/[id]/runs/route.ts", "utf8");
  ok("the console launch takes the claim from the contract",
    /claim: contract\.source_prompt/.test(runsRoute));
  ok("the console launch does not take a claim from the body",
    !/claim:\s*(body|typeof body)/.test(runsRoute));
  const verifyRoute = readFileSync("app/api/preflight/apps/[id]/guarantees/[gid]/verify/route.ts", "utf8");
  ok("verify-a-guarantee takes the claim from the approved record",
    /claim: g\.approved_claim/.test(verifyRoute));

  // M2. The claim parameter must reach the decision. Hardcoding it inside the loader turns every launch
  // into no_claim and nothing else in this file would notice.
  ok("M2: gateLaunchCoverage forwards its claim parameter rather than a literal",
    /return decideLaunchCoverage\(\{\s*\n\s*claim,/.test(gate));
  ok("M2: it does not pass a null literal to the decision",
    !/decideLaunchCoverage\(\{[^}]*claim:\s*null/.test(gate));

  // M5. Every call site must pass a real claim expression. A literal null at a call site disables the gate
  // for that entrance only, which is the hardest version to notice.
  for (const [label, src] of [["the acceptance service", accept], ["the rerun route", rerun]] as const) {
    const call = src.match(/gateLaunchCoverage\([^)]*\)/);
    ok(`M5: ${label} passes a real claim to the gate`,
      !!call && !/,\s*null\s*,/.test(call[0]), call ? call[0] : "no call found");
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
