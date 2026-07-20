// Regression tests for S2 — connection management after creation: the state model, the health-check
// planner, edit sanitization, the CRUD + verify routes' security lines (owner gates, SSRF guard order,
// no secrets in responses, honest zero-row 404s, audit events without metadata values), and the honesty
// of the management UI (coming-later chips never buttons, sealed replace path, native result states).
// Pure unit tests + static source checks; no DB, no network, no browser.
// Pattern follows scripts/preflight-connect-verify.ts: PASS/FAIL counters, exit 1 on any FAIL.
import { readFileSync } from "node:fs";
import {
  connectionState, stateLabel, STATE_LABELS, featureUse, neverAccesses, metaSummary, whenUtc,
  MANUAL_ADD_KINDS, MANUAL_FIELDS, COMING_LATER_PROVIDERS, isStoredNotYetUsed, STORED_NOT_YET_USED,
} from "../lib/preflight/connection-display";
import { planHealthCheck, healthStatusFromHttp, CHECK_NOTES, CHECK_TIMEOUT_MS } from "../lib/preflight/connection-health";
import { sanitizeConnectionMeta, canonicalMeta, CONNECTION_KINDS } from "../lib/preflight/connections-db";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const read = (p: string) => readFileSync(p, "utf8");
// Blank out // and /* */ comments so string checks never match documentation.
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + " ".repeat(m.length - p1.length));
}
// Skip past the import block so an imported symbol name never counts as a "call".
function afterImports(src: string): string {
  const re = /^import[\s\S]*?from\s+["'][^"']+["'];?\s*$/gm;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(src))) last = m.index + m[0].length;
  return src.slice(last);
}

// ── State model: explicit, total, honest ──
console.log("── state model ──");
ok("manual kind + connected -> Connected manually (no OAuth pretense)",
  connectionState("github", "connected") === "connected_manually" && stateLabel(connectionState("github", "connected")) === "Connected manually");
ok("test_account + connected -> Connected (a credential Vraelis actually holds)",
  connectionState("test_account", "connected") === "connected" && stateLabel("connected") === "Connected");
// OAuth: a row with meta.oauth === true holds a real token, so it renders "Connected", NOT "Connected manually".
ok("OAuth github (meta.oauth) + connected -> Connected (a real held token, not manual)",
  connectionState("github", "connected", { oauth: true }) === "connected" && stateLabel("connected") === "Connected");
ok("github WITHOUT the oauth flag stays 'Connected manually' (no OAuth pretense)",
  connectionState("github", "connected", {}) === "connected_manually" && connectionState("github", "connected", null) === "connected_manually");
ok("status error -> Verification failed", connectionState("supabase", "error") === "verification_failed" && stateLabel("verification_failed") === "Verification failed");
ok("pending / unknown -> Needs attention (honest, never optimistic)",
  connectionState("webhook", "pending") === "needs_attention" && connectionState("github", "") === "needs_attention" && connectionState("sentry", "weird") === "needs_attention");
ok("terminal states exist in the model (revoked / disconnected)",
  connectionState("test_account", "revoked") === "revoked" && connectionState("github", "disconnected") === "disconnected");
ok("every state has a label", (Object.keys(STATE_LABELS).length === 6) && Object.values(STATE_LABELS).every((v) => typeof v === "string" && v.length > 0));

// ── Edit-path sanitization: the same secret key/value redaction as create (sanitizeConnectionMeta) ──
console.log("\n── edit sanitization ──");
const edited = sanitizeConnectionMeta({ repo: "acme/dash", api_key: "sk_live_x", notes: "use sk_live_abcdEFGH12345678", password: "oops" });
ok("secret-looking keys are dropped on the edit path", !("api_key" in edited) && !("password" in edited));
ok("credential-shaped VALUES are redacted on the edit path", String(edited.notes).includes("[redacted"));
ok("safe metadata survives the edit path", edited.repo === "acme/dash");

