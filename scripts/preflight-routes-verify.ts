// Regression tests for the app.vraelis.com migration (docs/subdomain-migration-plan.md): the
// legacy->clean path mapping, the isAppPath product check, and static source checks that the
// renamed routes actually propagated (no stale /app/apps nav links, shell + guard + proxy + email
// wired to the new single source of truth). Pure unit tests + static checks; no DB, no network.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { legacyToNew, isAppPath, appHostUrl, legacyRunsPath } from "../lib/app-routes";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

// ── legacyToNew: every legacy /app/* link lands on its renamed clean path ──
const MAP: [string, string][] = [
  ["/app", "/"],
  ["/app/", "/"],
  ["/app/apps", "/applications"],
  ["/app/apps/X/runs/Y", "/applications/X/passes/Y"],
  ["/app/apps/abc123", "/applications/abc123"],
  ["/app/apps/abc123/contract", "/applications/abc123/contract"],
  ["/app/audit", "/activity"],
  ["/app/api-keys", "/api"],
  ["/app/team", "/team"],
  ["/app/billing", "/billing"],
  ["/app/data-quality", "/data-quality"],
];
for (const [from, to] of MAP) {
  const got = legacyToNew(from);
  ok(`legacyToNew ${from} -> ${to}`, got === to, got === to ? "" : `got ${got}`);
}
ok("legacyToNew leaves non-/app paths alone", legacyToNew("/pricing") === "/pricing");

// ── isAppPath: the product answers on clean roots + the legacy /app prefix, never marketing ──
for (const p of ["/applications", "/passes", "/account", "/app/anything", "/app", "/applications/x/passes/y", "/activity"]) {
  ok(`isAppPath true for ${p}`, isAppPath(p));
}
for (const p of ["/pricing", "/", "/signin", "/demo", "/how-it-works", "/contact"]) {
  ok(`isAppPath false for ${p}`, !isAppPath(p));
}

// ── appHostUrl: absolute product URL in production, relative in dev ──
{
  const savedVercel = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "production";
  ok("appHostUrl is absolute app-host in production", appHostUrl("/applications") === "https://app.vraelis.com/applications");
  process.env.VERCEL_ENV = savedVercel === undefined ? "" : savedVercel;
  if (savedVercel === undefined) delete process.env.VERCEL_ENV;
  if (process.env.NODE_ENV !== "production") {
    ok("appHostUrl stays relative outside production", appHostUrl("/applications") === "/applications");
  }
}

// ── legacyRunsPath: the CLEAN-path /runs -> /passes redirect (distinct from the /app-prefix mapping) ──
ok("legacyRunsPath /applications/X/runs -> /applications/X/passes",
  legacyRunsPath("/applications/X/runs") === "/applications/X/passes");
ok("legacyRunsPath /applications/X/runs/Y -> /applications/X/passes/Y",
  legacyRunsPath("/applications/X/runs/Y") === "/applications/X/passes/Y");
ok("legacyRunsPath preserves a real id + runId",
  legacyRunsPath("/applications/abc123/runs/run_789") === "/applications/abc123/passes/run_789");
ok("legacyRunsPath /applications/X/passes -> null (the target must NOT match, so no redirect loop)",
  legacyRunsPath("/applications/X/passes") === null);
ok("legacyRunsPath /applications/X/passes/Y -> null (no loop on the report page either)",
  legacyRunsPath("/applications/X/passes/Y") === null);
ok("legacyRunsPath leaves other application tabs alone",
  legacyRunsPath("/applications/X/contract") === null && legacyRunsPath("/applications/X/deployments") === null);
ok("legacyRunsPath ignores a deeper/unknown shape rather than guessing",
  legacyRunsPath("/applications/X/runs/Y/extra") === null);
ok("legacyRunsPath ignores non-application paths",
  legacyRunsPath("/runs") === null && legacyRunsPath("/pricing") === null && legacyRunsPath("/applications") === null);
