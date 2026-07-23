// Regression tests for S4 — deployment identity: canonical URL identity + strict dedupe, the loose
// verification match, the pure human-readable comparison, the "new deployment unverified" decision core
// with injected rows, and static checks for the migration rule (migration 8 unapplied must fail clearly,
// naming sql/vraelis-preflight-8-deployments.sql, without ever breaking run launch, the run report, or
// the application overview), owner scoping on every v_deployments query, the ONE combined createRun
// retry path for both pin columns, provider_deployment_id confinement to the Technical details
// disclosure, and the banner never replacing the health decision.
// Pure unit tests + static source checks; no DB, no network, no browser.
// Pattern follows scripts/preflight-context-verify.ts: PASS/FAIL counters, exit 1 on any FAIL.
import { readFileSync } from "node:fs";
import {
  canonicalDeploymentUrl, sameDeploymentIdentity, runTestedDeployment,
  compareDeployments, pickUnverifiedNewer,
  type Deployment,
} from "../lib/preflight/deployments-db";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const read = (p: string) => readFileSync(p, "utf8");
// Blank out // and /* */ comments so string checks never match documentation.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

// ── canonical URL identity ──
console.log("── canonical deployment URL ──");
ok("host is lowercased, path case preserved",
  canonicalDeploymentUrl("https://APP.Example.COM/Path?q=1") === "https://app.example.com/Path?q=1");
ok("surrounding whitespace is trimmed",
  canonicalDeploymentUrl("  https://app.example.com  ") === "https://app.example.com");
ok("a bare root slash and no path are the same deployment",
  canonicalDeploymentUrl("https://app.example.com/") === canonicalDeploymentUrl("https://app.example.com"));
ok("query strings are preserved (routing-significant)",
  canonicalDeploymentUrl("https://a.com/x?mode=fixed") !== canonicalDeploymentUrl("https://a.com/x?mode=broken"));
ok("an unparseable value falls back to its trimmed self, never throws",
  canonicalDeploymentUrl(" not a url ") === "not a url" && canonicalDeploymentUrl("") === "" && canonicalDeploymentUrl(null) === "");

// ── strict dedupe identity ──
console.log("\n── dedupe identity (strict: URL + commit) ──");
ok("same URL (host case differs) + same commit -> same deployment",
  sameDeploymentIdentity({ url: "https://App.Example.com/", commit_sha: "ABC123DEF0" }, { url: "https://app.example.com", commit_sha: "abc123def0" }));
ok("same URL, both commits absent -> same deployment",
  sameDeploymentIdentity({ url: "https://a.com", commit_sha: null }, { url: "https://a.com/", commit_sha: "" }));
ok("same URL, different commits -> different deployments",
  !sameDeploymentIdentity({ url: "https://a.com", commit_sha: "aaa1111" }, { url: "https://a.com", commit_sha: "bbb2222" }));
ok("same URL, one commit absent -> different (strict for dedupe)",
  !sameDeploymentIdentity({ url: "https://a.com", commit_sha: "aaa1111" }, { url: "https://a.com", commit_sha: null }));
ok("different URLs -> different deployments",
  !sameDeploymentIdentity({ url: "https://a.com", commit_sha: null }, { url: "https://b.com", commit_sha: null }));

// ── loose verification match ──
console.log("\n── run-tested-deployment (loose: commits must agree only when both exist) ──");
ok("URL match, run has no commit, deployment does -> still verified that URL",
  runTestedDeployment({ deployment_url: "https://a.com/", commit_sha: null }, { url: "https://a.com", commit_sha: "abc1234" }));
ok("URL match, both commits equal -> match",
  runTestedDeployment({ deployment_url: "https://a.com", commit_sha: "ABC1234" }, { url: "https://a.com", commit_sha: "abc1234" }));
ok("URL match, commits differ -> no match",
  !runTestedDeployment({ deployment_url: "https://a.com", commit_sha: "abc1234" }, { url: "https://a.com", commit_sha: "def5678" }));
ok("URL mismatch -> no match",
  !runTestedDeployment({ deployment_url: "https://b.com", commit_sha: null }, { url: "https://a.com", commit_sha: null }));
ok("a run with no deployment_url never matches",
  !runTestedDeployment({ deployment_url: null, commit_sha: null }, { url: "https://a.com", commit_sha: null }));

