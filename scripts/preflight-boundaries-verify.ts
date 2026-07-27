// S5 test-boundary enforcement tests. Two layers, mirroring preflight-scope-verify's structure:
//
//   1. PURE classification + evaluation tables (lib/preflight/boundaries.ts): core actions are never
//      blocked; the origin rule and the fixed never-rules are hard denials; the permit-governed
//      side-effect classes gate on their permits.
//
//   2. Executor spies (FakeRunStore + FakeBrowserProvider, no DB, no browser): the BACKWARD-COMPATIBILITY
//      PROOF that a legacy enqueue without boundaries running plain same-origin flows produces IDENTICAL
//      results to before; a policy refusal becomes blocked_by_policy (never an issue, decision
//      needs_review with a policy_blocked count); an all-blocked run fails terminally as blocked_by_policy
//      with a full refund.
//
//   3. Static source checks: issuesFromRun skips the state, the worker claim selects test_boundaries
//      defensively, and the report page carries the new pill + failure line.
import { readFileSync } from "node:fs";
import {
  classifyStepAction, evaluateBoundary, normalizeBoundaries, DEFAULT_BOUNDARIES, type TestBoundaries,
} from "../lib/preflight/boundaries";
import { issuesFromRun, planReconcile } from "../lib/preflight/issues";
import { decideRun, executeRun } from "../worker/preflight/execute-run";
import { FakeRunStore } from "../worker/preflight/run-store-fake";
import { FakeBrowserProvider } from "../worker/preflight/providers/fake";
import type { FlowSpec, FlowResult, Step } from "../worker/preflight/types";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const ORIGIN = "https://app.example.com";
const allOn: TestBoundaries = { allowed_domains: [], permit_account_creation: true, permit_db_writes: true, permit_email: true, permit_test_purchases: true, permit_file_upload: true };
const evalStep = (b: TestBoundaries | null, step: { action: string; target?: string; value?: string }, resolved?: string, origin: string | null = ORIGIN) =>
  evaluateBoundary(b, classifyStepAction(step, resolved ?? step.target, origin));

// ── 1a. Core actions are NEVER blocked (with null boundaries AND with every permit off) ──
for (const b of [null, DEFAULT_BOUNDARIES] as (TestBoundaries | null)[]) {
  const tag = b === null ? "boundaries absent (legacy)" : "all permits off";
  ok(`core: same-origin navigation allowed [${tag}]`, evalStep(b, { action: "navigate", target: "/dashboard" }, `${ORIGIN}/dashboard`).allowed);
  ok(`core: relative navigation allowed [${tag}]`, evalStep(b, { action: "navigate", target: "/x" }, "/x").allowed);
  ok(`core: fill allowed [${tag}]`, evalStep(b, { action: "fill", target: "Project name", value: "Acme" }).allowed);
  ok(`core: click "Create project" allowed (never mistaken for account creation) [${tag}]`, evalStep(b, { action: "click", target: "Create project" }).allowed);
  ok(`core: click "Sign in" allowed (sign-IN is not sign-UP) [${tag}]`, evalStep(b, { action: "click", target: "Sign in" }).allowed);
  ok(`core: assert_visible allowed [${tag}]`, evalStep(b, { action: "assert_visible", target: "Created" }).allowed);
  ok(`core: refresh allowed [${tag}]`, evalStep(b, { action: "refresh" }).allowed);
}
ok("core: typing 'sign up' into a FIELD is not a side effect (only click/press trigger)",
  evalStep(null, { action: "fill", target: "Sign up email", value: "a@b.co" }).allowed);