// The proxy carries the query string itself (goAbs sets url.search; the localhost clone keeps it), so
// legacyRunsPath is path-only by design: the query is never encoded into its return value.
ok("legacyRunsPath is path-only (query is the proxy's job, never baked into the mapping)",
  legacyRunsPath("/applications/X/runs") === "/applications/X/passes" && !legacyRunsPath("/applications/X/runs")!.includes("?"));

// ── Static: the proxy wires the clean /runs -> /passes redirect BEFORE the product rewrite, on both hosts ──
{
  const proxySrc = readFileSync("proxy.ts", "utf8");
  ok("proxy imports legacyRunsPath", proxySrc.includes("legacyRunsPath"));
  const iAppHostRuns = proxySrc.indexOf("legacyRunsPath(path)");
  ok("proxy calls legacyRunsPath in the app-host branch before the /rank/app rewrite", (() => {
    const iRewrite = proxySrc.indexOf('"/rank/app" + (path === "/"');
    return iAppHostRuns !== -1 && iRewrite !== -1 && iAppHostRuns < iRewrite;
  })());
  ok("proxy redirects the clean /runs report to the canonical app host /passes (app-host branch)",
    proxySrc.includes("https://app.vraelis.com${appHostRuns}"));
  ok("proxy handles the clean /runs redirect on the main host too, before the isAppPath rewrite", (() => {
    const iClean = proxySrc.indexOf("const cleanRuns = legacyRunsPath(path)");
    const iIsApp = proxySrc.indexOf("if (isAppPath(path) && !path.startsWith");
    return iClean !== -1 && iIsApp !== -1 && iClean < iIsApp;
  })());
  ok("proxy uses a 308 for the clean /runs redirect (permanent, method-preserving)",
    proxySrc.includes("NextResponse.redirect(url, 308)") && /goAbs\(req, `https:\/\/app\.vraelis\.com\$\{(appHostRuns|cleanRuns)\}`\)/.test(proxySrc));
}

// ── Static: no active PAGE link points at a /runs REPORT route (customer-facing nav uses /passes now) ──
// The report route moved /runs -> /passes. A page Link/href/router.push/redirect to
// /applications/<id>/runs would 404 or (via the redirect) cost a round trip; every such link must be
// /passes. The API namespace (/api/preflight/.../runs) and the developers page code SAMPLE (an API call)
// are the real API and are exempt.
{
  const runLinkOffenders: string[] = [];
  // A customer-facing link to the run report page: href/Link/push/redirect ending at an application's
  // /runs, i.e. "/applications/<something>/runs" NOT under /api/.
  const reportLink = /["'`]\/applications\/[^"'`]*\/runs(\/[^"'`]*)?["'`]/g;
  for (const dir of ["app", "components"]) {
    for (const file of walk(dir)) {
      if (!/\.(tsx|ts)$/.test(file)) continue;
      // The API route files themselves live under app/api and legitimately define /runs handlers; skip them.
      if (file.replace(/\\/g, "/").includes("/api/")) continue;
      const src = readFileSync(file, "utf8");
      if (reportLink.test(src)) runLinkOffenders.push(file);
      reportLink.lastIndex = 0;
    }
  }
  ok("no active PAGE link points at a /applications/<id>/runs report route (must be /passes)",
    runLinkOffenders.length === 0, runLinkOffenders.join(", "));
}

// ── Static: no stale /app/apps nav strings anywhere in shipped code (docs history exempt) ──
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
const SELF = join("scripts", "preflight-routes-verify.ts");
const MAPPER = join("lib", "app-routes.ts"); // documents the legacy forms on purpose
const legacyApps = "/app/" + "apps"; // built up so this file never contains the banned literal
const staleHits: string[] = [];
for (const dir of ["app", "lib", "components", "scripts"]) {
  for (const file of walk(dir)) {
    if (file.endsWith(SELF) || file.endsWith(MAPPER)) continue;
    const src = readFileSync(file, "utf8");
    if (src.includes(`href="${legacyApps}`) || src.includes(legacyApps + "/") || src.includes(`"${legacyApps}"`) || src.includes("`" + legacyApps)) {
      staleHits.push(file);
    }
  }
}
ok("no stale /app/apps nav strings left outside docs history", staleHits.length === 0, staleHits.join(", "));

