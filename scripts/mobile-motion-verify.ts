// THE PHONE'S MOTION, AND THE TWO WAYS IT CAN GO WRONG SILENTLY.
//
// Below 900px every scroll chapter unpins and its parts get entry motion instead. That is a good trade and
// it introduced one genuinely dangerous thing: the parts now START AT OPACITY 0. Two failures follow from
// that, and neither announces itself.
//
//   THE PAGE GOES BLANK. The hidden state is legal only because it is gated on .v6-mo, a class JavaScript
//   adds once the observer that can undo it exists. Drop the gate, or hide something the observer does not
//   watch, and a phone that fails to run the script shows a page with no content on it. That is strictly
//   worse than the stillness this replaced, and it looks fine on every desktop it is developed on.
//
//   THE TWO LISTS DRIFT. The CSS hides a list of selectors; mobile-motion.ts observes a list of selectors.
//   They are the same list written twice. Add a part to the stylesheet and forget the script and that part
//   is hidden by CSS with nothing to reveal it: invisible forever, on phones only.
//
// So the contract checked here is: nothing is hidden that is not also observed, and nothing is hidden
// without the gate. Static, because that is what the integrity suite can run. The rendered behaviour
// (no-JS, full-scroll, reduced motion) is proven by ops/mobile-motion-probe.mjs against a live server.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const css = readFileSync("app/dev-preview/v6/_system/chapters.css", "utf8");
const js = readFileSync("app/dev-preview/v6/_system/mobile-motion.ts", "utf8");
const progress = readFileSync("app/dev-preview/v6/_system/progress.ts", "utf8");
const home = readFileSync("app/dev-preview/v6/home.tsx", "utf8");

// Comments stripped from the WHOLE file before anything is located, then the block found by brace
// matching. Slicing at a marker word first does not work: every marker on this page lives inside a comment,
// so the slice starts mid-comment, the opening /* is already behind it, and the strip leaves prose that the
// selector regex then reports as a broken rule. This check exists to catch drift, not to manufacture some.
const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
const motionBlock = (() => {
  const start = bare.lastIndexOf("@media (max-width: 900px)");
  if (start === -1) return "";
  let depth = 0;
  for (let i = bare.indexOf("{", start); i < bare.length; i++) {
    if (bare[i] === "{") depth++;
    else if (bare[i] === "}" && --depth === 0) return bare.slice(start, i + 1);
  }
  return bare.slice(start);
})();
const hidingRules = Array.from(motionBlock.matchAll(/(?:[{}])\s*([^{}]+?)\s*\{[^}]*opacity:\s*0[^}]*\}/g))
  .map((m) => m[1].trim())
  .filter((s) => !s.startsWith("@"));

console.log("── the phone gets motion at all ──");
ok("a mobile motion block exists", motionBlock.length > 0 && /MOBILE MOTION/.test(css));
ok("the homepage mounts it", /useMobileMotion\(\)/.test(home) && /from "\.\/_system\/mobile-motion"/.test(home));

// ── The gate, which is the only thing standing between this and a blank page ──────────────────────────
console.log("\n── nothing is hidden without something that can un-hide it ──");
// Every declaration that sets opacity to 0 inside the mobile block must be scoped by .v6-mo. An unscoped
// one hides content in the stylesheet itself, where no script failure can be recovered from.
ok("the mobile block does hide something (or this check is vacuous)", hidingRules.length > 0);
const ungated = hidingRules.filter((sel) => sel.split(",").some((s) => !s.includes(".v6-mo")));
ok("every hiding rule is gated on .v6-mo", ungated.length === 0, ungated.join(" | "));
ok(".v6-mo is added by script, not by the document", /classList\.add\("v6-mo"\)/.test(js) && !/class="[^"]*v6-mo/.test(home));
ok("the gate is removed again when the observer cannot be built",
  /IntersectionObserver === "undefined"[\s\S]{0,200}classList\.remove\("v6-mo"\)/.test(js));

