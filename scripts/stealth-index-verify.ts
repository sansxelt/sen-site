// WHAT A SEARCH ENGINE IS ALLOWED TO KEEP WHILE THE CURTAIN IS DOWN.
//
// Blanket noindex had an end state nobody had followed through. robots.txt says Allow: / and the sitemap
// advertised thirty URLs, every one of which answered with X-Robots-Tag: noindex. Crawlers arrive, fetch,
// forget. Eventually vraelis.com is absent from search altogether, and at that point the only descriptions
// of this company left anywhere are the profiles it links to, which still carry the retired product. The
// stale answer an AI gives when asked what Vraelis is stops being a cache artefact and becomes the only
// answer that exists.
//
// So exactly one page stays indexable: the homepage, which curtained renders the name, one sentence, and
// no product surface at all. These assertions hold that line in both directions, because getting it wrong
// either way is expensive:
//
//   TOO OPEN  a real title like "Pricing | Vraelis" over an empty curtain teaches search engines the
//             pages are hollow, and that impression outlives the launch.
//   TOO SHUT  the domain leaves the index and the retired product becomes the company's public identity.
//
// AND IT TAKES TWO SIGNALS TO AGREE. An X-Robots-Tag header and a robots meta tag are combined
// restrictively, so the more restrictive always wins. Exempting the header while the meta still says
// noindex changes nothing at all, which is exactly what happened on the first attempt and is why this
// checks both.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const proxy = readFileSync("proxy.ts", "utf8");
const home = readFileSync("app/dev-preview/v6/page.tsx", "utf8");
const sitemap = readFileSync("app/sitemap.ts", "utf8");
const stealth = readFileSync("lib/stealth.ts", "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("── the header exempts the homepage and nothing else ──");
ok("the noindex header is still applied while stealthed",
  /X-Robots-Tag/.test(code(proxy)) && /noindex, nofollow/.test(code(proxy)));
ok("the homepage is exempt from it",
  /pathname === "\/"\s*\)?\s*return res;/.test(code(proxy)));
// The exemption must be keyed on the INCOMING path. "/" is rewritten to /dev-preview/v6, so testing the
// rewrite target would exempt nothing and testing it loosely could exempt everything.
// Matched per LINE rather than with a nested-paren pattern. The call wraps NextResponse.rewrite(...),
// so [^)]* cannot reach the second argument and the assertion failed against correct code. That is the
// third guard in this repo to be defeated by counting parentheses in a regex.
ok("the exemption is decided from the path the visitor asked for, not the rewrite target",
  code(proxy).split("\n").some((l) => l.includes("noindexWhileStealthed(") && /req\.nextUrl\.pathname\)\s*;?\s*$/.test(l)));

console.log("\n── the meta tag agrees, or the header change means nothing ──");
ok("robotsMeta still vetoes indexing during stealth for anything not explicitly exempt",
  /if \(stealthConfigured\(\)\)/.test(code(stealth))
  && /allowed = opts\?\.curtainVisible === true/.test(code(stealth)));