// ── Static: the shell decides app chrome with isAppPath, not a hardcoded /app prefix ──
const shell = readFileSync("app/rank/_components/rank-ui.tsx", "utf8");
ok("rank-ui imports isAppPath from lib/app-routes", /import \{[^}]*isAppPath[^}]*\} from "@\/lib\/app-routes"/.test(shell));
ok("RankShell inApp check uses isAppPath", shell.includes("isAppPath(pathname)") && !shell.includes('pathname.startsWith("/app")'));

// ── Static: the guard sends logged-out deep links to sign-in with an app-host callback ──
const guard = readFileSync("lib/v-preflight-guard.ts", "utf8");
ok("guard builds its signin callback with appHostUrl", guard.includes("appHostUrl(") && /encodeURIComponent\(appHostUrl\(/.test(guard));

// ── Static: proxy decides the app host (and the product roots) before the retired-sansxel list ──
const proxy = readFileSync("proxy.ts", "utf8");
const iAppHost = proxy.indexOf("if (isAppHost)");
const iAppPath = proxy.indexOf("isAppPath(path)");
const iSansxel = proxy.indexOf("SANSXEL.some(");
ok("proxy handles isAppHost before the SANSXEL retired-routes list", iAppHost !== -1 && iSansxel !== -1 && iAppHost < iSansxel);
ok("proxy handles APP_ROOTS paths before the SANSXEL list (/account collides; product wins)", iAppPath !== -1 && iAppPath < iSansxel);

// ── Static: email links point at the app host, never the old vraelis.com/app paths ──
const email = readFileSync("lib/email.ts", "utf8");
ok("email links point at app.vraelis.com", email.includes("https://app.vraelis.com"));
ok("no email link still uses vraelis.com/app/*", !email.includes('https://vraelis.com/app"') && !email.includes("https://vraelis.com/app/"));

// ── Static: standalone back links never use inline-flex (founder rule: a "← Back" link must be
//    display:"flex" + width:"fit-content" so it can never share a line with the eyebrow after it) ──
const backLinkOffenders: string[] = [];
for (const file of walk("app")) {
  if (!file.endsWith(".tsx")) continue;
  const src = readFileSync(file, "utf8");
  let pos = src.indexOf("←");
  while (pos !== -1) {
    const opener = Math.max(src.lastIndexOf("<Link", pos), src.lastIndexOf("<a", pos), src.lastIndexOf("<button", pos));
    if (opener !== -1 && src.slice(opener, pos).includes("inline-flex")) backLinkOffenders.push(`${file}:${src.slice(0, pos).split("\n").length}`);
    pos = src.indexOf("←", pos + 1);
  }
}
ok("no ← back link uses inline-flex", backLinkOffenders.length === 0, backLinkOffenders.join(", "));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

// Post-review additions: the two proxy findings from the migration agent, locked in.
{
  const proxySrc = require("node:fs").readFileSync("proxy.ts", "utf8");
  ok("main host passes /api/* through untouched (NextAuth + preflight API must never redirect)",
    proxySrc.indexOf('path.startsWith("/api/")') < proxySrc.indexOf("isAppPath(path) && !path.startsWith"));
  ok("retired checker links survive: /app/checks/* -> /legacy/checks/*",
    legacyToNew("/app/checks/abc") === "/legacy/checks/abc" && legacyToNew("/app/checks") === "/legacy/checks");
}
console.log(`\n${pass}/${pass + fail} passed (final)`);
process.exit(fail ? 1 : 0);
