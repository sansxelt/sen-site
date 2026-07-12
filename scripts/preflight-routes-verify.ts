// Regression tests for the app.vraelis.com migration (docs/subdomain-migration-plan.md): the
// legacy->clean path mapping, the isAppPath product check, and static source checks that the
// renamed routes actually propagated (no stale /app/apps nav links, shell + guard + proxy + email
// wired to the new single source of truth). Pure unit tests + static checks; no DB, no network.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { legacyToNew, isAppPath, appHostUrl } from "../lib/app-routes";

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
