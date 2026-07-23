// Pure-logic regression tests for the guarantee decision core: guaranteeStatus (how a guarantee's live status
// is derived from its latest tagged run + plan_state) and rollupRelease (how N guarantees combine into one
// release decision). No DB, no browser, no clock. These delegate to the single decision translator
// (public-decision.ts, already covered by preflight-decision-verify.ts); what is proven HERE is the guarantee
// precedence and the release roll-up rules that live nowhere else.
import { guaranteeStatus, lastProvenRun } from "../lib/preflight/guarantee-status";
import { rollupRelease } from "../lib/preflight/release-decision";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const run = (state: string, decision: string | null) => ({ state, decision });

// ── guaranteeStatus: plan_state 'review_required' takes precedence over any run outcome ──
ok("plan_review_required overrides even a verified last run (workflow changed since approval)",
  guaranteeStatus(run("completed", "ready"), "review_required") === "plan_review_required");
ok("plan_review_required overrides a failed last run too",
  guaranteeStatus(run("completed", "blocked"), "review_required") === "plan_review_required");

// ── guaranteeStatus: no run ⇒ unproven (freshly approved, or draft) ──
ok("no tagged run + plan ok ⇒ unproven", guaranteeStatus(null, "ok") === "unproven");
ok("no tagged run + plan draft ⇒ unproven", guaranteeStatus(null, "draft") === "unproven");

// ── guaranteeStatus: else delegate to toPublicDecision, with in-flight ⇒ checking ──
ok("completed + ready ⇒ verified", guaranteeStatus(run("completed", "ready"), "ok") === "verified");
ok("completed + blocked ⇒ failed", guaranteeStatus(run("completed", "blocked"), "ok") === "failed");
ok("completed + needs_review ⇒ blocked (no verdict)", guaranteeStatus(run("completed", "needs_review"), "ok") === "blocked");
ok("completed + repair_verified ⇒ blocked (partial repair is not a full pass)", guaranteeStatus(run("completed", "repair_verified"), "ok") === "blocked");
ok("terminal-but-not-completed (state failed) ⇒ blocked", guaranteeStatus(run("failed", null), "ok") === "blocked");
ok("still running (state running) ⇒ checking", guaranteeStatus(run("running", null), "ok") === "checking");
ok("still queued ⇒ checking", guaranteeStatus(run("queued", null), "ok") === "checking");

// ── lastProvenRun: newest-first history, the newest genuinely-verified run ──
{
  const history = [run("running", null), run("completed", "blocked"), run("completed", "ready"), run("completed", "ready")];
  const proven = lastProvenRun(history);
  ok("lastProvenRun returns the newest verified run, skipping in-flight and failed ones", proven === history[2]);
  ok("lastProvenRun is null when nothing ever verified", lastProvenRun([run("completed", "blocked"), run("failed", null)]) === null);
  ok("lastProvenRun is null on empty history", lastProvenRun([]) === null);
}

// ── rollupRelease: critical guarantees gate the release ──
const crit = (statusOnTarget: Parameters<typeof rollupRelease>[0][number]["statusOnTarget"]) => ({ criticality: "critical", statusOnTarget });
ok("all critical verified-on-target ⇒ release verified",
  rollupRelease([crit("verified"), crit("verified"), crit("verified")]) === "verified");
ok("one critical failed-on-target ⇒ release failed (a real regression)",
  rollupRelease([crit("verified"), crit("failed"), crit("verified")]) === "failed");
ok("failed dominates blocked/unproven (release failed, not blocked)",
  rollupRelease([crit("blocked"), crit("failed"), crit("unproven")]) === "failed");
ok("a critical unproven-on-target (no failure) ⇒ release blocked, never verified",
  rollupRelease([crit("verified"), crit("unproven")]) === "blocked");
ok("a critical plan_review_required ⇒ release blocked", rollupRelease([crit("verified"), crit("plan_review_required")]) === "blocked");
ok("a critical checking (in flight) ⇒ release blocked", rollupRelease([crit("verified"), crit("checking")]) === "blocked");
ok("no critical guarantees at all ⇒ release blocked (nothing proven is not shippable)",
  rollupRelease([]) === "blocked");
ok("a non-critical failure does NOT block a release whose criticals are all verified",
  rollupRelease([crit("verified"), { criticality: "important", statusOnTarget: "failed" }]) === "verified");

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
