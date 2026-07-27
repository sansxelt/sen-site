// The authenticated navigation shell.
//
// The restructure's whole promise is that it changes what users SEE without breaking what they already
// depend on. That is easy to claim and easy to get wrong: it takes one deleted route or one unhandled alias
// to strand a bookmark in a shell with nothing selected. These assertions hold both halves.
import { readFileSync, existsSync } from "node:fs";
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
// The nav states the PRODUCT MODEL. Each of these is a durable object a customer owns, in the order the
// model runs, and the earlier version of this check asserted a flat five-item list that described one action.
for (const label of ["Overview", "Systems", "Guarantees", "Verifications", "Review", "Records"]) {
  ok(`primary nav contains ${label}`, new RegExp(`label: "${label}"`).test(navBlock));
}
// Internal lifecycle stages must not be presented as equal destinations.
for (const gone of ["Applications", "Passes", "Issues", "Repairs", "Deployments", "Activity", "Credits", "Plans", "Home"]) {
  ok(`primary nav no longer offers ${gone} as a destination`, !new RegExp(`label: "${gone}"`).test(navBlock));
}
ok("the platform group presents the other ways to operate Vraelis",
  /group: "Platform"/.test(navBlock) && /label: "Integrations"/.test(navBlock) && /label: "Developers"/.test(navBlock));
ok("settings carries account, team, usage and billing",
  /label: "Account"/.test(navBlock) && /label: "Team"/.test(navBlock)
  && /label: "Usage"/.test(navBlock) && /label: "Billing"/.test(navBlock));

// THE FOUNDER'S HARD RULE, CHECKED RATHER THAN TRUSTED: "a navigation item may appear only when it leads to
// a real working surface". A label list cannot catch a dead link, and asserting the list I just wrote would
// only confirm that I wrote it. So resolve every href in the nav to a file on disk, and separately require
// that the proxy will actually route it on the app host.
{
  const hrefs = Array.from(navBlock.matchAll(/href: "([^"]+)"/g)).map((m) => m[1]);
  ok("the nav is not empty", hrefs.length >= 12, `${hrefs.length} items`);

  const missing = hrefs.filter((h) => {
    const dir = h === "/app" ? "app/rank/app" : `app/rank/app${h}`;
    return !existsSync(`${dir}/page.tsx`);
  });
  ok("every nav item leads to a page that exists", missing.length === 0, missing.join(", "));

  // A root absent from APP_ROOTS builds fine and then 404s on app.vraelis.com only in production, which is
  // the worst possible place to discover it.
  const roots = readFileSync("lib/app-routes.ts", "utf8");
  const proxySrc = readFileSync("proxy.ts", "utf8");
  // /developers is the one product path deliberately absent from APP_ROOTS: the same clean path is PUBLIC
  // documentation on vraelis.com and the authenticated console on app.vraelis.com, and isAppPath is
  // host-agnostic, so listing it would drag the public docs behind a sign-in wall. proxy.ts routes it by
  // host instead, so the requirement is that SOMETHING routes it, not that this one list does.
  const routedByProxy = (h: string) => new RegExp(`path === "${h}"`).test(proxySrc);
  const unrouted = hrefs.filter((h) => h !== "/app"
    && !new RegExp(`"${h.slice(1)}"`).test(roots)
    && !routedByProxy(h));
  ok("every nav item is routable on the app host", unrouted.length === 0, unrouted.join(", "));

  // Two entries pointing at one page is how a menu starts lying about how much is in it.
  const dupes = hrefs.filter((h, i) => hrefs.indexOf(h) !== i);
  ok("no two nav items share a destination", dupes.length === 0, dupes.join(", "));
}

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
  ["/activity", "/records"],
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

