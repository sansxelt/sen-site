// Deterministic issue generation. Issues come DIRECTLY from failed flow steps + the requirements a flow
// covers — NOT from a model. (AI may later add a plain-language likely_cause, kept separate.) Pure +
// testable. The category classifies the failure into a first-class Vraelis issue type so the report can
// speak in product terms (fake success / persistence / session / authorization / etc.), not "test failed".
import type { FlowResult, FlowSpec, StepObservation } from "../../worker/preflight/types";

export type IssueCategory =
  | "persistence_failure" | "session_failure" | "cross_account" | "fake_success" | "stale_ui"
  | "duplicate_action" | "authorization_failure" | "mobile_blocker" | "navigation_failure" | "functional_failure";
export type IssueSeverity = "critical" | "high" | "medium" | "low";

// The evidence model, kept explicit so a reader can tell the two apart at a glance:
//   observed              what the run actually saw (evidence)
//   expected              what the approved flow required (the owner's own contract)
//   category              an inference used for grouping and issue identity across reruns
//   possible_explanation  a guess, always labelled as one, never a cause
// There is deliberately no "confirmed cause" field. Nothing in the browser layer can establish a mechanism
// today, so the model does not offer somewhere to put one. Add the field when there is evidence to fill it.
export type Issue = {
  severity: IssueSeverity; category: IssueCategory; title: string;
  requirement_refs: string[]; expected: string; observed: string; repro: string[];
  possible_explanation: string | null;
  evidence: { failed_step_index: number; failed_action: string; console_errors: string[]; network_failures: { method: string; path: string; status: number }[]; current_url?: string };
  status: "open";
};

const READABLE: Record<string, (t?: string, v?: string, e?: string) => string> = {
  navigate: (t) => `Open ${t ?? "the page"}`,
  click: (t) => `Click ${t ?? "the control"}`,
  fill: (t, v) => `Enter ${v ? `"${v}"` : "a value"} in ${t ?? "the field"}`,
  refresh: () => "Refresh the page",
  // assert_text checks a VALUE, so it must read as the value, not the label. "Confirm the plan shows Pro",
  // never "Confirm the text Plan appears" (which reads as absent even when the label Plan is plainly visible).
  assert_visible: (t) => `Confirm ${t ?? "the expected content"} is visible`,
  assert_text: (t, _v, e) => (e ? `Confirm ${t ?? "the page"} shows "${e}"` : `Confirm the text "${t ?? ""}" appears`),
  assert_url: (t, _v, e) => `Confirm the page is ${e ?? t ?? ""}`,
  verify_authenticated: () => "Confirm the account is signed in",
  verify_unauthorized: () => "Confirm the account is signed out",
  sign_in_as: (t) => `Sign in as ${t ?? "the test account"}`,
  sign_out: () => "Sign out",
  reset_context: () => "Sign out and clear the session",
  switch_role: (t) => `Switch to ${t ?? "another role"}`,
  screenshot: () => "Capture a screenshot",
};
const readable = (s: { action: string; target?: string; value?: string; expect?: string }) =>
  (READABLE[s.action] ?? ((t?: string) => `${s.action} ${t ?? ""}`.trim()))(s.target ?? s.expect, s.value, s.expect);

// The one-line EXPECTED, phrased as the outcome the assertion required, from the AUTHORED step (which carries
// the expected value; the observation does not).
function expectedFor(s: { action: string; target?: string; expect?: string }, flowName: string): string {
  if (s.action === "assert_text") return `Expected ${s.target ? `${s.target} to show` : "the page to show"} "${s.expect ?? ""}"`;
  if (s.action === "assert_visible") return `Expected "${s.target ?? s.expect ?? ""}" to be visible`;
  if (s.action === "assert_url") return `Expected the page to be ${s.expect ?? s.target ?? ""}`;
  if (s.action === "verify_authenticated") return "Expected the account to be signed in";
  if (s.action === "verify_unauthorized") return "Expected the account to be signed out";
  return `Expected "${readable(s)}" to succeed, in ${flowName}`;
}

// The one-line OBSERVED, translated from the worker's machine detail into what a reader can act on. Uses the
// authored step's expected value so "text_absent" becomes "\"Pro\" was not present", not a raw code.
function observedFor(s: { action: string; target?: string; expect?: string }, detail: string, url?: string): string {
  const d = (detail || "").trim();
  const at = url ? ` (at ${url})` : "";
  const map: Record<string, string> = {
    text_absent: `"${s.expect ?? ""}" was not present`,
    text_present_pagewide: `"${s.expect ?? ""}" appeared somewhere on the page, but not where it was checked`,
    assert_target_not_found: `the element to check (${s.target ?? "the target"}) was not found`,
    assert_text_no_expected_text: "no expected text was given for the check",
    not_visible: `"${s.target ?? s.expect ?? ""}" was not visible`,
    url_mismatch: `the page was not ${s.expect ?? s.target ?? "the expected route"}`,
  };
  return `${map[d] ?? (d || "the step did not complete")}${at}`;
}

