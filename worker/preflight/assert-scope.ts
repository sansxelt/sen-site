// The one rule that stops a verification from confidently passing a broken app: an assert_text checks the
// expected value INSIDE the element it targets, not anywhere on the page.
//
// The old assert_text did a page-wide substring match, so on an account page that reads "Current plan: Free"
// but also shows a "Get Pro for unlimited notebooks" upsell, asserting the plan is "Pro" PASSED — the word
// "Pro" was present, just not as the plan value. That is a false pass: the assertion could not tell a Free
// account from a Pro one. The fix scopes the check to the target element's own text.
//
// This module holds the pure decision so it can be unit-tested without a browser; the provider supplies the
// scope text (the innerText of the element the target names) and the expected value.

/** True when `expect` appears within `scopeText` (case-insensitive, whitespace-normalized). `scopeText` is the
 *  text of the TARGET element only — never the whole page. */
export function textPresentInScope(scopeText: string, expect: string): boolean {
  const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const want = norm(expect);
  if (!want) return false;
  return norm(scopeText).includes(want);
}
