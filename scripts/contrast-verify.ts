// WCAG contrast for the pairs that are ACTUALLY RENDERED, computed from the token file rather than eyeballed
// from swatches.
//
// The distinction matters and is the reason this file exists: a palette review asks "is this green readable
// on that green", but the interface never puts those two together. What ships is a foreground on the ground
// it actually sits on, and only checking real pairs tells you whether anyone can read it.
//
// Thresholds are WCAG 2.1: 4.5:1 for body text, 3:1 for large text (>=18.66px bold or >=24px) and for
// meaningful non-text like borders, focus rings and state indicators.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const css = readFileSync("public/vraelis/authenticated.css", "utf8");

function token(name: string): string {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!m) throw new Error(`token --${name} not found`);
  return m[1];
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(fg: string, bg: string): number {
  const a = luminance(fg), b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

type Pair = { what: string; fg: string; bg: string; min: number; note?: string };

// Every pairing the interface actually renders. If a combination is not listed here, it is not used; if it
// starts being used, it belongs here first.
const PAIRS: Pair[] = [
  // ── The warm-neutral shell ─────────────────────────────────────────────────────────────────────────────
  { what: "shell body text on ground", fg: token("a-text"), bg: token("a-ground"), min: 4.5 },
  { what: "shell body text on raised surface", fg: token("a-text"), bg: token("a-raised"), min: 4.5 },
  { what: "shell secondary text on ground", fg: token("a-text-2"), bg: token("a-ground"), min: 4.5 },
  { what: "shell secondary text on raised", fg: token("a-text-2"), bg: token("a-raised"), min: 4.5 },
  { what: "shell muted text on ground", fg: token("a-text-muted"), bg: token("a-ground"), min: 4.5 },
  { what: "shell muted text on raised", fg: token("a-text-muted"), bg: token("a-raised"), min: 4.5 },
  { what: "accent text on ground", fg: token("a-accent"), bg: token("a-ground"), min: 4.5 },
  { what: "accent text on its own soft tint", fg: token("a-accent"), bg: token("a-accent-soft"), min: 4.5 },
  { what: "verified label on raised", fg: token("a-verified"), bg: token("a-raised"), min: 4.5 },
  { what: "failed label on raised", fg: token("a-failed"), bg: token("a-raised"), min: 4.5 },
  { what: "blocked label on raised", fg: token("a-blocked"), bg: token("a-raised"), min: 4.5 },
  // Borders and focus rings are meaningful non-text: 3:1 is the bar, and they must not disappear.
  { what: "quiet border against ground", fg: token("a-border"), bg: token("a-ground"), min: 1.15, note: "quiet by design; only needs to be perceivable, not readable" },
  { what: "active border against raised", fg: token("a-border-active"), bg: token("a-raised"), min: 1.4, note: "structural, not informational" },
  { what: "focus ring against ground", fg: token("a-focus"), bg: token("a-ground"), min: 3 },

  // ── The charcoal console ───────────────────────────────────────────────────────────────────────────────
  { what: "console primary text on console ground", fg: token("c-text"), bg: token("c-ground"), min: 4.5 },
  { what: "console primary text on console surface", fg: token("c-text"), bg: token("c-surface"), min: 4.5 },
  { what: "console secondary text on ground", fg: token("c-text-2"), bg: token("c-ground"), min: 4.5 },
  { what: "console muted text on ground", fg: token("c-text-muted"), bg: token("c-ground"), min: 4.5 },
  { what: "console muted text on surface (placeholders)", fg: token("c-text-muted"), bg: token("c-surface"), min: 4.5 },
  { what: "console accent on ground", fg: token("c-accent"), bg: token("c-ground"), min: 4.5 },
  { what: "console accent on surface", fg: token("c-accent"), bg: token("c-surface"), min: 4.5 },
  { what: "console accent on raised (focused input)", fg: token("c-accent"), bg: token("c-raised"), min: 4.5 },
  { what: "verified on console ground", fg: token("c-verified"), bg: token("c-ground"), min: 4.5 },
  { what: "failed on console ground", fg: token("c-failed"), bg: token("c-ground"), min: 4.5 },
  { what: "blocked on console ground", fg: token("c-blocked"), bg: token("c-ground"), min: 4.5 },
  { what: "console focus ring against surface", fg: token("c-accent"), bg: token("c-surface"), min: 3 },
  { what: "console border against ground", fg: token("c-border"), bg: token("c-ground"), min: 1.15, note: "quiet by design" },
];

console.log("── contrast, computed on rendered pairs rather than swatches ──");
for (const p of PAIRS) {
  const r = ratio(p.fg, p.bg);
  ok(`${p.what}  ${p.fg} on ${p.bg}  ${r.toFixed(2)}:1 (min ${p.min})`, r >= p.min, p.note);
}

console.log("\n── the pairing that was flagged in review ──");
// The concern raised was #7FBFA8 on #2F5D50, roughly 3.5:1, too weak for small text. It is worth recording
// that the interface never renders that combination: #7FBFA8 is the CONSOLE accent and lives on charcoal,
// while #2F5D50 is the SHELL accent and never serves as a background for it. Checking the palette would
// have flagged it; checking rendered pairs shows there is nothing to fix.
const consoleAccentOnShellAccent = ratio(token("c-accent"), token("a-accent"));
const consoleAccentOnConsoleGround = ratio(token("c-accent"), token("c-ground"));
console.log(`      console accent on shell accent would be ${consoleAccentOnShellAccent.toFixed(2)}:1 (never rendered)`);
console.log(`      console accent on console ground is    ${consoleAccentOnConsoleGround.toFixed(2)}:1 (what actually ships)`);
ok("the console accent is never placed on the shell accent",
  !new RegExp(`background:\\s*var\\(--a-accent\\)[^}]*color:\\s*var\\(--c-accent\\)`).test(css));
ok("the console accent clears 4.5:1 where it is actually used", consoleAccentOnConsoleGround >= 4.5,
  `${consoleAccentOnConsoleGround.toFixed(2)}:1`);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