// ── 1b. Origin rule: external navigation is a hard denial by default; allowed_domains admits hosts ──
{
  const v = evalStep(null, { action: "navigate", target: "https://evil.example/x" }, "https://evil.example/x");
  ok("external navigation refused with boundaries absent", !v.allowed && !v.allowed && v.permit === "allowed_domains");
}
ok("external navigation refused with empty allowed_domains", !evalStep(DEFAULT_BOUNDARIES, { action: "navigate" }, "https://other.example/p").allowed);
{
  const b = normalizeBoundaries({ allowed_domains: ["Checkout.Stripe.com "] });
  ok("allowed_domains admits the listed host", evalStep(b, { action: "navigate" }, "https://checkout.stripe.com/pay").allowed);
  ok("allowed_domains admits subdomains of a listed domain", evalStep(normalizeBoundaries({ allowed_domains: ["stripe.com"] }), { action: "navigate" }, "https://js.stripe.com/v3").allowed);
  ok("allowed_domains does not admit unrelated hosts", !evalStep(b, { action: "navigate" }, "https://evil.example/x").allowed);
}
ok("unparseable run target: an absolute external navigation is still refused (no legitimate origin exists)",
  !evalStep(null, { action: "navigate" }, "https://evil.example/x", null).allowed);

// ── 1c. Permit-governed side-effect classes, on and off ──
{
  const off = evalStep(DEFAULT_BOUNDARIES, { action: "click", target: "Sign up" });
  ok("signup click refused when permit_account_creation is off", !off.allowed && !off.allowed && off.permit === "permit_account_creation");
  ok("signup click allowed when permit_account_creation is on", evalStep({ ...DEFAULT_BOUNDARIES, permit_account_creation: true }, { action: "click", target: "Sign up" }).allowed);
  ok("'Create account' click gated by the same permit", !evalStep(DEFAULT_BOUNDARIES, { action: "click", target: "Create an account" }).allowed);
  ok("'Register' click gated by the same permit", !evalStep(DEFAULT_BOUNDARIES, { action: "click", target: "Register" }).allowed);
}
{
  const off = evalStep(DEFAULT_BOUNDARIES, { action: "click", target: "Checkout" });
  ok("checkout click refused when permit_test_purchases is off", !off.allowed && !off.allowed && off.permit === "permit_test_purchases");
  ok("checkout click allowed when permit_test_purchases is on", evalStep({ ...DEFAULT_BOUNDARIES, permit_test_purchases: true }, { action: "click", target: "Checkout" }).allowed);
}
ok("'Send email' click gated by permit_email",
  !evalStep(DEFAULT_BOUNDARIES, { action: "click", target: "Send email" }).allowed
  && evalStep({ ...DEFAULT_BOUNDARIES, permit_email: true }, { action: "click", target: "Send email" }).allowed);
ok("'Upload' click gated by permit_file_upload",
  !evalStep(DEFAULT_BOUNDARIES, { action: "click", target: "Upload file" }).allowed
  && evalStep({ ...DEFAULT_BOUNDARIES, permit_file_upload: true }, { action: "click", target: "Upload file" }).allowed);
// permit_db_writes is honestly unenforceable from browser steps (every submit writes); never a false block.
ok("a plain form-submitting click is never refused under permit_db_writes (undetectable => do not block)",
  evalStep(DEFAULT_BOUNDARIES, { action: "click", target: "Save changes" }).allowed);

// ── 1d. Fixed never-rules: destructive patterns refused even with EVERY permit on ──
for (const target of ["Delete account", "Delete my account", "Delete all data", "Delete everything", "Factory reset"]) {
  const v = evalStep(allOn, { action: "click", target });
  ok(`destructive "${target}" always refused, names no grantable permit`, !v.allowed && !v.allowed && v.permit === "none");
}
ok("destructive wording gates even when the label ALSO matches a permitted class (never-rule wins)",
  !evalStep(allOn, { action: "click", target: "Register and delete all previous accounts" }).allowed);

// ── 1e. Pure decision + issue rules for blocked_by_policy ──
const spec = (flowId: string, priority: FlowSpec["priority"], steps: Step[]): FlowSpec =>
  ({ flowId, name: flowId, priority, destructiveAllowed: false, maxMs: 60000, steps });
