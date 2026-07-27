// Vraelis-controlled email + social embeds: current product language, honest delivery, safe escaping.
//
// The audit that produced this found the whole email surface still saying "Production Pass" and "the
// production layer for AI-built software", and the social cards plus the root-layout meta still carrying the
// retired homepage headline. Link previews and lifecycle emails are the two places a stale product identity
// travels furthest, so this keeps them pinned to the current one.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { robotsMeta } from "../lib/stealth";

// robotsMeta reads STEALTH_MODE at call time, so the behavioural assertions below can drive it both ways.
// The original value is restored afterwards; nothing else in the suite depends on it, but a check that
// leaves the environment changed is a check that breaks the next one.
const stealthWas = process.env.STEALTH_MODE ?? "";
const setStealth = (v: string) => { process.env.STEALTH_MODE = v; };

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const email = readFileSync("lib/email.ts", "utf8");
const ogMain = readFileSync("app/og/route.tsx", "utf8");
const ogReport = readFileSync("app/og/r/route.tsx", "utf8");
const rootLayout = readFileSync("app/layout.tsx", "utf8");

console.log("── emails speak the current product, not the retired one ──");
// Retired product vocabulary. "Production Pass" was the old unit; the product now runs verifications.
for (const [term, where] of [
  ["Production Pass", "the old unit name"],
  ["production layer for AI", "the retired positioning"],
] as [string, string][]) {
  ok(`no "${term}" in Vraelis emails (${where})`, !email.includes(term));
}
// The current identity should actually appear, not just the absence of the old one.
ok("emails carry the current positioning", /independent verification layer for work performed by AI/.test(email));
ok('emails use the "verify an outcome" action', /Verify an outcome/i.test(email));

console.log("\n── emails claim nothing the product does not do ──");
// The standing rule: no automation the engine does not perform. A lifecycle nudge is the easiest place to
// imply continuous monitoring or automatic repair, and it must not.
for (const re of [
  /continuously monitor/i, /automatic(ally)? (repair|reverif|re-verif|redeploy)/i,
  /watches your deploy/i, /deployment hook/i, /github check/i,
]) {
  ok(`emails do not claim: ${re.source}`, !re.test(email));
}
// Vraelis provides a repair PROMPT; the agent repairs. Emails must not say Vraelis repaired anything.
ok("emails never say Vraelis repaired the application", !/Vraelis (repairs|repaired|fixes|fixed) your/i.test(email));

console.log("\n── delivery is honest: never claim delivered when unconfigured ──");
// getResend() returns null without RESEND_API_KEY, and every sender returns early on null rather than
// reporting success. Log-only / unconfigured must never read as delivered.
ok("sends gate on a configured Resend client", /if \(!resend\)/.test(email));
ok("no sender claims 'delivered'", !/\bdelivered\b/i.test(email.replace(/webhook_delivered/g, "")));

console.log("\n── user content is escaped before it enters HTML email ──");
// A name/subject placed raw into an HTML body is an injection vector. The welcome path escapes the name.
ok("user-supplied name is escaped in email HTML", /escapeHtml\(name\)/.test(email));
ok("an escapeHtml helper exists and is used widely", (email.match(/escapeHtml\(/g) || []).length >= 5);

console.log("\n── links point at the right host ──");
// App actions belong on app.vraelis.com; public/marketing on vraelis.com. A verify CTA that points at the
// marketing host would dump a signed-in user out of the product.
ok("the verify CTA points at the app host root (no legacy /app suffix)",
  /https:\/\/app\.vraelis\.com"/.test(email) && !/https:\/\/app\.vraelis\.com\/app(\/|")/.test(email));
ok("public references point at the marketing host", /https:\/\/vraelis\.com\/(how-it-works|pricing|privacy|terms)/.test(email));

console.log("\n── ONE embed, for every surface, forever ──");
// This section used to check that each rendered OG card carried the current headline. That was the wrong
// shape of check: it verified that several independently-written embeds happened to agree today, which is a
// property that decays the moment anyone adds a page. And they did NOT all agree — the root layout carried a
// three-sentence description and no image at all, nineteen marketing pages carried a per-page description
// plus a rendered 1200x630 headline card, and two retired share stubs were still advertising "Production
// validation for AI-built systems", a positioning two pivots old.
//
// So the check is now structural: there is exactly one embed, it is defined in exactly one file, and no
// surface may fork it. The standing rule from the founder is one sentence and no artwork beyond the mark.
const socialCardSrc = readFileSync("lib/social-card.ts", "utf8");
const ogMeta = readFileSync("lib/og-meta.ts", "utf8");

