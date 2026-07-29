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
//
// ── AND THEN THE SAME MISTAKE, ONE LEVEL DOWN ────────────────────────────────────────────────────────
//
// Scoping fixed WHERE we look. It left HOW we compare as a bare substring test, which is how the failure
// state came to satisfy the success assertion:
//
//   "Unsaved changes"  contains  "saved"
//   "Unpaid"           contains  "paid"
//   "Inactive"         contains  "active"
//   "Unverified"       contains  "verified"
//
// Every one of those is a product telling the user something went wrong, read by Vraelis as proof it went
// right. It lands on the most common assertion in the product, on exactly the guarantee shape this company
// demonstrates ("the change is saved"), and the per-run unique token cannot help: the asserted text is a
// status word the application chose, not something the run typed.
//
// The comparison is anchored on word boundaries now, which keeps the substring behaviour that matters (the
// expected value sitting inside a longer row, e.g. a note title among its buttons) while refusing a match
// that is only part of a larger word.
//
// Boundaries alone still read "Not saved" as saved, so a match immediately preceded by a negation is
// refused too. That is deliberately a small, closed list of English negations rather than anything clever:
// a guess about meaning does not belong in the one function that decides whether a verdict is true.

/** True when the browser is on `expect`, which the plan contract defines as a path on this application.
 *
 *  Lives here, beside the text rule, because it is the same kind of decision and needs the same kind of
 *  test: it was `url().includes(expect)` over the whole url, and three things could not fail.
 *
 *    expect ""           "".includes("") is true, so the step certified every possible destination
 *    expect "/"          every url contains a slash, so the root check passed on any page
 *    expect "/dashboard" satisfied by https://app/login?next=/dashboard
 *
 *  The last is the cruel one: being bounced back to sign-in is precisely the failure the assertion exists
 *  to catch, and the bounce carries the wanted path in its query string.
 *
 *  Anchored at a segment boundary, so /auth matches /auth and /auth/callback but never /authenticate. */
export function urlPathMatches(currentUrl: string, expect: string): boolean {
  const want = (expect || "").trim();
  if (!want) return false;   // an empty expectation is not a check, whatever the caller intended
  const seg = (p: string) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);
  // A bare "dashboard" keeps meaning /dashboard: the contract asks for a leading slash, and an authored
  // step that omits one meant the route, not a failure.
  const wantPath = seg(want.startsWith("/") ? want : `/${want}`);
  let path: string;
  try { path = seg(new URL(currentUrl).pathname); } catch { path = seg(currentUrl || ""); }
  return path === wantPath || (wantPath !== "/" && path.startsWith(`${wantPath}/`));
}

/** When the expected value is not in the target element's own text, assert_text widens to the target's
 *  IMMEDIATE parent — because a target often names a LABEL sitting beside the value ("Plan" next to
 *  "Current plan: Pro").
 *
 *  Unbounded, that widening restores the exact page-wide match this module exists to prevent. getByText
 *  resolves to the DEEPEST node containing the text, so when the target names a REGION — which is what the
 *  plan contract asks authors for — its parent is the section, or <main>, or the body, and the check runs
 *  over the whole page again. The Free-vs-Pro false pass, arrived at from the other side.
 *
 *  A genuine label/value container is small and close in size to the label itself. Anything materially
 *  bigger is a different scope, not a container. */
export function parentScopeAcceptable(ownText: string, parentText: string): boolean {
  const own = (ownText || "").trim().length;
  const parent = (parentText || "").trim().length;
  // The floor lets a short label ("Plan") reach a normal-sized value container; the ratio keeps a long
  // target from licensing an enormous one.
  return parent <= Math.max(240, own * 3);
}

// Regex-special characters in the expected value are literal text, not syntax.
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A match immediately preceded by one of these is the opposite of what was asserted. Kept short and
// explicit: everything here inverts the following word outright, so there is no judgement call.
// The auxiliaries that can sit between the negation and the word without softening it: "could not BE
// saved", "was not SUCCESSFULLY saved", "has not YET BEEN saved". Erring toward refusing is the right
// direction here — a wrongly refused assertion is a false failure, which is visible and annoying, while a
// wrongly accepted one is a false Verified, which is invisible and is the thing this product sells against.
const NEGATED_BY = /(^|[^\p{L}\p{N}])(not|no|never|cannot|unable|failed|couldn't|can't|didn't|doesn't|isn't|wasn't|won't|n't)\s+((to|be|been|being|get|got|yet|able|successfully|properly|fully|correctly)\s+)*$/u;

/** True when `expect` appears within `scopeText` as a whole word or phrase (case-insensitive,
 *  whitespace-normalized), and is not immediately negated. `scopeText` is the text of the TARGET element
 *  only — never the whole page. */
export function textPresentInScope(scopeText: string, expect: string): boolean {
  const norm = (s: string) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  const want = norm(expect);
  if (!want) return false;
  const hay = norm(scopeText);

  // Word-boundary anchored on both ends. \b is wrong here: the expected value often begins or ends with
  // punctuation ("/dashboard", "$12.00"), where \b either fails or matches in the wrong place. Explicit
  // "start-of-string or a non-alphanumeric" is what "whole word" actually means for arbitrary text, and
  // \p{L}/\p{N} keep it true for names that are not ASCII.
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(want)}($|[^\\p{L}\\p{N}])`, "gu");
  for (let m = re.exec(hay); m; m = re.exec(hay)) {
    // Text before this occurrence, up to and including the boundary character. `?? ""` because a throw
    // here would take down the whole flow rather than failing one assertion, and a verification harness
    // that crashes reports nothing at all about the application it was asked to check.
    const lead = (m[1] ?? "").length;
    const before = hay.slice(0, m.index + lead);
    if (!NEGATED_BY.test(before)) return true;
    // A negated occurrence does not disprove the value appearing honestly elsewhere in the same element,
    // so keep looking rather than returning false on the first one.
    re.lastIndex = m.index + lead + want.length;
  }
  return false;
}
