// Phase 3.07 acceptance proof: the human-evaluation ("Vraelis Rank") product is fully retired.
// This is the executable form of the 7-point contract:
//   1. No PUBLIC route reaches human evaluation
//   2. No AUTHENTICATED route reaches human evaluation
//   3. No API or WEBHOOK exposes human-evaluation behavior
//   4. No NAVIGATION exposes it
//   5. No FEATURE FLAG can reactivate it
//   6. No BACKGROUND JOB calls it
//   7. No CURRENT verification path executes the retained (deferred) dead sections
// Static assertions (no DB, no network). Historical DB rows/migrations are intentionally NOT
// asserted here — this is a CODE-reachability proof; the data is preserved by design.

import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join } from "path";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? "  — " + detail : ""}`); }
}
const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const gone = (p: string) => !existsSync(p);

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[]; try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    let st; try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { if (e !== "node_modules" && e !== ".next") walk(p, out); }
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

// ── 1. No PUBLIC route reaches human evaluation ──
console.log("\n1. No public route reaches human evaluation");
ok("public crowd-vote UI is gone (app/rank/vote)", gone("app/rank/vote"));
ok("public embed vote widget is gone (app/embed)", gone("app/embed"));
const proxy = read("proxy.ts");
ok("proxy redirects the retired /vote surface home", /path === "\/vote" \|\| path\.startsWith\("\/vote\/"\)/.test(proxy) && proxy.includes('go(req, "/", "redirect")'));

// ── 2. No AUTHENTICATED route reaches human evaluation ──
console.log("\n2. No authenticated route reaches human evaluation");
for (const d of ["tests", "sandbox", "projects", "data", "data-quality", "legacy", "shared", "_workspace"])
  ok(`retired app surface is gone (app/rank/app/${d})`, gone(`app/rank/app/${d}`));
ok("/new is a redirect stub, not the retired vote-creation form",
  read("app/rank/app/new/page.tsx").includes('redirect("/applications/new")') && gone("app/rank/app/new/layout.tsx"));

// ── 3. No API or WEBHOOK exposes human-evaluation behavior ──
console.log("\n3. No API or webhook exposes human-evaluation behavior");
for (const p of [
  "app/api/embed", "app/api/v/vote", "app/api/v/vote-context", "app/api/v/tests",
  "app/api/v/screening-questions", "app/api/v/report-analysis", "app/api/v/report-themes",
  "app/api/v/share", "app/api/v/collection-links", "app/api/v/admin/votes", "app/api/v/check",
  "app/api/v/check-upload", "app/api/v/checks", "app/api/v/projects", "app/api/v/sandbox",
  "app/api/v1/tests", "app/api/v1/check",
]) ok(`retired API is gone (${p})`, gone(p));
const vw = read("lib/v-webhooks.ts");
ok("developer webhooks deliver verification.completed, never the retired test.completed",
  vw.includes('"verification.completed"') && !/"test\.completed"/.test(vw) && !vw.includes("deliverTestCompleted"));

// ── 4. No NAVIGATION exposes it ──
console.log("\n4. No navigation exposes it");
const rankUi = read("app/rank/_components/rank-ui.tsx");
ok("the app shell carries no humanEval prop", !/humanEval/.test(rankUi));
ok("the app nav has no /vote (or other retired) ingress item", !/href:\s*"\/vote"/.test(rankUi));

// ── 5. No FEATURE FLAG can reactivate it ──
console.log("\n5. No feature flag can reactivate it");
// Product code only — a verify script may reference the flag NAME to assert its absence, which is
// not a reactivation switch. The flag can only ship from app/lib/worker/component code.
const productFiles = ["app", "lib", "worker", "components"].flatMap((d) => walk(d));
const flagRefs = productFiles.filter((f) => /humanEvalEnabled|VRAELIS_HUMAN_EVAL/.test(read(f)));
ok("the humanEval flag is removed from product source everywhere (no reactivation switch)", flagRefs.length === 0, flagRefs.join(", "));

// ── 6. No BACKGROUND JOB calls it ──
console.log("\n6. No background job calls it");
ok("the retired check-attachment sweep cron is gone", gone("app/api/cron/attachment-sweep"));
const crons = walk("app/api/cron");
const cronRankRefs = crons.filter((f) => /test\.completed|deliverTestCompleted|v-checks|v-evaluator/.test(read(f)));
ok("no remaining cron references retired human-eval behavior", cronRankRefs.length === 0, cronRankRefs.join(", "));

// ── 7. No CURRENT verification path executes the retained (deferred) dead sections ──
console.log("\n7. No current verification path executes the retained dead sections");
// The deferred split leaves 7 libs + the retired halves of v-db/v-workspace as dead-but-compiling
// code. Prove the CURRENT verification stack imports none of the dead libs and calls none of the
// dead report/vote functions — so nothing a real verification runs can reach them.
const CURRENT_DIRS = ["app/api/preflight", "app/api/v1/verifications", "lib/preflight", "worker/preflight"];
const currentFiles = CURRENT_DIRS.flatMap((d) => walk(d));
const DEAD_LIBS = /from ["'].*\/(v-stats|v-ai|v-themes|v-intelligence|v-analytics|v-content-policy|v-sources)["']/;
const deadLibReach = currentFiles.filter((f) => DEAD_LIBS.test(read(f)));
ok("current verification stack imports NONE of the retained dead libs", deadLibReach.length === 0, deadLibReach.join(", "));
const DEAD_FNS = /\b(completeTest|getReport|getTestWithOptions|launchTest|recordVote|recordJudgment|sharedProjectView|workspaceProjectSummaries|resolveWorkspaceSelection)\b/;
const deadFnReach = currentFiles.filter((f) => DEAD_FNS.test(read(f)));
ok("current verification stack calls NONE of the retained dead report/vote functions", deadFnReach.length === 0, deadFnReach.join(", "));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
