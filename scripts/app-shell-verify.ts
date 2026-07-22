// The authenticated navigation shell.
//
// The restructure's whole promise is that it changes what users SEE without breaking what they already
// depend on. That is easy to claim and easy to get wrong: it takes one deleted route or one unhandled alias
// to strand a bookmark in a shell with nothing selected. These assertions hold both halves.
import { readFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { isAppPath, APP_ROOTS } from "../lib/app-routes";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const ui = readFileSync("app/rank/_components/rank-ui.tsx", "utf8");
// The sidebar block only, so a string appearing in a comment or elsewhere cannot satisfy these.
const navBlock = ui.slice(ui.indexOf("const APP_NAV"), ui.indexOf("const NAV_ALIASES"));

console.log("── the primary navigation is the product, not the architecture ──");
for (const label of ["Home", "Verifications", "Systems", "Connections", "Developers"]) {
  ok(`primary nav contains ${label}`, new RegExp(`label: "${label}"`).test(navBlock));
}
// Internal lifecycle stages must not be presented as equal destinations.
for (const gone of ["Applications", "Passes", "Issues", "Repairs", "Deployments", "Activity", "Credits", "Billing", "Plans"]) {
  ok(`primary nav no longer offers ${gone} as a destination`, !new RegExp(`label: "${gone}"`).test(navBlock));
}
ok("settings carries account, team, usage and billing",
  /label: "Account"/.test(navBlock) && /label: "Team"/.test(navBlock)
  && /label: "Usage & credits"/.test(navBlock) && /label: "Plans & billing"/.test(navBlock));

console.log("\n── nothing was deleted: every retired destination still resolves ──");
// A route that stopped existing would break a bookmark, a saved link, and any deep link in an old email.
const RETIRED: [string, string][] = [
  ["applications", "app/rank/app/applications/page.tsx"],
  ["passes", "app/rank/app/passes/page.tsx"],
  ["issues", "app/rank/app/issues/page.tsx"],
  ["repairs", "app/rank/app/repairs/page.tsx"],
  ["deployments", "app/rank/app/deployments/page.tsx"],
  ["activity", "app/rank/app/activity/page.tsx"],
  ["credits", "app/rank/app/credits/page.tsx"],
  ["billing", "app/rank/app/billing/page.tsx"],
  ["plans", "app/rank/app/plans/page.tsx"],
];
for (const [root, file] of RETIRED) {
  ok(`/${root} still routes`, isAppPath(`/${root}`), "dropped from APP_ROOTS");
  ok(`/${root} page still exists`, existsSync(file), `${file} is gone`);
}

console.log("\n── the new canonical URLs work ──");
for (const root of ["systems", "verifications"]) {
  ok(`/${root} is a routable app path`, isAppPath(`/${root}`));
  ok(`/${root} has a page`, existsSync(`app/rank/app/${root}/page.tsx`));
  ok(`/${root} is in APP_ROOTS`, (APP_ROOTS as readonly string[]).includes(root));
}
// Aliased rather than reimplemented, so the old and new URLs cannot drift apart mid-transition.
ok("/systems re-exports the applications page (one implementation, two URLs)",
  /from "\.\.\/applications\/page"/.test(readFileSync("app/rank/app/systems/page.tsx", "utf8")));
ok("/verifications re-exports the passes page",
  /from "\.\.\/passes\/page"/.test(readFileSync("app/rank/app/verifications/page.tsx", "utf8")));

console.log("\n── a bookmarked old URL still highlights the right nav item ──");
// Reimplements the component's own resolution so the mapping is tested, not just its presence.
const aliases: Record<string, string> = Object.fromEntries(
  [...ui.matchAll(/"(\/[a-z-]+)": "(\/[a-z-]+)"/g)].map((m) => [m[1], m[2]]),
);
const resolve = (p: string) => {
  const root = Object.keys(aliases).find((o) => p === o || p.startsWith(o + "/"));
  return root ? aliases[root] : p;
};
const EXPECT: [string, string][] = [
  ["/applications", "/systems"],
  ["/applications/abc-123", "/systems"],
  ["/passes", "/verifications"],
  ["/passes/run-1", "/verifications"],
  ["/issues", "/verifications"],
  ["/billing", "/plans"],
  ["/activity", "/app"],
  // /api is the OLD name for the authenticated developer console, which now lives at /developers. It is an
  // alias like the rest, not a pass-through, and the page itself still resolves.
  ["/api", "/developers"],
];
for (const [from, to] of EXPECT) {
  ok(`${from} highlights ${to}`, resolve(from) === to, `got ${resolve(from)}`);
}
// A current URL must pass through untouched, or the alias table would hijack live navigation.
for (const p of ["/systems", "/verifications", "/connections", "/developers", "/account"]) {
  ok(`${p} is not rewritten by the alias table`, resolve(p) === p);
}

console.log("\n── /developers: public docs on the marketing host, console in the app shell ──");
// The one product path deliberately out of APP_ROOTS: the same clean path is public documentation on
// vraelis.com and the authenticated console on app.vraelis.com. If it were in APP_ROOTS, isAppPath would be
// true everywhere and the public docs would be dragged behind the app shell (and, in the proxy, behind the
// sign-in wall). So it must NOT be a routable app path...
ok("/developers is NOT in APP_ROOTS (keeps the public docs public)", !(APP_ROOTS as readonly string[]).includes("developers"));
ok("isAppPath(/developers) is false (host-agnostic check must not claim it)", !isAppPath("/developers"));
// ...but on the app host the shell must still promote it into the app chrome, or the console renders with no
// left panel. The promotion is host-gated (appHost) so the marketing host is unaffected.
const shellDecision = ui.slice(ui.indexOf("const consolePath"), ui.indexOf("if (inApp)"));
ok("the shell treats /developers as a console path", /consolePath = pathname === "\/developers"/.test(shellDecision));
ok("the console promotion is gated on the app host, not global",
  /appHost && \(pathname === "\/" \|\| consolePath\)/.test(shellDecision));
// Both the public docs page and the authenticated console page exist (the proxy routes by host to each).
ok("the public developers docs page exists", existsSync("app/rank/developers/page.tsx"));
ok("the authenticated developers console page exists", existsSync("app/rank/app/developers/page.tsx"));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
