// WHAT IS INVISIBLE ON A PHONE THAT SHOULD NOT BE.
//
// The chapters derive a dozen variables from --p and drive child opacity from them. On mobile --p no longer
// travels, so every one of those children renders a single frozen frame of an animation, and for anything
// that FADES OUT by the end that frame is opacity 0. The parent is forced visible by its own mobile rule;
// the children were never in that rule.
//
// Reasoning about which children those are is how you miss one. This walks every descendant of every
// chapter after the page has settled and reports anything a reader cannot see, with the declaration
// responsible. Run it, fix what it names, run it again until it is empty.
import { chromium, devices } from "playwright";

const URL = process.argv[2] || "http://localhost:3311/";
const CHAPTERS = [".v6-gap", ".v6-st", ".v6-rg", ".v6-dr", ".v6-tm", ".v6-cs", ".v6-kn"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);

// Scroll the whole page so every reveal has had its chance, then let transitions finish.
const vh = await page.evaluate(() => innerHeight);
const docH = await page.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y <= docH; y += Math.round(vh * 0.5)) {
  await page.evaluate((yy) => scrollTo(0, yy), y);
  await page.waitForTimeout(110);
}
await page.waitForTimeout(1600);

// Deliberately invisible, with the reason. Kept as an explicit list rather than a looser threshold so the
// probe's empty output keeps meaning "nothing is wrong" instead of "nothing new is wrong".
//
//   v6-st__count   the running tally the ring counts up. It shares its box with .v6-st__verdict, which is
//                  position: absolute; inset: 0 and takes over once the ring closes. They are an either/or
//                  pair by construction, and with no scrub on mobile the finished state is the honest one:
//                  a progress counter has nothing to say about progress that is not happening. Verified by
//                  this same probe NOT reporting .v6-st__verdict, i.e. the swap landed the right way up.
const EXPECTED_INVISIBLE = ["v6-st__count"];

const bad = await page.evaluate((chapters) => {
  const out = [];
  for (const c of chapters) {
    const root = document.querySelector(c);
    if (!root) continue;
    for (const el of [root, ...root.querySelectorAll("*")]) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;   // deliberately removed, not hidden
      const op = parseFloat(cs.opacity);
      const hasText = (el.textContent || "").trim().length > 0;
      const box = el.getBoundingClientRect();
      // Only things that OCCUPY SPACE and CARRY CONTENT. A zero-size decorative node at opacity 0 is not a
      // reader's problem; a paragraph is.
      if (!hasText || box.width < 4 || box.height < 4) continue;
      if (op < 0.9) {
        out.push({
          chapter: c,
          cls: el.className.toString().slice(0, 46),
          opacity: +op.toFixed(3),
          text: (el.textContent || "").trim().slice(0, 44),
          transform: cs.transform === "none" ? "" : cs.transform.slice(0, 34),
        });
      }
    }
  }
  // A parent at opacity 0 makes every descendant invisible; report the outermost only.
  return out.filter((r, i) => !out.some((o, j) => j < i && r.cls.startsWith(o.cls.split(" ")[0]) && o.chapter === r.chapter && r.cls !== o.cls));
}, CHAPTERS);

const vars = await page.evaluate(() => {
  const g = document.querySelector(".v6-gap");
  if (!g) return {};
  const cs = getComputedStyle(g);
  const out = {};
  for (const n of ["--p", "--strike", "--turn", "--claim", "--found", "--foundout", "--verdict", "--settle"]) {
    out[n] = cs.getPropertyValue(n).trim();
  }
  return out;
});

console.log("── .v6-gap computed variables on a phone ──");
console.log(" ", JSON.stringify(vars));
const expected = bad.filter((b) => EXPECTED_INVISIBLE.some((e) => b.cls.includes(e)));
const unexpected = bad.filter((b) => !EXPECTED_INVISIBLE.some((e) => b.cls.includes(e)));

if (expected.length) {
  console.log(`\n── invisible ON PURPOSE: ${expected.length} ──`);
  for (const b of expected) console.log(`  ${b.chapter.padEnd(9)} ${b.cls.padEnd(30)} "${b.text}"`);
}
console.log(`\n── content a reader cannot see: ${unexpected.length} ──`);
for (const b of unexpected) console.log(`  ${b.chapter.padEnd(9)} opacity ${String(b.opacity).padEnd(6)} ${b.cls.padEnd(30)} "${b.text}"`);
if (!unexpected.length) console.log("  (none)");

await browser.close();
process.exit(unexpected.length ? 1 : 0);
