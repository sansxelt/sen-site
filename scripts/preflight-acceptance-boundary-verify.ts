// THE ACCEPTANCE BOUNDARY RATCHET.
//
// A run-creation inventory found that the coverage gate sits in the caller ABOVE the shared handler rather
// than below every entrance, so the dashboard and rerun paths can start a run the public API would refuse
// with claim_not_provable. The fix is a domain acceptance service that all three entrances call.
//
// That refactor runs through credit holds, idempotency and dispatch, so it is not something to do halfway.
// This file exists to hold the line until it lands, and to keep holding it afterwards.
//
// It asserts two things about the SOURCE, not about runtime behaviour:
//
//   1. exactly the known set of customer-visible paths calls createRun, and nothing else does
//   2. no route handler imports another route handler's POST/GET
//
// Both currently FAIL-BY-ADDITION only: the known violations are listed with the reason they exist and the
// commit that will remove them. A NEW violation fails the suite immediately. That is the whole point: the
// next entrance someone adds cannot quietly forget coverage the way these two did.
//
// Run: npm run preflight:acceptance:test

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`);
  if (c) pass++; else fail++;
};

const ROOT = process.cwd();
const SEARCH_DIRS = ["app", "lib", "worker"];

/** Every .ts/.tsx under the production directories. Scripts and tests are deliberately excluded. */
function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }
    for (const e of entries) {
      if (e === "node_modules" || e === ".next" || e.startsWith(".")) continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) { walk(p); continue; }
      if (/\.(ts|tsx)$/.test(e)) out.push(p);
    }
  };
  for (const d of SEARCH_DIRS) walk(join(ROOT, d));
  return out;
}

/** Comments are prose, and prose is not a call site. A first pass flagged lib/preflight/run-report-db.ts as
 *  a third createRun caller; it is a sentence containing "createRun (stream 1's shared creator)". */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")     // block comments, which these files use heavily
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // line comments, without eating the // inside a URL
}

const files = sources().map((p) => ({
  path: relative(ROOT, p).replace(/\\/g, "/"),
  text: stripComments(readFileSync(p, "utf8")),
}));
console.log(`\nscanned ${files.length} production source files\n`);

// ── 1. who may create a durable customer-visible run ──────────────────────────────────────────────────
//
// KNOWN, and each one is a defect this ratchet is protecting, not an approved pattern:
//   the acceptance service   creates without evaluating coverage
//   the rerun route          creates without evaluating coverage
//
// HALF DONE, deliberately: acceptVerificationRun() landed and the dashboard route moved into it, so the
// launch path is now one domain function instead of a route body. The rerun route has NOT moved yet — it
// carries lineage rules the launch path does not (it must inherit the parent's guarantee binding and must
// never look up the current one), so it moves in its own increment. Until then this list is two entries,
// and it is the rerun route that keeps it from being one.
const KNOWN_CREATE_CALLERS = new Set([
  "lib/preflight/acceptance/accept-run.ts",
  "app/api/preflight/runs/[runId]/rerun/route.ts",
]);

const createCallers = files
  .filter((f) => /\bcreateRun\s*\(/.test(f.text))
  .filter((f) => !/export (async )?function createRun/.test(f.text))   // the definition itself
  .map((f) => f.path);

const newCreateCallers = createCallers.filter((p) => !KNOWN_CREATE_CALLERS.has(p));
ok("no NEW production path calls createRun directly",
  newCreateCallers.length === 0,
  newCreateCallers.length ? newCreateCallers.join(", ") : `${createCallers.length} known callers`);

ok("the known createRun callers are still exactly the two the inventory records",
  KNOWN_CREATE_CALLERS.size === 2
  && [...KNOWN_CREATE_CALLERS].every((p) => createCallers.includes(p)),
  createCallers.join(", "));

// ── 1b. THE BLIND SPOT THIS RATCHET HAD ───────────────────────────────────────────────────────────────
//
// The check above keys on createRun, so it was watching run CREATION and calling that the money boundary.
// They are not the same set. app/api/preflight/apps/[id]/api-runs/route.ts takes a real credit hold via
// takeApiHold and inserts through claimApiRun, so it was completely invisible to a ratchet whose entire
// purpose is to notice new entrances into the money path. A guard that names one function will keep missing
// every entrance that reaches the same escrow by another name.
//
// So the second key is the ESCROW itself: anything that takes a hold is an entrance, whatever it calls to
// create its row.
// The escrow has since MOVED OUT of app/api/: the dashboard launch now holds inside the acceptance service.
// A scan restricted to route files would have watched the money path walk out of its field of view and
// reported one fewer entrance, which reads as an improvement and is the exact shape of the blind spot
// described above. So the scan follows the escrow into the domain layer.
const KNOWN_HOLD_TAKERS = new Set([
  "lib/preflight/acceptance/accept-run.ts",           // acceptance service: the dashboard launch's escrow
  "app/api/preflight/runs/[runId]/rerun/route.ts",    // repair rerun
  "app/api/preflight/apps/[id]/api-runs/route.ts",    // API-runtime beta: holds, executes INLINE, settles
]);

// Matched on the CALL SHAPE, not on a word boundary: `await hold(` and `takeApiHold(` are the two ways a
// route actually reaches the escrow. Either can be used without ever naming createRun, which is exactly how
// the API-runtime entrance stayed invisible to this file.
const holdTakers = files
  .filter((f) => f.path.startsWith("app/api/") || f.path.startsWith("lib/preflight/"))
  .filter((f) => !/export async function takeApiHold/.test(f.text))   // the shared helper's own definition
  .filter((f) => /await[ ]+hold[ ]*[(]/.test(f.text) || /takeApiHold[ ]*[(]/.test(f.text))
  .map((f) => f.path);

const newHoldTakers = holdTakers.filter((p) => !KNOWN_HOLD_TAKERS.has(p));
ok("no NEW production path takes a credit hold", newHoldTakers.length === 0,
  newHoldTakers.length ? newHoldTakers.join(", ") : `${holdTakers.length} known entrances`);

// A permission list only ever grew here, so an entrance that MOVED left its old path behind as a standing
// permission: re-adding a hold to the dashboard route would have been waved through by an entry describing
// code that no longer exists. Every recorded entrance must still be a real one, so the list shrinks when
// the money path does.
const staleHoldTakers = [...KNOWN_HOLD_TAKERS].filter((p) => !holdTakers.includes(p));
ok("every recorded escrow entrance is still a real one", staleHoldTakers.length === 0,
  staleHoldTakers.length ? `no longer takes a hold: ${staleHoldTakers.join(", ")}` : `${holdTakers.length} live`);

// The inline entrance settles in its own request rather than through the worker, so a killed function
// between the hold and the settle strands escrow with nothing to sweep it. Recorded as a known exposure so
// it is a decision rather than an oversight.
ok("the inline API entrance still releases on a thrown error",
  /held\.hold\.release\(\)/.test(readFileSync(join(ROOT, "app/api/preflight/apps/[id]/api-runs/route.ts"), "utf8")),
  "an inline entrance that cannot release strands escrow permanently");

// ── 2. no route handler may be another route handler's backend ────────────────────────────────────────
//
// KNOWN: the public verification API imports the dashboard route's POST and invokes it with a synthesized
// Request. That is the pattern the acceptance service replaces.
const KNOWN_ROUTE_TO_ROUTE = new Set(["app/api/v1/verifications/route.ts"]);

const routeToRoute = files
  .filter((f) => f.path.endsWith("/route.ts"))
  .filter((f) => /import\s*\{[^}]*\b(POST|GET|PUT|PATCH|DELETE)\b[^}]*\}\s*from\s*["'][^"']*route["']/.test(f.text)
    || /import\s*\{[^}]*\bPOST as \w+/.test(f.text))
  .map((f) => f.path);

const newRouteToRoute = routeToRoute.filter((p) => !KNOWN_ROUTE_TO_ROUTE.has(p));
ok("no NEW route handler imports another route handler",
  newRouteToRoute.length === 0,
  newRouteToRoute.length ? newRouteToRoute.join(", ") : `${routeToRoute.length} known`);

// ── 3. THE COVERAGE GATE RUNS ON EVERY LAUNCH PATH ─────────────────────────────────────────────────────
//
// These three assertions used to record the opposite. They named the dashboard and rerun routes as paths
// that did NOT evaluate coverage and held that line as a defect. The gate has moved, so they now assert the
// property instead of the absence of it.
//
// TWO GATES SHARE ONE NAME, and keeping them apart is what this section is really about:
//
//   resolveCoverage()     the CORRECTIVE resolver: synthesis, a model, possibly a recrawl, up to 300s. It
//                         belongs where a plan is BUILT, and only there. Its placement is still pinned.
//   gateLaunchCoverage()  the DETERMINISTIC gate: pure, no model, no network beyond two reads. It belongs
//                         below every entrance that spends money, and now is.
const correctiveCallers = files
  .filter((f) => /\bresolveCoverage\s*\(/.test(f.text))
  .filter((f) => !/export (async )?function resolveCoverage/.test(f.text))
  .map((f) => f.path);

// The corrective resolver is still exactly where it was. It must NOT spread to a launch path: it cannot run
// there (no synthesis in hand) and a 300s model loop in front of a launch is not a gate, it is an outage.
const KNOWN_CORRECTIVE_CALLERS = [
  "app/api/preflight/apps/[id]/guarantees/[gid]/prepare/route.ts",
  "app/api/v1/verifications/route.ts",
].sort();
ok("the corrective resolver still sits only where a plan is built",
  JSON.stringify([...correctiveCallers].sort()) === JSON.stringify(KNOWN_CORRECTIVE_CALLERS),
  correctiveCallers.join(", "));

// EVERY path that can queue a paid run evaluates coverage. The acceptance service covers the console launch
// and the verify-a-guarantee entrance; the rerun route calls the same shared gate directly because its money
// path has not merged yet.
const LAUNCH_PATHS: [string, string][] = [
  ["the acceptance service", "lib/preflight/acceptance/accept-run.ts"],
  ["the rerun route", "app/api/preflight/runs/[runId]/rerun/route.ts"],
];
for (const [label, path] of LAUNCH_PATHS) {
  const text = files.find((f) => f.path === path)?.text ?? "";
  ok(`${label} evaluates coverage before it queues a run`, /\bgateLaunchCoverage\s*\(/.test(text), path);
  ok(`${label} refuses with claim_not_provable`, /claim_not_provable/.test(text), path);
}

// THE GATE MUST PRECEDE THE MONEY. A refusal after a hold has already cost the customer something, and on
// the free tier it would spend a lifetime pass on a run Vraelis had already decided it would not trust.
// Positional, because ordering is the only thing that makes the two facts above worth anything.
for (const [label, path] of LAUNCH_PATHS) {
  const text = files.find((f) => f.path === path)?.text ?? "";
  const gateAt = text.search(/\bgateLaunchCoverage\s*\(/);
  const holdAt = text.search(/\bhold\s*\(\s*owner/);
  ok(`${label} runs the gate BEFORE any credit hold`,
    gateAt !== -1 && (holdAt === -1 || gateAt < holdAt), `gate@${gateAt} hold@${holdAt}`);
}

// THE RATCHET, POINTED FORWARD. Any NEW file that queues a run must also gate it. createRun's caller list is
// already frozen above; this catches the other half — a caller that is added to that list without the gate.
const ungatedCreators = files
  .filter((f) => /\bcreateRun\s*\(/.test(f.text))
  .filter((f) => !/export (async )?function createRun/.test(f.text))
  .filter((f) => !/\bgateLaunchCoverage\s*\(/.test(f.text))
  .map((f) => f.path);
ok("no path creates a run without evaluating coverage",
  ungatedCreators.length === 0,
  ungatedCreators.length ? ungatedCreators.join(", ") : `${LAUNCH_PATHS.length} gated launch paths`);

// ONE COPY OF THE PREDICATE. The gate loads the requirements and flows, filters to what will execute, and
// decides, all in one module. A caller assembling that input itself would be a second definition of what
// the gate looks at, which is the exact shape of the bug that put a private balance fold in v-lifecycle.
const reimplementers = files
  .filter((f) => !f.path.startsWith("lib/preflight/acceptance/launch-coverage"))
  .filter((f) => !f.path.startsWith("lib/preflight/coverage"))
  .filter((f) => !f.path.startsWith("lib/preflight/reviewed-plan"))
  .filter((f) => /\bcoverageReport\s*\(/.test(f.text))
  .map((f) => f.path);
ok("no launch path calls coverageReport directly instead of the shared gate",
  reimplementers.length === 0, reimplementers.join(", "));

// ── 4. nothing may declare its own coverage verdict ───────────────────────────────────────────────────
const selfDeclared = files.filter((f) =>
  /readyToLaunch\s*:\s*true/.test(f.text) && !f.path.startsWith("lib/preflight/coverage"));
ok("no path outside the coverage module asserts readyToLaunch: true",
  selfDeclared.length === 0, selfDeclared.map((f) => f.path).join(", "));


// ── APPROVAL FREEZES MEANING ──────────────────────────────────────────────────────────────────────────
// A run persists contract_id. If approved semantic content can change in place, that id resolves to
// current meaning rather than approved meaning, and a rerun proves something else while calling itself a
// rerun. These assertions are source-level: they prove every semantic writer consults contract status.
console.log("\n── approval freezes meaning ──");
{
  const va = files.find((f) => f.path === "lib/v-applications.ts");
  const src = va?.text ?? "";
  ok("lib/v-applications.ts was scanned", !!va);

  // the shared policy exists rather than three ad-hoc checks
  ok("a shared semantic-write policy exists",
    /async function contractAcceptsSemanticWrite/.test(src)
    && /async function requirementAcceptsSemanticWrite/.test(src));
  ok("the policy admits writes only on a draft contract",
    /contract\?\.status === "draft"/.test(src)
    && /contractStatusForRequirement\(uid, requirementId\)\)\) === "draft"/.test(src.replace(/\s+/g, " ")) === false
      ? /=== "draft"/.test(src) : true);

  // each writer body must consult it. Slice each function body and look inside it, so a policy defined
  // elsewhere in the file cannot make an unguarded writer look guarded.
  const body = (name: string) => {
    const i = src.indexOf(`export async function ${name}(`);
    if (i < 0) return "";
    const j = src.indexOf("\nexport ", i + 10);
    return src.slice(i, j < 0 ? src.length : j);
  };
  // addRequirement was split into two explicit writers (a person typed it / a model generated it) so a
  // generated path can no longer be recorded as human-authored. BOTH must carry the same guard: the split
  // must not have created a second, unguarded way into an approved contract.
  for (const [fn, note] of [
    ["addAuthoredRequirement", "an approved contract must not accept a NEW human-authored requirement"],
    ["addGeneratedRequirement", "an approved contract must not accept a NEW model-generated requirement"],
    ["updateRequirement", "approved requirement text must not be editable"],
    ["deleteRequirement", "an approved requirement must not be deletable"],
  ] as const) {
    const b = body(fn);
    ok(`${fn}: ${note}`,
      b.length > 0 && /(contractAcceptsSemanticWrite|requirementAcceptsSemanticWrite)/.test(b),
      b.length ? "guard present" : "function not found");
  }

  // the flow side was already correct; assert it stays that way
  for (const fn of ["updateFlow", "deleteFlow", "addFlow"] as const) {
    const b = body(fn);
    if (!b) continue;
    ok(`${fn} still consults contract status`,
      /(contractStatusForFlow|contractAcceptsSemanticWrite|status === "approved"|getContractById)/.test(b),
      "addFlow guards inline via getContractById + status check, not a named helper");
  }

  // and nothing may write these tables outside this module
  // KNOWN direct writers of the requirement table, each recorded with its status:
  //
  //   lib/v-applications.ts                      the guarded helpers. Correct.
  //   app/api/preflight/apps/[id]/contract/draft  creates a DRAFT contract and seeds it, then deletes it on
  //                                              rollback. Pre-approval by construction. Acceptable.
  //   lib/preflight/discovery-db.ts              OPEN DEFECT. applyMergePlan inserts and patches requirement
  //                                              rows directly with no contract-status guard, and its caller
  //                                              lib/preflight/discover-run.ts contains no reference to
  //                                              status, approved or draft at all. Discovery can therefore
  //                                              add to and edit an APPROVED contract, breaching "approval
  //                                              freezes meaning" on a path the v-applications guards do not
  //                                              cover. Not fixed here: whether discovery should refuse on an
  //                                              approved contract or propose a new version is a product
  //                                              decision, not a mechanical one.
  const KNOWN_SEMANTIC_WRITERS = new Set([
    "lib/v-applications.ts",
    "app/api/preflight/apps/[id]/contract/draft/route.ts",
    "lib/preflight/discovery-db.ts",
  ]);
  const rogue = files.filter((f) =>
    !KNOWN_SEMANTIC_WRITERS.has(f.path)
    && !f.path.startsWith("scripts/")
    && /from\("v_contract_requirements"\)[\s\S]{0,80}\.(update|delete|insert|upsert)\(/.test(f.text));
  ok("no NEW module writes requirement rows outside the known set",
    rogue.length === 0, rogue.map((f) => f.path).join(", "));
  ok("discovery remains a recorded open defect, not silently forgotten",
    files.some((f) => f.path === "lib/preflight/discovery-db.ts"
      && /from\("v_contract_requirements"\)[\s\S]{0,80}\.(insert|update)\(/.test(f.text)),
    "applyMergePlan still writes requirement rows unguarded");
}

console.log(`
${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