const OFFICIAL_DESC = "Verifies software built with AI actually works";
ok("the shared card states the official sentence", socialCardSrc.includes(OFFICIAL_DESC));
ok("the official description fits the 50-character limit", OFFICIAL_DESC.length <= 50, `${OFFICIAL_DESC.length} chars`);

// The ONLY embed image is the square mark, which is the artwork the favicon is generated from. A rendered
// headline card is the worst kind of stale: platforms cache the PNG far longer than the page, so the picture
// keeps saying the old thing after the words around it have been fixed.
ok("the only embed image is the Vraelis mark", /SOCIAL_IMAGE = "https:\/\/vraelis\.com\/icon-original\.png"/.test(socialCardSrc));
ok("the card is a small summary, so the mark is never stretched across a banner",
  /card: "summary" as const/.test(socialCardSrc));

// A census across every route: nothing but social-card.ts may name an embed image, and nothing may ask for
// the wide card. This is the assertion that would have caught all three forks above.
{
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      if (e === "node_modules" || e === ".next") continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(e)) out.push(p.replace(/\\/g, "/"));
    }
    return out;
  };
  // app/og/** are the legacy rendered-card endpoints. They are RETAINED, not referenced: a platform that
  // cached one of those image URLs from an old share still fetches it, and deleting the route would turn
  // those previews into a broken image. Nothing may point at them again.
  const routes = walk("app").concat(walk("lib")).filter((f) => !f.startsWith("app/og/"));
  // COMMENTS ARE STRIPPED FIRST. Several of the files below explain this very rule in prose, naming
  // summary_large_image and the retired positioning in order to record what was removed. A scan that reads
  // comments fails on its own documentation, which teaches the next person to delete the explanation rather
  // than fix the code.
  const code = (f: string) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const forkedImage = routes.filter((f) =>
    /(openGraph|twitter)[\s\S]{0,300}?images:\s*\[/.test(code(f)) && f !== "lib/social-card.ts");
  ok("no route declares its own embed image", forkedImage.length === 0, forkedImage.join(", "));

  const wideCard = routes.filter((f) => code(f).includes("summary_large_image"));
  ok("no route asks for summary_large_image", wideCard.length === 0, wideCard.join(", "));

  const referencesRendered = routes.filter((f) => /["'`](https:\/\/vraelis\.com)?\/og(\?|\/|["'`])/.test(code(f)));
  ok("nothing references the legacy rendered cards", referencesRendered.length === 0, referencesRendered.join(", "));

  const retired = routes.filter((f) => code(f).includes("Production validation for AI-built systems"));
  ok("no surface still carries the retired positioning", retired.length === 0, retired.join(", "));
}

// og-meta serves nineteen marketing pages, so it is the highest-leverage place for a fork to reappear.
ok("the marketing pages take their embed from the shared card", /socialCard/.test(ogMeta));
ok("og-meta offers no per-page image or opt-out override",
  !/noImage|image\?:/.test(ogMeta.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")));
ok("the root layout takes its embed from the shared card", /socialCard\(/.test(rootLayout));
// The rendered endpoints must stay unreferenced but keep working, so old cached previews still resolve.
ok("the legacy rendered card endpoints still exist for already-shared links",
  ogMain.length > 0 && ogReport.length > 0);

console.log("\n== ONE mark, and every file that draws it agrees ==");
{
  // The mark is defined ONCE in lib/brand-mark.ts. The favicon, the iOS icon, the docs rail and the chapter
  // marks import it, so those cannot drift by construction. public/mark.svg is the exception: it is a static
  // file anyone can hand to a designer or paste into a deck, and a static copy of a definition is exactly
  // the thing that silently goes stale. So it is checked against the source rather than trusted.
  const brand = readFileSync("lib/brand-mark.ts", "utf8");
  const svg = readFileSync("public/mark.svg", "utf8");
  const pts: Record<string, string> = {};
  for (const m of brand.matchAll(/^const (L|R|TL|TR|ML|MR|C|B) = "([^"]+)";/gm)) pts[m[1]] = m[2];
  ok("the mark's vertices are all named in the definition", Object.keys(pts).length === 8, Object.keys(pts).join(","));

  const facets = [...brand.matchAll(/\{ d: `([^`]+)`, fill: "(#[0-9A-F]{6})" \}/g)]
    .map((m) => ({ d: m[1].replace(/\$\{(\w+)\}/g, (_x, k) => pts[k]), fill: m[2] }));
  ok("the definition carries the seven facets of the cut stone", facets.length === 7, String(facets.length));

  const missing = facets.filter((f) => !svg.includes(`d="${f.d}"`) || !svg.includes(f.fill));
  ok("public/mark.svg matches lib/brand-mark.ts facet for facet", missing.length === 0,
    missing.map((f) => f.fill).join(", "));

  // The retired brand's coloured logos are gone; nothing may point at them again.
  const revived = ["logo-amber", "logo-cyan", "logo-emerald", "logo-violet", "logo-circle-amber"]
    .filter((g) => existsSync(`public/${g}.svg`));
  ok("the retired coloured logos stay deleted", revived.length === 0, revived.join(", "));
}

console.log("\n== the company describes itself once, and only when it is public ==");
{
  const entity = readFileSync("lib/entity.ts", "utf8");
  const rootLayout2 = readFileSync("app/layout.tsx", "utf8");
  const proxySrc = readFileSync("proxy.ts", "utf8");
  const v6Layout = readFileSync("app/dev-preview/v6/layout.tsx", "utf8");
  const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  // A search for the company returned a description of the RETIRED product, assembled by a model from
  // whatever it could find. The retired wording is gone from the code; what was missing was any
  // machine-readable statement of identity at all.
  ok("there is an entity graph", /"@type": "Organization"/.test(entity) && /"@type": "WebSite"/.test(entity));
  ok("it reuses the ONE sentence rather than writing a second description",
    /SOCIAL_DESCRIPTION/.test(entity) && !/description: "/.test(strip(entity)));
  ok("it names only profiles the company controls", /linkedin\.com\/company\/vraelis/.test(entity) && /x\.com\/vraelis/.test(entity));
  ok("the root layout emits it", /entityJsonLd\(\)/.test(rootLayout2));
  // The stealth branch returns before the body that carries the graph, so a curtained page never claims an
  // identity it is not showing.
  ok("the curtain does not carry it",
    rootLayout2.indexOf("StealthScreen") < rootLayout2.indexOf("entityJsonLd()"));

  // THE ACTIVE DEFECT THIS SECTION EXISTS FOR. Every page served "Not open yet." while telling crawlers
  // index,follow under a real title, because nested segment metadata wins in Next and the v6 layout flipped
  // robots on the promotion flag alone.
  ok("stealth sets a noindex HEADER, which no nested metadata can override",
    /X-Robots-Tag/.test(strip(proxySrc)) && /noindex, nofollow/.test(strip(proxySrc)));
  ok("that header is applied to rendered routes, not just one of them",
    (strip(proxySrc).match(/noindexWhileStealthed\(/g) ?? []).length >= 3);
  ok("and the meta tag itself stops claiming otherwise", /robotsMeta\(v6Public\)/.test(strip(v6Layout)));

  // AND THE CENSUS THAT WOULD HAVE CAUGHT IT. Fixing the layout above was verified by asserting the layout's
  // own source, which passed while the site went on serving index,follow: v6meta() in _system/meta.ts sets
  // robots on twenty-six PAGES, and page metadata is deeper than layout metadata, so it won every time.
  // og-meta.ts had a third copy of the same decision for the previous generation's pages.
  //
  // So the rule is now structural: exactly one function decides indexing, and no module may reach that
  // conclusion by itself. A hardcoded noindex is exempt, because stealth only ever vetoes TOWARD noindex, so
  // a page that has already opted out cannot be made to lie by it.
  const walkAll = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir)) {
      if (e === "node_modules" || e === ".next") continue;
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walkAll(p, out);
      else if (/\.tsx?$/.test(e)) out.push(p.replace(/\\/g, "/"));
    }
    return out;
  };
  const forks: string[] = [];
  for (const f of walkAll("app").concat(walkAll("lib"))) {
    for (const m of strip(readFileSync(f, "utf8")).matchAll(/robots:\s*([\s\S]{0,60})/g)) {
      const val = m[1];
      if (/^\s*robotsMeta\(/.test(val)) continue;              // routed through the one decision
      if (/^\s*\{\s*index:\s*false/.test(val)) continue;       // opted out already, cannot be made to lie
      forks.push(`${f} → robots: ${val.split("\n")[0].trim().slice(0, 44)}`);
    }
  }
  ok("every indexable page routes its robots through the one stealth-aware decision",
    forks.length === 0, forks.join(" | "));

  // Static reading is what let the last fix pass while the site stayed broken, so assert the BEHAVIOUR too.
  ok("stealth vetoes a page that wants to be indexed", (setStealth("1"), robotsMeta(true).index === false));
  ok("it vetoes follow as well, not just index", robotsMeta(true).follow === false);
  ok("a page that opted out stays out when the curtain lifts", (setStealth(""), robotsMeta(false).index === false));
  ok("and a public page indexes normally once it is off", robotsMeta(true).index === true);
  setStealth(stealthWas);
}


console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
