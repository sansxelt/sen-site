// THE FALSE FAILURE: a verification that reported a working application as broken.
//
// worker/preflight/providers/browserbase.ts resolve() built exactly one locator, getByRole("button"), while
// returning a three-entry `candidates` array that worker/preflight/types.ts describes as "accessible-name
// candidates the resolver considered". Nothing considered them. The function's own comment claimed a
// fallback chain — "Prefer an accessible role match, then visible text, then a form label" — that the code
// did not implement.
//
// A plain <a href> has the accessible role LINK, so every anchor styled as a button was unreachable and its
// step timed out. The customer is shown "the flow stopped at step 2", which reads as a defect in their
// application.
//
// MEASURED against the live demo deployment (my-safe-note.lovable.app), whose landing page uses anchors:
//
//   target                 role=button   role=link   old result            new result
//   "Create free account"      0             1       click timed out       clicked -> /auth?mode=signup
//   "Sign in"                  0             1       click timed out       clicked -> /auth
//   "See pricing"              0             1       click timed out       clicked -> /#pricing
//
// Those three timeouts ARE the three critical failures standing in the YC demo account. The application was
// never broken. A false FAILED is the mirror of a false Verified and costs the same trust.
//
// These are source assertions: the resolver needs a live browser and a real page, which this suite has
// neither of. The property that matters is structural — more than one strategy is actually attempted, the
// text fallback cannot match prose, and a genuinely missing control still fails.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const SRC = "worker/preflight/providers/browserbase.ts";
const src = readFileSync(SRC, "utf8");
const fn = src.slice(src.indexOf("async function resolve("), src.indexOf("export class PlaywrightPreflightPage"));
const code = fn.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

console.log("── the resolver actually tries what it reports ──");
ok("it builds an ordered list of attempts", /const attempts\s*:/.test(code));
ok("it iterates them rather than returning the first blindly", /for \(const a of attempts\)/.test(code));
// The specific regression: candidates were advertised and never built.
ok("the reported candidates ARE the attempts, not a separate list",
  /const candidates = attempts\.map\(/.test(code));
ok("the accessible BUTTON role is still tried first", /attempts.*\n?.*role=button/.test(code) || /role=button\[name=\$\{target\}\]/.test(code));
ok("the LINK role is tried, which is the whole defect", /getByRole\("link", \{ name: target \}\)/.test(code));
ok("a form label is still tried", /getByLabel\(target\)/.test(code));

console.log("\n── it cannot be satisfied by prose ──");
// A bare getByText fallback would match a paragraph. Clicking non-interactive copy SUCCEEDS in Playwright,
// so a real failure would become a false PASS: strictly worse than the defect being fixed.
ok("the text fallback is restricted to interactive elements", /INTERACTIVE/.test(code));
ok("no bare getByText fallback", !/getByText\(target/.test(code));
{
  const list = (src.match(/const INTERACTIVE = "([^"]+)"/) ?? [])[1] ?? "";
  ok("the interactive set covers anchors and buttons", /\ba\b/.test(list) && /\bbutton\b/.test(list));
  ok("it covers role-annotated controls", /\[role=button\]/.test(list) && /\[role=link\]/.test(list));
  ok("it covers submit inputs", /input\[type=submit\]/.test(list));
  // A div is not a control. Allowing one back would reintroduce the false-pass risk above.
  ok("it does not include generic containers", !/\bdiv\b/.test(list) && !/\bspan\b/.test(list) && !/\bp\b,/.test(list));
}

console.log("\n── a match must be real ──");
ok("a zero-match candidate is skipped", /if \(n === 0\) continue/.test(code));
ok("an invisible match is skipped", /isVisible\(\)/.test(code) && /continue/.test(code));
// Absent must stay absent: inventing a match would turn a missing control into a passing step.
ok("nothing matching falls back to the button locator, so the step still fails",
  /return \{ locator: attempts\[0\]\.locator/.test(code));
ok("the selection is reported truthfully", /selected: a\.name/.test(code));

console.log("\n── both callers await it ──");
// resolve became async. A missed await would return a Promise and every click would throw.
ok("click awaits the resolver", /case "click":[^\n]*await resolve\(/.test(src));
ok("fill awaits the resolver", /case "fill":[^\n]*await resolve\(/.test(src));
ok("no un-awaited resolve call remains", !/[^t] resolve\(this\.page/.test(src.replace(/await resolve\(this\.page/g, "AWAITED")));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
