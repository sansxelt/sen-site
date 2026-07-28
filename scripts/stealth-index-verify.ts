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

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