console.log("\n── increment 2: landmarks, current-page indication, shared nav body ──");
ok("the sidebar is a labelled nav landmark", /<nav className="app-side" aria-label="Primary">/.test(ui));
ok("the active nav item is announced with aria-current=page", /aria-current=\{on \? "page" : undefined\}/.test(ui));
ok("the nav body is a single shared component (sidebar + drawer cannot drift)",
  /function NavItems\(/.test(ui) && (ui.match(/<NavItems/g) ?? []).length >= 2);
ok("icon-only nav icons are aria-hidden (labels carry meaning)", /slink__i" aria-hidden/.test(ui));

console.log("\n── one accessible dismissal contract for every popover ──");
// The hook moved out of rank-ui.tsx into its own module. Not cosmetic: rank-ui imports the command palette,
// so the palette importing the hook back would have been a cycle, and the palette therefore shipped with a
// PRIVATE copy that only closed when the press resolved to the backdrop element itself. A press landing on
// any descendant of the overlay left it open, which is what the founder hit.
const dismiss = readFileSync("app/rank/_components/use-dismiss.ts", "utf8");
ok("useDismiss exists (Escape + outside-press close every popover)", /export function useDismiss\(/.test(dismiss));
ok("Escape returns focus to the trigger", /refs\.trigger\.current\?\.focus\(\)/.test(dismiss));
ok("outside-press restores focus to the trigger on non-focusable space", /if \(!el\) refs\.trigger\.current\?\.focus\(\)/.test(dismiss));
ok("the outside-press listener is capturing, so a deeper stopPropagation cannot swallow it",
  /addEventListener\("pointerdown", onDown, true\)/.test(dismiss));

// THE ASSERTION THAT WOULD HAVE CAUGHT THE PALETTE. Every pop-open surface must reach the ONE hook. A
// dismissal rule that exists in two places is a rule that will behave two ways, and it did.
{
  const palette = readFileSync("app/rank/_components/command-palette.tsx", "utf8");
  ok("the command palette uses the shared contract", /useDismiss\(open, close, \{ panel:/.test(palette));
  ok("the palette rolls no private dismissal of its own", !/function useDismiss\(/.test(palette));
  ok("rank-ui keeps no second copy", !/function useDismiss\(/.test(ui) && /from "\.\/use-dismiss"/.test(ui));
  // Both refs must be real elements or the contains() checks silently pass for everything.
  ok("the palette wires a panel ref and a trigger ref", /ref=\{panelRef\}/.test(palette) && /ref=\{triggerRef\}/.test(palette));
}

console.log("\n── account + workspace popovers use NATIVE popover semantics, not an unimplemented ARIA menu ──");
// role=menu advertises arrow-key roving focus; these popovers navigate with Tab, so they must NOT claim it.
// The disclosure contract is: a button trigger with aria-expanded + aria-controls pointing at the panel id.
ok("NO role=menu / role=menuitem anywhere in the shell", !/role="menu"/.test(ui) && !/role="menuitem"/.test(ui));
ok("NO aria-haspopup=\"menu\" anywhere (menu keyboard contract is not implemented)", !/aria-haspopup="menu"/.test(ui));
ok("account trigger: expanded + controls the panel by id, no false menu affordance",
  /aria-expanded=\{menu\} aria-controls="acct-menu"/.test(ui) && /id="acct-menu"/.test(ui));
ok("account menu wires the dismissal contract", /useDismiss\(menu, \(\) => setMenu\(false\)/.test(ui));
ok("workspace trigger: expanded + controls the panel by id",
  /aria-expanded=\{open\} aria-controls="ws-switch"/.test(ui) && /id="ws-switch"/.test(ui));
ok("workspace switcher wires the dismissal contract", /useDismiss\(open, \(\) => setOpen\(false\)/.test(ui));
// The one place aria-haspopup is correct: the mobile drawer genuinely IS a modal dialog (role=dialog,
// aria-modal, focus trap), so it keeps aria-haspopup="dialog".
ok("aria-haspopup is used ONLY for the drawer, and only as dialog", (ui.match(/aria-haspopup="dialog"/g) ?? []).length === 1 && !/aria-haspopup="(menu|listbox|grid|tree)"/.test(ui));

console.log("\n── increment 2: accessible mobile navigation drawer ──");
ok("the mobile hamburger is rendered in the topbar", /<MobileNav \/>/.test(ui));
ok("hamburger: labelled, haspopup=dialog, expanded state, controls the drawer",
  /aria-label="Open navigation"/.test(ui) && /aria-haspopup="dialog"/.test(ui)
  && /aria-expanded=\{open\}/.test(ui) && /aria-controls="app-drawer"/.test(ui));
ok("the drawer is a modal dialog", /id="app-drawer" className="app-drawer" role="dialog" aria-modal="true"/.test(ui));
ok("the drawer traps Tab focus within itself", /if \(e\.key !== "Tab"\) return;/.test(ui) && /first\.focus\(\)/.test(ui) && /last\.focus\(\)/.test(ui));
ok("the drawer moves initial focus inside on open", /focusables\(\)\[0\]\?\.focus\(\)/.test(ui));
ok("the drawer locks body scroll while open", /document\.body\.style\.overflow = "hidden"/.test(ui));
ok("the drawer closes on backdrop press, close button, Escape, and following a link",
  /app-drawer-scrim" onClick=\{close\}/.test(ui) && /aria-label="Close navigation"/.test(ui) && /<NavItems onNavigate=\{close\}/.test(ui));
ok("the drawer closes on route change", /useEffect\(\(\) => \{ setOpen\(false\); \}, \[pathname\]\)/.test(ui));

console.log("\n── increment 2: the mobile layout is a drawer, not a shrunk desktop strip ──");
const css = readFileSync("public/vraelis/styles.css", "utf8");
ok("mobile hides the sidebar (no horizontal scroll strip)", /\.app-side \{ display: none; \}/.test(css) && !/\.app-side \{[^}]*flex-direction: row/.test(css));
ok("the hamburger is desktop-hidden, mobile-shown", /\.app-burger \{ display: none; \}/.test(css) && /\.app-burger \{\s*display: inline-grid/.test(css));
ok("the drawer + scrim are styled", /\.app-drawer \{/.test(css) && /\.app-drawer-scrim \{/.test(css));
ok("visible keyboard focus across the shell", /\.slink:focus-visible/.test(css) && /outline: 2px solid var\(--acc-deep\)/.test(css));
ok("drawer motion respects prefers-reduced-motion", /prefers-reduced-motion: reduce\) \{ \.app-drawer/.test(css));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