const res = (flowId: string, state: FlowResult["state"]): FlowResult =>
  ({ flowId, state, steps: [{ action: "click", target: "Sign up", ok: false, detail: "blocked_by_policy: requires permit_account_creation", ms: 0 }], evidence: { consoleErrors: [], networkFailures: [] } });
{
  const flows = [spec("f-a", "critical", []), spec("f-b", "critical", [])];
  const d = decideRun([res("f-a", "passed"), res("f-b", "blocked_by_policy")], flows, true);
  ok("decideRun: a policy-blocked CRITICAL flow -> needs_review (never READY on an unverified critical)", d.decision === "needs_review");
  ok("decideRun: policy-blocked is never BLOCKED (the app failed nothing)", d.decision !== "blocked");
  ok("decideRun: summary carries the policy_blocked count", d.summary.policy_blocked === 1);
  const d2 = decideRun([res("f-a", "failed"), res("f-b", "blocked_by_policy")], flows, true);
  ok("decideRun: a REAL critical failure still decides blocked even alongside a policy block", d2.decision === "blocked");
  ok("decideRun: runs without policy blocks report policy_blocked 0 (summary shape stays honest)",
    decideRun([res("f-a", "passed"), res("f-b", "passed")], flows, true).summary.policy_blocked === 0
    && decideRun([res("f-a", "passed"), res("f-b", "passed")], flows, true).decision === "ready");
}
ok("issuesFromRun: a blocked_by_policy flow opens NO issue",
  issuesFromRun([res("f-a", "blocked_by_policy")], [spec("f-a", "critical", [{ action: "click", target: "Sign up" }])]).length === 0);
ok("planReconcile: a policy-blocked flow excluded from ranFlows leaves its open issue untouched",
  (() => { const p = planReconcile([], [{ id: "i1", flowId: "f-a", category: "functional_failure" }]); return p.resolve.length === 0 && p.continueExisting.length === 0 && p.openNew.length === 0; })());

// ── 2. Executor spies ──
const limits = { leaseSecs: 60, maxRunMs: 60000, maxFlowMs: 60000, maxStepsPerFlow: 30 };
const BASE = "https://preflight-demo-ten.vercel.app";
const plainFlow = (flowId: string, marker: string): FlowSpec => spec(flowId, "critical", [
  { action: "navigate", target: "/" }, { action: "assert_visible", target: marker, expect: marker },
]);

async function spyRun(input: { runId: string; deploymentUrl: string; flows: FlowSpec[]; boundaries?: TestBoundaries | null }) {
  const store = new FakeRunStore();
  const provider = new FakeBrowserProvider({}, input.deploymentUrl || "https://fixture.local/");
  store.enqueue({ runId: input.runId, applicationId: "a1", deploymentUrl: input.deploymentUrl, flows: input.flows, boundaries: input.boundaries });
  const claimed = await store.claim("w1", 60);
  if (claimed) await executeRun(claimed, { store, provider, workerId: "w1", limits });
  return { row: store.get(input.runId)!, provider, claimed };
}

