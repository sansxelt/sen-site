// Regression tests for the app.vraelis.com migration (docs/subdomain-migration-plan.md): the
// legacy->clean path mapping, the isAppPath product check, and static source checks that the
// renamed routes actually propagated (no stale /app/apps nav links, shell + guard + proxy + email
// wired to the new single source of truth). Pure unit tests + static checks; no DB, no network.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { before } from "./_source-order";
import { join } from "node:path";
import { legacyToNew, isAppPath, appHostUrl, legacyRunsPath, legacySystemsPath } from "../lib/app-routes";
import { getSafeRedirectPath } from "../lib/auth-ui";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

// ── legacyToNew: every legacy /app/* link lands on its renamed clean path ──
const MAP: [string, string][] = [
  ["/app", "/"],
  ["/app/", "/"],
  // "apps" now lands on /systems, not /applications. Both were the canonical word once; only one is now,
  // and an old link should not have to be redirected twice to reach the page it always meant.
  ["/app/apps", "/systems"],
  ["/app/apps/X/runs/Y", "/systems/X/passes/Y"],
  ["/app/apps/abc123", "/systems/abc123"],
  ["/app/apps/abc123/contract", "/systems/abc123/contract"],
  ["/app/applications/abc123", "/systems/abc123"],
  ["/app/applications/abc123/runs/r1", "/systems/abc123/passes/r1"],
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
ok("legacyRunsPath /systems/X/runs -> /systems/X/passes",
  legacyRunsPath("/systems/X/runs") === "/systems/X/passes");
ok("legacyRunsPath /systems/X/runs/Y -> /systems/X/passes/Y",
  legacyRunsPath("/systems/X/runs/Y") === "/systems/X/passes/Y");
ok("legacyRunsPath preserves a real id + runId",
  legacyRunsPath("/systems/abc123/runs/run_789") === "/systems/abc123/passes/run_789");
// TWO DEAD WORDS IN ONE URL, CORRECTED IN ONE HOP. Every share page and webhook payload emitted
// /applications/<id>/runs/<run> for months. Answering with /systems/<id>/runs would be technically
// progress and practically a second redirect for the same click.
ok("legacyRunsPath accepts the OLD first segment and answers with the canonical one",
  legacyRunsPath("/applications/abc123/runs/run_789") === "/systems/abc123/passes/run_789"
  && legacyRunsPath("/applications/X/runs") === "/systems/X/passes");
ok("legacyRunsPath /systems/X/passes -> null (the target must NOT match, so no redirect loop)",
  legacyRunsPath("/systems/X/passes") === null);
ok("legacyRunsPath /systems/X/passes/Y -> null (no loop on the report page either)",
  legacyRunsPath("/systems/X/passes/Y") === null);
ok("legacyRunsPath leaves other system tabs alone",
  legacyRunsPath("/systems/X/contract") === null && legacyRunsPath("/systems/X/deployments") === null);
ok("legacyRunsPath ignores a deeper/unknown shape rather than guessing",
  legacyRunsPath("/systems/X/runs/Y/extra") === null);
ok("legacyRunsPath ignores non-system paths",
  legacyRunsPath("/runs") === null && legacyRunsPath("/pricing") === null && legacyRunsPath("/systems") === null);
// The proxy carries the query string itself (goAbs sets url.search; the localhost clone keeps it), so
// legacyRunsPath is path-only by design: the query is never encoded into its return value.
ok("legacyRunsPath is path-only (query is the proxy's job, never baked into the mapping)",
  legacyRunsPath("/systems/X/runs") === "/systems/X/passes" && !legacyRunsPath("/systems/X/runs")!.includes("?"));

// ── legacySystemsPath: /applications/* -> /systems/*, the last leg of the rename ──
//
// The pages MOVED. Until this shipped, /systems was a file that re-exported /applications and the same
// screen answered at two addresses; now only one directory exists, so every old address has to be carried
// across or it 404s. These assertions are the carry.
ok("legacySystemsPath /applications -> /systems", legacySystemsPath("/applications") === "/systems");
ok("legacySystemsPath preserves the rest of the path",
  legacySystemsPath("/applications/abc123") === "/systems/abc123"
  && legacySystemsPath("/applications/abc123/passes/run_789") === "/systems/abc123/passes/run_789"
  && legacySystemsPath("/applications/abc123/settings/connections") === "/systems/abc123/settings/connections");
ok("legacySystemsPath -> null for the canonical word (this is what stops the 308 looping)",
  legacySystemsPath("/systems") === null && legacySystemsPath("/systems/abc123/passes/r1") === null);
ok("legacySystemsPath -> null for everything that is not the old prefix",
  legacySystemsPath("/pricing") === null && legacySystemsPath("/passes") === null
  && legacySystemsPath("/") === null && legacySystemsPath("/app/applications") === null);
// A path that merely STARTS with the letters is not the prefix. Without the trailing slash this would
// rewrite /applications-archive into /systems-archive and invent a route.
ok("legacySystemsPath does not match a longer first segment",
  legacySystemsPath("/applicationsx") === null && legacySystemsPath("/applications-archive") === null);
ok("legacySystemsPath is path-only (the proxy carries the query, same as legacyRunsPath)",
  !legacySystemsPath("/applications/abc123")!.includes("?"));
// THE PAGES ARE GONE FROM THE OLD DIRECTORY, which is the fact that makes the redirect load-bearing rather
// than cosmetic. If the tree ever came back, /applications would serve again and this whole mapping would
// quietly stop being the thing that keeps old links alive.
ok("the old route directory no longer exists (so the redirect is what serves those URLs)",
  !existsSync("app/rank/app/applications"));
ok("the tree it moved to does exist", existsSync("app/rank/app/systems/page.tsx")
  && existsSync("app/rank/app/systems/[id]/passes/[runId]/page.tsx"));

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

  // THE SAME WIRING FOR THE WORD THAT MOVED, and the ordering matters twice over.
  //
  // "applications" is still in APP_ROOTS, so isAppPath() answers true for it and the rewrite below would
  // happily try to serve /rank/app/applications, a directory that no longer exists. The redirect has to
  // win. And it has to run AFTER legacyRunsPath, or a link carrying both dead words gets corrected one
  // word per round trip.
  ok("proxy imports legacySystemsPath", proxySrc.includes("legacySystemsPath"));
  ok("proxy redirects /applications on the app host before the product rewrite", (() => {
    const iSys = proxySrc.indexOf("legacySystemsPath(path)");
    const iRewrite = proxySrc.indexOf('"/rank/app" + (path === "/"');
    return iSys !== -1 && iRewrite !== -1 && iSys < iRewrite;
  })());
  ok("proxy redirects /applications on the main host before the isAppPath rewrite", (() => {
    const iSys = proxySrc.indexOf("const cleanSystems = legacySystemsPath(path)");
    const iIsApp = proxySrc.indexOf("if (isAppPath(path) && !path.startsWith");
    return iSys !== -1 && iIsApp !== -1 && iSys < iIsApp;
  })());
  ok("the /runs correction runs first, so a doubly-legacy URL costs one hop and not two", (() => {
    const iRuns = proxySrc.indexOf("const cleanRuns = legacyRunsPath(path)");
    const iSys = proxySrc.indexOf("const cleanSystems = legacySystemsPath(path)");
    return iRuns !== -1 && iSys !== -1 && iRuns < iSys;
  })());
  ok("the /applications redirect is a 308 on both hosts",
    /goAbs\(req, `https:\/\/app\.vraelis\.com\$\{(appHostSystems|cleanSystems)\}`\)/.test(proxySrc)
    && /cleanSystems[\s\S]{0,200}NextResponse\.redirect\(url, 308\)/.test(proxySrc));
}