// ── Duplicate detection: canonicalMeta ignores bookkeeping keys and key order ──
console.log("\n── duplicate detection ──");
ok("canonicalMeta is key-order insensitive", canonicalMeta({ a: "1", b: "2" }) === canonicalMeta({ b: "2", a: "1" }));
ok("canonicalMeta ignores updated_at + last_check_note (edits/checks never block a legit re-add match)",
  canonicalMeta({ repo: "a/b", updated_at: "x", last_check_note: "y" }) === canonicalMeta({ repo: "a/b" }));
ok("different metadata is never a duplicate", canonicalMeta({ repo: "a/b" }) !== canonicalMeta({ repo: "a/c" }));

// ── Health-check planner: only stored metadata, only safe shapes ──
console.log("\n── health-check planner ──");
ok("github with a valid repo plans a GitHub API check", JSON.stringify(planHealthCheck("github", { repo: "acme/dash" })) === JSON.stringify({ kind: "github", repo: "acme/dash" }));
ok("github with a malformed repo plans NO remote check",
  planHealthCheck("github", { repo: "https://evil.example/x" }).kind === "metadata_only" && planHealthCheck("github", {}).kind === "metadata_only");
ok("supabase plans a reachability check on its stored project_url (as a root probe)", JSON.stringify(planHealthCheck("supabase", { project_url: "https://xyz.supabase.co" })) === JSON.stringify({ kind: "url", url: "https://xyz.supabase.co", rootProbe: true }));
ok("vercel plans a check only when a deployment_url is stored",
  planHealthCheck("vercel", { deployment_url: "https://a.vercel.app" }).kind === "url" && planHealthCheck("vercel", { project: "x" }).kind === "metadata_only");
ok("webhook plans a check on its stored url", planHealthCheck("webhook", { url: "https://hooks.example.com/x" }).kind === "url");
const sentryPlan = planHealthCheck("sentry", { dsn: "https://publickey@o0.ingest.sentry.io/12345" });
ok("sentry reduces the DSN to its HOST (no userinfo, no key, no path in the checked URL)",
  sentryPlan.kind === "url" && sentryPlan.url === "https://o0.ingest.sentry.io/" && !sentryPlan.url.includes("publickey"));
ok("sentry with an unparseable DSN plans NO remote check", planHealthCheck("sentry", { dsn: "not a url" }).kind === "metadata_only");
for (const kind of ["test_account", "custom_auth", "custom_deploy", "stripe_test", "openapi"]) {
  ok(`${kind}: no remote check (metadata only)`, planHealthCheck(kind, { url: "https://x.example", project_url: "https://y.example" }).kind === "metadata_only");
}
ok("2xx/3xx/401/403 classify reachable; 404/418/5xx are verification failures (endpoint probes)",
  [200, 204, 301, 302, 401, 403].every((c) => healthStatusFromHttp(c) === "connected") && [404, 418, 500, 503].every((c) => healthStatusFromHttp(c) === "error"));
ok("check timeout is 5 seconds", CHECK_TIMEOUT_MS === 5000);
ok("check notes are fixed strings + at most a status number or reason code (sanitized remediation)",
  CHECK_NOTES.reachable(200) === "Reachable (HTTP 200)." && CHECK_NOTES.unsafeUrl("private_ip").includes("private_ip")
  && CHECK_NOTES.metadataOnly.toLowerCase().includes("metadata only") && !CHECK_NOTES.network.includes("$"));

// ── Display vocabulary: every kind covered, truthfully ──
console.log("\n── display vocabulary ──");
ok("every connection kind has a feature-use line and a never-accesses line",
  (CONNECTION_KINDS as readonly string[]).every((k) => featureUse(k).length > 5 && neverAccesses(k).length > 5));
ok("github never-accesses: metadata only, no code write access", neverAccesses("github").includes("No code write access") && neverAccesses("github").toLowerCase().includes("metadata only"));
ok("supabase never-accesses: no database credentials, no rows", neverAccesses("supabase").includes("No database credentials") && neverAccesses("supabase").includes("no rows"));
ok("stripe never-accesses: no live keys, no card data", neverAccesses("stripe_test").includes("No live keys") && neverAccesses("stripe_test").includes("no card data"));
ok("test account never-accesses: sealed, never displayed", neverAccesses("test_account").includes("sealed") && neverAccesses("test_account").includes("never displayed"));
ok("test-account feature use is honest about authenticated flows coming later", featureUse("test_account").toLowerCase().includes("coming"));