// A flow only counts as multi-user/multi-session if its STEPS say so. This is the gate that stops a flow
// merely NAMED "Authorize payment" from being filed as a cross-account finding: the words in a name are the
// author's label, never evidence about what the browser did.
function hasMultiActorStructure(flow: FlowSpec): boolean {
  return (flow.steps ?? []).some((s) => s.action === "new_context" || s.action === "sign_in_as" || s.action === "switch_role");
}

// Classify a failed step within its flow into a first-class category. The category is an INFERENCE used for
// grouping and for issue identity across reruns. It is deliberately allowed to be approximate, because
// nothing user-facing states a cause based on it (see CATEGORY_TITLE below, which is purely observational).
function classify(flow: FlowSpec, steps: StepObservation[], failedIdx: number): IssueCategory {
  const name = `${flow.name}`.toLowerCase();
  const failed = steps[failedIdx];
  const priorRefresh = steps.slice(0, failedIdx).some((s) => s.action === "refresh");
  const isAssert = failed?.action?.startsWith("assert");
  // A success was CONFIRMED earlier in this flow (a passed success/confirmation assertion), yet a later value
  // check failed: the classic broken outcome behind a green screen. This is the checkout entitlement shape,
  // payment says done, the account never shows the plan.
  const priorSuccess = steps.slice(0, failedIdx).some((s) =>
    s.ok && s.action?.startsWith("assert") && /success|complete|active|thank|confirmed|paid|received|processed/i.test(`${s.target ?? ""} ${s.detail ?? ""}`));
  if (isAssert && priorRefresh) return name.includes("sign") || name.includes("session") || name.includes("auth") ? "session_failure" : "persistence_failure";
  if (isAssert && priorSuccess) return "fake_success";
  if (isAssert && /created|success|toast/.test(`${failed?.detail} ${name}`)) return "fake_success";
  // Tightened: "nav" and "overlay" used to land any navigation flow in the mobile bucket.
  if (/mobile|viewport|responsive/.test(name)) return "mobile_blocker";
  // Tightened: the NAME may suggest a multi-actor flow, but the STEPS have to actually contain a second
  // context or a role switch. Without that, a run never had two actors and cannot have seen one reach the
  // other's data, whatever the flow is called.
  if (/another user|cross|other account|authoriz/.test(name) && hasMultiActorStructure(flow)) return "cross_account";
  if (failed?.action === "navigate") return "navigation_failure";
  if (/duplicate|double/.test(name)) return "duplicate_action";
  return "functional_failure";
}

// Issue titles state WHAT WAS SEEN, never why. These used to be causal diagnoses ("One user can access
// another user's data", "Created data disappears after refresh") generated from keyword matches on a flow
// name. That is a fabricated finding: the run observed a step that did not succeed, and inferred a
// mechanism it never witnessed. A security-shaped claim invented from a regex is the fastest way to lose
// a user's trust, and it is worse than reporting nothing.
//
// The rule this encodes: a title may describe an OBSERVATION. Claims of data leakage, unauthorized access,
// data loss, payment failure or deletion require direct evidence, which the browser layer does not produce
// today, so no title asserts one.
const CATEGORY_TITLE: Partial<Record<IssueCategory, string>> = {
  persistence_failure: "Expected content was not visible after a refresh",
  session_failure: "The signed-in state was not visible after a refresh",
  fake_success: "A success message appeared, but the expected result was not visible afterwards",
  cross_account: "An access-restriction check did not complete as expected",
  mobile_blocker: "A step failed at a mobile viewport",
  stale_ui: "The interface did not show the expected state after a change",
  duplicate_action: "A repeated action did not behave the way the flow expected",
  authorization_failure: "An expected access restriction was not observed",
  navigation_failure: "A required page failed to load",
};

// The uncertain half, shown separately and always labelled as a guess. Kept apart from `title` so the
// report can render observation and interpretation in different voices, and so a reader can act on the
// first without being asked to believe the second.
const CATEGORY_EXPLANATION: Partial<Record<IssueCategory, string>> = {
  persistence_failure: "The data created earlier in the flow may not have been saved.",
  session_failure: "The session may not be surviving a page load.",
  fake_success: "The success message may be shown before the change is durable.",
  cross_account: "An access rule may not be applied on this path. This has not been confirmed.",
  mobile_blocker: "A control may be covered or off-screen at this viewport.",
  stale_ui: "The interface may not be refetching after the change.",
  duplicate_action: "The action may not be guarded against being repeated.",
  authorization_failure: "An access rule may not be applied on this path. This has not been confirmed.",
  navigation_failure: "The route may be missing, erroring, or redirecting.",
};

