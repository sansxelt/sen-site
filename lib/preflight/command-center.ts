// Application Command Center resolver (pure, no I/O). Given the overview's already-computed application
// state, it returns exactly ONE dominant next action and the ribbon of ONLY-TRUE state facts. Every field
// is derived from real state passed in — nothing is invented, and a fact that is not true is simply absent.
// Kept pure so it is unit-testable and so the page stays a thin presenter.

export type Decision = "ready" | "blocked" | "needs_review" | "repair_verified" | null;

export type CommandState = {
  appId: string;
  contractExists: boolean;
  contractApproved: boolean;
  requirementCount: number;
  flowCount: number;
  eligibleFlowCount: number;      // enabled + approved flows a pass would run
  criticalEligibleCount: number;  // eligible flows marked critical (for full verification)
  decision: Decision;             // the latest full-coverage health decision
  runActive: boolean;             // a pass is running right now
  latestRunId: string | null;     // the run behind the current decision (for "view")
  blockerCount: number;           // open critical/high issues
  repairPendingFullVerify: boolean; // a repair was verified but full critical verification is still owed
  newerUnverifiedDeploy: boolean; // a deployment newer than the tested one exists
  criticalTotal: number;          // critical flows in the latest pass
  criticalPassed: number;
  coverageFull: boolean;          // the latest pass was FULL-coverage (not a targeted/partial repair run)
  deploymentLabel: string | null; // host/path of the current (tested-or-target) deployment
  contractVersion: number | null;
};

export type NextAction = {
  label: string;
  href: string;          // where a NAVIGATE action goes (author/review/inspect/view)
  why: string;            // one owner-facing line: why this is the next thing
  tone: "primary" | "quiet"; // quiet = healthy, nothing urgent (still offers a next step)
  // When set, this action LAUNCHES a pass rather than navigating: the UI renders the real launch control
  // over these flow ids (never a link to a page that cannot start a run). `href` is unused for launch.
  launch?: { flowIds: "eligible" | "critical" };
};

// Priority-ordered so exactly ONE action wins. Earliest funnel gap first; a healthy READY app falls to the
// quiet "run a new pass" at the end. This ladder is the product's operating logic, encoded once.
export function nextAction(s: CommandState): NextAction {
  const app = `/applications/${s.appId}`;
  // 1. Nothing to test yet: a freshly connected app with an empty contract and no flows.
  if (!s.contractApproved && s.requirementCount === 0 && s.flowCount === 0) {
    return { label: "Author your Production Contract", href: `${app}/contract`, why: "Define what Vraelis should verify before this app can be tested.", tone: "primary" };
  }
  // 2. Requirements exist but the contract is still a draft: review + approve.
  if (!s.contractApproved) {
    return { label: "Review Production Contract", href: `${app}/contract`, why: "Approve the contract to lock in what a pass verifies.", tone: "primary" };
  }
  // 3. Approved contract but no runnable flows: author the journeys.
  if (s.eligibleFlowCount === 0) {
    return { label: "Add flows to your contract", href: `${app}/contract`, why: "A pass runs approved flows; add at least one to launch.", tone: "primary" };
  }
  // 4. A pass is running: the next thing is to watch it.
  if (s.runActive && s.latestRunId) {
    return { label: "View running pass", href: `${app}/passes/${s.latestRunId}`, why: "A Production Pass is running now.", tone: "primary" };
  }
  // 5. Blocked: inspect the blocker (the single most urgent state).
  if (s.decision === "blocked" && s.latestRunId) {
    return { label: "Inspect blocker", href: `${app}/passes/${s.latestRunId}`, why: s.blockerCount > 0 ? `${s.blockerCount} critical launch blocker${s.blockerCount === 1 ? "" : "s"} to resolve.` : "This deployment is blocked from launch.", tone: "primary" };
  }
  // 6. A repair was verified but the full critical verification is still owed -> earn READY. LAUNCHES the
  //    full critical suite (not a link to a page that can't run it).
  if (s.repairPendingFullVerify && s.criticalEligibleCount > 0) {
    return { label: "Run full critical verification", href: `${app}/contract`, why: "The repair is verified; run every critical flow to earn READY.", tone: "primary", launch: { flowIds: "critical" } };
  }
  // 7. A newer, different deployment exists that the current decision never tested. LAUNCHES a pass.
  if (s.newerUnverifiedDeploy && s.eligibleFlowCount > 0) {
    return { label: "Verify this deployment", href: `${app}`, why: "A newer deployment exists; your last decision doesn't cover it.", tone: "primary", launch: { flowIds: "eligible" } };
  }
  // 8. Needs review: a pass finished without a clean decision -> open the report.
  if (s.decision === "needs_review" && s.latestRunId) {
    return { label: "Review the report", href: `${app}/passes/${s.latestRunId}`, why: "The last pass needs your review.", tone: "primary" };
  }
  // 9. READY and nothing pending: the app is in good shape; a new pass is available but not urgent.
  if (s.decision === "ready") {
    return { label: "Run a new pass", href: `${app}`, why: "This deployment is verified. Run again after your next change.", tone: "quiet", launch: { flowIds: "eligible" } };
  }
  // 10. Approved contract with runnable flows and no prior decision: the first launch. LAUNCHES the pass.
  return { label: "Run a Production Pass", href: `${app}`, why: "Launch a pass to get a launch decision with evidence.", tone: "primary", launch: { flowIds: "eligible" } };
}

// The ribbon: only-true state facts, in a fixed reading order (deployment identity -> verification ->
// what's wrong -> coverage -> freshness). Absent facts are omitted so the ribbon's length itself signals
// health. Returns short, instrument-style strings the UI renders in mono.
export type RibbonFact = { key: string; text: string; tone: "muted" | "warn" | "bad" | "good" };

export function stateRibbon(s: CommandState): RibbonFact[] {
  const out: RibbonFact[] = [];
  if (s.deploymentLabel) out.push({ key: "deploy", text: s.deploymentLabel, tone: "muted" });
  // Verification status of the CURRENT deployment.
  if (s.newerUnverifiedDeploy) out.push({ key: "verif", text: "newer deploy unverified", tone: "warn" });
  else if (s.decision === "ready") out.push({ key: "verif", text: "verified", tone: "good" });
  else if (s.decision === null && !s.runActive) out.push({ key: "verif", text: "not tested", tone: "muted" });
  if (s.blockerCount > 0) out.push({ key: "block", text: `${s.blockerCount} blocker${s.blockerCount === 1 ? "" : "s"}`, tone: "bad" });
  if (s.repairPendingFullVerify) out.push({ key: "repair", text: "repair awaiting full verification", tone: "warn" });
  // Coverage only for a FULL-coverage pass — a targeted/partial repair run's subset counts must never be
  // shown as if the full critical suite passed.
  if (s.criticalTotal > 0 && s.coverageFull) out.push({ key: "cov", text: `${s.criticalPassed}/${s.criticalTotal} critical`, tone: s.criticalPassed === s.criticalTotal ? "good" : "warn" });
  if (s.contractVersion != null && s.contractApproved) out.push({ key: "contract", text: `contract v${s.contractVersion}`, tone: "muted" });
  return out;
}
