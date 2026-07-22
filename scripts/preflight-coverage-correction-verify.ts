// The bounded correction loop.
//
// The property under test: the model may PROPOSE stronger requirements and flows, but the deterministic
// validators DECIDE whether they are sufficient, and the loop is strictly bounded — each stage runs at most
// once, a failed requirement correction never reaches flow correction, and the only outcomes are "provable
// after correction" or Blocked. Every corrector here is a FAKE that returns canned proposals and counts its
// calls, so the whole loop is exercised with no model, no network, and fully deterministic assertions.
import { resolveCoverage, type Correctors } from "../lib/preflight/coverage-resolve";
import type { Synthesis } from "../lib/preflight/discover-synthesis";
import type { PageSnapshot } from "../lib/preflight/discover-extract";
import type { PlanRequirement, PlanFlow } from "../lib/preflight/verification-lane";
import type { FlowStep } from "../lib/preflight/flow-steps";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};
const section = (t: string) => console.log(`\n── ${t} ──`);

const CLAIM = "A customer can upgrade to Pro, receive access immediately, and retain Pro after signing out and signing back in with the same account";
const URL_ = "https://broken-checkout.example";

// ── Synthesis + page factories (only the fields the loop reads) ────────────────────────────────────────────
type RawStep = { action: string; target?: string; value?: string; expect?: string };
const step = (action: string, target = "", value = "", expect = ""): RawStep => ({ action, target, value, expect });

function mkSynth(reqTexts: string[], flows: { name: string; steps: RawStep[]; role?: string; auth?: boolean }[]): Synthesis {
  return {
    product_summary: "", product_type: "", roles: [], capabilities: [], data_entities: [], integrations: [],
    requirements: reqTexts.map((t) => ({ text: t, category: "correctness", severity: "critical" as const, confidence: 1, support: "explicit" as const, justified_by: "prompt", sources: [] })),
    flows: flows.map((f) => ({ name: f.name, goal: f.name, role: f.role ?? "", priority: "critical" as const, start_path: "/", auth_required: f.auth ?? false, mobile_relevant: false, steps: f.steps.map((s) => ({ action: s.action, target: s.target ?? "", value: s.value ?? "", expect: s.expect ?? "" })), requirement_refs: [] })),
    uncertainties: [],
  };
}
const page = (url: string, extra: Partial<PageSnapshot> = {}): PageSnapshot => ({
  url, status: 200, title: "", metaDescription: "", headings: [], navLinks: [], links: [], forms: [],
  buttons: [], ctas: [], indicators: [], roles: [], apiRefs: [], framework: null, ...extra,
});
// Pages that DO contain the purchase surface + an account surface, so discoveryCovers is true (no recrawl).
const COVERED_PAGES: PageSnapshot[] = [
  page(`${URL_}/pricing`, { ctas: ["Upgrade to Pro"], navLinks: [{ label: "Pricing", href: "/pricing" }] }),
  page(`${URL_}/account`, { headings: ["Account"], navLinks: [{ label: "Account", href: "/account" }] }),
];
// Pages missing the surfaces, so discoveryCovers is false (a targeted recrawl should be attempted).
const BARE_PAGES: PageSnapshot[] = [page(`${URL_}/`, { headings: ["Welcome"] })];

// ── Canned proposals ──────────────────────────────────────────────────────────────────────────────────────
const STRONG_REQ = "The account must show Pro after upgrading, and must still show Pro after signing out and signing back in with the same account";
const WEAK_REQS = ["The account page must display the current plan", "Users can sign in with email and password"];
const READ_ONLY_FLOWS = [
  { name: "View pricing", steps: [step("navigate", "/pricing"), step("assert_visible", "Pro plan")] },
  { name: "View account", steps: [step("navigate", "/account"), step("assert_visible", "Current plan")] },
];
// The complete journey: pay, assert Pro on the account, sign out, sign back in, assert Pro again — in ONE flow.
const COMPLETE_JOURNEY: PlanFlow[] = [{
  name: "Upgrade and verify Pro persists", goal: "Pro survives a fresh sign-in", role: null, priority: "critical",
  steps: ([
    step("navigate", "/"), step("click", "Upgrade to Pro"), step("click", "Pay $20 and start Pro"),
    step("navigate", "/account"), step("assert_text", "plan", "", "Pro"),
    step("click", "Sign out"), step("navigate", "/signin"), step("fill", "Email", "demo@example.com"), step("click", "Sign in"),
    step("navigate", "/account"), step("assert_text", "plan", "", "Pro"),
  ] as RawStep[]).map((s) => ({ action: s.action, target: s.target, value: s.value, expect: s.expect } as FlowStep)),
}];
// A flow correction that still does NOT prove persistence (asserts Pro after checkout, never after sign-in).
const INCOMPLETE_JOURNEY: PlanFlow[] = [{
  name: "Upgrade only", goal: "buy Pro", role: null, priority: "critical",
  steps: ([
    step("navigate", "/"), step("click", "Upgrade to Pro"), step("click", "Pay"),
    step("navigate", "/account"), step("assert_text", "plan", "", "Pro"),
  ] as RawStep[]).map((s) => ({ action: s.action, target: s.target, value: s.value, expect: s.expect } as FlowStep)),
}];
const STRONG_CORRECTION: PlanRequirement[] = [{ text: STRONG_REQ, category: "correctness", severity: "critical" }];

