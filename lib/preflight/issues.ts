// Deterministic issue generation. Issues come DIRECTLY from failed flow steps + the requirements a flow
// covers — NOT from a model. (AI may later add a plain-language likely_cause, kept separate.) Pure +
// testable. The category classifies the failure into a first-class Vraelis issue type so the report can
// speak in product terms (fake success / persistence / session / authorization / etc.), not "test failed".
import type { FlowResult, FlowSpec, StepObservation } from "../../worker/preflight/types";

export type IssueCategory =
  | "persistence_failure" | "session_failure" | "cross_account" | "fake_success" | "stale_ui"
  | "duplicate_action" | "authorization_failure" | "mobile_blocker" | "navigation_failure" | "functional_failure";
export type IssueSeverity = "critical" | "high" | "medium" | "low";

export type Issue = {
  severity: IssueSeverity; category: IssueCategory; title: string;
  requirement_refs: string[]; expected: string; observed: string; repro: string[];
  evidence: { failed_step_index: number; failed_action: string; console_errors: string[]; network_failures: { method: string; path: string; status: number }[]; current_url?: string };
  status: "open";
};

const READABLE: Record<string, (t?: string, v?: string) => string> = {
  navigate: (t) => `Open ${t ?? "the page"}`,
  click: (t) => `Click ${t ?? "the control"}`,
  fill: (t, v) => `Enter ${v ? `"${v}"` : "a value"} in ${t ?? "the field"}`,
  refresh: () => "Refresh the page",
  assert_visible: (t) => `Confirm ${t ?? "the expected content"} is visible`,
  assert_text: (t) => `Confirm the text ${t ?? ""} appears`,
  assert_url: (t) => `Confirm the URL is ${t ?? ""}`,
  screenshot: () => "Capture a screenshot",
};
const readable = (s: { action: string; target?: string; value?: string; expect?: string }) =>
  (READABLE[s.action] ?? ((t?: string) => `${s.action} ${t ?? ""}`.trim()))(s.target ?? s.expect, s.value);

// Classify a failed step within its flow into a first-class category. Deterministic keyword + shape rules.
function classify(flow: FlowSpec, steps: StepObservation[], failedIdx: number): IssueCategory {
  const name = `${flow.name}`.toLowerCase();
  const failed = steps[failedIdx];
  const priorRefresh = steps.slice(0, failedIdx).some((s) => s.action === "refresh");
  const isAssert = failed?.action?.startsWith("assert");
  if (isAssert && priorRefresh) return name.includes("sign") || name.includes("session") || name.includes("auth") ? "session_failure" : "persistence_failure";
  if (isAssert && /created|success|toast/.test(`${failed?.detail} ${name}`)) return "fake_success";
  if (/mobile|viewport|overlay|nav/.test(name)) return "mobile_blocker";
  if (/another user|cross|other account|authoriz/.test(name)) return "cross_account";
  if (failed?.action === "navigate") return "navigation_failure";
  if (/duplicate|double/.test(name)) return "duplicate_action";
  return "functional_failure";
}

const CATEGORY_TITLE: Partial<Record<IssueCategory, string>> = {
  persistence_failure: "Created data disappears after refresh",
  session_failure: "Session does not survive a refresh",
  fake_success: "Success is shown but nothing durable changed",
  cross_account: "One user can access another user's data",
  mobile_blocker: "A primary action is blocked on mobile",
  stale_ui: "The interface shows stale state after a change",
  duplicate_action: "A repeated action creates duplicate records",
  authorization_failure: "An authorization boundary was not enforced",
  navigation_failure: "A required page failed to load",
};

// Generate issues from a run's flow results. One issue per failed/blocked flow, anchored to the first
// failed step, carrying the flow's covered requirements + deterministic evidence.
export function issuesFromRun(results: FlowResult[], flows: FlowSpec[], flowRequirementRefs: Record<string, string[]> = {}): Issue[] {
  const byId = new Map(flows.map((f) => [f.flowId, f]));
  const out: Issue[] = [];
  for (const r of results) {
    // blocked_by_policy is a boundary REFUSAL (the step never executed) — NEVER an application defect, so
    // it can never open an issue. Explicit even though the failed/blocked filter below already excludes it.
    if (r.state === "blocked_by_policy") continue;
    if (r.state !== "failed" && r.state !== "blocked") continue;
    const flow = byId.get(r.flowId); if (!flow) continue;
    const failedIdx = Math.max(0, r.steps.findIndex((s) => !s.ok));
    const failed = r.steps[failedIdx];
    const category = classify(flow, r.steps, failedIdx);
    const severity: IssueSeverity = flow.priority === "critical" ? "critical" : flow.priority === "important" ? "high" : "medium";
    out.push({
      severity, category,
      title: CATEGORY_TITLE[category] ?? `${flow.name} did not complete`,
      requirement_refs: flowRequirementRefs[r.flowId] ?? [],
      expected: failed?.action?.startsWith("assert") ? `Expected: ${failed.target ?? failed.detail}` : `Step "${failed ? readable({ action: failed.action, target: failed.target }) : flow.name}" should succeed`,
      observed: failed ? `${failed.detail}${failed.url ? ` (at ${failed.url})` : ""}` : "The flow did not complete",
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