// Integration honesty: a stored-but-inert connection must SAY it is not yet read during verification,
// and a wired one (supabase/stripe/sentry seed requirements; deploy providers set the URL) must NOT.
ok("custom_auth / openapi are flagged stored-not-yet-used",
  isStoredNotYetUsed("custom_auth") && isStoredNotYetUsed("openapi"));
ok("their feature-use line says not yet read during verification (no overstated consumer)",
  ["custom_auth", "openapi"].every((p) => /not yet read during verification/i.test(featureUse(p))));
// webhook GRADUATED: it now receives the launch decision when a run finalizes, so it must no longer claim
// to be inert, and its line must describe the real delivery.
ok("webhook is NO LONGER stored-not-yet-used (it receives the decision now)", !isStoredNotYetUsed("webhook"));
ok("webhook's feature-use line describes the real delivery, not inertness",
  /launch decision/i.test(featureUse("webhook")) && !/not yet read/i.test(featureUse("webhook")));
ok("wired providers are NOT flagged stored-not-yet-used",
  ["supabase", "stripe_test", "sentry", "github", "vercel", "custom_deploy", "test_account"].every((p) => !isStoredNotYetUsed(p)));
ok("wired discovery providers name a real seeded requirement (never 'not yet')",
  /seeds/i.test(featureUse("supabase")) && /seeds/i.test(featureUse("stripe_test")) && /seeds/i.test(featureUse("sentry"))
  && !/not yet/i.test(featureUse("supabase")) && !/not yet/i.test(featureUse("stripe_test")) && !/not yet/i.test(featureUse("sentry")));
ok("the stored-not-yet-used set is exactly those two (no silent scope creep)",
  STORED_NOT_YET_USED.size === 2);

// Supabase reaches further over OAuth (a Management API token) than pasted metadata (a URL). The promise
// copy has to change WITH the connection, or the authorized card would carry the metadata-only promise.
ok("supabase OAuth gets its OWN never-accesses line, different from the manual one",
  neverAccesses("supabase", { oauth: true }) !== neverAccesses("supabase"));
ok("the supabase OAuth promise is specific about what the token cannot reach",
  /no database password/i.test(neverAccesses("supabase", { oauth: true }))
  && /no table rows/i.test(neverAccesses("supabase", { oauth: true }))
  && /revoke/i.test(neverAccesses("supabase", { oauth: true })));
ok("the supabase OAuth promise does NOT claim we only hold the project URL",
  !/the project url only/i.test(neverAccesses("supabase", { oauth: true })));
ok("the supabase OAuth feature-use names the Management API read it actually performs",
  /management api/i.test(featureUse("supabase", { oauth: true })));
ok("providers with no OAuth variant fall through to the single line either way",
  neverAccesses("github", { oauth: true }) === neverAccesses("github")
  && featureUse("webhook", { oauth: true }) === featureUse("webhook"));
ok("metaSummary renders safe one-liners", metaSummary("github", { repo: "a/b", branch: "main" }) === "a/b @ main" && metaSummary("webhook", {}) === null);
ok("whenUtc renders a stable UTC stamp", whenUtc("2026-07-02T14:31:00.000Z") === "2026-07-02 14:31 UTC" && whenUtc(null) === "");
ok("the Add affordance offers exactly the 9 manual kinds (test accounts go through the sealed route)",
  MANUAL_ADD_KINDS.length === 9 && !(MANUAL_ADD_KINDS as readonly string[]).includes("test_account") && (MANUAL_ADD_KINDS as readonly string[]).every((k) => k === "github" || !!MANUAL_FIELDS[k]));
ok("coming-later list has no manual kind in it", COMING_LATER_PROVIDERS.every((n) => !(MANUAL_ADD_KINDS as readonly string[]).includes(n.toLowerCase())));