// ── A fake corrector set with call counters ───────────────────────────────────────────────────────────────
function fakes(opts: {
  reqOut?: PlanRequirement[] | null;
  flowOut?: PlanFlow[] | null;
  recrawlOut?: PageSnapshot[];
}) {
  const calls = { req: 0, flow: 0, recrawl: 0 };
  const correctors: Correctors = {
    correctRequirements: async () => { calls.req++; return opts.reqOut ?? null; },
    correctFlows: async () => { calls.flow++; return opts.flowOut ?? null; },
    recrawl: async (_u, _p, existing) => { calls.recrawl++; return opts.recrawlOut ?? existing; },
  };
  return { correctors, calls };
}

async function main() {
  section("a complete first result performs no correction");
  {
    const synth = mkSynth([STRONG_REQ], [{ name: "journey", steps: COMPLETE_JOURNEY[0].steps }]);
    const { correctors, calls } = fakes({});
    const r = await resolveCoverage(URL_, CLAIM, synth, COVERED_PAGES, { correctors });
    ok("would_launch is true with no correction", r.readyToLaunch && r.blockedReason === null);
    ok("neither corrector ran", calls.req === 0 && calls.flow === 0);
    ok("no recrawl ran", calls.recrawl === 0 && !r.recrawlAttempted);
  }

  section("strong requirements + weak flows trigger FLOW correction only");
  {
    const synth = mkSynth([STRONG_REQ], READ_ONLY_FLOWS);
    const { correctors, calls } = fakes({ flowOut: COMPLETE_JOURNEY });
    const r = await resolveCoverage(URL_, CLAIM, synth, COVERED_PAGES, { correctors });
    ok("requirement correction did NOT run (claim coverage already passed)", calls.req === 0 && !r.requirementCorrectionAttempted);
    ok("flow correction ran exactly once", calls.flow === 1 && r.flowCorrectionAttempted);
    ok("execution coverage failed before, passes after", !r.executionBefore.ok && r.executionAfter.ok);
    ok("would_launch is true after flow correction", r.readyToLaunch);
  }

  section("weak requirements trigger REQUIREMENT correction first");
  {
    // Weak requirements but a complete flow: requirement correction runs first; once claim coverage passes,
    // execution already holds, so flow correction never runs. Proves the ordering and the hand-off.
    const synth = mkSynth(WEAK_REQS, [{ name: "journey", steps: COMPLETE_JOURNEY[0].steps }]);
    const { correctors, calls } = fakes({ reqOut: STRONG_CORRECTION });
    const r = await resolveCoverage(URL_, CLAIM, synth, COVERED_PAGES, { correctors });
    ok("requirement correction ran exactly once", calls.req === 1 && r.requirementCorrectionAttempted);
    ok("claim coverage failed before, passes after correction", !r.claimBefore.ok && r.claimAfter.ok);
    ok("a successful requirement correction proceeds to execution validation", r.executionAfter.ok);
    ok("flow correction did not run (execution already held)", calls.flow === 0 && !r.flowCorrectionAttempted);
    ok("would_launch is true", r.readyToLaunch);
    ok("the existing weak requirements were not discarded", WEAK_REQS.every((w) => r.plan.requirements.some((x) => x.text === w)));
  }

  section("a failed REQUIREMENT correction Blocks and never calls flow correction");
  {
    const synth = mkSynth(WEAK_REQS, READ_ONLY_FLOWS);
    const { correctors, calls } = fakes({ reqOut: null, flowOut: COMPLETE_JOURNEY }); // req correction yields nothing
    const r = await resolveCoverage(URL_, CLAIM, synth, COVERED_PAGES, { correctors });
    ok("requirement correction ran once", calls.req === 1);
    ok("flow correction was NEVER called", calls.flow === 0 && !r.flowCorrectionAttempted);
    ok("Blocked with the claim-stage reason", !r.readyToLaunch && r.blockedReason === "claim_coverage_incomplete_after_correction");
    ok("remaining obligations are reported", r.remainingObligations.length > 0);
  }

  section("a failed FLOW correction Blocks");
  {
    const synth = mkSynth([STRONG_REQ], READ_ONLY_FLOWS);
    const { correctors, calls } = fakes({ flowOut: INCOMPLETE_JOURNEY }); // asserts Pro after checkout, not after sign-in
    const r = await resolveCoverage(URL_, CLAIM, synth, COVERED_PAGES, { correctors });
    ok("flow correction ran once", calls.flow === 1);
    ok("Blocked with the execution-stage reason", !r.readyToLaunch && r.blockedReason === "execution_coverage_incomplete_after_correction");
    ok("the remaining obligation names the unproven persistence", r.remainingObligations.some((m) => /signing back in|reload/i.test(m)));
  }

  section("no stage runs more than once (both stages engaged)");
  {
    const synth = mkSynth(WEAK_REQS, READ_ONLY_FLOWS);
    const { correctors, calls } = fakes({ reqOut: STRONG_CORRECTION, flowOut: COMPLETE_JOURNEY });
    const r = await resolveCoverage(URL_, CLAIM, synth, COVERED_PAGES, { correctors });
    ok("requirement correction ran exactly once", calls.req === 1);
    ok("flow correction ran exactly once", calls.flow === 1);
    ok("would_launch is true after both bounded corrections", r.readyToLaunch);
  }

  section("targeted recrawl is gated on discovery, not automatic");
  {
    const synth = mkSynth([STRONG_REQ], READ_ONLY_FLOWS);
    // Covered discovery: recrawl must be skipped.
    const a = fakes({ flowOut: COMPLETE_JOURNEY });
    const ra = await resolveCoverage(URL_, CLAIM, synth, COVERED_PAGES, { correctors: a.correctors });
    ok("recrawl skipped when discovery already has the surfaces", a.calls.recrawl === 0 && !ra.recrawlAttempted && ra.readyToLaunch);
    // Bare discovery: recrawl must be attempted before flow correction.
    const b = fakes({ flowOut: COMPLETE_JOURNEY, recrawlOut: COVERED_PAGES });
    const rb = await resolveCoverage(URL_, CLAIM, synth, BARE_PAGES, { correctors: b.correctors });
    ok("recrawl attempted when discovery lacks the surfaces", b.calls.recrawl === 1 && rb.recrawlAttempted);
    ok("recrawl runs BEFORE flow correction (both once)", b.calls.recrawl === 1 && b.calls.flow === 1 && rb.readyToLaunch);
  }

  section("FIXTURE REGRESSION: read-only plan is corrected into the full journey");
  {
    const synth = mkSynth([STRONG_REQ], READ_ONLY_FLOWS);
    const { correctors } = fakes({ flowOut: COMPLETE_JOURNEY });
    const r = await resolveCoverage(URL_, CLAIM, synth, COVERED_PAGES, { correctors });
    ok("the first plan was read-only (execution coverage rejected it)", !r.executionBefore.ok);
    const f = r.plan.flows[0];
    const kinds = f.steps.map((s) => `${s.action}:${(s.target || s.expect || "").toLowerCase()}`);
    ok("corrected flow reaches checkout (a purchase action)", kinds.some((k) => /click:.*(upgrade|pay)/.test(k)));
    const proAsserts = f.steps.map((s, i) => ({ i, s })).filter(({ s }) => s.action.startsWith("assert") && (s.expect || "").toLowerCase() === "pro");
    ok("corrected flow asserts the exact plan is Pro (twice)", proAsserts.length >= 2);
    const signout = f.steps.findIndex((s) => /sign out/i.test(s.target || ""));
    const signin = f.steps.findIndex((s) => s.action === "click" && /sign in/i.test(s.target || ""));
    ok("corrected flow signs out then back in with the same account", signout !== -1 && signin > signout);
    ok("the final Pro assertion comes AFTER signing back in", proAsserts[proAsserts.length - 1].i > signin);
    ok("the corrected dry run would launch", r.readyToLaunch && r.blockedReason === null);
  }

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
