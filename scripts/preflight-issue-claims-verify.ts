// Tests for the ISSUE EVIDENCE MODEL (lib/preflight/issues.ts).
//
// The defect this guards against: issue titles used to be causal diagnoses picked by matching keywords in a
// FLOW NAME. A flow called "Authorize payment" matched /authoriz/ and was reported as "One user can access
// another user's data" — a security finding invented from a regex, about something the run never saw.
//
// The rule: a title may state an OBSERVATION. Data leakage, unauthorized access, data loss, payment failure
// and deletion are claims that require direct evidence, and the browser layer does not produce it, so no
// title may assert one. Interpretation lives in possible_explanation, labelled as a guess.

import { issuesFromRun, type Issue } from "../lib/preflight/issues";
import type { FlowResult, FlowSpec } from "../worker/preflight/types";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}`); }
}

// A flow whose NAME is suggestive but whose STEPS contain a single actor and no role switching.
function nameOnlyFlow(name: string): FlowSpec {
  return {
    flowId: "f1", name, priority: "critical",
    steps: [
      { action: "navigate", target: "/" },
      { action: "click", target: "Open" },
      { action: "assert_visible", target: "Details" },
    ],
  } as unknown as FlowSpec;
}

function failedResult(flowId = "f1"): FlowResult {
  return {
    flowId, state: "failed",
    steps: [
      { action: "navigate", target: "/", ok: true, detail: "ok" },
      { action: "click", target: "Open", ok: true, detail: "ok" },
      { action: "assert_visible", target: "Details", ok: false, detail: "not visible", url: "https://x.test/a" },
    ],
    evidence: { consoleErrors: [], networkFailures: [] },
  } as unknown as FlowResult;
}

const gen = (name: string): Issue => issuesFromRun([failedResult()], [nameOnlyFlow(name)])[0];

// ── THE core invariant: no unobserved security or data-loss claim, from any suggestive name ──
const LOADED_NAMES = [
  "Authorize payment", "Cross-sell upsell", "Another user checkout", "Other account settings",
  "Authorization header test", "Delete duplicate records", "Mobile nav overlay",
];
const FORBIDDEN_TITLE = /(can access another|another user's|unauthorized|data (?:leak|loss)|leaked|deleted|disappears|breach|exposed)/i;

ok("no suggestive flow name produces a security or data-loss TITLE",
  LOADED_NAMES.every((n) => !FORBIDDEN_TITLE.test(gen(n).title)));

ok("'Authorize payment' is NOT filed as a cross-account finding (no second actor in the steps)",
  gen("Authorize payment").category !== "cross_account");

ok("'Another user checkout' with a single-actor flow is NOT cross_account either",
  gen("Another user checkout").category !== "cross_account");

// ── the gate that permits it: real multi-actor STRUCTURE in the steps ──
const twoActor = {
  flowId: "f1", name: "Another user cannot open the record", priority: "critical",
  steps: [
    { action: "navigate", target: "/" },
    { action: "new_context" },
    { action: "sign_in_as", target: "second" },
    { action: "assert_visible", target: "Denied" },
  ],
} as unknown as FlowSpec;
const twoActorIssue = issuesFromRun([failedResult()], [twoActor])[0];

ok("a genuinely multi-actor flow IS categorised cross_account", twoActorIssue.category === "cross_account");
ok("even then the title stays observational, never a leakage claim",
  !FORBIDDEN_TITLE.test(twoActorIssue.title) && /did not complete as expected/i.test(twoActorIssue.title));

// ── observation vs interpretation are separate fields, in different voices ──
ok("every issue carries observed evidence from the run", typeof gen("Checkout").observed === "string" && gen("Checkout").observed.length > 0);
ok("every issue carries the expectation from the approved flow", typeof gen("Checkout").expected === "string" && gen("Checkout").expected.length > 0);
ok("interpretation is a SEPARATE field, not folded into the title",
  "possible_explanation" in gen("Checkout"));
ok("the explanation is hedged, never stated as fact",
  LOADED_NAMES.every((n) => { const e = gen(n).possible_explanation; return e === null || /\bmay\b|not been confirmed/i.test(e); }));
ok("the explanation never asserts a confirmed cause",
  LOADED_NAMES.every((n) => { const e = gen(n).possible_explanation ?? ""; return !/root cause|because|caused by|confirmed/i.test(e.replace(/not been confirmed/i, "")); }));

// ── titles describe what was seen, in every category ──
const ALL_TITLES = LOADED_NAMES.map((n) => gen(n).title).concat(twoActorIssue.title);
ok("no title claims a mechanism the run could not witness",
  ALL_TITLES.every((t) => !/\bbecause\b|root cause|due to/i.test(t)));

// ── severity is unchanged by this work: it still comes from the flow's own priority ──
ok("severity still derives from flow priority, not from the category",
  gen("Authorize payment").severity === "critical");
const lowFlow = { ...nameOnlyFlow("Authorize payment"), priority: "nice_to_have" } as unknown as FlowSpec;
ok("a non-critical flow does not become critical via a scary-sounding name",
  issuesFromRun([failedResult()], [lowFlow])[0].severity !== "critical");

// ── boundary refusals and worker auth failures still never open an issue ──
const policyBlocked = { ...failedResult(), state: "blocked_by_policy" } as unknown as FlowResult;
const authConfig = { ...failedResult(), state: "auth_config_failed" } as unknown as FlowResult;
ok("a policy refusal opens no issue", issuesFromRun([policyBlocked], [nameOnlyFlow("Checkout")]).length === 0);
ok("a worker auth failure opens no issue", issuesFromRun([authConfig], [nameOnlyFlow("Checkout")]).length === 0);

console.log(`\n${pass}/${pass + fail} passed`);
if (fail > 0) process.exit(1);
