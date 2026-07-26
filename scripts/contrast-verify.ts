// WCAG contrast for the pairs that are ACTUALLY RENDERED, computed from the token file rather than eyeballed
// from swatches.
//
// The distinction matters and is the reason this file exists: a palette review asks "is this green readable
// on that green", but the interface never puts those two together. What ships is a foreground on the ground
// it actually sits on, and only checking real pairs tells you whether anyone can read it.
//
// AND THE HARDER LESSON, which this file learned the expensive way.
//
// Every assertion here used to pass while measuring a palette the product did not use. authenticated.css
// declared --a-ground, --a-text, --a-accent, a --c-* console family and a .vconsole component; the product
// referenced none of them and rendered on the public marketing tokens instead. So this test computed
// beautiful ratios for colours nobody could see, and reported ALL PASS on an interface that had never been
// themed at all. "Pairs that are actually rendered" was the stated intent and the file was not enforcing it.
//
// So there are now two halves. The second one is the important one: NO DECLARED TOKEN MAY BE UNUSED. A
// theme is only real if the product references it, and a token with zero references is the exact shape of
// the failure above. Contrast maths cannot detect that; a usage census can.
//
// Thresholds are WCAG 2.1: 4.5:1 for body text, 3:1 for large text (>=18.66px bold or >=24px) and for
// meaningful non-text like borders, focus rings and state indicators.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const css = readFileSync("public/vraelis/authenticated.css", "utf8");

// The product's token block. Reading only inside [data-surface="app"] keeps the census honest: a value
// declared anywhere else in the file is not part of the theme the product resolves.
const BLOCK = (() => {
  const start = css.indexOf('[data-surface="app"] {');
  if (start < 0) throw new Error('the [data-surface="app"] token block is gone');
  return css.slice(start, css.indexOf("\n}", start));
})();