// ── The two lists that must not drift ─────────────────────────────────────────────────────────────────
console.log("\n── the hidden list and the observed list are the same list ──");
// EVERY string in the list, not one per line. This read `.match(/"([^"]+)"/)` per line, which takes only
// the FIRST, so two selectors written on one line left the second observed by the script and invisible to
// this check — the exact drift the check exists for, hiding inside the check. Found by mutation: adding a
// second selector to an existing line stayed green.
const observed = new Set(
  Array.from((js.match(/const PARTS = \[([\s\S]*?)\]\.join/)?.[1] ?? "").matchAll(/"([^"]+)"/g)).map((m) => m[1]),
);
// What CSS hides, normalised back to the bare selector the script would have to observe.
const hidden = new Set<string>();
for (const rule of hidingRules) {
  for (const sel of rule.split(",")) {
    const plain = sel.trim().replace(/^\.v6-mo\s+/, "").replace(/\.v6-in\b/, "").trim();
    if (plain) hidden.add(plain);
  }
}
ok("the script observes something", observed.size > 0);
const unobserved = [...hidden].filter((s) => !observed.has(s));
ok("nothing is hidden that the script does not observe", unobserved.length === 0,
  `${unobserved.join(", ")} would stay invisible on a phone`);
const unhidden = [...observed].filter((s) => !hidden.has(s));
ok("nothing is observed that the stylesheet does not hide", unhidden.length === 0,
  `${unhidden.join(", ")} is watched for a reveal that does nothing`);

// ── Reduced motion is not negotiable ──────────────────────────────────────────────────────────────────
console.log("\n── someone who asked for less motion gets none ──");
ok("the gate is refused under prefers-reduced-motion",
  /prefers-reduced-motion: reduce/.test(js) && /!window\.matchMedia\(REDUCED\)\.matches/.test(js));
ok("the reveal is entry-driven and one-shot, so nothing recomputes on scroll",
  /IntersectionObserver/.test(js) && /io\.unobserve/.test(js) && !/addEventListener\("scroll"/.test(js));

// ── Only properties a compositor can animate ──────────────────────────────────────────────────────────
console.log("\n── the motion cannot cost layout ──");
// width/height/top/left/margin/padding in an animating rule is a layout thrash on every frame, on the
// device least able to absorb it.
const transitioned = Array.from(motionBlock.matchAll(/transition:\s*([^;]+);/g)).map((m) => m[1]);
ok("something is transitioned (or this check is vacuous)", transitioned.length > 0);
const layoutProps = /\b(width|height|top|left|right|bottom|margin|padding|font-size)\b/;
const costly = transitioned.filter((t) => layoutProps.test(t));
ok("only opacity and transform are transitioned", costly.length === 0, costly.join(" | "));
ok("will-change is released after the part arrives", /\.v6-in[\s\S]{0,400}will-change:\s*auto/.test(motionBlock));

// ── The engine that was running for nothing ───────────────────────────────────────────────────────────
console.log("\n── the scrub engine stops where nothing reads it ──");
// Measured before this shipped: --p travelled a full 0.00 -> 1.00 on an iPhone 13 viewport while not one
// part of any chapter moved. A scroll listener and a rAF loop, measuring geometry, writing a value the
// cascade discarded. If this short-circuit is removed the page still LOOKS correct, which is exactly why
// it needs an assertion rather than a comment.
ok("useScrollProgress returns early below 900px",
  /max-width: 900px[\s\S]{0,200}setProperty\(property, "1"\)[\s\S]{0,80}return;/.test(progress));
ok("it pins the value rather than leaving it unset, so any survivor reads a finished scene",
  /max-width: 900px[\s\S]{0,200}setProperty\(property, "1"\)/.test(progress));
const earlyReturn = progress.indexOf('matchMedia("(max-width: 900px)")');
const listener = progress.indexOf('addEventListener("scroll"');
ok("the short-circuit runs before the scroll listener is ever attached",
  earlyReturn !== -1 && listener !== -1 && earlyReturn < listener);

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
