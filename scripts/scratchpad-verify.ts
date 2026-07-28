// A SCRATCHPAD THE COMPANY CAN READ IS NOT A SCRATCHPAD.
//
// People will paste API keys into this panel. That is not a misuse of it, it is the stated reason it
// exists: a key is shown once at creation and then never again, so it has to be kept somewhere while you
// finish setting things up. Which makes exactly two properties non-negotiable, and neither is visible by
// looking at the panel:
//
//   IT NEVER LEAVES THE DEVICE. No fetch, no analytics event, no server component reading it, no cookie.
//   A note that reaches a server is a credential in a log, and it would arrive there silently.
//
//   THE TERMS ARE STATED WHERE IT IS USED. localStorage is unencrypted and readable by any script on the
//   origin. Someone pasting a live key is entitled to know that before they do, in the panel, not in a
//   document nobody opens.
//
// The rest is about not losing the text: it is the only copy, so reset asks first, and it is bounded so
// one runaway paste cannot evict everything else the product stores.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const src = readFileSync("app/rank/_components/scratchpad.tsx", "utf8");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const shell = readFileSync("app/rank/_components/rank-ui.tsx", "utf8");

console.log("── the text never leaves the device ──");
ok("it stores to localStorage and nowhere else", /localStorage\.setItem/.test(code));
// The list is the point: any ONE of these would move a key off the machine.
for (const [what, re] of [
  ["fetch", /\bfetch\s*\(/],
  ["XMLHttpRequest", /XMLHttpRequest/],
  ["sendBeacon", /sendBeacon/],
  ["a websocket", /new WebSocket/],
  ["a cookie", /document\.cookie/],
  ["an analytics call", /\btrack\s*\(|analytics\./],
] as [string, RegExp][]) {
  ok(`it never uses ${what}`, !re.test(code));
}
// A server component could read a prop and log it. This has to stay a client island.
ok('it is a client component, so nothing server-side can ever see the text', /^"use client";/.test(src));
ok("and the shell passes it no props at all", /<Scratchpad \/>/.test(shell));

console.log("\n── the terms are stated where someone will paste a key ──");
ok("the panel says the text stays in this browser", /this browser/i.test(src));
ok("and that it is not sent to Vraelis", /[Nn]ever sent to Vraelis/.test(src));
ok("and that it is not encrypted, which is the part people assume otherwise", /not encrypted/i.test(src));

console.log("\n── it is the only copy, so it is hard to lose ──");
// Reset is the one destructive control and there is no undo, because nothing was ever stored elsewhere.
ok("reset asks before it clears", /confirmReset/.test(code) && /if \(!confirmReset\)/.test(code));
ok("and typing disarms it, so a forgotten click cannot fire later", /setConfirmReset\(false\)/.test(code));
// localStorage is a small shared quota. Unbounded text is how one paste evicts everything else.
ok("the text is bounded", /const MAX = \d+/.test(code) && /slice\(0, MAX\)/.test(code));
// Reading storage during render is the classic hydration mismatch: server renders empty, client renders
// full, React discards the difference without saying anything.
ok("storage is read after mount, never during render",
  /useEffect\(\(\) => \{[\s\S]{0,200}localStorage\.getItem/.test(code)
  && !/useState\([^)]*localStorage/.test(code));

console.log("\n── the only thing that removes it is Reset ──");
// THE PROMISE THE PANEL MAKES OUT LOUD, so it had better be true of the code. Nothing may clear this key
// except the reset control: not signing out, not navigating, not closing the tab. The dangerous version of
// this feature is one that silently forgets a key somebody was relying on having.
ok("only the reset path clears the text",
  (code.match(/setText\(""\)/g) ?? []).length === 1
  && /const reset = \(\) => \{[\s\S]{0,220}setText\(""\)/.test(code));
ok("nothing removes the stored key outright", !/removeItem/.test(code));
// Signing out clears a session cookie. If anything cleared storage alongside it, the note would vanish at
// the one moment a person is most likely to be mid-task and least likely to notice.
const shellSrc = readFileSync("app/rank/_components/rank-ui.tsx", "utf8");
ok("signing out does not clear browser storage", !/localStorage\.clear|sessionStorage\.clear/.test(shellSrc));
ok("and the panel states how long the text lasts, not only where it lives",
  /signing out/.test(src) && /only thing that/.test(src.replace(/\s+/g, " ")));

console.log("\n── the title bar controls are real ──");
// Three things that render as buttons must do three things. Something shaped like a control that does
// nothing is a small lie that costs one click to discover.
ok("close, collapse and zoom are all wired",
  /setOpen\(false\)/.test(code) && /"min"/.test(code) && /"zoom"/.test(code));
// Anchored on being a button with a label, not on how the JSX happens to be formatted. The previous
// version matched `<button key={id}` on one line, so wrapping the attributes across lines for readability
// broke it while the markup was unchanged. A check that fails when code is tidied gets tidied away.
// ...and it pinned `onClick={act}` anyway, which is the same mistake one line lower: a fact about how the
// handler is spelled, not about whether the control does anything. Wrapping the call to stop a click on a
// light also reaching the bar behind it broke this while every button kept working. What matters is that
// the light invokes its own action, in whatever form.
ok("they are real buttons with labels, not decorative spans",
  /<button\b/.test(code) && /aria-label=\{label\}/.test(code) && /onClick=\{[\s\S]{0,90}?\bact\b/.test(code));
// Verdict colours mean something in this product. Spending --go-ink, the green that means Verified, on a
// zoom control blurs the one vocabulary it cannot afford to blur.
ok("the window controls do not borrow the verdict palette",
  !/--go-(ink|line)[\s\S]{0,120}Zoom|Zoom[\s\S]{0,120}--go-(ink|line)/.test(code));
// A window state that resets on navigation is the panel forgetting a decision you just made.
//
// Checked as a round trip, both directions. Asserting the constant's NAME appeared was not enough: a
// mutation renaming the declaration left every use of it intact, so the regex matched a file that no
// longer compiled. What matters is that the view is written on change and read back on mount.
ok("the window state is written when it changes", /setItem\(VIEW_KEY/.test(code));
ok("and read back on mount, so it survives navigation", /getItem\(VIEW_KEY\)/.test(code));
// None of the three may touch the note.
ok("no title-bar control clears the text",
  !/setView[\s\S]{0,90}setText\(""\)/.test(code) && !/setOpen[\s\S]{0,90}setText\(""\)/.test(code));

console.log("\n── the controls are actually visible ──");
{
  // MEASURED, NOT EYEBALLED. These first used --stop-line, --wait-line and --go-line, which are 30% alpha
  // BORDER tints rather than fills. Over the title bar that came out at 1.68:1, 2.00:1 and 2.01:1, all
  // three below the 3:1 WCAG floor for a non-text control. They read as "dark", which is how a contrast
  // failure usually announces itself: as a vague sense that something looks off rather than as a bug.
  const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c: number[]) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const contrast = (a: number[], b: number[]) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const panel = rgb("#111214");
  const found = Array.from(code.matchAll(/base: "(#[0-9A-Fa-f]{6})"/g)).map((m) => m[1]);
  ok("the three control colours are declared as opaque fills", found.length === 3, found.join(", "));
  for (const c of found) {
    const r = contrast(rgb(c), panel);
    ok(`${c} clears the 3:1 floor for a non-text control`, r >= 3, `${r.toFixed(2)}:1`);
  }
  // A translucent fill is exactly how the washed-out version happened in the first place.
  ok("none of them is a translucent tint", !/base: "rgba/.test(code));
}

console.log("\n── a collapsed panel does not look like a broken one ──");
{
  // An 11px dot is a fine control for somebody who already knows it is there. Collapsed to a bare strip it
  // is the ONLY way back, and anyone who does not think to aim at the amber dot a second time reads the
  // panel as stuck. The whole bar restores it.
  ok("the title bar restores the panel when collapsed", /onClick=\{view === "min" \? \(\) => setView\("normal"\)/.test(code));
  // Keyboard too, or the bar is a control only a mouse can reach.
  ok("  by keyboard as well as by pointer", /onKeyDown=\{view === "min"/.test(code) && /e\.key === "Enter" \|\| e\.key === " "/.test(code));
  ok("  and announces itself as a control while collapsed", /role=\{view === "min" \? "button"/.test(code) && /tabIndex=\{view === "min" \? 0/.test(code));
  ok("  showing a pointer so it reads as clickable", /cursor: view === "min" \? "pointer"/.test(code));

  // ONLY WHEN COLLAPSED. Making the expanded bar collapse on click trades a discovery problem for an
  // accidental one, and this is the safe direction: it never closes and it never touches the text.
  ok("the expanded bar stays inert, so nothing collapses by accident", /: undefined\}/.test(code) && !/onClick=\{\(\) => setView\("min"\)\}/.test(code));

  // The bar behind the lights restores. Without stopPropagation, closing a collapsed panel would also
  // expand it, and it would come back full size the next time it was opened.
  ok("a click on one of the three lights stops at that light", /onClick=\{\(e\) => \{ e\.stopPropagation\(\); act\(\); \}\}/.test(code));
}

console.log("\n── it is in the product, not on the marketing site ──");
ok("mounted inside the signed-in shell", /<Scratchpad \/>/.test(shell));
ok("and only there", (shell.match(/<Scratchpad \/>/g) ?? []).length === 1);

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
