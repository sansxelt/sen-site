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
ok("they are real buttons with labels, not decorative spans",
  /<button key=\{id\}/.test(code) && /aria-label=\{label\}/.test(code));
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

console.log("\n── it is in the product, not on the marketing site ──");
ok("mounted inside the signed-in shell", /<Scratchpad \/>/.test(shell));
ok("and only there", (shell.match(/<Scratchpad \/>/g) ?? []).length === 1);

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