// ── Static: connections-db holds the security lines ──
console.log("\n── connections-db static ──");
const connDb = stripComments(read("lib/preflight/connections-db.ts"));
function fnBody(src: string, name: string): string {
  const i = src.indexOf(`export async function ${name}`);
  if (i === -1) return "";
  const j = src.indexOf("export async function", i + 10);
  return src.slice(i, j === -1 ? src.length : j);
}
for (const fn of ["getConnection", "updateConnectionMeta", "recordConnectionCheck", "removeConnection"]) {
  const body = fnBody(connDb, fn);
  ok(`${fn}: filters user_id + application_id + id TOGETHER (cross-owner and cross-application access impossible)`,
    body.includes('eq("user_id"') && body.includes('eq("application_id"') && body.includes('eq("id"'));
}
const upd = fnBody(connDb, "updateConnectionMeta");
ok("updateConnectionMeta runs sanitizeConnectionMeta on the edit path", upd.includes("sanitizeConnectionMeta("));
ok("updateConnectionMeta never touches encrypted_ref or provider (meta-only update, plus a provider filter)",
  !upd.includes("encrypted_ref") && !/update\(\{[^}]*provider\s*:/.test(upd) && upd.includes('neq("provider", "test_account")'));
ok("updateConnectionMeta refuses stale edits (updated_at echo mismatch)", upd.includes('"stale"') && upd.includes("expectedUpdatedAt"));
ok("updateConnectionMeta honest row count: zero rows -> not_found (a removed connection is never recreated)",
  upd.includes('select("id")') && /data\.length === 0/.test(upd));
const rec = fnBody(connDb, "recordConnectionCheck");
ok("recordConnectionCheck updates ONLY status + last_verified_at + the note in meta (failed checks never destroy metadata)",
  rec.includes("last_check_note") && rec.includes("...current.meta") && !rec.includes("encrypted_ref") && rec.includes("last_verified_at"));
const getc = fnBody(connDb, "getConnection");
ok("getConnection never selects the ciphertext column", !getc.includes("encrypted_ref"));
const rem = fnBody(connDb, "removeConnection");
ok("removeConnection deletes the whole ROW (sealed credential destroyed with it), counted honestly",
  rem.includes(".delete()") && rem.includes('select("id")') && rem.includes("data.length > 0"));
const addc = fnBody(connDb, "addConnection");
ok("addConnection dedupes identical provider+metadata inserts within a window (double-click safe)",
  addc.includes("DEDUPE_WINDOW_MS") && addc.includes("canonicalMeta(") && addc.includes("existing: true"));

// ── Static: the three routes hold the gates ──
console.log("\n── routes static ──");
const COLLECTION = "app/api/preflight/apps/[id]/connections/route.ts";
const SINGLE = "app/api/preflight/apps/[id]/connections/[connId]/route.ts";
const VERIFY = "app/api/preflight/apps/[id]/connections/[connId]/verify/route.ts";
const routes = { [COLLECTION]: afterImports(stripComments(read(COLLECTION))), [SINGLE]: afterImports(stripComments(read(SINGLE))), [VERIFY]: afterImports(stripComments(read(VERIFY))) };

for (const [file, code] of Object.entries(routes)) {
  // Owner identity now comes from the canonical team gate gatePreflightApp (which calls auth() itself and
  // resolves the app OWNER + role), OR a direct auth() call. Either way it must never be taken from the body.
  ok(`${file}: owner identity comes from auth()/gatePreflightApp, never the request body`,
    (/\bauth\s*\(\s*\)/.test(code) || /\bgatePreflightApp\s*\(/.test(code)) && !code.includes("owner_id") && !/body[^;\n]*(email|owner)/i.test(code));
  ok(`${file}: the ownership gate (gatePreflightApp or getApplication) precedes every write`, (() => {
    // The route resolves ownership via gatePreflightApp (preferred) or a direct getApplication call.
    const g1 = code.indexOf("gatePreflightApp(");
    const g2 = code.indexOf("getApplication(");
    const gate = g1 !== -1 ? g1 : g2;
    if (gate === -1) return false;
    return ["addConnection(", "updateConnectionMeta(", "removeConnection(", "recordConnectionCheck(", "logEvent("]
      .every((w) => { const i = code.indexOf(w); return i === -1 || i > gate; });
  })());
  ok(`${file}: encrypted_ref never appears (no ciphertext, IV, or auth tag can reach a response)`, !code.includes("encrypted_ref"));
  // Audit events: metadata carries application_id + provider ONLY, never metadata values.
  const metas = [...code.matchAll(/logEvent\(\{[\s\S]*?metadata:\s*\{([^}]*)\}/g)].map((m) => m[1]);
  ok(`${file}: audit event metadata is application_id + provider only`,
    metas.length > 0 === (file !== COLLECTION || true) && metas.every((m) => {
      const keys = [...m.matchAll(/(\w+)\s*:/g)].map((k) => k[1]);
      return keys.length > 0 && keys.every((k) => k === "application_id" || k === "provider");
    }));
}
ok(`${COLLECTION}: GET lists via listConnections (masked, safe metadata only)`, routes[COLLECTION].includes("listConnections("));
ok(`${COLLECTION}: refuses test_account on the metadata path (sealed route required)`, routes[COLLECTION].includes("sealed_route_required"));
ok(`${COLLECTION}: no audit event on a deduped re-add (idempotent retry logs once)`, routes[COLLECTION].includes("r.existing") && /if \(!r\.existing\)/.test(routes[COLLECTION]));
ok(`${SINGLE}: stale edit -> 409`, routes[SINGLE].includes("stale_edit") && routes[SINGLE].includes("409"));
ok(`${SINGLE}: test_account metadata is not editable here (sealed path only)`, routes[SINGLE].includes("not_editable"));
ok(`${SINGLE}: DELETE 404s on zero rows (repeat DELETE resolves honestly, never a false disconnect)`,
  routes[SINGLE].includes("Nothing was disconnected") && /if \(!ok\) return NextResponse\.json\(\{ error: "not_found"/.test(routes[SINGLE]));
ok(`${SINGLE}: PATCH 404s on a removed connection (never silently recreates)`, routes[SINGLE].includes("Nothing was changed"));

// ── Static: the verify route's safety rails ──
console.log("\n── verify route static ──");
const v = routes[VERIFY];
ok("verify: unsafeHttpsUrlReason runs BEFORE any fetch (SSRF guard first, in source and in flow)", (() => {
  const guard = v.indexOf("unsafeHttpsUrlReason(");
  const fetches = v.indexOf("safeFetch(");
  return guard !== -1 && fetches !== -1 && guard < fetches;
})());
ok("verify: only safeFetch touches the network (no bare fetch anywhere)", !/(?<![a-zA-Z_.])fetch\s*\(/.test(v.replace(/safeFetch/g, "SF")));
ok("verify: strict 5s timeout on every probe", (v.match(/AbortSignal\.timeout\(CHECK_TIMEOUT_MS\)/g) ?? []).length >= 3);
ok("verify: read-only probes (HEAD/GET only, redirects never followed)",
  !/method:\s*"(POST|PUT|DELETE|PATCH)"/.test(v) && v.includes('redirect: "manual"'));
ok("verify: rate-limited per user before any work", v.includes("checkRateLimit(") && v.indexOf("checkRateLimit(") < v.indexOf("getConnection("));
ok("verify: a removed/revoked connection cannot verify (404, nothing recorded)",
  v.indexOf("getConnection(") < v.indexOf("planHealthCheck(") && v.includes('"not_found"'));
ok("verify: the checked URL comes ONLY from the connection's stored metadata (request body never read)",
  v.includes("planHealthCheck(conn.provider, conn.meta)") && !v.includes("req.json"));
ok("verify: notes come from CHECK_NOTES only, raw provider errors never surface",
  v.includes("CHECK_NOTES.") && !v.includes(".message") && !v.includes("String(e") && !v.includes("statusText"));
ok("verify: no credential decryption on this route (openTestAccount never imported)", !read(VERIFY).includes("openTestAccount"));
ok("verify: github 404 reads as private-or-not-found with OAuth honestly deferred",
  CHECK_NOTES.githubNotFound.includes("private or not found") && CHECK_NOTES.githubNotFound.includes("coming later"));

// ── Static: secrets route audit events (test-account add/revoke reach the same trail) ──
console.log("\n── secrets route audit ──");
const secrets = stripComments(read("app/api/preflight/apps/[id]/secrets/route.ts"));
ok("secrets POST logs connection_added (application_id + provider only)", secrets.includes("connection_added") && /connection_added[\s\S]{0,200}application_id: g\.appId, provider: "test_account"/.test(secrets));
ok("secrets DELETE logs connection_removed after an honest revoke", secrets.indexOf("connection_removed") > secrets.indexOf("Nothing was revoked"));
ok("secrets audit events never carry masks or credentials",
  [...secrets.matchAll(/logEvent\(\{[\s\S]*?\}\)/g)].every((m) => !/(username|password|mask)/.test(m[0])) && (secrets.match(/logEvent\(/g) ?? []).length === 2);

// ── Static: the management UI stays honest ──
console.log("\n── management UI static ──");
const tabs = read("app/rank/app/applications/[id]/app-tabs.tsx");
ok("app tabs include Connections -> /settings/connections", tabs.includes('"/settings/connections"') && tabs.includes('label: "Connections"'));
const page = read("app/rank/app/applications/[id]/settings/connections/page.tsx");
ok("management page is owner/member-gated (requirePreflightAppAccess or requirePreflightOwner, + getApplication)", (page.includes("requirePreflightAppAccess(") || page.includes("requirePreflightOwner(")) && page.includes("getApplication("));
ok("management page renders the audit history from v_events (last 10)", page.includes("recentConnectionEvents(") && page.includes("Connection activity"));
ok("management page has an honest empty state for the audit trail", page.includes("No connection activity recorded yet"));
const mgr = read("app/rank/app/applications/[id]/settings/connections/connections-manager.tsx");
ok("cards state the truthful feature use and the never-accesses promise", mgr.includes("Used by Vraelis for") && mgr.includes("Data Vraelis never accesses"));
ok("coming-later providers render as chips (shared ComingLater), never buttons",
  mgr.includes("<ComingLater") && mgr.includes("COMING_LATER_PROVIDERS") && !/function ComingLater[\s\S]*?<button/.test(read("app/rank/app/applications/_connections/brand.tsx")));
ok("empty / busy / success / failure states all render natively",
  mgr.includes("No connections recorded") && mgr.includes('"Checking"') && mgr.includes('role={msg.kind === "err" ? "alert" : "status"}'));
ok("disconnect and revoke require an inline confirm step", mgr.includes("confirming") && mgr.includes("Cancel"));
ok("test-account replace re-seals through the sealed secrets route, then revokes the old row",
  /replaceCredential[\s\S]*?\/secrets[\s\S]*?method: "POST"[\s\S]*?connections\/[\s\S]*?DELETE/.test(mgr));
ok("edits echo expected_updated_at (stale edits surface as a conflict, never a silent clobber)", mgr.includes("expected_updated_at"));
ok("manager reuses the SHARED forms (no duplicated form components)",
  mgr.includes('from "../../../_connections/forms"') && !mgr.includes("function TwoFieldForm") && !mgr.includes("function GithubForm"));
ok("connect workspace reuses the same shared forms (extraction, not duplication)", (() => {
  const cf = read("app/rank/app/applications/new/connect-form.tsx");
  return cf.includes('from "../_connections/forms"') && !cf.includes("function TwoFieldForm") && !cf.includes("function GithubForm") && !cf.includes("const BRAND_PATHS");
})());
ok("management surface never renders an em dash or middle dot (copy rule)",
  ![page, mgr].some((s) => s.includes("—") || s.includes("·")));
const settings = read("app/rank/app/applications/[id]/settings/page.tsx");
ok("settings page superseded: compact count + Manage connections link, old read-only section gone",
  settings.includes("Manage connections") && settings.includes("/settings/connections") && !settings.includes("Managed at connect time for now"));

// ── S2 code-review fixes locked in ──
console.log("\n── review fixes ──");
// 1. The secrets DELETE only ever revokes TEST ACCOUNTS: it loads the connection first and 404s on any
//    other provider (those are managed by the connections routes, which audit the true provider).
const secretsDel = secrets.slice(secrets.indexOf("export async function DELETE"));
ok("secrets DELETE revokes ONLY test_account rows (getConnection provider gate before removeConnection)",
  secretsDel.includes("getConnection(") && secretsDel.includes('provider !== "test_account"')
  && secretsDel.indexOf("getConnection(") < secretsDel.indexOf("removeConnection("));
// 2. The stale-edit guard is ATOMIC: the expected timestamp rides the UPDATE's own WHERE (JSON filter),
//    with a null-path branch for never-edited rows, and a zero-row result is disambiguated by a re-read.
ok("updateConnectionMeta stale guard is atomic (expected meta->>updated_at in the UPDATE's own WHERE, null branch included)",
  upd.includes('eq("meta->>updated_at", expectedUpdatedAt)') && upd.includes('is("meta->>updated_at", null)'));
ok("zero rows updated re-reads once: row present -> stale, row gone -> not_found",
  /data\.length === 0[\s\S]{0,300}getConnection\([\s\S]{0,200}"stale"[\s\S]{0,60}"not_found"/.test(upd));
// 3. An edit RESETS verification state: edited metadata has not been verified, so no stale
//    Verification-failed pill can describe values that were never checked.
ok("an edit resets verification state (status connected, last_verified_at cleared, check note dropped)",
  upd.includes('status: "connected"') && upd.includes("last_verified_at: null") && upd.includes("delete nextMeta.last_check_note"));
// 4a. Pure-dot repo segments can never URL-normalize the GitHub probe onto a different endpoint.
ok("REPO_RE rejects pure-dot segments ('../orgs', 'a/..', './x'); dotted names still pass",
  planHealthCheck("github", { repo: "../orgs" }).kind === "metadata_only"
  && planHealthCheck("github", { repo: "a/.." }).kind === "metadata_only"
  && planHealthCheck("github", { repo: "./x" }).kind === "metadata_only"
  && planHealthCheck("github", { repo: "a.b/c.d" }).kind === "github");
// 4b. Root-host probes treat ANY HTTP response as reachable (healthy Supabase/Sentry hosts 404 at "/");
//     a webhook URL probe keeps 404 = failure (a missing endpoint is a real problem for a webhook).
ok("root probes count 404 as reachable; endpoint (webhook) probes do not",
  healthStatusFromHttp(404, "root") === "connected" && healthStatusFromHttp(404, "endpoint") === "error" && healthStatusFromHttp(404) === "error");
ok("planner marks supabase/vercel/sentry as root probes and webhook as an endpoint probe",
  (planHealthCheck("supabase", { project_url: "https://x.supabase.co" }) as { rootProbe?: boolean }).rootProbe === true
  && (planHealthCheck("vercel", { deployment_url: "https://a.vercel.app" }) as { rootProbe?: boolean }).rootProbe === true
  && (planHealthCheck("sentry", { dsn: "https://k@o0.ingest.sentry.io/1" }) as { rootProbe?: boolean }).rootProbe === true
  && (planHealthCheck("webhook", { url: "https://hooks.example.com/x" }) as { rootProbe?: boolean }).rootProbe === false);
ok("the reachable-root note claims the host responded (TLS + HTTP), never that the project was validated",
  CHECK_NOTES.reachableRoot(404).includes("Host responded") && !CHECK_NOTES.reachableRoot(404).toLowerCase().includes("valid")
  && v.includes("CHECK_NOTES.reachableRoot"));
// 5. safeFetch's SSRF/DNS-pin rejection maps to the unsafe-URL note, never the network-timeout note,
//    so owners are not sent debugging a fake uptime problem.
ok("verify maps safeFetch's blocked rejection to the unsafe-URL note (never the network note)",
  /isBlockedFetchError\(e\)[\s\S]{0,120}CHECK_NOTES\.unsafeUrl\(/.test(v)
  && /isBlockedFetchError\(e\)[\s\S]{0,200}CHECK_NOTES\.network/.test(v));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
