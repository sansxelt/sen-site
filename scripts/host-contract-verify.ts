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
import { existsSync, readdirSync } from "node:fs";
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

console.log("\n── every public page is actually reachable ──");
// A page under app/rank/ only serves if the proxy maps its clean path to /rank/<path>. Nothing enforces
// that at build time: the page compiles, renders locally through the dev fallthrough, and 404s in
// production. /research shipped exactly that way, was deployed, and was dead on arrival.
{
  const cleanExact = new Set(
    [...proxy.matchAll(/"(\/[a-z0-9-]*)":\s*"\/rank[^"]*"/g)].map((m) => m[1]),
  );
  // A section can be prefix-routed to the previous site, or to whichever generation is serving. Research
  // articles now take the second form, because promoted they render in design 06 and unpromoted they do
  // not exist there.
  const prefixed = [
    ...[...proxy.matchAll(/path\.startsWith\("(\/[a-z0-9-]+)\/"\)\)\s*target = "\/rank"/g)].map((m) => m[1]),
    ...[...proxy.matchAll(/path\.startsWith\("(\/[a-z0-9-]+)\/"\)\)\s*target = \(v6Public\(\)/g)].map((m) => m[1]),
  ];

  // Every directory directly under app/rank/ that has a page is a public route.
  const pages = readdirSync("app/rank", { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_") && d.name !== "app")
    .filter((d) => existsSync(`app/rank/${d.name}/page.tsx`))
    .map((d) => `/${d.name}`);

  // A page is reachable three legitimate ways: an exact map, a prefix rule, or a deliberate redirect
  // somewhere else. Only "none of the above" is a bug.
  const redirected = [...proxy.matchAll(/path === "(\/[a-z0-9-]+)"\) return go\(req, "\/[a-z0-9-]+", "redirect"\)/g)].map((m) => m[1]);
  const exactPrefixed = [...proxy.matchAll(/path === "(\/[a-z0-9-]+)" \|\| path\.startsWith/g)].map((m) => m[1]);
  for (const p of pages) {
    const reachable = cleanExact.has(p) || prefixed.includes(p) || exactPrefixed.includes(p) || redirected.includes(p);
    ok(`${p} is reachable in production`, reachable, "no exact map, no prefix rule, no redirect: this 404s on vraelis.com only");
  }
  // A section with dynamic children needs the prefix form too, or the index works and every article 404s.
  ok("/research articles are reachable, not just the index", prefixed.includes("/research"),
    "needs a startsWith(\"/research/\") rule");
  // AND they must be reachable in BOTH regimes, rendering whichever generation is live. They were the last
  // surface still serving the previous site after promotion: indexed, in the sitemap, and linked from
  // nothing, so a reader arriving from search landed inside the old company.
  ok("research articles follow the promotion instead of pinning one generation",
    /path\.startsWith\("\/research\/"\)\) target = \(v6Public\(\) \? "\/dev-preview\/v6" : "\/rank"\)/.test(proxy));
  ok("design 06 has a renderer for them", existsSync("app/dev-preview/v6/research/[slug]/page.tsx"));
  // One registry. A re-skin that forked the prose would give two versions of an authoritative document.
  ok("that renderer reads the SAME article registry, it does not copy the writing",
    /from "@\/app\/rank\/research\/_articles"/.test(readFileSync("app/dev-preview/v6/research/[slug]/page.tsx", "utf8")));
  ok("design 06 links its articles, so they are reachable and not only addressable",
    /publishedArticles\(\)/.test(readFileSync("app/dev-preview/v6/research/page.tsx", "utf8")));
}

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