(async () => {
  // BACKWARD-COMPATIBILITY PROOF: legacy enqueue (no boundaries recorded) + plain same-origin flows ->
  // identical results to the pre-S5 executor: every flow runs, passes, READY, charged.
  const legacy = await spyRun({ runId: "legacy", deploymentUrl: `${BASE}/?mode=fixed`, flows: [plainFlow("f-create", "x"), plainFlow("f-persist", "y"), plainFlow("f-mobile", "z")] });
  ok("compat: claim carries boundaries: null for a legacy enqueue", legacy.claimed !== null && legacy.claimed!.boundaries === null);
  ok("compat: all 3 plain same-origin flows executed", legacy.row.flowResults.length === 3, `${legacy.row.flowResults.length} executed`);
  ok("compat: every flow passed (nothing policy-blocked)", legacy.row.flowResults.every((f) => f.state === "passed"));
  ok("compat: decision READY, charged, summary.policy_blocked 0",
    legacy.row.decision === "ready" && legacy.row.billing === "charged" && legacy.row.summary.policy_blocked === 0,
    `${legacy.row.decision}/${legacy.row.billing}`);
  ok("compat: provider saw all 3 navigations on the run target", legacy.provider.navigations.length === 3 && legacy.provider.navigations.every((u) => u === `${BASE}/?mode=fixed`));

  // A permit-refused step: the flow becomes blocked_by_policy, the run finalizes needs_review, no issue.
  const mixed = await spyRun({
    runId: "mixed", deploymentUrl: `${BASE}/?mode=fixed`,
    flows: [plainFlow("f-plain", "x"), spec("f-signup", "critical", [{ action: "navigate", target: "/" }, { action: "click", target: "Sign up" }, { action: "assert_visible", target: "Welcome" }])],
    boundaries: DEFAULT_BOUNDARIES,
  });
  {
    const blocked = mixed.row.flowResults.find((f) => f.flowId === "f-signup")!;
    ok("policy: the signup flow is blocked_by_policy (permit off)", blocked.state === "blocked_by_policy", blocked.state);
    ok("policy: the refused step never executed and records blocked_by_policy + the permit",
      blocked.steps.some((s) => !s.ok && s.detail.startsWith("blocked_by_policy:") && s.detail.includes("permit_account_creation")));
    ok("policy: the flow stopped at the refusal (no later steps ran)", blocked.steps.length === 2 && blocked.steps[1].action === "click");
    ok("policy: blocked_by_policy carries no severity (not a defect)", blocked.severity === undefined);
    ok("policy: the plain flow still ran and passed", mixed.row.flowResults.find((f) => f.flowId === "f-plain")?.state === "passed");
    ok("policy: decision needs_review with policy_blocked count (never READY, never BLOCKED)",
      mixed.row.decision === "needs_review" && mixed.row.summary.policy_blocked === 1, `${mixed.row.decision}`);
    ok("policy: run charged (real work executed)", mixed.row.billing === "charged");
    ok("policy: no issue payload from the policy-blocked flow",
      issuesFromRun(mixed.row.flowResults, mixed.claimed!.flows).every((i) => i.title.indexOf("f-signup") === -1)
      && issuesFromRun([blocked], mixed.claimed!.flows).length === 0);
  }

  // Same flow with the permit GRANTED runs to completion (permits actually admit).
  const granted = await spyRun({
    runId: "granted", deploymentUrl: `${BASE}/?mode=fixed`,
    flows: [spec("f-signup", "critical", [{ action: "navigate", target: "/" }, { action: "click", target: "Sign up" }, { action: "assert_visible", target: "Welcome" }])],
    boundaries: { ...DEFAULT_BOUNDARIES, permit_account_creation: true },
  });
  ok("policy: granting permit_account_creation lets the same flow execute fully",
    granted.row.flowResults[0]?.state === "passed" && granted.row.decision === "ready");

  // External navigation -> blocked_by_policy. With a parseable run target every stored navigation is
  // REBASED onto the target origin (that is the pre-existing invariant that keeps legacy flows safe), so
  // the origin gate fires on the unparseable-target edge, where the resolver passes the stored URL through.
  const external = await spyRun({
    runId: "external", deploymentUrl: "",
    flows: [spec("f-ext", "critical", [{ action: "navigate", target: "https://evil.example/steal" }, { action: "assert_visible", target: "x" }]),
            spec("f-rel", "critical", [{ action: "navigate", target: "/ok" }, { action: "assert_visible", target: "y" }])],
  });
  {
    const blocked = external.row.flowResults.find((f) => f.flowId === "f-ext")!;
    ok("origin: external navigation is blocked_by_policy", blocked.state === "blocked_by_policy", blocked.state);
    ok("origin: the browser NEVER navigated to the external host", !external.provider.navigations.some((u) => u.includes("evil.example")));
    ok("origin: the refusal names allowed_domains", blocked.steps.some((s) => s.detail.includes("allowed_domains")));
    ok("origin: no issue payload for the external-navigation refusal", issuesFromRun([blocked], external.claimed!.flows).length === 0);
    ok("origin: the same-origin-relative flow still ran; decision needs_review with the count",
      external.row.flowResults.find((f) => f.flowId === "f-rel")?.state === "passed"
      && external.row.decision === "needs_review" && external.row.summary.policy_blocked === 1);
  }
  // The rebasing guarantee itself: with a PARSEABLE target, a stored absolute external URL is rebased
  // onto the run target (legacy behavior, unchanged) — it executes on-target instead of being blocked.
  const rebased = await spyRun({ runId: "rebased", deploymentUrl: `${BASE}/?mode=fixed`, flows: [spec("f-abs", "critical", [{ action: "navigate", target: "https://old-preview.example/page" }, { action: "assert_visible", target: "x" }])] });
  ok("compat: a stored absolute URL is rebased onto the run target and still executes (no false block)",
    rebased.row.flowResults[0]?.state === "passed" && rebased.provider.navigations[0] === `${BASE}/page?mode=fixed`);

  // ALL flows policy-blocked before any step executed -> terminal failRun blocked_by_policy + full refund.
  const allBlocked = await spyRun({
    runId: "all-blocked", deploymentUrl: `${BASE}/?mode=fixed`,
    flows: [spec("f-signup", "critical", [{ action: "click", target: "Sign up" }]),
            spec("f-del", "critical", [{ action: "click", target: "Delete account" }])],
    boundaries: DEFAULT_BOUNDARIES,
  });
  ok("all-blocked: run fails terminally with code blocked_by_policy",
    allBlocked.row.state === "failed" && allBlocked.row.failureCode === "blocked_by_policy",
    `${allBlocked.row.state}/${allBlocked.row.failureCode}`);
  ok("all-blocked: the reservation is fully refunded (nothing ran, nothing billed)", allBlocked.row.billing === "refunded");
  ok("all-blocked: no step ever reached the page layer", allBlocked.provider.navigations.length === 0);
  ok("all-blocked: no launch decision was minted", allBlocked.row.decision === null);
  ok("all-blocked: terminal (a retry cannot change the boundaries) — not requeued", allBlocked.row.state !== "queued");

  // Destructive never-rule blocks even with every permit granted, end to end.
  const destructive = await spyRun({
    runId: "destructive", deploymentUrl: `${BASE}/?mode=fixed`,
    flows: [spec("f-wipe", "critical", [{ action: "navigate", target: "/" }, { action: "click", target: "Delete all data" }])],
    boundaries: allOn,
  });
  ok("never-rule: destructive click blocked_by_policy even with every permit on",
    destructive.row.flowResults[0]?.state === "blocked_by_policy" && destructive.row.decision === "needs_review");

  // ── 3. Static source checks ──
  const issuesSrc = readFileSync("lib/preflight/issues.ts", "utf8");
  ok("static: issuesFromRun explicitly skips blocked_by_policy", issuesSrc.includes('r.state === "blocked_by_policy"'));
  const pgSrc = readFileSync("worker/preflight/run-store-postgres.ts", "utf8");
  ok("static: worker claim selects v_applications.test_boundaries defensively (normalized, try/catch to null)",
    pgSrc.includes('select("test_boundaries")') && pgSrc.includes("normalizeBoundaries(") && /catch\s*\{\s*\/\*\s*boundaries stay null/.test(pgSrc));
  ok("static: Postgres failRun treats blocked_by_policy as terminal", pgSrc.includes('code === "blocked_by_policy"'));
  ok("static: Postgres issue reconciliation skips blocked_by_policy flows", pgSrc.includes('result.state === "blocked_by_policy"'));
  const report = readFileSync("app/rank/app/systems/[id]/passes/[runId]/page.tsx", "utf8");
  ok("static: report page has the muted 'Blocked by policy' pill", report.includes('"blocked_by_policy"') && report.includes('"Blocked by policy"'));
  ok("static: report page has the blocked_by_policy failure line",
    report.includes("your test boundaries do not permit an action they require"));
  ok("static: report page shows 'Additional permission required' from the step detail",
    report.includes("Additional permission required:") && report.includes("permit_[a-z_]+|allowed_domains"));
  const typesSrc = readFileSync("worker/preflight/types.ts", "utf8");
  ok("static: FlowResult state union includes blocked_by_policy and ClaimedRun carries boundaries",
    typesSrc.includes('"blocked_by_policy"') && typesSrc.includes("boundaries: TestBoundaries | null"));

  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error("boundary tests crashed:", (e as Error).message); process.exit(1); });