// Generate issues from a run's flow results. One issue per failed/blocked flow, anchored to the first
// failed step, carrying the flow's covered requirements + deterministic evidence.
export function issuesFromRun(results: FlowResult[], flows: FlowSpec[], flowRequirementRefs: Record<string, string[]> = {}): Issue[] {
  const byId = new Map(flows.map((f) => [f.flowId, f]));
  const out: Issue[] = [];
  for (const r of results) {
    // blocked_by_policy is a boundary REFUSAL and auth_config_failed is a worker/config auth failure — in
    // BOTH the step never verified any application behavior, so NEITHER is ever an application defect and
    // neither can open an issue. Explicit even though the failed/blocked filter below already excludes them.
    // (auth_rejected_by_app, the one real auth defect, arrives as a normal "failed" and IS handled below.)
    if (r.state === "blocked_by_policy" || r.state === "auth_config_failed") continue;
    if (r.state !== "failed" && r.state !== "blocked") continue;
    const flow = byId.get(r.flowId); if (!flow) continue;
    const failedIdx = Math.max(0, r.steps.findIndex((s) => !s.ok));
    const failed = r.steps[failedIdx];
    const category = classify(flow, r.steps, failedIdx);
    const severity: IssueSeverity = flow.priority === "critical" ? "critical" : flow.priority === "important" ? "high" : "medium";
    // The AUTHORED step carries the expected value; the observation does not. Use it for expected/observed so
    // the finding reads as the outcome ("Expected the plan to show Pro"), not the label ("Expected: Plan").
    const stepSpec = flow.steps[failedIdx] ?? { action: failed?.action ?? "", target: failed?.target };
    out.push({
      severity, category,
      title: CATEGORY_TITLE[category] ?? `${flow.name} did not complete`,
      possible_explanation: CATEGORY_EXPLANATION[category] ?? null,
      requirement_refs: flowRequirementRefs[r.flowId] ?? [],
      expected: failed ? expectedFor(stepSpec, flow.name) : `Expected the flow "${flow.name}" to complete`,
      observed: failed ? observedFor(stepSpec, failed.detail ?? "", failed.url) : "The flow did not complete",
      repro: flow.steps.map((s, i) => `${i + 1}. ${readable(s)}`),
      evidence: { failed_step_index: failedIdx, failed_action: failed?.action ?? "unknown", console_errors: r.evidence?.consoleErrors ?? [], network_failures: r.evidence?.networkFailures ?? [], current_url: failed?.url },
      status: "open",
    });
  }
  // Most severe first, stable within severity.
  const rank = { critical: 0, high: 1, medium: 2, low: 3 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

// ── Cross-run issue reconciliation (repair verification) ──────────────────────────────────────────────
// Pure decision: given each flow that RAN in a (re)run (passed, or its failure categories) and the
// application's currently OPEN issues, decide which open issues RESOLVE (their flow passed), which CONTINUE
// (their flow still fails the same category, so bump + refresh), and which NEW issues to OPEN (a failure with
// no matching open issue = a regression). Open issues whose flow did NOT run are left untouched (unverified).
// Correlation identity is application + flow + category. No DB, no time, no model.
export type ReconcileFlow = { flowId: string; passed: boolean; failureCategories: string[] };
export type OpenIssueRef = { id: string; flowId: string; category: string | null };
export type ReconcilePlan = {
  resolve: string[];                                                              // open issue ids -> resolved
  continueExisting: { id: string; flowId: string; category: string | null }[];    // still failing -> refresh
  openNew: { flowId: string; category: string | null }[];                         // regressions -> insert
};
export function planReconcile(ranFlows: ReconcileFlow[], open: OpenIssueRef[]): ReconcilePlan {
  const openByFlow = new Map<string, string[]>();
  const openByFlowCat = new Map<string, string>();
  for (const o of open) {
    if (!o.flowId) continue;
    if (!openByFlow.has(o.flowId)) openByFlow.set(o.flowId, []);
    openByFlow.get(o.flowId)!.push(o.id);
    openByFlowCat.set(`${o.flowId}|${o.category ?? ""}`, o.id);
  }
  const resolve: string[] = [];
  const continueExisting: ReconcilePlan["continueExisting"] = [];
  const openNew: ReconcilePlan["openNew"] = [];
  for (const f of ranFlows) {
    if (!f.flowId) continue;
    if (f.passed) { for (const id of openByFlow.get(f.flowId) ?? []) resolve.push(id); continue; }
    for (const cat of f.failureCategories) {
      const existing = openByFlowCat.get(`${f.flowId}|${cat ?? ""}`);
      if (existing) continueExisting.push({ id: existing, flowId: f.flowId, category: cat });
      else openNew.push({ flowId: f.flowId, category: cat });
    }
  }
  return { resolve, continueExisting, openNew };
}