// ── Static: no active PAGE link points at a /runs REPORT route (customer-facing nav uses /passes now) ──
// The report route moved /runs -> /passes. A page Link/href/router.push/redirect to
// /systems/<id>/runs would 404 or (via the redirect) cost a round trip; every such link must be
// /passes. The API namespace (/api/preflight/.../runs) and the developers page code SAMPLE (an API call)
// are the real API and are exempt.
{
  const runLinkOffenders: string[] = [];
  // A customer-facing link to the run report page: href/Link/push/redirect ending at a system's /runs.
  // BOTH first segments, because the directory rename did not delete the old word from anyone's fingers:
  // a link written as /applications/<id>/runs now costs two redirects, and this is the check that says so.
  const reportLink = /["'`]\/(systems|applications)\/[^"'`]*\/runs(\/[^"'`]*)?["'`]/g;
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
  ok("no active PAGE link points at a /systems/<id>/runs report route (must be /passes)",
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

// ── Static: the signed-in app shell is pinned to per-request rendering so auth() can never be served
//    from a session-less prerendered/cached shell (the signed-out hero + signed-in menu split). Both the
//    layout (covers every clean-path child) and the Dashboard page (its signed-out branch is the visible
//    symptom) must export force-dynamic. Regression lock for the session-split fix. ──
const rankLayout = readFileSync("app/rank/layout.tsx", "utf8");
const dashPage = readFileSync("app/rank/app/page.tsx", "utf8");
ok("app/rank/layout.tsx pins force-dynamic (auth() runs per request)", /export const dynamic\s*=\s*"force-dynamic"/.test(rankLayout));
ok("app/rank/app/page.tsx pins force-dynamic (no session-less prerender of the dashboard)", /export const dynamic\s*=\s*"force-dynamic"/.test(dashPage));

// ── Static: no prospect-reachable surface points at the RETIRED products (checker /r/check, Rank
//    /r/sample, /new). The current product entry is /free-report or /how-it-works. ──
// /guides was the retired "AI output QA" content section (removed in Phase 3.06). It has no source
// route anymore; the contract that replaced the page is: the proxy redirects every /guides* link to
// the current product story, and robots keeps it out of the index. Asserted from the live contract,
// never by reading the deleted page.
ok("the retired /guides route is gone from source", !existsSync("app/rank/guides"));
const proxyGuides = readFileSync("proxy.ts", "utf8");
ok("proxy intercepts retired /guides and /guides/* links", /path === "\/guides" \|\| path\.startsWith\("\/guides\/"\)/.test(proxyGuides));
ok("proxy redirects the retired guides section to the current product story", proxyGuides.includes('go(req, "/how-it-works", "redirect")'));
ok("robots keeps /guides out of the index", readFileSync("app/robots.ts", "utf8").includes('"/guides"'));
const sitemapSrc = readFileSync("app/sitemap.ts", "utf8");
ok("sitemap does NOT advertise the retired /r/check or /r/sample samples", !sitemapSrc.includes('page("/r/check"') && !sitemapSrc.includes('page("/r/sample"'));
const rCheck = readFileSync("app/r/check/page.tsx", "utf8");
const rSample = readFileSync("app/r/sample/page.tsx", "utf8");
// The retired shared-report SAMPLES now REDIRECT to the current product story (stronger than noindex: they
// render no retired positioning at all) and stay noindex.
ok("the retired /r/check + /r/sample samples redirect to the current product + are noindex",
  /redirect\("\/how-it-works"\)/.test(rCheck) && /redirect\("\/how-it-works"\)/.test(rSample)
  && /index:\s*false/.test(rCheck) && /index:\s*false/.test(rSample));
const proxySrc2 = readFileSync("proxy.ts", "utf8");
ok("proxy redirects ALL retired /v/* to home (catch-all, after the legal vanity paths)", /path === "\/v" \|\| path\.startsWith\("\/v\/"\)/.test(proxySrc2));
const rToken = readFileSync("app/r/[token]/page.tsx", "utf8");
const rcToken = readFileSync("app/r/c/[token]/page.tsx", "utf8");
// The retired per-token shared reports (human-eval /r/[token] and checker /r/c/[token]) REDIRECT and render
// NO retired report body, so no retired positioning (judgments / Decision Package / AI output check) or
// retired CTA (/new, /app/checks/new) can reach the public.
//
// The target used to be pinned to the literal /how-it-works. That is a page design 06 deliberately drops
// (superseded by /method and /platform), so the assertion was holding these stubs to a destination that
// disappears at promotion — an old link would land on the generation this repo is replacing. "/" is the only
// target correct in both regimes, and it is what the check now requires.
ok("retired per-token shared reports redirect to the site root, rendering no retired body/CTA",
  /redirect\("\/"\)/.test(rToken) && /redirect\("\/"\)/.test(rcToken)
  && !/redirect\("\/how-it-works"\)/.test(rToken) && !/redirect\("\/how-it-works"\)/.test(rcToken)
  && !rToken.includes("app.vraelis.com/new") && !rcToken.includes('href="/app/checks/new"')
  && !/getSharedReport|ReportBody|Decision Package/.test(rToken) && !/getSharedCheck|CheckReport/.test(rcToken));
// And their link preview is the shared one, not a hand-written card. These two were the last surfaces still
// advertising "Production validation for AI-built systems" with a rendered 1200x630 image.
ok("the retired share stubs use the one shared social card",
  /socialCard\(\)/.test(rToken) && /socialCard\(\)/.test(rcToken));

// ── A SIGNED-OUT DEEP LINK MUST KEEP ITS DESTINATION ──────────────────────────────────────────────────
//
// This asserted the opposite until now: that the guard wrapped its callback in appHostUrl(). It did, and
// that is what broke it. appHostUrl is ABSOLUTE in production, safeReturnPath rejects any absolute URL as
// open-redirect defence, and getSafeRedirectPath therefore threw the destination away and returned its
// default. Every signed-out deep link into the product landed on account settings, and a team invite is
// exactly the link you send to someone who is not signed in.
//
// So the check is now BEHAVIOURAL rather than structural: run the value the guard actually builds through
// the function that actually gates it, in production mode, and assert the destination is still there. A
// test that pins an implementation detail cannot tell you the implementation is wrong.
{
  const guard = readFileSync("lib/v-preflight-guard.ts", "utf8");
  const teamPage = readFileSync("app/rank/app/systems/[id]/team/page.tsx", "utf8");
  const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  ok("the guard does not wrap its signin callback in an absolute URL",
    !/appHostUrl\(/.test(code(guard)) && /encodeURIComponent\(returnPath\)/.test(code(guard)));
  ok("the team page does not either (it is the invite destination)",
    !/appHostUrl\(/.test(code(teamPage)));

  // The property itself, end to end, in the mode where it broke.
  const prev = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "production";
  const deep = "/systems/abc123/team";
  const survives = getSafeRedirectPath(deep);
  const absoluteWouldBe = getSafeRedirectPath(appHostUrl(deep));
  process.env.VERCEL_ENV = prev;

  ok(`a relative deep link survives the redirect allowlist (${survives})`, survives === deep);
  // And the reason the wrapper cannot come back: prove the allowlist still rejects the absolute form, so
  // nobody "fixes" this later by loosening the open-redirect defence instead.
  ok(`an absolute app-host callback is still rejected, as it must be (${absoluteWouldBe})`,
    absoluteWouldBe !== deep);
}

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
    before(proxySrc, 'path.startsWith("/api/")', "isAppPath(path) && !path.startsWith"));
  ok("retired checker links land home: /app/checks[/*] -> / (the checker surface is deleted)",
    legacyToNew("/app/checks/abc") === "/" && legacyToNew("/app/checks") === "/");
}
console.log(`\n${pass}/${pass + fail} passed (final)`);
process.exit(fail ? 1 : 0);