// ── The theme boundary ───────────────────────────────────────────────────────────────────────────────────
// The product renders on design 06's graphite token layer; the marketing site keeps the light tokens. The
// boundary is a single attribute, which is what makes this checkable at all rather than a matter of
// remembering.
//
// WHAT THIS BLOCK USED TO ASSERT, AND WHY IT WAS REPLACED.
//
// It previously encoded the opposite contract: "the product is NOT dark, exactly one surface is dark (the
// verification console), everything around it stays warm-neutral". Every one of those assertions passed
// while the product wore no theme at all. They were checking that authenticated.css DECLARED a --c-ground,
// a --a-accent and a .vconsole class, and it did — but nothing in the product referenced any of them, so the
// interface rendered on the public marketing tokens from end to end. The file was internally consistent and
// describing an interface that did not exist.
//
// The lesson is in scripts/contrast-verify now: a theme is real only if the product references it, which is
// enforced there by a usage census. What is left here is the part this file is actually for — that the
// boundary exists, is scoped, and cannot leak into a public document.
{
  console.log("\n── the product theme is scoped, and does not leak ──");
  const authCss = readFileSync("public/vraelis/authenticated.css", "utf8");
  const publicTokens = readFileSync("public/vraelis/tokens.css", "utf8");
  const surface = readFileSync("app/_components/product-surface.tsx", "utf8");

  // Every rule must be scoped. An unscoped :root here would redefine the public palette for the whole
  // document the moment the sheet loads.
  const selectors = authCss.split("}")
    .map((b) => b.split("{")[0].trim())
    .filter((s) => s && !s.startsWith("/*") && !s.startsWith("@") && !s.includes("*/"));
  const unscoped = selectors.filter((s) => !s.includes('data-surface="app"'));
  ok("every product rule is scoped to the app surface", unscoped.length === 0, unscoped.join(" | "));
  ok("the product sheet never redefines :root", !/^\s*:root\s*\{/m.test(authCss));
  ok("product tokens do not appear in the public token file", !/--graphite|--g-fg|--canvas-scheme/.test(publicTokens));

  // ONE mount point, not a copy per layout. Three layouts need this boundary (the signed-in shell, the auth
  // round-trip, sign-in) and when each carried its own <link> and wrapper they drifted: the app layout had
  // one, both auth layouts had none, and the sheet they pointed at had gone dead anyway.
  ok("the boundary is a single shared component", /data-surface="app"/.test(surface) && /authenticated\.css/.test(surface));
  ok("the shared component carries a cache-busting version", /authenticated\.css\?v=\d+/.test(surface));
  for (const [what, file] of [
    ["the signed-in shell", "app/rank/_components/rank-ui.tsx"],
    ["the auth round-trip", "app/auth/layout.tsx"],
    ["sign-in", "app/signin/layout.tsx"],
    ["the authenticated layout", "app/rank/app/layout.tsx"],
  ] as const) {
    ok(`${what} mounts the boundary through ProductSurface`, /<ProductSurface>/.test(readFileSync(file, "utf8")));
  }
  // The chrome is part of the product. Mounted only deeper, the topbar and sidebar rendered OUTSIDE the
  // boundary and the product came up graphite inside a cream frame with an emerald button.
  ok("the boundary opens ABOVE the app chrome, not below it",
    /<ProductSurface>[\s\S]{0,400}<AppTopbar/.test(readFileSync("app/rank/_components/rank-ui.tsx", "utf8")));
  // No public route may mount it: the marketing site is the light half of the same brand.
  ok("no public marketing page mounts the product boundary",
    !/<ProductSurface>/.test(readFileSync("app/rank/page.tsx", "utf8")));

  console.log("\n── the product ground, and colour that only ever means state ──");
  const authRules = authCss.replace(/\/\*[\s\S]*?\*\//g, "");
  // Near-black, never pure black: #000 on every layer flattens depth and reads as a terminal. Shadows are
  // exempt — a shadow IS black, at low alpha.
  const surfaceTokens = [...authRules.matchAll(/--bg-\d:\s*(#[0-9a-fA-F]{6})/g)].map((m) => m[1]);
  ok(`no surface token is pure black (${surfaceTokens.length} grounds)`,
    surfaceTokens.length >= 4 && !surfaceTokens.some((c) => /^#000000$/i.test(c)), surfaceTokens.join(" "));
  // Design 06 has no accent hue: the primary action is contrast. An accent that is a colour is an accent
  // competing with the state signals, which is the one thing colour is reserved for here.
  const accent = (authRules.match(/--acc:\s*(#[0-9a-fA-F]{6})/) ?? [])[1] ?? "";
  const accentDeep = (authRules.match(/--acc-deep:\s*(#[0-9a-fA-F]{6})/) ?? [])[1] ?? "";
  const isNeutral = (hex: string) => {
    const h = hex.replace("#", "");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return Math.max(r, g, b) - Math.min(r, g, b) <= 6;
  };
  ok("the primary action is contrast, not a hue", !!accent && isNeutral(accent), accent);
  ok("the accent text colour is contrast, not a hue", !!accentDeep && isNeutral(accentDeep), accentDeep);
  // The three state triads are the ONLY colour, and each needs its ink, wash and hairline.
  for (const s of ["go", "wait", "stop"]) {
    ok(`the ${s} state is a full triad (ink, wash, line)`,
      new RegExp(`--${s}-ink:`).test(authRules) && new RegExp(`--${s}-wash:`).test(authRules) && new RegExp(`--${s}-line:`).test(authRules));
  }
  // Blocked must not be coloured as a failure: it is the honest third answer, not a broken run, and
  // colouring it red would teach people to read "no verdict" as "something went wrong". Asserted as a
  // PROPERTY rather than a literal, because the values legitimately move when contrast is corrected.
  const hueOf = (hex: string) => {
    const h = hex.replace("#", "");
    const r = parseInt(h.slice(0, 2), 16) / 255, g = parseInt(h.slice(2, 4), 16) / 255, b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (d === 0) return 0;
    const deg = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    return (deg + 360) % 360;
  };
  const grab = (name: string) => (authRules.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`)) ?? [])[1] ?? "";
  const blocked = grab("wait-ink"), failed = grab("stop-ink"), verified = grab("go-ink");
  ok("blocked, failed and verified are three different colours",
    !!blocked && !!failed && !!verified && new Set([blocked, failed, verified]).size === 3);
  const hb = hueOf(blocked);
  ok("blocked is an amber, not a red", hb > 30 && hb < 90, `hue ${hb.toFixed(0)}deg`);
  // Browser focus rings vanish against graphite, so the surface defines its own.
  ok("keyboard focus is defined on the product ground",
    /:focus-visible \{ outline: 2px solid var\(--focus-ring\)/.test(authCss));
  // THE FIRST PAINTED FRAME.
  //
  // This used to assert that the root layout painted html through a --canvas variable that
  // authenticated.css set. That mechanism worked, and it was still too late: a linked stylesheet has not
  // applied when the browser paints its first frame, so arriving at any dark surface showed a white frame
  // and the overscroll gutter past a dark page stayed pale. Screencasting a stalled load proved it — the
  // first painted frame was pure white.
  //
  // The ground is now resolved by proxy.ts from the route it is about to serve and forwarded as a request
  // header, so <html> carries the correct background AND colour scheme on its opening tag. colour-scheme is
  // the half that actually mattered: it is what the browser uses for its own canvas, the overscroll region
  // and native controls, all before the page exists.
  const rootLayout = readFileSync("app/layout.tsx", "utf8");
  const proxySrc = readFileSync("proxy.ts", "utf8");
  ok("the proxy resolves a ground for every rendered request",
    /export const GROUND_HEADER/.test(proxySrc) && /function groundFor\(/.test(proxySrc)
    && /NextResponse\.rewrite\(url, withGround\(req, pathname\)\)/.test(proxySrc)
    && /NextResponse\.next\(withGround\(req, path\)\)/.test(proxySrc));
  ok("the root layout paints <html> from that ground, on the opening tag",
    /GROUND_CSS\[ground\]\.scheme/.test(rootLayout) && /GROUND_CSS\[ground\]\.bg/.test(rootLayout)
    && /headers\(\)\)\.get\(GROUND_HEADER\)/.test(rootLayout));
  ok("colour scheme is set, not just background — it is what paints before any CSS",
    /colorScheme: GROUND_CSS\[ground\]\.scheme/.test(rootLayout));
  ok("the ground rule has ONE definition, shared by the proxy and the v6 shell",
    /export function v6GroundAtTop/.test(readFileSync("lib/v6-routes.ts", "utf8"))
    && /v6GroundAtTop/.test(proxySrc)
    && /v6GroundAtTop/.test(readFileSync("app/dev-preview/v6/_system/shell.tsx", "utf8")));
  ok("the product surface pins its canvas in the document, not only in the linked sheet",
    /color-scheme: dark !important/.test(readFileSync("app/_components/product-surface.tsx", "utf8")));
}

console.log("\n── retired product surfaces are not reachable or indexable ──");
{
  // /vote was the one retired human-eval page still rendered and indexable. It must now redirect home and
  // NOT be rewritten into the rank tree.
  ok("/vote redirects home (retired human evaluation)", /path === "\/vote"[\s\S]{0,80}"\/", "redirect"/.test(proxy));
  ok("/vote is no longer rewritten to render", !/\/vote"[\s\S]{0,40}target = "\/rank"/.test(proxy));

  // The dead-product legal pages (SMS lead-agent, desktop early-access) are removed from the build entirely.
  for (const p of ["app/(vraelis)/v/privacy", "app/(vraelis)/v/terms", "app/(vraelis)/v/refunds", "app/(site)/privacy", "app/(site)/terms"]) {
    ok(`removed dead-product legal page: ${p}`, !existsSync(`${p}/page.tsx`));
  }
  // The retired Decision Package public schema is gone.
  ok("retired Decision Package public schema removed", !existsSync("public/schemas/decision-package-v2.json"));
  // Stray root HTML snapshots (old sansxel/lead-agent) are gone.
  for (const f of ["how.html", "pricing.html", "dashboard.html", "automates.html", "index.html"]) {
    ok(`removed stray root snapshot: ${f}`, !existsSync(f));
  }

  // robots disallows the retired crawl surfaces.
  const robots = readFileSync("app/robots.ts", "utf8");
  ok("robots.ts disallows /vote", /disallow:[\s\S]{0,160}"\/vote"/.test(robots));
  ok("robots.ts disallows /guides", /disallow:[\s\S]{0,160}"\/guides"/.test(robots));

  // The retired sansxel (site) group (AR lens, voice, workshop, learn) is removed from the build entirely.
  ok("the retired sansxel (site) route group is removed", !existsSync("app/(site)"));

  // THE SITEMAP IS DERIVED FROM THE ROUTING, NOT WRITTEN BESIDE IT.
  //
  // This used to assert a literal page("/research") entry in a hand-kept list. The promotion showed why
  // that is the wrong thing to hold: the moment NEXT_PUBLIC_VRAELIS_V6_PUBLIC was set, the proxy began
  // serving design 06 at the clean paths and the hand-kept list did not know. It went on advertising
  // /how-it-works and /free-report, which are the PREVIOUS generation, and listed none of the nine routes
  // design 06 added. The one file whose job is telling search engines what this site is was describing the
  // site being replaced. Every assertion here passed throughout.
  //
  // So what is checked now is the derivation itself, which is what makes divergence impossible.
  const sitemap = readFileSync("app/sitemap.ts", "utf8");
  const proxyMaps = readFileSync("proxy.ts", "utf8");
  ok("the sitemap derives its routes from the same maps the proxy routes with",
    /import \{[^}]*V6_EXACT[^}]*CLEAN_EXACT[^}]*\} from "@\/proxy"/.test(sitemap)
    && /Object\.keys\(V6_EXACT\)/.test(sitemap) && /Object\.keys\(CLEAN_EXACT\)/.test(sitemap));
  ok("the sitemap keeps no hand-written page list to fall out of date",
    !/\bpage\("\//.test(sitemap));
  ok("those maps are exported so there can only be one source of truth",
    /export const V6_EXACT/.test(proxyMaps) && /export const CLEAN_EXACT/.test(proxyMaps));
  // /research is advertised because it is a routed path, and its articles are the one section with a prefix
  // rule rather than an exact mapping, so they are still listed explicitly.
  ok("sitemap advertises /research and its published articles",
    /"\/research":/.test(proxyMaps) && /publishedArticles\(\)/.test(sitemap));
  ok("the sitemap never advertises a sign-in form", /NEVER_INDEXED[\s\S]{0,140}"\/signin"/.test(sitemap));
  // Superseded pages stay REACHABLE (old bookmarks must not 404) but stop being advertised once there is a
  // newer site to be superseded by. Before promotion they are the live site and belong in the sitemap.
  ok("superseded pages are dropped from the sitemap only once design 06 is serving",
    /SUPERSEDED_BY_V6[\s\S]{0,200}"\/how-it-works"/.test(sitemap)
    && /promoted && SUPERSEDED_BY_V6\.has\(p\)/.test(sitemap));
  const paypal = readFileSync("app/api/paypal/create-subscription/route.ts", "utf8");
  ok("PayPal subscription returns to the live /billing/success (not the dead /checkout/success)",
    /returnUrl:[\s\S]{0,60}\/billing\/success/.test(paypal) && !/returnUrl:[\s\S]{0,60}\/checkout\/success/.test(paypal));

  // The live legal pages no longer carry retired human-eval vocabulary.
  const privacy = readFileSync("app/rank/privacy/page.tsx", "utf8");
  ok("live privacy page no longer says 'participant'", !/participant/i.test(privacy));
  const subs = readFileSync("app/rank/subprocessors/page.tsx", "utf8");
  ok("subprocessors says 'verification', not 'check'", /each verification/.test(subs) && !/runs each check/.test(subs));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