// Asked for through the one decision function, never written as a literal here. A hardcoded robots object
// on a page is what email-embeds-verify exists to reject, and it is right to: the moment two places decide
// indexing, the one nobody edited is the one that ships.
ok("the homepage asks for the exemption through robotsMeta rather than declaring its own",
  /robotsMeta\(true, \{ curtainVisible: true \}\)/.test(code(home))
  && !/robots: \{ index:/.test(code(home)));

console.log("\n── the sitemap advertises only what is indexable ──");
ok("while stealthed it returns the homepage alone",
  /stealthConfigured\(\)/.test(code(sitemap))
  && /return \[\{ url: `\$\{BASE\}\/`/.test(code(sitemap)));
// The full derived list has to come back on its own; a launch checklist item is a launch checklist item
// somebody forgets.
ok("and reverts to the full derived list once the curtain lifts, with nothing to remember",
  /Object\.keys\(V6_EXACT\)/.test(code(sitemap)));

console.log("\n── the curtain still hides the product ──");
const layout = readFileSync("app/layout.tsx", "utf8");
ok("the curtain branch renders the stealth screen and no product",
  /<StealthScreen \/>/.test(code(layout)));
// Indexing a page that says nothing about who this is would be the worst of both: visible and useless.
ok("and carries the structured self-description, so an indexed copy names the company",
  /entityJsonLd\(\)/.test(code(layout))
  && code(layout).indexOf("entityJsonLd()") < code(layout).indexOf("<StealthScreen />"));

// ── THE CURTAIN HAS TO STOP THE PAGE RENDERING, NOT JUST STOP IT SHOWING ────────────────────────────
//
// The layout returning <StealthScreen /> instead of children is what the checks above assert, and on its
// own it is not enough. It decides what is DISPLAYED; Next renders the matched page segment anyway and
// streams it into the RSC flight payload. Measured against production: the curtained /platform answered
// 90,867 bytes to a request with no cookie, and a grep of that response found the entire marketing copy.
// The site looked hidden and was readable with curl.
//
// So the curtain is enforced in proxy.ts, in front of the renderer, and these hold that line.
console.log("\n── the curtain stops the page being rendered at all ──");
{
  const proxy = code(readFileSync("proxy.ts", "utf8"));
  ok("proxy rewrites a curtained request away from the real page",
    /stealthConfigured\(\) &&\s*!verifyStealthCookie\(/.test(proxy) && proxy.includes('url.pathname = "/curtain"'));
  // A presence check would hand the whole leak back to anyone who set the cookie to any value at all.
  ok("and VERIFIES the cookie rather than checking it exists",
    /verifyStealthCookie\(req\.cookies\.get\(STEALTH_COOKIE\)\?\.value\)/.test(proxy)
    && !/req\.cookies\.has\(STEALTH_COOKIE\)/.test(proxy));
  // The machine surfaces lib/stealth.ts already documents as exempt must stay exempt, or OAuth callbacks,
  // webhooks, the worker and the reviewer entrance itself all break behind the curtain.
  for (const p of ["/api/", "/v1", "/yc", "/og"]) {
    ok(`  ${p} stays reachable while curtained`, proxy.includes(`"${p}"`));
  }
  ok("the curtain route renders nothing, so the payload has nothing to leak",
    /return null;/.test(code(readFileSync("app/curtain/page.tsx", "utf8"))));
  ok("  and 404s when stealth is off, so it never becomes a stray public URL",
    /notFound\(\)/.test(code(readFileSync("app/curtain/page.tsx", "utf8"))));
  // The check runs before every path-resolving branch, or a rewritten path would render its real page.
  const bodyStart = proxy.indexOf("export default function proxy");
  ok("the curtain check runs before any route resolution",
    proxy.indexOf("/curtain", bodyStart) < proxy.indexOf("CLEAN_EXACT[path]", bodyStart));
}

// ── AND THE PAGE THAT IS ACTUALLY RENDERED HAS TO BE THE ONE THAT ASKS ──────────────────────────────
//
// The assertion further up checks that app/dev-preview/v6/page.tsx asks for the exemption. It passed while
// the exemption was dead, because curtained requests are rewritten to /curtain and that page was no longer
// in the tree: the deepest segment declaring metadata became /curtain, which declared none, so the root
// layout won, the meta tag said noindex while the header said indexable, and combined restrictively that is
// noindex. Checking the page that no longer renders is how a guard passes over a broken site.
console.log("\n── the rendered curtain carries the exemption, not just the page it replaced ──");
{
  const curtain = code(readFileSync("app/curtain/page.tsx", "utf8"));
  const rootLayout = code(readFileSync("app/layout.tsx", "utf8"));
  ok("the curtain route decides robots through robotsMeta",
    curtain.includes("robotsMeta(true, { curtainVisible:") && !/robots: \{ index:/.test(curtain));
  ok("  from the path the visitor asked for, forwarded by proxy",
    curtain.includes("CURTAIN_PATH_HEADER") && curtain.includes('asked === "/"'));
  ok("proxy forwards that path on the curtain rewrite",
    code(proxy).includes("headers.set(CURTAIN_PATH_HEADER, path)"));

  // The curtain is the only description of this company a machine can read while stealth is on. Saying
  // "Vraelis is in stealth." there left the retired product standing as the best answer anything could find.
  ok("the curtain describes the company rather than its absence",
    rootLayout.includes("description: SOCIAL_DESCRIPTION") && !rootLayout.includes("Vraelis is in stealth"));
  ok("  using the same string the JSON-LD publishes",
    code(readFileSync("lib/entity.ts", "utf8")).includes("SOCIAL_DESCRIPTION"));
  ok("and the root layout asks robotsMeta rather than hardcoding a robots object",
    rootLayout.includes("robots: robotsMeta(false)") && !/robots: \{ index: false/.test(rootLayout));
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