// ── compareDeployments ──
console.log("\n── compareDeployments ──");
const OLD = { url: "https://a.com", environment: "preview", repo: "acme/dash", branch: "main", commit_sha: "aaa1111222233334444" };
ok("identical identities diff to nothing", compareDeployments(OLD, { ...OLD }).length === 0);
ok("URL change line",
  compareDeployments(OLD, { ...OLD, url: "https://b.com" }).some((l) => l === "URL changed from https://a.com to https://b.com"));
ok("commit change uses short shas",
  compareDeployments(OLD, { ...OLD, commit_sha: "bbb5555666677778888" }).some((l) => l === "Commit changed from aaa1111222 to bbb5555666"));
ok("commit recorded where the previous had none",
  compareDeployments({ ...OLD, commit_sha: null }, OLD).some((l) => l === "Commit aaa1111222 recorded (the previous deployment had none)"));
ok("commit no longer recorded",
  compareDeployments(OLD, { ...OLD, commit_sha: null }).some((l) => l === "Commit no longer recorded (was aaa1111222)"));
ok("branch change line",
  compareDeployments(OLD, { ...OLD, branch: "hotfix" }).some((l) => l === "Branch changed from main to hotfix"));
ok("repository change line",
  compareDeployments(OLD, { ...OLD, repo: "acme/dash-v2" }).some((l) => l === "Repository changed from acme/dash to acme/dash-v2"));
ok("environment change line (case-normalized)",
  compareDeployments(OLD, { ...OLD, environment: "Production" }).some((l) => l === "Environment changed from preview to production")
  && compareDeployments(OLD, { ...OLD, environment: "Preview" }).length === 0);
ok("several changes stack as separate lines",
  compareDeployments(OLD, { url: "https://b.com", environment: "production", repo: OLD.repo, branch: "release", commit_sha: "ccc9999000011112222" }).length === 4);

// ── pickUnverifiedNewer with injected rows ──
console.log("\n── pickUnverifiedNewer (the banner decision core) ──");
function mkDeployment(over: Partial<Deployment>): Deployment {
  return {
    id: "d-new", application_id: "app-1", url: "https://a.com",
    environment: "production", provider: "vercel", project: "dash",
    repo: "acme/dash", branch: "main", commit_sha: "bbb5555666677778888",
    provider_deployment_id: "dpl_123", source: "manual",
    deployed_at: null, detected_at: "2026-07-12T12:00:00.000Z",
    ...over,
  };
}
const TESTED = { url: "https://a.com", commit_sha: "aaa1111222233334444", repo: "acme/dash", branch: "main", environment: "production" };
const TESTED_AT = "2026-07-10T12:00:00.000Z";
ok("no newest recorded deployment -> null", pickUnverifiedNewer(null, TESTED, TESTED_AT) === null);
ok("no tested deployment (untested app) -> null", pickUnverifiedNewer(mkDeployment({}), null, TESTED_AT) === null);
ok("tested identity without a URL -> null", pickUnverifiedNewer(mkDeployment({}), { url: " " }, TESTED_AT) === null);
ok("same identity (URL + commit) -> null even when detected later",
  pickUnverifiedNewer(mkDeployment({ commit_sha: TESTED.commit_sha }), TESTED, TESTED_AT) === null);
ok("different commit detected AFTER the test -> the newer deployment, with change lines", (() => {
  const r = pickUnverifiedNewer(mkDeployment({}), TESTED, TESTED_AT);
  return !!r && r.deployment.id === "d-new"
    && r.changes.some((l) => l === "Commit changed from aaa1111222 to bbb5555666");
})());
ok("different identity detected BEFORE the test -> null (nothing newer to verify)",
  pickUnverifiedNewer(mkDeployment({ detected_at: "2026-07-01T00:00:00.000Z" }), TESTED, TESTED_AT) === null);
ok("unparseable timestamps -> null (never a speculative banner)",
  pickUnverifiedNewer(mkDeployment({ detected_at: "not a date" }), TESTED, TESTED_AT) === null
  && pickUnverifiedNewer(mkDeployment({}), TESTED, null) === null);
ok("URL change alone is enough to flag", (() => {
  const r = pickUnverifiedNewer(mkDeployment({ url: "https://b.com", commit_sha: TESTED.commit_sha }), TESTED, TESTED_AT);
  return !!r && r.changes.some((l) => l.startsWith("URL changed from"));
})());

// ── Static: the deployments module is owner-scoped, insert-only, and warns by name ──
console.log("\n── deployments-db static ──");
const MODULE = "lib/preflight/deployments-db.ts";
const mod = stripComments(read(MODULE));
const modRaw = read(MODULE);
const deployChains = [...mod.matchAll(/from\("v_deployments"\)[\s\r\n]*\.(\w+)/g)].map((m) => m[1]);
ok("v_deployments is only ever SELECTed or INSERTed (history is immutable: no update, no delete)",
  deployChains.length >= 4 && deployChains.every((m) => m === "select" || m === "insert"));
