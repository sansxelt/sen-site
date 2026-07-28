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

console.log("\n── it is in the product, not on the marketing site ──");
ok("mounted inside the signed-in shell", /<Scratchpad \/>/.test(shell));
ok("and only there", (shell.match(/<Scratchpad \/>/g) ?? []).length === 1);

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
