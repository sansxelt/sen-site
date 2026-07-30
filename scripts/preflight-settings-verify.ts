// Regression tests for editable application settings (V1.1 customer-UI fix): the owner-scoped
// updateApplication data layer, its URL validation (the SSRF string guard it reuses), the owner-gated
// PATCH route, and the deployment-identity behavior on a genuine target change (record a NEW deployment,
// log the change event, never rewrite historical run URLs, never duplicate an unchanged target).
//
// DB-bound behavior is proven the way the S4 suite proves its own: the pure validator is exercised
// directly, a no-DB call is run live (fail-closed), and the tenancy / dedupe / immutability guarantees
// are locked with static source checks against the actual module + route text.
// Pure unit tests + a live no-DB call + static source checks. No live DB, no network, no browser.
import { readFileSync } from "node:fs";
import { before } from "./_source-order";
import { unsafeHttpsUrlReason } from "../lib/safe-fetch";
import { canonicalDeploymentUrl } from "../lib/preflight/deployments-db";
import { updateApplication } from "../lib/v-applications";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };
const read = (p: string) => readFileSync(p, "utf8");
// Blank out // and /* */ comments so string checks never match documentation.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}

async function main() {
// ── URL validation: the exact guard updateApplication + the connect route reuse (unsafeHttpsUrlReason) ──
console.log("── target URL validation (the SSRF string guard updateApplication reuses) ──");
ok("valid public https URL accepted", unsafeHttpsUrlReason("https://app.example.com") === null);
ok("valid https URL with a path + query accepted", unsafeHttpsUrlReason("https://app.example.com/dash?x=1") === null);
ok("http (non-https) rejected", unsafeHttpsUrlReason("http://app.example.com") === "https_required");
ok("javascript: scheme rejected", unsafeHttpsUrlReason("javascript:alert(1)") === "https_required");
ok("data: scheme rejected", unsafeHttpsUrlReason("data:text/html,<h1>x</h1>") === "https_required");
ok("file: scheme rejected", unsafeHttpsUrlReason("file:///etc/passwd") === "https_required");
ok("ftp: scheme rejected", unsafeHttpsUrlReason("ftp://example.com/x") === "https_required");
ok("malformed URL rejected", unsafeHttpsUrlReason("not a url") === "invalid_url" && unsafeHttpsUrlReason("https://") === "invalid_url");
ok("localhost rejected", unsafeHttpsUrlReason("https://localhost/x") === "internal_host");
ok("*.local / *.internal rejected", unsafeHttpsUrlReason("https://db.internal/x") === "internal_host" && unsafeHttpsUrlReason("https://box.local") === "internal_host");
ok("private IPv4 host rejected (10/8, 192.168, 127, link-local metadata)",
  unsafeHttpsUrlReason("https://10.0.0.5") === "private_ip"
  && unsafeHttpsUrlReason("https://192.168.1.10") === "private_ip"
  && unsafeHttpsUrlReason("https://127.0.0.1") === "private_ip"
  && unsafeHttpsUrlReason("https://169.254.169.254") === "private_ip");
ok("non-443 port rejected", unsafeHttpsUrlReason("https://app.example.com:8443") === "port_not_allowed");

// ── Target-change detection uses the SAME canonical compare recordDeployment dedupes on ──
console.log("\n── target-change detection (canonical compare, same rule as dedupe) ──");
ok("trailing slash + host case is the SAME target (no false target change)",
  canonicalDeploymentUrl("https://App.Example.com/") === canonicalDeploymentUrl("https://app.example.com"));
ok("a different host IS a target change",
  canonicalDeploymentUrl("https://a.example.com") !== canonicalDeploymentUrl("https://b.example.com"));
ok("a different path IS a target change (routing-significant)",
  canonicalDeploymentUrl("https://a.com/v1") !== canonicalDeploymentUrl("https://a.com/v2"));

// ── Live, no-DB: updateApplication fails closed (never a silent success without a database) ──
console.log("\n── updateApplication live (no DB configured) ──");
{
  const savedUrl = process.env.SUPABASE_URL, savedPub = process.env.NEXT_PUBLIC_SUPABASE_URL, savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL; delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await updateApplication("owner@example.com", "app-1", { name: "x" });
  ok("no DB -> { ok:false, error:'unavailable' } (never a fake updated:true)", r.ok === false && r.error === "unavailable");
  if (savedUrl !== undefined) process.env.SUPABASE_URL = savedUrl;
  if (savedPub !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedPub;
  if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
}

// ── Static: updateApplication is owner-scoped, validates, honest about zero rows, never trusts client ──
console.log("\n── updateApplication static (v-applications.ts) ──");
const APPS = "lib/v-applications.ts";
const apps = stripComments(read(APPS));
ok("updateApplication exists and returns a discriminated result",
  apps.includes("export async function updateApplication") && apps.includes("UpdateApplicationResult"));
ok("ownership is loaded owner-scoped BEFORE any write (getApplication gate)",
  /updateApplication[\s\S]*?getApplication\(uid, id\)[\s\S]*?if \(!current\) return \{ ok: false, error: "not_found" \}/.test(apps)
  && before(apps, "getApplication(uid, id)", 'from("v_applications").update'));
ok("the UPDATE is owner-scoped (eq user_id AND eq id) — a cross-owner id can never match another tenant",
  /from\("v_applications"\)\.update\([\s\S]{0,120}\.eq\("user_id", uid\)\.eq\("id", id\)/.test(apps));
ok("app_url is validated with unsafeHttpsUrlReason before it can be stored",
  apps.includes("unsafeHttpsUrlReason(url)") && apps.includes('return { ok: false, error: "invalid_url" }'));
ok("environment is whitelisted (preview/staging/production) or explicitly cleared, else rejected",
  apps.includes('env === "preview" || env === "staging" || env === "production"') && apps.includes('error: "invalid_environment"'));
ok("a zero-row write reports updated:false (honest), never a fake success",
  /select\("\*"\)[\s\S]{0,200}if \(!rows\.length\) return \{ ok: true, updated: false/.test(apps));
ok("targetChanged is computed with the canonical compare (same rule recordDeployment dedupes on)",
  apps.includes("canonicalDeploymentUrl(current.app_url) !== canonicalDeploymentUrl(newUrl)"));
ok("the description is MERGED into context, preserving every non-summary source (no clobber)",
  apps.includes('kind: "summary"') && apps.includes("const others = raw.filter") && apps.includes("...others"));
ok("updateApplication never writes any table other than v_applications (no run-URL rewrite here)",
  [...apps.matchAll(/from\("(\w+)"\)\.(update|insert|delete|upsert)/g)]
    .filter((m) => {
      // Only count writes inside updateApplication's body.
      const start = apps.indexOf("export async function updateApplication");
      const end = apps.indexOf("export ", start + 20);
      return m.index! >= start && m.index! < (end === -1 ? apps.length : end);
    })
    .every((m) => m[1] === "v_applications"));

// ── Static: the PATCH route is owner-gated, session-only, and orders the ownership check first ──
console.log("\n── PATCH route static (app/api/preflight/apps/[id]/route.ts) ──");
const ROUTE = "app/api/preflight/apps/[id]/route.ts";
const routeRaw = read(ROUTE);
const route = stripComments(routeRaw);
ok("route exports a PATCH handler", route.includes("export async function PATCH"));
// Owner identity now comes from the team resolver applicationAccess(email, id) (auth() email in, resolved app
// OWNER out) inside the route's gate(); a direct auth()/email.toLowerCase() also qualifies. Never the body.
ok("owner identity comes from the session (auth() -> applicationAccess), never the request body",
  (/applicationAccess\s*\(/.test(route) || (/auth\(\)/.test(route) && route.includes("email.toLowerCase()")))
  && !route.includes("body?.owner") && !route.includes("body?.user_id") && !route.includes("body.owner_id"));
ok("gate order: the ownership resolver (applicationAccess / getApplication) precedes the update",
  (route.includes("applicationAccess(") || (route.includes("preflightEnabled()") && route.includes("preflightDbReady()") && route.indexOf("getApplication(") !== -1))
  && (before(route, "applicationAccess(", "updateApplication(") || before(route, "getApplication(", "updateApplication(")));
ok("editing settings is EDITOR+ and a caller without access 404s before any mutation (view-only member 403)",
  /applicationAccess\(email, id\)/.test(route) && /if \(!access\)/.test(route) && /hasAtLeastRole\(access\.role,\s*"editor"\)/.test(route));
ok("the id used for the update is the route param, never a client-supplied app id",
  route.includes("updateApplication(g.owner, g.appId, patch)") && route.includes("const { id } = await params"));
ok("only the safe fields are returned to the client (id, name, app_url, environment)",
  route.includes("app_url: r.application.app_url") && route.includes("environment: appEnvironment") && !route.includes("user_id:"));

// ── Static: deployment identity on a genuine target change (record new, log event, never rewrite history) ──
console.log("\n── deployment identity on target change (route) ──");
ok("a genuine target change records a NEW deployment (source 'manual') so the newest identity differs",
  /if \(r\.updated && r\.targetChanged\)[\s\S]{0,260}recordDeployment\(g\.owner, g\.appId, \{[\s\S]{0,160}source: "manual"/.test(route));
ok("the change logs an application_target_updated event, application id + safe HOSTS only (no full URL)",
  route.includes('eventType: "application_target_updated"')
  && route.includes("old_host: safeHost(r.oldUrl)") && route.includes("new_host: safeHost(r.newUrl)")
  && route.includes("application_id: g.appId"));
ok("the audit metadata carries a HOST, not the full URL (a query could hold a token)",
  route.includes("new URL(url).host") && !/metadata:\s*\{[^}]*old_url/.test(route) && !/metadata:\s*\{[^}]*new_url/.test(route));
ok("an unchanged URL never records (guarded by r.targetChanged; recordDeployment also dedupes)",
  route.includes("r.updated && r.targetChanged"));
ok("recording is best-effort and never fails the save (no throw path; recordDeployment returns null on miss)",
  // recordDeployment is awaited but its result is not asserted, and the response returns ok regardless.
  route.includes("await recordDeployment(") && route.includes("ok: true"));

// ── Historical evidence: run rows' deployment_url is NEVER rewritten by this feature ──
console.log("\n── historical evidence immutability ──");
ok("no settings-path file UPDATEs v_preflight_runs (historical run rows, incl. deployment_url, are immutable here)", (() => {
  // v-applications.ts legitimately READS v_preflight_runs (listRuns/latestRunByApp); the guarantee is that
  // no settings write path ever calls .update()/.delete() on it, and the route/form never touch it at all.
  const runsWrites = [...apps.matchAll(/from\("v_preflight_runs"\)[\s\r\n]*\.(update|delete|upsert)/g)];
  return runsWrites.length === 0
    && !route.includes("v_preflight_runs")
    && !stripComments(read("app/rank/app/systems/[id]/settings/edit-application.tsx")).includes("v_preflight_runs");
})());
ok("recordDeployment (the write this feature triggers) is INSERT-only against v_deployments (S4 invariant holds)", (() => {
  const dep = stripComments(read("lib/preflight/deployments-db.ts"));
  const chains = [...dep.matchAll(/from\("v_deployments"\)[\s\r\n]*\.(\w+)/g)].map((m) => m[1]);
  return chains.length >= 4 && chains.every((m) => m === "select" || m === "insert");
})());

// ── Static: the settings UI form (client edit, stay-on-settings, confirmation, honest states) ──
console.log("\n── settings edit UI static ──");
const FORM = "app/rank/app/systems/[id]/settings/edit-application.tsx";
const form = read(FORM);
const formStripped = stripComments(form);
ok("client component that PATCHes the owner-gated route", form.startsWith('"use client"') && form.includes("method: \"PATCH\"") && form.includes("/api/preflight/apps/"));
ok("edits name, target URL, environment, and description", form.includes("Deployment target URL") && form.includes("id=\"edit-name\"") && form.includes("id=\"edit-env\"") && form.includes("id=\"edit-desc\""));
ok("Save + Discard controls present",
  /type="submit"[\s\S]{0,200}(Saving\.\.\.|Confirm and save|Save)/.test(form) && form.includes("Discard") && form.includes("onClick={discard}"));
ok("stays on Settings after save (router.refresh, no dashboard redirect / router.push)",
  form.includes("router.refresh()") && !form.includes("router.push") && !formStripped.includes('href="/app"'));
ok("success copy: 'Settings updated.' and the target-change 'Deployment updated. New deployment unverified.'",
  form.includes("Settings updated.") && form.includes("Deployment updated. New deployment unverified."));
ok("a target change asks for confirmation BEFORE saving, with the exact reassurance copy",
  form.includes("targetChanged && !confirming")
  && form.includes("Changing the deployment target does not modify previous reports")
  && form.includes("remain")
  && form.includes("unverified until a Production Pass completes"));
ok("native saving / failure states (busy + inline error), no fake progress bar",
  form.includes("setBusy(true)") && form.includes("Saving...") && form.includes("var(--err)"));

// ── The settings page renders the edit form above the read-only sections it keeps ──
console.log("\n── settings page wiring ──");
const PAGE = "app/rank/app/systems/[id]/settings/page.tsx";
const page = read(PAGE);
ok("page renders <EditApplicationForm> seeded from the app + extras",
  page.includes("<EditApplicationForm") && page.includes("initial={{") && page.includes("environment: extras.environment"));
ok("the current description (summary source) seeds the form",
  page.includes("readContextSources(") && page.includes('s.kind === "summary"'));
ok("read-only sections are KEPT below the form (connections summary, boundaries, missing)",
  page.includes("Connections (") && page.includes("Test boundaries") && page.includes("Missing from this system"));
ok("no longer claims renaming or deletion is 'coming' (both are built now)",
  !page.includes("Renaming an application and deleting") && !page.includes("Deleting an application from the UI is coming") && page.includes("<DeleteApplication"));

// The delete control (B3): calls the owner-scoped DELETE route, requires a typed name confirmation, and
// never trusts the client for ownership (the server re-derives owner + returns 404 on a zero-row delete).
const del = read("app/rank/app/systems/[id]/settings/delete-application.tsx");
ok("delete calls the DELETE /api/preflight/apps route (owner-scoped server-side)",
  del.includes('method: "DELETE"') && del.includes("/api/preflight/apps?id="));
ok("delete requires a typed-name confirmation before it can fire (no accidental one-click delete)",
  del.includes("confirmText") && del.includes("matches") && /disabled=\{!matches/.test(del));
ok("delete surfaces an honest failure and never fakes success", del.includes("was not deleted") || del.includes("Could not delete"));
ok("delete never sends an owner/user id from the client (server derives it from the session)",
  !/user_id|owner:|email:/.test(del));

// ── Design rules: no em dash, no middle dot, no emoji in the new copy ──
console.log("\n── design rules ──");
for (const f of [FORM, ROUTE, APPS, PAGE]) {
  const src = stripComments(read(f));
  ok(`${f}: no em dash, no middle dot, no emoji in copy`,
    !src.includes("—") && !src.includes("·") && !/[\u{1F300}-\u{1FAFF}]/u.test(read(f)));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