ok("every v_deployments query is owner-scoped (eq user_id, or user_id in the inserted row)",
  [...mod.matchAll(/from\("v_deployments"\)/g)].every((m) => {
    const window = mod.slice(m.index, m.index + 450);
    return window.includes('eq("user_id"') || window.includes("user_id: uid");
  }));
ok("every other table the module reads is owner-scoped too (v_applications, v_app_connections, v_preflight_runs)",
  [...mod.matchAll(/from\("(v_applications|v_app_connections|v_preflight_runs)"\)/g)].every((m) => {
    const window = mod.slice(m.index, m.index + 450);
    return window.includes('eq("user_id"');
  }));
ok("missing-table failures warn NAMING the migration file",
  modRaw.includes("sql/vraelis-preflight-8-deployments.sql") && /console\.warn\([\s\S]{0,200}MIGRATION_FILE/.test(modRaw));
ok("missing-table detection covers 42P01 and PGRST205", mod.includes('"42P01"') && mod.includes('"PGRST205"'));
ok("recordDeployment catches everything and returns null (never throws into a parent operation)",
  /export async function recordDeployment[\s\S]*?try \{[\s\S]*?\} catch \{[\s\S]{0,200}return null;[\s\S]{0,30}\}/.test(mod));
ok("unverifiedNewerDeployment catches everything and returns null",
  /export async function unverifiedNewerDeployment[\s\S]*?try \{[\s\S]*?\} catch \{ return null; \}/.test(mod));
ok("recordDeployment verifies application ownership before reading or writing anything",
  /export async function recordDeployment[\s\S]*?from\("v_applications"\)[\s\S]*?eq\("user_id", uid\)\.eq\("id", applicationId\)[\s\S]*?if \(!app\) return null;[\s\S]*?from\("v_deployments"\)/.test(mod));
ok("dedupe returns the existing newest row on an identical identity (idempotent, no duplicate insert)",
  /sameDeploymentIdentity\(\{ url, commit_sha: enriched\.commit_sha \}, newest\)[\s\S]{0,120}existing: true/.test(mod));
ok("enrichment reads safe connection metadata only (github/custom_deploy/vercel; never encrypted_ref)",
  mod.includes('.in("provider", ["github", "custom_deploy", "vercel"])') && !mod.includes("encrypted_ref") && !mod.includes("openTestAccount"));
ok("runVersionPins reads each additive pin column in its OWN query (7 and 8 degrade independently)",
  /select\("context_snapshot_id"\)/.test(mod) && /select\("deployment_id"\)/.test(mod)
  && modRaw.includes("runVersionPins: v_preflight_runs.deployment_id is missing. Apply"));

// ── Static: createRun pins the deployment with ONE combined retry path ──
console.log("\n── createRun combined retry static ──");
const runsRaw = read("lib/preflight/runs-db.ts");
const runsDb = stripComments(runsRaw);
ok("createRun obtains the deployment id inside its own try/catch (a record failure never blocks a launch)",
  /try \{ deploymentId = await deploymentForRun\(uid, input\.applicationId, input\.deploymentUrl\); \} catch \{ deploymentId = null; \}/.test(runsDb));
ok("createRun pins deployment_id ONLY when a deployment row id was actually obtained",
  // pinDeployment is exactly "a deployment id was obtained"; deployment_id is added to the row only under it.
  runsDb.includes("let pinDeployment = deploymentId !== null;")
  && /if \(pinDeployment\) row = \{ \.\.\.row, deployment_id: deploymentId \};/.test(runsDb)
  && runsDb.includes("pinContext ? { ...baseRow, context_snapshot_id: contextSnapshotId } : baseRow"));
// ONE combined retry loop drops whichever additive pin column the DB reports missing (context 7, deployment 8,
// and now the api-key pin). Anchored on the stable prefix so a further pin column cannot silently break this.
ok("ONE combined retry path handles every missing pin column (context 7, deployment 8, api-key)",
  /while \(error && \(pinContext \|\| pinDeployment/.test(runsDb)
  && /pinContext && \/context_snapshot_id\/i\.test\(msg\)/.test(runsRaw)
  && /pinDeployment && \/deployment_id\/i\.test\(msg\)/.test(runsRaw));
ok("both column-missing warns name their migration file",
  runsRaw.includes("createRun: v_preflight_runs.context_snapshot_id is missing. Apply sql/vraelis-preflight-7-context-snapshots.sql")
  && runsRaw.includes("createRun: v_preflight_runs.deployment_id is missing. Apply sql/vraelis-preflight-8-deployments.sql"));
ok("no duplicate submission inserts: the run row is inserted at exactly two call sites (initial + the retry), retried only after an error", (() => {
  const inserts = runsDb.match(/insert\(rowFor\(\) as never\)/g) ?? [];
  const start = runsDb.indexOf("export async function createRun");
  const end = runsDb.indexOf("export async function", start + 10);
  const body = runsDb.slice(start, end === -1 ? runsDb.length : end);
  const allInserts = body.match(/\.insert\(/g) ?? [];
  return inserts.length === 2 && allInserts.length === 2 && /while \(error && \(pinContext \|\| pinDeployment/.test(runsDb);
})());
ok("an unknown insert error still breaks out of the retry loop (no infinite retry, no blind drop of pins)",
  /\} else break;/.test(runsDb));

// ── Static: the run report confines provider_deployment_id to Technical details ──
console.log("\n── run report static ──");
const REPORT = "app/rank/app/applications/[id]/passes/[runId]/page.tsx";
const reportRaw = read(REPORT);
const report = stripComments(reportRaw);
ok("Tested deployment block present", reportRaw.includes("Tested deployment"));
ok("provider_deployment_id appears ONLY inside a Technical details disclosure", (() => {
  const hits = [...report.matchAll(/provider_deployment_id/g)].map((m) => m.index);
  if (hits.length === 0) return false;
  // Both code references live inside the conditional details element: condition + rendered value.
  return hits.length === 2
    && /\{deployment\?\.provider_deployment_id \? \(\s*<details[\s\S]{0,600}\{deployment\.provider_deployment_id\}[\s\S]{0,300}<\/details>/.test(report);
})());
ok("no other S4 surface renders provider_deployment_id",
  !stripComments(read("app/rank/app/applications/[id]/deployments/page.tsx")).includes("provider_deployment_id")
  && !stripComments(read("app/rank/app/applications/[id]/page.tsx")).includes("provider_deployment_id")
  && !stripComments(read("app/rank/app/applications/[id]/deployments/record-deployment.tsx")).includes("provider_deployment_id")
  && !stripComments(read("app/api/preflight/apps/[id]/deployments/route.ts")).includes("provider_deployment_id"));
ok("migration-8 honesty on the report: one line naming the sql file, gated on deploymentStoreReady",
  reportRaw.includes("sql/vraelis-preflight-8-deployments.sql") && reportRaw.includes("deploymentStoreReady("));
ok("contract and context versions render only when they exist (no placeholders)",
  // The report derives `const contractVersion = internal.contractVersion` and renders every version through
  // that alias (`contractVersion != null ? ...`), so the conditional-render intent holds under the alias.
  /contractVersion != null \? <span>Contract v/.test(reportRaw) && /\{contextSnap \? <span>Context v/.test(reportRaw));
ok("context version resolves through getSnapshot, best-effort",
  reportRaw.includes("getSnapshot(owner, pins.contextSnapshotId)") && reportRaw.includes("Promise.resolve(null)"));

// ── Static: the health page banner never replaces the decision ──
console.log("\n── application health static ──");
const HEALTH = "app/rank/app/applications/[id]/page.tsx";
const health = read(HEALTH);
ok("banner present with honest carry-forward copy",
  health.includes("New deployment unverified") && health.includes("never carried forward to an untested deployment"));
ok("banner renders ABOVE the tested-deployment detail (the decision is never carried to an untested deploy)", (() => {
  // The verdict now lives in the Command Center strip; the newer-deploy banner still renders above the
  // tested-deployment detail that describes the decision's deployment.
  const banner = health.indexOf('aria-label="New deployment unverified"');
  const detail = health.indexOf('aria-label="Tested deployment"');
  return banner !== -1 && detail !== -1 && banner < detail;
})());
ok("the VERDICT computation never reads the newer deployment (the banner cannot replace the decision)", (() => {
  // Scope strictly to the verdict/hero/subParts block — NOT the later CommandState, which legitimately
  // reads newerDeploy for the state ribbon (that does not change the decision).
  const start = health.indexOf("let hero");
  const end = health.indexOf("const criticalEligibleIds", start);
  return start !== -1 && end > start && !health.slice(start, end).includes("newerDeploy");
})());
// The banner shows what changed and offers to run a verification on the new deployment. Its CTA now carries
// the current Verification terminology ("Run a verification"), and the region is bounded by the real adjacent
// section (the tested-deployment detail) — the old "Production status" hero aria-label no longer exists.
ok("banner carries the change lines and the verification CTA (existing LaunchPassButton)", (() => {
  const banner = health.indexOf('aria-label="New deployment unverified"');
  const end = health.indexOf('aria-label="Tested deployment"', banner);
  const region = health.slice(banner, end === -1 ? undefined : end);
  return banner !== -1 && end > banner && region.includes("newerDeploy.changes.map") && region.includes("<LaunchPassButton") && /label="Run a verification"/.test(region);
})());
ok("unverifiedNewerDeployment is asked only for a decided, non-active health run",
  health.includes("latest && !latestActive && latest.decision"));

// ── Static: the deployments route is owner-gated and honest about migration 8 ──
console.log("\n── deployments route static ──");
const ROUTE = "app/api/preflight/apps/[id]/deployments/route.ts";
const routeRaw = read(ROUTE);
const route = stripComments(routeRaw);
// The route now resolves ownership through the canonical team gate gatePreflightApp (which itself enforces
// preflightEnabled + auth + preflightDbReady + applicationAccess -> the app OWNER + role), instead of the
// four calls inline. Accept the gate as the ownership entry point; still require it and a role-gated write.
ok("route gates ownership via gatePreflightApp (flag + auth + db-ready + access) or the legacy inline gates",
  route.includes("gatePreflightApp(") || (route.includes("preflightEnabled()") && /\bauth\s*\(\s*\)/.test(route) && route.includes("preflightDbReady()") && route.includes("getApplication(")));
ok("ownership gate precedes the write (recordDeployment)",
  route.indexOf("gatePreflightApp(") !== -1 && route.indexOf("gatePreflightApp(") < route.indexOf("recordDeployment("));
ok("manual recording posts source 'manual'", route.includes('source: "manual"'));
ok("GET lists via the owner-scoped listDeployments", route.includes("listDeployments(g.owner, g.appId)"));
ok("unapplied migration 8 answers an actionable 503 naming the sql file, never a fake success",
  routeRaw.includes('"migration_required"') && routeRaw.includes("sql/vraelis-preflight-8-deployments.sql"));
ok("URL and commit are validated before anything is recorded",
  route.includes('parsed.protocol !== "https:"') && route.includes("/^[0-9a-f]{7,40}$/"));

// ── Static: the Deployments tab surfaces (form, comparison, honest notice) ──
console.log("\n── deployments tab static ──");
const TAB = "app/rank/app/applications/[id]/deployments/page.tsx";
const tab = read(TAB);
ok("migration-8 notice present, naming the sql file, gated on deploymentStoreReady",
  tab.includes("Deployment identity is not active yet: apply")
  && tab.includes("sql/vraelis-preflight-8-deployments.sql") && tab.includes("deploymentStoreReady("));
ok("Record new deployment affordance wired to the form component",
  tab.includes("<RecordDeploymentForm appId={id} />")
  && read("app/rank/app/applications/[id]/deployments/record-deployment.tsx").includes("Record new deployment"));
ok("comparison renders previous verified against current with the pure diff",
  tab.includes("Deployment comparison") && tab.includes("Previous verified")
  && tab.includes("compareDeployments(previous, current)"));
ok("current verification status is honest: matched decided pass or Unverified, never invented",
  tab.includes("verifyingRun") && tab.includes(">Unverified</span>"));
ok("owner/member-gated server component (requirePreflightAppAccess or requirePreflightOwner, + getApplication)",
  (tab.includes("requirePreflightAppAccess(") || tab.includes("requirePreflightOwner(")) && tab.includes("getApplication("));

// ── Design rules: no em dash, no middle dot, no emoji in any S4 surface ──
console.log("\n── design rules ──");
for (const f of [
  MODULE, REPORT, HEALTH, ROUTE, TAB,
  "app/rank/app/applications/[id]/deployments/record-deployment.tsx",
]) {
  // Copy rule: em dashes and middle dots are checked on comment-stripped source (rendered copy and
  // string literals), since pre-S4 files carry them in code comments; emoji nowhere at all.
  const src = stripComments(read(f));
  ok(`${f}: no em dash, no middle dot, no emoji in copy`,
    !src.includes("—") && !src.includes("·") && !/[\u{1F300}-\u{1FAFF}]/u.test(read(f)));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
