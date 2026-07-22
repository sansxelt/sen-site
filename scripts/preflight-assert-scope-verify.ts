// The false-pass fix: an assert_text must check the expected value INSIDE the element it targets, not
// anywhere on the page. This is the pure-logic proof (no browser); the real-DOM proof is the Playwright spec
// tests/e2e/04-assert-text-scope.spec.ts. The two account states below are exactly what the broken-checkout
// fixture renders: Free (plan is Free, and a "Get Pro" upsell is present) and Pro (plan is Pro).
import { textPresentInScope } from "../worker/preflight/assert-scope";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

// The target element's own text (what getByText("Current plan").innerText returns) in each state.
const PLAN_SCOPE_FREE = "Current plan: Free";
const PLAN_SCOPE_PRO = "Current plan: Pro";
// The WHOLE account page text in each state — note both contain the word "Pro" (Free via the upsell).
const PAGE_FREE = "Your account Plan Current plan: Free Three notebooks, synced across two devices. See plans Notebooks You are using 3 of 3 notebooks. Get Pro for unlimited notebooks.";
const PAGE_PRO = "Your account Plan Current plan: Pro Unlimited notebooks, offline sync, version history, and export. Notebooks Unlimited notebooks. You are using 3.";

console.log("── scoped assert_text discriminates Free from Pro ──");
ok('scoped: "Current plan: Free" does NOT satisfy expect "Pro"', !textPresentInScope(PLAN_SCOPE_FREE, "Pro"));
ok('scoped: "Current plan: Pro" DOES satisfy expect "Pro"', textPresentInScope(PLAN_SCOPE_PRO, "Pro"));

console.log("\n── the OLD page-wide behavior FALSE-PASSES (this is the bug we fixed) ──");
// Page-wide substring match: "Pro" is present in BOTH pages, so it cannot tell them apart.
const pageWide = (page: string, want: string) => page.toLowerCase().includes(want.toLowerCase());
ok("page-wide would pass on the FREE page (false pass — the plan is Free)", pageWide(PAGE_FREE, "Pro"));
ok("page-wide would pass on the PRO page too (so it never discriminates)", pageWide(PAGE_PRO, "Pro"));
ok("=> page-wide gives the SAME answer for Free and Pro (non-discriminating)", pageWide(PAGE_FREE, "Pro") === pageWide(PAGE_PRO, "Pro"));
ok("=> scoped gives DIFFERENT answers for Free and Pro (discriminating)",
  textPresentInScope(PLAN_SCOPE_FREE, "Pro") !== textPresentInScope(PLAN_SCOPE_PRO, "Pro"));

console.log("\n── normalization ──");
ok("case-insensitive", textPresentInScope("Current plan: PRO", "pro"));
ok("whitespace-normalized", textPresentInScope("Current   plan:\n Pro", "Pro"));
ok("empty expected text never passes", !textPresentInScope("anything", ""));
ok("the value must be present, not merely the label", !textPresentInScope("Current plan:", "Pro"));

console.log("\n── the worker scopes assert_text to the target element ──");
import("node:fs").then((fs) => {
  const src = fs.readFileSync("worker/preflight/providers/browserbase.ts", "utf8");
  const block = src.slice(src.indexOf('case "assert_text"'), src.indexOf('case "assert_url"'));
  ok("assert_text uses the target to locate the element", /getByText\(target\)/.test(block));
  ok("assert_text checks the value within the target scope, not page-wide", /textPresentInScope\(ownText, want\)/.test(block));
  ok("assert_text falls back to the target's immediate container (label/heading beside the value)", /xpath=\.\./.test(block) && /textPresentInScope\(parentText, want\)/.test(block));
  ok("a page-wide fallback exists ONLY when no target is named", /if \(!target\)/.test(block) && /text_present_pagewide/.test(block));

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
  process.exitCode = fail === 0 ? 0 : 1;
});
