// The host contract.
//
//   vraelis.com      the public company surface. Readable without an account.
//   app.vraelis.com  the authenticated reliability control plane.
//
// These are structural assertions because the failure mode is invisible locally: the proxy only splits by
// host, and localhost has one host, so a broken boundary compiles, renders, and passes every local check
// while 404ing or leaking a sign-in wall in production. The APP_ROOTS omission caught during the navigation
// work was exactly this shape, and it reached a commit.
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { isAppPath, APP_ROOTS } from "../lib/app-routes";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const proxy = readFileSync("proxy.ts", "utf8");

console.log("── /developers means different things per host, by design ──");
// The public page must stay public: it exists to be read before you have an account.
ok("the PUBLIC documentation page exists", existsSync("app/rank/developers/page.tsx"));
// The authenticated console must be a separate page, never a re-export of the public one.
ok("the AUTHENTICATED console exists", existsSync("app/rank/app/developers/page.tsx"));
const authedConsole = readFileSync("app/rank/app/developers/page.tsx", "utf8");
ok("the console does NOT re-export the public documentation",
  !/from ["'].*rank\/developers/.test(authedConsole));
ok("the console is the API-key surface (keys stay under Developers)", /api\/page/.test(authedConsole));

// THE TRAP. isAppPath is host-agnostic and the MAIN host uses it to bounce product paths to the app
// subdomain. "developers" in APP_ROOTS would redirect the public documentation to app.vraelis.com and put a
// sign-in wall in front of the one page whose job is to be readable first.
ok("'developers' is deliberately NOT in APP_ROOTS", !(APP_ROOTS as readonly string[]).includes("developers"));
ok("/developers does not read as an app path on the public host", !isAppPath("/developers"));
// So the app host has to special-case it, before the marketing fallthrough.
ok("the app host rewrites /developers to the authenticated console",
  /path === "\/developers"[\s\S]{0,200}rank\/app\/developers/.test(proxy));
ok("that rewrite precedes the marketing bounce (order decides which page you get)",
  proxy.indexOf('rank/app/developers') < proxy.indexOf("marketing never renders here"));

console.log("\n── cross-host redirects preserve the query string ──");
// A dropped query silently breaks ?callbackUrl, ?oauth=, and every share link with parameters.
ok("absolute cross-host redirects copy the search string", /url\.search = req\.nextUrl\.search/.test(proxy));
// Same-host redirects clone the URL, which carries the query with it.
ok("same-host redirects clone the URL rather than rebuilding it", /const url = req\.nextUrl\.clone\(\)/.test(proxy));

console.log("\n── the API namespace is never redirected ──");
// /api/* is the real API on both hosts. A redirect here would break NextAuth and every keyed call.
ok("the app host passes /api/ straight through", /path\.startsWith\("\/api\/"\)[\s\S]{0,120}NextResponse\.next\(\)/.test(proxy));
ok("the public host passes /api/ straight through", (proxy.match(/path\.startsWith\("\/api\/"\)/g) || []).length >= 2);
// /v1/* is the public product API and must be rewritten, never redirected: a 307 drops a POST body.
ok("/v1 is rewritten, not redirected", /path\.startsWith\("\/v1\/"\)[\s\S]{0,80}"rewrite"/.test(proxy));

console.log("\n── every clean authenticated route is routable ──");
// A missing root builds and renders locally, then 404s on app.vraelis.com only.
for (const root of ["systems", "verifications", "connections", "account", "team", "organization", "credits", "plans", "billing", "api"]) {
  ok(`/${root} resolves as an app path`, isAppPath(`/${root}`));
}

console.log("\n── legacy routes still resolve (nothing was traded for the rename) ──");
for (const [root, file] of [
  ["applications", "app/rank/app/applications/page.tsx"],
  ["passes", "app/rank/app/passes/page.tsx"],
  ["issues", "app/rank/app/issues/page.tsx"],
  ["api", "app/rank/app/api/page.tsx"],
] as [string, string][]) {
  ok(`/${root} still routes and still has a page`, isAppPath(`/${root}`) && existsSync(file));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
