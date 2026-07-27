// The guarantee-to-verification binding: the relationship that makes a guarantee provable.
//
// The defect this exists for: createRun() accepted guaranteeId and NOT ONE CALLER PASSED IT, so
// v_preflight_runs.guarantee_id was never written, and a guarantee could be created, planned and
// human-approved and then never become proven. These assertions are about the relationship being IMPOSSIBLE
// TO LOSE, not about it being present today.
import { readFileSync, existsSync } from "node:fs";
import { before } from "./_source-order";

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
    before(rerun, "guarantee_plan_superseded", "await hold("));
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

console.log("\n── approval produces something runnable ──");
{
  const approve = code("app/api/preflight/apps/[id]/guarantees/[gid]/approve/route.ts");
  const lane = code("lib/preflight/verification-lane.ts");
  // Approval used to store the plan as JSON and stop. A run does not execute JSON; it executes the flow_ids
  // of a contract. So "this run proves that guarantee" was checked against nothing.
  ok("approval materializes the plan into a contract", /prepareVerification\(/.test(approve));
  ok("that contract is marked as a guarantee's, not the system's", /"guarantee",/.test(approve));
  ok("the contract kind is a real parameter", /kind: "production" \| "guarantee"/.test(lane));
  // Unmarked, getApprovedContract would return it as the Production Contract the moment it is approved.
  ok("an unmarkable guarantee contract is refused rather than written",
    /Refusing to materialize an UNMARKED guarantee contract/.test(readFileSync("lib/preflight/verification-lane.ts", "utf8")));
  ok("the guarantee records which contract to run", /setGuaranteePlanContract\(/.test(approve));
  // The person really did approve. That fact must not be lost because a later write failed.
  ok("a failed materialization does not void the approval",
    before(approve, "approveGuaranteePlan(", "prepareVerification("));
  ok("the response says whether it is runnable", /runnable: planContractId !== null/.test(approve));
}

console.log("\n── status is derived, and stale evidence stops counting ──");
{
  const st = code("lib/preflight/guarantee-status.ts");
  ok("every state the founder named exists",
    ["verified", "reverified", "failed", "repairing", "blocked", "checking", "unproven", "plan_review_required"]
      .every((k) => new RegExp(`\\b${k}\\b`).test(st)));
  // approveGuaranteePlan overwrites approved_plan_hash IN PLACE, so runs from before a re-approval proved a
  // DIFFERENT sentence. They stay in the history and stop counting toward the live verdict.
  ok("only runs proving the CURRENT meaning count", /export function provesCurrentMeaning/.test(st));
  ok("a run with no pinned hash is not assumed to match", /Boolean\(run\.planHash\) && run\.planHash === approvedPlanHash/.test(st));
  // Both halves required, or a first run carrying a parent id would claim a repair story it does not have.
  ok("reverified requires a real earlier failure in this guarantee's own history",
    /repairedSomething = Boolean\(latest\.parentRunId\)/.test(st) && /=== "failed"/.test(st));
  ok("review required outranks any verdict", before(st, 'planState === "review_required"', "qualifying[0]"));
  ok("every decision goes through the canonical translator", /toPublicDecision\(/.test(st) && !/decision === "ready"/.test(st));
  // One Verified run must never read as permanent health.
  ok("the labels say 'most recently', never a bare permanent verdict",
    /Verified most recently/.test(st) && /Failed most recently/.test(st));
  ok("the coverage disclosure is stated once and shared",
    /GUARANTEE_COVERAGE_NOTE/.test(st) && /not continuous or complete coverage/.test(st));
}

console.log("\n── the launch boundary is respected ──");
{
  // The acceptance-boundary ratchet exists because the coverage gate sits in the caller ABOVE the shared
  // handler, so every new entrance can forget it. A verify-this-guarantee action IS a new entrance, and it
  // waited for the acceptance service rather than working around the boundary.
  const boundary = readFileSync("scripts/preflight-acceptance-boundary-verify.ts", "utf8");
  ok("the ratchet still names exactly one permitted route-to-route import",
    /KNOWN_ROUTE_TO_ROUTE = new Set\(\["app\/api\/v1\/verifications\/route\.ts"\]\)/.test(boundary));

  // This used to assert the route did NOT exist, because building it before the acceptance service would
  // have meant a third copy of the money path. The service landed, so the precondition is satisfied and the
  // assertions below are what that "not yet" was protecting.
  const VERIFY = "app/api/preflight/apps/[id]/guarantees/[gid]/verify/route.ts";
  ok("the verify-this-guarantee entrance exists", existsSync(VERIFY));
  const verify = code(VERIFY);
  ok("it goes through the acceptance service", /acceptVerificationRun\(/.test(verify));
  ok("it does not create runs itself", !/\bcreateRun\s*\(/.test(verify));
  ok("it does not import another route handler", !/\bPOST as \w+/.test(verify));
}

console.log("\n── the guarantee a run proves is resolved server-side, never asserted by the caller ──");
{
  const verify = code("app/api/preflight/apps/[id]/guarantees/[gid]/verify/route.ts");

  // THE FALSE-VERIFIED PRIMITIVE. If this entrance read a guarantee id, a plan hash or a flow list from the
  // request body, any editor could post one trivial passing journey alongside the tenant's most critical
  // guarantee id and that guarantee would render Verified. The id comes from the URL; everything executable
  // comes from the approved record.
  ok("the binding is read from the stored guarantee", /getGuarantee\(owner, gid\)/.test(verify));
  ok("no guarantee id is accepted from the body", !/body\?\.guarantee/i.test(verify));
  ok("no plan hash is accepted from the body", !/body\?\.plan_hash|body\?\.planHash/i.test(verify));
  ok("no flow list is accepted from the body", !/body\?\.flow_ids|body\?\.flowIds/i.test(verify));
  ok("the flows come from the frozen approved contract", /listFlows\(owner, g\.plan_contract_id\)/.test(verify));
  ok("the pin sent to the service is the guarantee's own fields",
    /planHash: g\.approved_plan_hash/.test(verify) && /planVersion: g\.plan_version/.test(verify));

  // An unapproved definition has no human behind it, so it cannot be proved.
  ok("an unapproved guarantee is refused", /guarantee_not_approved/.test(verify) && /g\.plan_state !== "ok"/.test(verify));
  ok("a re-approval pending review is named as such", /review_required/.test(verify));
  // Approval deliberately stands even when materializing the contract fails, so approved does not imply
  // runnable, and the entrance must say which it is instead of inventing a contract at launch.
  ok("an approved-but-unmaterialized guarantee is refused, not improvised",
    /guarantee_not_runnable/.test(verify) && /!g\.plan_contract_id/.test(verify));
}

console.log("\n── a reverification inherits a lineage, it does not choose one ──");
{
  const verify = code("app/api/preflight/apps/[id]/guarantees/[gid]/verify/route.ts");
  const internal = code("lib/preflight/run-report-db.ts");

  // ONE reader, not a second one. getRunInternal already existed for exactly this, and its own comment says
  // why: "so a rerun can INHERIT the meaning it proved rather than look up whatever the guarantee says
  // today". It also degrades correctly on a pre-migration database. A parallel pin reader was written for
  // this route and then deleted — two live reads of the same fact is how they drift apart.
  ok("the parent pin is READ off the parent run", /getRunInternal\(owner, rawParent\)/.test(verify));
  ok("it reuses the existing internal reader rather than adding a second one",
    !/runGuaranteePin/.test(verify) && /guarantee_plan_hash, guarantee_reviewed_plan_id/.test(internal));
  ok("a parent with no guarantee cannot anchor a reverification", /!pin \|\| !pin\.guaranteeId/.test(verify));
  // One guarantee's failure must never be presented as another guarantee's repair.
  ok("a parent from a different guarantee is refused",
    /parent_guarantee_mismatch/.test(verify) && /pin\.guaranteeId !== gid/.test(verify));
  // Re-approval is a new meaning. Attributing it to the old failure would restate history.
  ok("a parent proved under a superseded plan is refused",
    /parent_plan_superseded/.test(verify) && /pin\.guaranteePlanHash !== g\.approved_plan_hash/.test(verify));
  ok("the parent is carried into the run, so the repair chain is stored not inferred",
    /parentRunId,/.test(verify));
}

console.log("\n── a guarantee can find the plan it just minted (mint and find scope identically) ──");
{
  const db = code("lib/preflight/reviewed-plan-db.ts");
  const approve = code("app/api/preflight/apps/[id]/guarantees/[gid]/approve/route.ts");
  const detail = code("app/rank/app/applications/[id]/guarantees/[gid]/page.tsx");
  const prepare = code("app/api/preflight/apps/[id]/guarantees/[gid]/prepare/route.ts");

  // THE DEFECT: the lookup filtered `.eq("guarantee_id", guaranteeId as never)` unconditionally. PostgREST
  // renders .eq(col, null) as `guarantee_id=eq.null`, which matches neither a real id nor a SQL NULL, so it
  // returned nothing on BOTH paths. Approval was unreachable: prepare minted a plan carrying the guarantee's
  // id, and nothing could ever find it again. The `as never` cast is what let it compile.
  ok("the null case uses .is(), not .eq(col, null)",
    /\.is\("guarantee_id", null\)/.test(db) && !/\.eq\("guarantee_id", guaranteeId as never\)/.test(db));
  ok("a guarantee lookup filters by the guarantee id", /\.eq\("guarantee_id", guaranteeId\)/.test(db));
  // Mint has always had the correct shape. The two must agree or a plan is unfindable the moment it is made.
  ok("mint still scopes the same way", /input\.guaranteeId \? q\.eq\("guarantee_id", input\.guaranteeId\) : q\.is\("guarantee_id", null\)/.test(db));

  // Every caller must SAY which guarantee it means. Omitting the argument silently asks for an unlinked plan.
  const calls = [...code("app/api/preflight/apps/[id]/guarantees/[gid]/approve/route.ts").matchAll(/findLivePendingPlanForClaim\(([^)]*)\)/g)].map((m) => m[1]);
  ok("the approve route passes the guarantee id", calls.some((c) => /,\s*gid\s*$/.test(c)));
  ok("the detail page passes the guarantee id", /findLivePendingPlanForClaim\([^)]*,\s*gid\)/.test(detail));
  ok("prepare still passes it too", /findLivePendingPlanForClaim\([^)]*,\s*gid\)/.test(prepare));
  ok("no caller omits it", !/findLivePendingPlanForClaim\(owner, app\.app_url, g\.title\)/.test(approve + detail + prepare));

  // Pre-migration, an unscoped match could hand a guarantee a plain verification's plan sharing its claim
  // and URL, and it would be approved as that guarantee's meaning. Refuse, exactly as mint refuses.
  ok("an unmigrated column refuses rather than matching an unlinked plan",
    /Refusing to match an UNLINKED plan to a guarantee/.test(readFileSync("lib/preflight/reviewed-plan-db.ts", "utf8")));
}

console.log("\n── the record says which promise it proves, and whether that promise still stands ──");
{
  const record = code("app/rank/app/applications/[id]/passes/[runId]/page.tsx");
  // A run bound to a guarantee that says nothing about it is a record a customer cannot audit.
  ok("the record reads the guarantee from the run's OWN pin", /internal\.guaranteeId \? getGuarantee\(owner, internal\.guaranteeId\)/.test(record));
  ok("it names the guarantee and links to it", /guarantee\.title/.test(record) && /guarantees\/\$\{guarantee\.id\}/.test(record));
  ok("it states the approved plan version the run executed", /internal\.guaranteePlanVersion/.test(record));
  // The drift rule is DERIVED, not restated: one definition of "still the current meaning" for the whole
  // product, so a record and a guarantee page can never disagree about the same run.
  ok("drift is decided by the shared rule, not re-implemented here",
    /provesCurrentMeaning\(/.test(record) && !/planHash === /.test(record));
  ok("a superseded record says it no longer counts", /superseded definition/.test(record));
  // Absent must read as absent.
  ok("a run with no guarantee renders no guarantee", /guarantee \? \(/.test(record));

  // The list page may only claim what is now true: proving on demand IS wired; proving automatically on
  // each new deployment is NOT, and saying otherwise would be the misleading copy this whole pass removed.
  // Whitespace-collapsed, because these assert a CLAIM and not a line wrap. The previous version pinned the
  // exact break positions and failed when the paragraph was reflowed around an unrelated edit, reporting
  // copy that still said the right thing as copy that had stopped saying it.
  const list = readFileSync("app/rank/app/guarantees/page.tsx", "utf8").replace(/\s+/g, " ");
  ok("the guarantees page no longer says verification is unwired",
    !/Re-checking a guarantee automatically against each new deployment is not wired up yet/.test(list));
  ok("it still says automatic re-checking is not wired",
    /automatically as each new deployment appears is not wired up yet/.test(list));
  // And now that a verdict is reachable, the page must actually show one rather than only the plan's state.
  ok("the guarantees page reports the verification verdict, not only the plan state",
    /guaranteeStatus\(/.test(list) && /GUARANTEE_STATUS_LABEL/.test(list));
  ok("the verdict comes from the newest NON-invalidated run",
    /is\("invalidated_at", null\)/.test(readFileSync("lib/preflight/guarantees-db.ts", "utf8")));
}

console.log("\n── the API and the CLI carry the same relationship the console does ──");
{
  const api = code("app/api/v1/verifications/[id]/route.ts");
  // An agent could read the decision and the evidence and had no way to learn which standing promise it
  // belonged to, whether it repaired an earlier run, or where a human would open the record.
  ok("the API returns the guarantee it proved", /guarantee_id: internal\?\.guaranteeId/.test(api));
  ok("it returns the exact meaning proved, not just the id", /guarantee_plan_hash/.test(api));
  ok("it returns the repair relationship", /reverification_of: detail\.run\.parent_run_id/.test(api));
  ok("it returns a console record URL", /console_url: recordUrl/.test(api));
  // Absent must read as absent. A title invented for a run with no guarantee would be the same class of
  // defect as inventing the guarantee itself.
  ok("guarantee fields are omitted when there is no guarantee", /\.\.\.\(guarantee \? \{/.test(api));

  const cli = readFileSync("cli/vraelis.mjs", "utf8");
  ok("the CLI prints the guarantee, the repair link and the record URL", /Guarantee  \$\{v\.guarantee_title\}/.test(cli) && /console_url/.test(cli));
  ok("each CLI line appears only when the API returned it", /if \(v\.guarantee_title\) say/.test(cli));
  // The founder banned middots in ALL visible copy; two had survived in the CLI's own output.
  ok("no middots in CLI output", !cli.includes("·"));
}

console.log("\n── nothing invents a relationship ──");
const migration = readFileSync("sql/vraelis-preflight-23-guarantee-binding.sql", "utf8");
ok("migration 23 backfills nothing", !/^\s*update\s+v_preflight_runs/im.test(migration.replace(/^--.*$/gm, "")));
ok("no code matches plans to guarantees by hash, claim text or URL",
  !/approved_plan_hash[\s\S]{0,80}===[\s\S]{0,40}plan_hash/.test(grtDb + planDb));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