function token(name: string): string {
  const m = BLOCK.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8}|rgba?\\([^)]+\\))`));
  if (!m) throw new Error(`token --${name} not found in the product block`);
  return m[1];
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

// Colours are compared as rendered, which means an rgba() hairline has to be composited over the ground it
// sits on rather than measured in isolation. Comparing the raw rgba is how a border that is invisible in
// practice passes a contrast check on paper.
function rgb(c: string, over?: string): [number, number, number] {
  if (c.startsWith("#")) {
    const h = c.replace("#", "");
    const f = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
    return [parseInt(f.slice(0, 2), 16), parseInt(f.slice(2, 4), 16), parseInt(f.slice(4, 6), 16)];
  }
  const n = c.match(/[\d.]+/g)!.map(Number);
  const a = n.length > 3 ? n[3] : 1;
  if (a === 1 || !over) return [n[0], n[1], n[2]];
  const [br, bg, bb] = rgb(over);
  return [n[0] * a + br * (1 - a), n[1] * a + bg * (1 - a), n[2] * a + bb * (1 - a)];
}

function luminance(c: string, over?: string): number {
  const [r, g, b] = rgb(c, over);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

// `under` is the surface a translucent bg sits on. A state wash is its own ink at 10% alpha, so measuring
// the ink against the raw rgba compares the colour with itself and always returns 1.00:1. What ships is the
// wash already composited onto a card, and that is what the ink is read against.
function ratio(fg: string, bg: string, under?: string): number {
  const flat = bg.startsWith("#") ? bg : `rgb(${rgb(bg, under ?? "#000000").map(Math.round).join(", ")})`;
  const a = luminance(fg, flat), b = luminance(flat);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

type Pair = { what: string; fg: string; bg: string; min: number; note?: string; under?: string };

// Every pairing the product actually renders on graphite. If a combination is not listed here, it is not
// used; if it starts being used, it belongs here first.
const G0 = token("bg-0"), G1 = token("bg-1"), G2 = token("bg-2"), G3 = token("bg-3");
const PAIRS: Pair[] = [
  // ── Type on each of the four grounds ─────────────────────────────────────────────────────────────────
  { what: "headline on page ground", fg: token("fg-1"), bg: G0, min: 4.5 },
  { what: "headline on a card", fg: token("fg-1"), bg: G1, min: 4.5 },
  { what: "headline on a hovered row", fg: token("fg-1"), bg: G3, min: 4.5 },
  { what: "body on page ground", fg: token("fg-2"), bg: G0, min: 4.5 },
  { what: "body on a card", fg: token("fg-2"), bg: G1, min: 4.5 },
  { what: "body on a hovered row", fg: token("fg-2"), bg: G3, min: 4.5 },
  { what: "secondary on page ground", fg: token("fg-3"), bg: G0, min: 4.5 },
  { what: "secondary on a card", fg: token("fg-3"), bg: G1, min: 4.5 },
  { what: "secondary on a recessed well", fg: token("fg-3"), bg: G2, min: 4.5 },
  // --fg-4 and --fg-5 resolve to the same measured grey on purpose; they are checked because components
  // still ask for them by name and a future edit could quietly soften one below the floor.
  { what: "meta label on a card", fg: token("fg-4"), bg: G1, min: 4.5 },
  { what: "fine print on page ground", fg: token("fg-5"), bg: G0, min: 4.5 },

  // ── The primary action ───────────────────────────────────────────────────────────────────────────────
  { what: "ink on the primary button", fg: token("fg-on-accent"), bg: token("acc"), min: 4.5 },
  { what: "accent text on page ground", fg: token("acc-deep"), bg: G0, min: 4.5 },

  // ── State, on every ground a badge lands on ──────────────────────────────────────────────────────────
  { what: "verified on page ground", fg: token("go-ink"), bg: G0, min: 4.5 },
  { what: "verified on a card", fg: token("go-ink"), bg: G1, min: 4.5 },
  { what: "blocked on page ground", fg: token("wait-ink"), bg: G0, min: 4.5 },
  { what: "blocked on a card", fg: token("wait-ink"), bg: G1, min: 4.5 },
  { what: "failed on page ground", fg: token("stop-ink"), bg: G0, min: 4.5 },
  { what: "failed on a card", fg: token("stop-ink"), bg: G1, min: 4.5 },
  // A state badge is ink on its own wash. The wash is the ink at low alpha, so this is the pair that
  // actually ships and it must survive the compositing.
  { what: "verified on its own wash, over a card", fg: token("go-ink"), bg: token("go-wash"), under: G1, min: 4.5 },
  { what: "blocked on its own wash, over a card", fg: token("wait-ink"), bg: token("wait-wash"), under: G1, min: 4.5 },
  { what: "failed on its own wash, over a card", fg: token("stop-ink"), bg: token("stop-wash"), under: G1, min: 4.5 },
  // The same badges also land directly on the page ground, which is darker, so both are checked.
  { what: "verified on its own wash, over the ground", fg: token("go-ink"), bg: token("go-wash"), under: G0, min: 4.5 },
  { what: "blocked on its own wash, over the ground", fg: token("wait-ink"), bg: token("wait-wash"), under: G0, min: 4.5 },
  { what: "failed on its own wash, over the ground", fg: token("stop-ink"), bg: token("stop-wash"), under: G0, min: 4.5 },

  // ── Non-text that still has to be perceivable ────────────────────────────────────────────────────────
  { what: "focus ring on page ground", fg: token("focus-ring"), bg: G0, min: 3 },
  { what: "quiet hairline on page ground", fg: token("line-1"), bg: G0, min: 1.1, note: "structural, only needs to be perceivable", under: G0 },
  { what: "structural border on a card", fg: token("line-2"), bg: G1, min: 1.15, note: "structural, not informational" },
  { what: "strong border on a card", fg: token("line-3"), bg: G1, min: 1.4 },
  { what: "strongest border on a card", fg: token("line-strong"), bg: G1, min: 1.8 },
];

console.log("── contrast, computed on rendered pairs rather than swatches ──");
for (const p of PAIRS) {
  const r = ratio(p.fg, p.bg, p.under);
  ok(`${p.what}  ${p.fg} on ${p.bg}  ${r.toFixed(2)}:1 (min ${p.min})`, r >= p.min, p.note);
}

console.log("\n── the three states must stay distinguishable from each other ──");
// Being readable is not enough: verified, blocked and failed have to be tellable apart, and blocked must
// not read as a failure. Hue distance, not luminance, is what carries that.
function hue(c: string): number {
  const [r, g, b] = rgb(c).map((v) => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return -1;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}
const hGo = hue(token("go-ink")), hWait = hue(token("wait-ink")), hStop = hue(token("stop-ink"));
const apart = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
ok(`verified and failed are different hues (${hGo.toFixed(0)}deg vs ${hStop.toFixed(0)}deg)`, apart(hGo, hStop) > 60);
// 20deg, not 60. These two are the closest pair in the system and deliberately so: both values are v6.css's
// published on-dark signals (--wait-dk, --stop-dk), a warm amber and a coral, ~24deg apart. Widening the gap
// would mean diverging from the design system to satisfy a number. The gap is defensible because hue is
// never the only carrier here: every badge also states its word ("Blocked" / "Failed") and carries a
// distinct mark (a dash / an x), so nothing depends on telling the two colours apart alone. If a surface
// ever shows one of these WITHOUT its label, this threshold is the wrong test for it.
ok(`blocked and failed are different hues (${hWait.toFixed(0)}deg vs ${hStop.toFixed(0)}deg)`, apart(hWait, hStop) > 20);
// Blocked is the honest third answer, not a failure. Colouring it red teaches people to read "no verdict"
// as "broken", which is the single most expensive misreading this product can cause.
ok(`blocked is not a red (${hWait.toFixed(0)}deg is in the amber band)`, hWait >= 25 && hWait <= 65);

console.log("\n── the PUBLIC light theme, which the product theme sits on top of ──");
// This file only ever measured the product surface, so the marketing site went unchecked, and a rendered
// audit found the primary call to action on EVERY public page at 3.43:1: white on --acc. Twenty-five
// instances, one cause. The button now sits on --acc-deep. These pairs exist so it stays there.
{
  const pub = readFileSync("public/vraelis/styles.css", "utf8");
  const ptok = (name: string): string => {
    const m = pub.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
    if (!m) throw new Error(`public token --${name} not found`);
    return m[1];
  };
  const PUB: Pair[] = [
    { what: "public body on paper", fg: ptok("fg-2"), bg: ptok("bg-0"), min: 4.5 },
    { what: "public secondary on paper", fg: ptok("fg-3"), bg: ptok("bg-0"), min: 4.5 },
    { what: "public meta on paper", fg: ptok("fg-4"), bg: ptok("bg-0"), min: 4.5 },
    { what: "public fine print on paper", fg: ptok("fg-5"), bg: ptok("bg-0"), min: 4.5 },
    { what: "public accent text on paper", fg: ptok("acc-deep"), bg: ptok("bg-0"), min: 4.5 },
    // THE ONE THAT WAS BROKEN, and its hover.
    { what: "white on the primary button", fg: ptok("fg-on-accent"), bg: ptok("acc-deep"), min: 4.5 },
    { what: "white on the primary button, hovered", fg: ptok("fg-on-accent"), bg: ptok("acc-deepest"), min: 4.5 },
  ];
  for (const p of PUB) {
    const r = ratio(p.fg, p.bg);
    ok(`${p.what}  ${p.fg} on ${p.bg}  ${r.toFixed(2)}:1 (min ${p.min})`, r >= p.min);
  }
  // The button must not drift back onto --acc, which is the value that failed. --acc is still correct for
  // fills and marks that carry no text, so it is not removed, only kept off text-bearing grounds.
  const btnRule = pub.slice(pub.indexOf("\n.btn {"), pub.indexOf("\n.btn--ghost"));
  ok("the primary button is not painted on --acc", !/background:\s*var\(--acc\)/.test(btnRule), btnRule.slice(0, 80));
  ok("white never sits on --acc in a gradient either",
    !/linear-gradient\([^)]*var\(--acc\)[^)]*\)[^;]*;\s*[^}]*color:\s*#fff/i.test(pub));
}

console.log("\n── no declared token may be unused ──");
// THE GUARD THAT WOULD HAVE CAUGHT THE ORIGINAL FAILURE. A theme is only real if the product resolves it.
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e === ".git" || e === ".shots") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(e) && p !== "public\\vraelis\\authenticated.css" && p !== "public/vraelis/authenticated.css") out.push(p);
  }
  return out;
}
// authenticated.css is kept out of `walk` so its own DECLARATIONS are never mistaken for uses. Its
// component rules (.btn--ghost, :focus-visible, the pricing overrides) are real consumers though, so its
// var() references are appended — declarations excluded, references counted.
const SOURCE = walk("app").concat(walk("components"), walk("lib"), ["public/vraelis/styles.css"])
  .map((f) => readFileSync(f, "utf8")).join("\n")
  + "\n" + [...css.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => `var(${m[1]})`).join("\n");

const declared = [...BLOCK.matchAll(/^\s*(--[a-z0-9-]+):/gim)].map((m) => m[1]);
const unused = declared.filter((t) => !SOURCE.includes(`var(${t})`));
ok(`every one of the ${declared.length} declared tokens is referenced by the product`,
  unused.length === 0,
  unused.length ? `never used: ${unused.join(", ")} — a token nothing reads is a theme nothing wears` : "");

// The same failure in the other direction: the boundary has to be mounted, or the tokens resolve nowhere.
ok("the theme boundary is mounted by a shared component, not copied per layout",
  readFileSync("app/_components/product-surface.tsx", "utf8").includes('data-surface="app"'));
ok("the signed-in shell renders INSIDE the boundary (chrome is part of the product)",
  /<ProductSurface>[\s\S]{0,400}<AppTopbar/.test(readFileSync("app/rank/_components/rank-ui.tsx", "utf8")));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
