// The guarantee-to-verification binding: the relationship that makes a guarantee provable.
//
// The defect this exists for: createRun() accepted guaranteeId and NOT ONE CALLER PASSED IT, so
// v_preflight_runs.guarantee_id was never written, and a guarantee could be created, planned and
// human-approved and then never become proven. These assertions are about the relationship being IMPOSSIBLE
// TO LOSE, not about it being present today.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};
const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const runsDb = code("lib/preflight/runs-db.ts");
const planDb = code("lib/preflight/reviewed-plan-db.ts");
const grtDb = code("lib/preflight/guarantees-db.ts");
const apps = code("lib/v-applications.ts");

console.log("── the binding cannot be omitted ──");
// Optional is an invitation to forget, and all four callers had. Required makes "this is a plain
// verification" a decision somebody wrote down.
ok("createRun REQUIRES a guarantee decision", /guarantee: GuaranteeBinding \| null;/.test(runsDb));
ok("it is not optional", !/guaranteeId\?:/.test(runsDb));
const CALLERS = [
  ["launch route", "app/api/preflight/apps/[id]/runs/route.ts"],
  ["rerun route", "app/api/preflight/runs/[runId]/rerun/route.ts"],
  ["seed script", "scripts/preflight-seed-run.ts"],
  ["fixture rerun", "scripts/preflight-fixture-rerun.ts"],
] as const;
for (const [name, f] of CALLERS) {
  ok(`${name} states its answer`, /guarantee:\s*(null|parent\.guaranteeId|guarantee)/.test(code(f)), f);
}

console.log("\n── the run pins the MEANING, not just the id ──");
// approveGuaranteePlan overwrites approved_plan and approved_plan_hash IN PLACE and bumps plan_version, with
// no version history. A run carrying only guarantee_id resolves at READ time to whatever the definition says
// today, so one re-approval silently restates every historical verdict.
for (const field of ["guarantee_plan_version", "guarantee_plan_hash", "guarantee_reviewed_plan_id"]) {
  ok(`the insert carries ${field}`, new RegExp(field).test(runsDb));
}
ok("the pin is one unit: the whole binding drops together when unmigrated",
  /pinGuarantee = false/.test(runsDb) && !/pinGuarantee = true[\s\S]{0,200}guarantee_id: input/.test(runsDb));
// A single reviewed plan is consumed once and expires; a guarantee is reverified forever. So the plan id can
// only ever be provenance copied off the guarantee, never a token replayed per run.
ok("the reviewed plan id is provenance, never an execution token",
  /APPROVAL PROVENANCE|provenance/i.test(readFileSync("lib/preflight/runs-db.ts", "utf8")));

console.log("\n── lineage rides the same insert as the run ──");
// It was a separate UPDATE afterwards inside a try/catch that swallowed every error, so repair lineage could
// be lost silently while the run itself succeeded.
ok("parent_run_id is written by createRun", /parent_run_id: input\.parentRunId/.test(runsDb));
ok("the rerun route no longer patches lineage after the fact",
  !/setParentRun\(/.test(code("app/api/preflight/runs/[runId]/rerun/route.ts")));

console.log("\n── a rerun proves the SAME approved meaning ──");
{
  const rerun = code("app/api/preflight/runs/[runId]/rerun/route.ts");
  ok("it inherits the parent's binding rather than looking up the latest", /parent\.guaranteeId/.test(rerun) && /parent\.guaranteePlanHash/.test(rerun));
  ok("it refuses an archived or foreign guarantee", /guarantee_unavailable/.test(rerun));
  ok("it refuses while the plan is awaiting review", /guarantee_review_required/.test(rerun));
  ok("it refuses a superseded plan", /guarantee_plan_superseded/.test(rerun));
  // Producing evidence and charging for it against a definition nobody currently stands behind is the
  // failure the whole binding exists to prevent.
  ok("every refusal happens BEFORE any money is held",
    rerun.indexOf("guarantee_plan_superseded") < rerun.indexOf("await hold("));
}

console.log("\n── a plan knows which guarantee it defines ──");
ok("mint requires the decision", /guaranteeId: string \| null;/.test(planDb));
// Dedupe matches on (owner, deployment_fp, claim_fp, plan_hash). Without scoping, a guarantee's plan and a
// plain verification of the same sentence were the SAME ROW, and approving one approved the other.
ok("plan reuse is scoped to the guarantee", /q\.eq\("guarantee_id", input\.guaranteeId\) : q\.is\("guarantee_id", null\)/.test(planDb));
ok("the live-plan lookup is scoped too", /findLivePendingPlanForClaim\([^)]*guaranteeId/.test(planDb));
// A plan that was meant to define a guarantee must never quietly become a plain one.
ok("an unmigrated database refuses to mint an unlinked guarantee plan",
  /Refusing to mint an UNLINKED plan/.test(readFileSync("lib/preflight/reviewed-plan-db.ts", "utf8")));

console.log("\n── only a person approves a guarantee ──");
{
  const approve = code("app/api/v1/verifications/plans/[id]/approve/route.ts");
  ok("a machine principal is refused on a guarantee-bound plan", /guarantee_plan_requires_human/.test(approve));
  ok("the refusal is by session, not by scope", /via !== "session"/.test(approve));
  ok("approval records the exact artifact read", /reviewedPlanId: live\.id/.test(code("app/api/preflight/apps/[id]/guarantees/[gid]/approve/route.ts")));
}

console.log("\n── a guarantee's contract cannot hijack the system's own ──");
// getApprovedContract returns the highest-version APPROVED contract. Approving a guarantee materializes one
// on the SAME application, so without this filter one approval would replace the customer's hand-curated
// Production Contract everywhere it is read.
ok("the production contract read excludes guarantee contracts", /\.eq\("kind", "production"\)/.test(apps));
ok("it still works before migration 23", /if \(!filtered\.error\)/.test(apps));

console.log("\n── nothing invents a relationship ──");
const migration = readFileSync("sql/vraelis-preflight-23-guarantee-binding.sql", "utf8");
ok("migration 23 backfills nothing", !/^\s*update\s+v_preflight_runs/im.test(migration.replace(/^--.*$/gm, "")));
ok("no code matches plans to guarantees by hash, claim text or URL",
  !/approved_plan_hash[\s\S]{0,80}===[\s\S]{0,40}plan_hash/.test(grtDb + planDb));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
