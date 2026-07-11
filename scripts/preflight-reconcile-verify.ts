// Tests for planReconcile (lib/preflight/issues.ts) — the pure cross-run issue reconciliation that makes a
// rerun VERIFY a repair. Pure, no DB. Encodes the exact fixture progression semantics:
//   broken           -> persistence + mobile issues open
//   partially_fixed  -> persistence flow passes (RESOLVED), mobile still fails (stays OPEN)
//   fixed            -> mobile flow passes (RESOLVED); a skipped flow is NEVER newly verified
// plus regressions (new failure with no matching open issue) and historical preservation (resolve never deletes).
import { planReconcile, type ReconcileFlow, type OpenIssueRef } from "../lib/preflight/issues";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const PERSIST = "flow-persist", MOBILE = "flow-mobile", CREATE = "flow-create";
const openIssues: OpenIssueRef[] = [
  { id: "iss-persist", flowId: PERSIST, category: "persistence_failure" },
  { id: "iss-mobile", flowId: MOBILE, category: "mobile_blocker" },
];

// ── partially_fixed rerun: persistence passes, mobile still fails ──
{
  const ran: ReconcileFlow[] = [
    { flowId: PERSIST, passed: true, failureCategories: [] },
    { flowId: MOBILE, passed: false, failureCategories: ["mobile_blocker"] },
  ];
  const plan = planReconcile(ran, openIssues);
  ok("partially_fixed: persistence issue RESOLVES", plan.resolve.length === 1 && plan.resolve[0] === "iss-persist");
  ok("partially_fixed: mobile issue CONTINUES open (same identity, no duplicate)", plan.continueExisting.length === 1 && plan.continueExisting[0].id === "iss-mobile");
  ok("partially_fixed: no new regression opened", plan.openNew.length === 0);
}

// ── fixed rerun (mobile only): mobile passes, persistence flow did NOT run ──
{
  const stillOpen: OpenIssueRef[] = [{ id: "iss-mobile", flowId: MOBILE, category: "mobile_blocker" }];
  const plan = planReconcile([{ flowId: MOBILE, passed: true, failureCategories: [] }], stillOpen);
  ok("fixed: mobile issue RESOLVES when its flow passes", plan.resolve.length === 1 && plan.resolve[0] === "iss-mobile");
  ok("fixed: nothing continues, nothing new", plan.continueExisting.length === 0 && plan.openNew.length === 0);
}

// ── skipped flow is NEVER newly verified: its open issue is untouched by the plan ──
{
  const plan = planReconcile([{ flowId: MOBILE, passed: false, failureCategories: ["mobile_blocker"] }], openIssues);
  ok("skipped persistence flow: its issue is NOT resolved (unverified)", !plan.resolve.includes("iss-persist"));
  ok("skipped persistence flow: its issue is NOT continued either (untouched)", !plan.continueExisting.some((c) => c.id === "iss-persist"));
}

// ── regression: a previously-passing flow now fails with no matching open issue ──
{
  const plan = planReconcile([{ flowId: CREATE, passed: false, failureCategories: ["functional_failure"] }], openIssues);
  ok("regression: a new failure with no open match OPENS a new issue", plan.openNew.length === 1 && plan.openNew[0].flowId === CREATE && plan.openNew[0].category === "functional_failure");
  ok("regression: existing open issues untouched", plan.resolve.length === 0 && plan.continueExisting.length === 0);
}

// ── same flow, DIFFERENT category: continues the match, opens the new one ──
{
  const plan = planReconcile([{ flowId: MOBILE, passed: false, failureCategories: ["mobile_blocker", "navigation_failure"] }], openIssues);
  ok("category identity: matching category continues", plan.continueExisting.some((c) => c.id === "iss-mobile"));
  ok("category identity: new category on the same flow is a regression", plan.openNew.some((n) => n.flowId === MOBILE && n.category === "navigation_failure"));
}

// ── a passing flow resolves ALL its open issues (multiple categories) ──
{
  const multi: OpenIssueRef[] = [
    { id: "a", flowId: PERSIST, category: "persistence_failure" },
    { id: "b", flowId: PERSIST, category: "fake_success" },
  ];
  const plan = planReconcile([{ flowId: PERSIST, passed: true, failureCategories: [] }], multi);
  ok("pass resolves every open issue on the flow", plan.resolve.length === 2 && plan.resolve.includes("a") && plan.resolve.includes("b"));
}

// ── plans only mutate, never delete: resolve is a status transition (history preserved by design) ──
{
  const plan = planReconcile([{ flowId: PERSIST, passed: true, failureCategories: [] }], openIssues);
  ok("plan has no delete concept (resolution is a transition, history preserved)", !("delete" in plan) && Array.isArray(plan.resolve));
}

// ── empty run: nothing ran, nothing changes ──
{
  const plan = planReconcile([], openIssues);
  ok("no flows ran -> no resolutions, no continues, no regressions", plan.resolve.length === 0 && plan.continueExisting.length === 0 && plan.openNew.length === 0);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
