// The Research section's one load-bearing rule: an unpublished article is invisible everywhere.
//
// It exists because this section's entire value is being credible. A landing page is forgiven for being
// enthusiastic; a research note is not forgiven for being wrong. So a draft describing capability that does
// not ship yet must not leak into the index, into related links, or through a guessed URL.
import { publishedArticles, articleBySlug, relatedArticles, readingMinutes, type Article } from "../app/rank/research/_articles";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const pub = publishedArticles();
const DRAFT = "from-failure-to-verified-repair";

console.log("── the publishing gate ──");
ok("some articles are published", pub.length >= 3, `${pub.length}`);
ok("the unpublished case study is NOT in the index", !pub.some((a) => a.slug === DRAFT));
ok("its direct URL returns nothing (indistinguishable from missing)", articleBySlug(DRAFT) === null);
ok("a published slug resolves", !!articleBySlug("what-is-outcome-verification"));
ok("an unknown slug returns null", articleBySlug("nope") === null);
ok("related never surfaces an unpublished article",
  pub.every((a) => relatedArticles(a.slug, 5).every((r) => r.slug !== DRAFT)));
ok("related never returns the article itself",
  pub.every((a) => relatedArticles(a.slug, 5).every((r) => r.slug !== a.slug)));

console.log("\n── ordering and metadata ──");
ok("newest first", pub.every((a, i) => i === 0 || pub[i - 1].date >= a.date));
ok("exactly one featured article", pub.filter((a) => a.featured).length === 1);
ok("every article has a one-sentence summary", pub.every((a) => a.summary.length > 30 && a.summary.length < 220));
ok("reading time is computed and sane", pub.every((a) => readingMinutes(a) >= 1 && readingMinutes(a) <= 20));
ok("slugs are unique", new Set(pub.map((a) => a.slug)).size === pub.length);
ok("every article has a real body", pub.every((a) => a.body.length >= 8));

console.log("\n── copy rules ──");
const src = readFileSync("app/rank/research/_articles.ts", "utf8");
// Standing rule from the founder: em dashes read as AI-generated.
ok("no em dashes anywhere in the copy", !src.includes("—"));

// The browser article was scoped DOWN from a brief that claimed Vraelis follows an outcome across payments,
// authentication, data, email and connected systems. It does not. The limiting note is what keeps the
// rewrite honest, so its absence is a regression, not a style change.
const browser = articleBySlug("browser-testing-is-not-verification") as Article;
ok("the browser article carries a limiting note", browser.body.some((b) => b.t === "note"));
ok("that note calls multi-system coverage direction, not capability",
  browser.body.some((b) => b.t === "note" && /direction, not a current capability/.test(b.text)));

// No published article may state the unbuilt coverage as present tense.
const CLAIMS = [/follows the (complete )?result across/i, /verifies (payments|email|databases)/i];
ok("no published article claims multi-system verification as shipped",
  !pub.some((a) => a.body.some((b) => b.t !== "list" && b.t !== "code" && CLAIMS.some((r) => r.test((b as { text: string }).text)))));

// ── The homepage claim audit ─────────────────────────────────────────────────────────────────────────────
// The homepage is where overclaiming is most tempting and most costly. Vraelis sells independent
// verification of completion claims, so a homepage that overstates its own coverage is the exact failure it
// sells against. These assertions make that structural rather than something someone has to remember.
{
  console.log("\n── the homepage claims only what exists ──");
  // Comments are stripped first: the file documents this rule in prose, and the rule must not read as a claim.
  const raw = readFileSync("app/rank/page.tsx", "utf8");
  const copy = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  const FORBIDDEN: [RegExp, string][] = [
    [/\bMCP\b/, "MCP is not shipped"],
    [/GitHub Check/i, "GitHub Checks are not built"],
    [/deployment hook/i, "deployment hooks are not built"],
    [/\bmobile\b/i, "mobile execution does not exist"],
    [/\bdesktop\b/i, "desktop execution does not exist"],
    [/physical (system|device)/i, "physical systems are not supported"],
    [/follows the (complete )?result across/i, "multi-system tracing is direction, not capability"],
  ];
  for (const [re, why] of FORBIDDEN) {
    ok(`homepage does not claim: ${why}`, !re.test(copy));
  }

  // The wedge has to be stated on the page, not implied. "Outcomes" invites the reader to assume any system.
  ok("homepage states the web-application wedge explicitly", /Starting with deployed web applications/.test(copy));
  // The repair boundary: Vraelis decides, the agent fixes. Losing this line turns an honest claim into
  // "Vraelis fixes your code", which it does not do.
  ok("homepage states that Vraelis does not edit code", /does not edit your code/i.test(copy));
  // Machine-derived requirements must be disclosed wherever they are shown.
  ok("homepage discloses that derived requirements are not human reviewed", /Not human reviewed/i.test(copy));
  ok("no em dashes in homepage copy", !raw.includes("—"));
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
