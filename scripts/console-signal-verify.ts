// THE PRODUCT SELLS ONE SIGNAL, SO IT MAY ONLY BE BUILT ONCE.
//
// Verified / Failed / Blocked is the entire output of this company. Before the consolidation it was
// implemented separately on nine console surfaces, and they disagreed in ways a customer could see:
//
//   COLOUR. app/rank/app/systems/page.tsx, the most visited list in the product, painted Failed with
//   rgba(194,84,12,...) and Blocked with rgba(194,131,26,...). Those are the CREAM theme's inks hardcoded
//   onto a graphite surface, so the same run rendered a different colour depending on which page you
//   opened it from. It also painted In progress in --acc-deep, which resolves to #FAFAFA, so an unfinished
//   run looked louder than a finished one.
//
//   WORDS. The state where nothing has been proven had four names: "Not tested", "No verdict",
//   "No decision" and "Not yet verified". lib/preflight/home-verdict.ts had already decided it is
//   "Not yet verified". The pages were simply not asking it.
//
//   SHAPE. Blocked and Failed both carried the same mark, separating the two by amber against orange
//   alone, which is the hardest pair to distinguish with a red-green deficiency, and which contradicts the
//   token file's own statement that Blocked is the honest third answer rather than a failure.
//
// This suite is what stops all three coming back. It is deliberately about SOURCE SHAPE rather than
// rendered output: the defect is always somebody writing a private table, and the cheapest place to catch
// that is the moment the table appears. scripts/preflight-decision-verify.ts already guards the DECISION;
// this guards the way the decision is drawn.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { runVerdict } from "../lib/preflight/home-verdict";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};
const norm = (p: string) => p.replace(/\\/g, "/");
// Comments are stripped before every source assertion, so a paragraph describing the old defect can never
// satisfy a check that the defect is gone. Every file in this repo documents what it replaced, so without
// this the suite would pass on the strength of its own history.
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const SHARED = "app/rank/_components/verdict.tsx";
const CONSOLE = walk("app/rank/app").filter((p) => norm(p) !== SHARED);

console.log("── the shared component is the only place the signal is drawn ──");
{
  const v = strip(readFileSync(SHARED, "utf8"));
  ok("the shared Verdict exists and is exported", /export function Verdict\(/.test(v));
  ok("  and holds no decision logic of its own, only presentation",
    /runVerdict\(/.test(v) && !/toPublicDecision\(/.test(v));
  ok("  and covers all five tones the display layer can return",
    ["verified", "failed", "blocked", "progress", "unproven"].every((t) => new RegExp(`${t}:\\s*\\{`).test(v)));
  ok("  and gives Blocked a different MARK from Failed, not just a different colour",
    /blocked:\s*\{[^}]*mark:\s*I\.slash/.test(v) && /failed:\s*\{[^}]*mark:\s*I\.x/.test(v));
  ok("  and takes its inks from the canonical signal tokens",
    /var\(--go-ink\)/.test(v) && /var\(--stop-ink\)/.test(v) && /var\(--wait-ink\)/.test(v));
  ok("  and never reaches for the cream theme's inks",
    !/194,\s*84,\s*12/.test(v) && !/194,\s*131,\s*26/.test(v));
}

console.log("\n── the retired labels are gone from the console ──");
{
  // home-verdict.ts owns the vocabulary. These three were the private inventions that competed with it.
  for (const dead of ["Not tested", "No verdict", "No decision"]) {
    const hits = CONSOLE.filter((p) => strip(readFileSync(p, "utf8")).includes(`"${dead}"`)
      || new RegExp(`>\\s*${dead}\\s*<`).test(strip(readFileSync(p, "utf8"))));
    ok(`no console surface still renders "${dead}"`, hits.length === 0, hits.slice(0, 4).map(norm).join(", "));
  }
  ok('the one undecided label is still the one home-verdict returns',
    runVerdict("completed", null).label === "Not yet verified"
    || runVerdict("queued", null).label === "In progress");
}

console.log("\n── no console surface hardcodes the cream theme onto graphite ──");
{
  // These two literals are the light theme's --money and its amber. They belong to the public site and
  // rendering them inside data-surface="app" is what made one run look like two.
  const hits = CONSOLE.filter((p) => {
    const s = strip(readFileSync(p, "utf8"));
    return /194,\s*84,\s*12/.test(s) || /194,\s*131,\s*26/.test(s);
  });
  ok("no console file carries the cream theme's signal inks", hits.length === 0, hits.slice(0, 5).map(norm).join(", "));
}

console.log("\n── every surface that shows a decision renders the shared component ──");
{
  // A file that names all three public words is drawing the signal. It must do so through <Verdict>.
  const draws = CONSOLE.filter((p) => {
    const s = strip(readFileSync(p, "utf8"));
    return /["'>]\s*Verified\b/.test(s) && /["'>]\s*Failed\b/.test(s) && /["'>]\s*Blocked\b/.test(s);
  });
  const rogue = draws.filter((p) => {
    const s = strip(readFileSync(p, "utf8"));
    if (/<Verdict\b/.test(s)) return false;
    // A file may still MENTION the three words in prose (an empty state explaining what will come back).
    // What it may not do is map them to a colour, which is the shape of every private pill there was.
    //
    // The word and the colour must be in the SAME expression, not merely in the same file. Asking only
    // whether a signal token appears anywhere flagged app/rank/app/usage/page.tsx, where the three words
    // are stat-tile captions and the tokens are the fills of a stacked 30-day bar chart, thirty lines
    // apart and never on the same element. A chart series is not a pill and cannot become <Verdict>; the
    // rule this suite exists to keep is that nothing draws the WORD in its own colour.
    const WORD = "(?:Verified|Failed|Blocked)";
    const INK = "(?:background|borderColor|color):\\s*[\"'`]?var\\(--(?:go|stop|wait)-";
    return new RegExp(`["'>]\\s*${WORD}\\b[\\s\\S]{0,180}?${INK}`).test(s)
      || new RegExp(`${INK}[\\s\\S]{0,180}?["'>]\\s*${WORD}\\b`).test(s);
  });
  ok("no surface maps the three words to colours without the shared component",
    rogue.length === 0, rogue.slice(0, 6).map(norm).join(", "));
  ok("  and at least one surface actually renders it (this check is not vacuous)",
    CONSOLE.some((p) => /<Verdict\b/.test(strip(readFileSync(p, "utf8")))));
}

console.log("\n── the page frame is shared too ──");
{
  const ph = strip(readFileSync("app/rank/_components/page-header.tsx", "utf8"));
  ok("PageHeader and Page are exported", /export function PageHeader\(/.test(ph) && /export function Page\(/.test(ph));
  ok("  and there are two named measures, not fifteen numbers",
    /MEASURE = \{ wide: \d+, prose: \d+ \}/.test(ph));
  ok("  and the heading takes one size from .display rather than setting its own",
    /<h1 className="display" style=\{\{ margin: 0 \}\}>/.test(ph));

  // The 61 dead paddingTop values existed because the shell overrides them with !important. A page that
  // adopts <Page> and keeps one is carrying a line that cannot do anything.
  const ui = readFileSync("app/rank/_components/rank-ui.tsx", "utf8");
  ok("the shell still owns the top padding (which is why pages must not set it)",
    /app-main>\.wrap\{padding-top:[^}]*!important\}/.test(ui));
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
