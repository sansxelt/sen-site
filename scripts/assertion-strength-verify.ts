// AN ASSERTION THAT CANNOT FAIL IS WORSE THAN NO ASSERTION, BECAUSE IT IS COUNTED AS COVERAGE.
//
// Two of them sat in the spine, and both were found by asking a simple question of every assert action:
// what page state would satisfy this while the feature is broken?
//
//   assert_text      "Unsaved changes" contains "saved". The product telling the user it FAILED to save
//                    satisfied the assertion that it saved. Likewise Unpaid/paid, Inactive/active,
//                    Unverified/verified. The per-run unique token cannot help here: the asserted text is
//                    a status word the application chose, not something the run typed.
//
//   assert_url       url().includes(expect) over the whole url. An empty expect matched every possible
//                    destination; "/" matched every page; and "/dashboard" was satisfied by
//                    /login?next=/dashboard, so being bounced back to sign-in — the exact failure the
//                    assertion exists to catch — passed it.
//
// These are behavioural tests against the real functions, not shape checks. The failure each one prevents
// is written out and asserted, so the suite fails if the defect comes back rather than if the code is
// tidied.
import { textPresentInScope, urlPathMatches } from "../worker/preflight/assert-scope";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

console.log("── the failure state must not satisfy the success assertion ──");
{
  // Each pair is a real product telling a real user something went wrong.
  const NEGATIVE: [string, string][] = [
    ["Unsaved changes", "saved"],
    ["Unpaid", "paid"],
    ["Inactive", "active"],
    ["Unverified", "verified"],
    ["Unpublished draft", "published"],
    ["Disconnected", "connected"],
  ];
  for (const [shown, want] of NEGATIVE) {
    ok(`"${shown}" does not prove "${want}"`, !textPresentInScope(shown, want));
  }
  // Boundaries alone would still read "Not saved" as saved.
  const NEGATED: [string, string][] = [
    ["Not saved", "saved"],
    ["Changes could not be saved", "saved"],
    ["Your note was not successfully saved", "saved"],
    ["Has not yet been saved", "saved"],
    ["Payment failed to process", "process"],
    ["We couldn't publish this", "publish"],
  ];
  for (const [shown, want] of NEGATED) {
    ok(`"${shown}" does not prove "${want}"`, !textPresentInScope(shown, want));
  }
  // A prefix is not the word.
  ok("preauthorized does not prove authorized", !textPresentInScope("preauthorized", "authorized"));
}

console.log("\n── while everything that genuinely passed still passes ──");
{
  // A guard that closes a false pass by breaking every true one is a false FAILURE machine, which costs the
  // same trust from the other side: it tells someone their working software is broken, with evidence.
  const POSITIVE: [string, string][] = [
    ["Changes saved", "saved"],
    ["Saved", "saved"],
    ["All changes saved just now", "saved"],
    ["saved-state", "saved"],                                   // punctuation is a boundary
    ["$12.00 due today", "$12.00"],                             // value starts with punctuation
    ["Go to /dashboard now", "/dashboard"],                     // path-shaped value
    ["Note title Ünïqüe vr-1a2b", "Ünïqüe vr-1a2b"],            // non-ASCII names are words too
    ["Vraelis check vr-3f9a2b71 Edit Delete", "Vraelis check vr-3f9a2b71"], // the run's own token in a row
  ];
  for (const [shown, want] of POSITIVE) {
    ok(`"${shown}" proves "${want}"`, textPresentInScope(shown, want));
  }
  // A negated mention does not erase an honest one in the same element.
  ok("an honest occurrence still counts when a negated one precedes it",
    textPresentInScope("Not saved yet. Saved drafts appear below.", "saved"));
  // Unchanged: an empty expectation is not a check.
  ok("an empty expectation never passes", !textPresentInScope("saved", ""));
  ok("and neither does an empty scope", !textPresentInScope("", "saved"));
}

console.log("\n── the url check must be able to fail ──");
{
  // THE THREE THAT COULD NOT.
  ok("an empty expectation is not satisfied by every destination", !urlPathMatches("https://app.example.com/anything", ""));
  ok("  nor by whitespace", !urlPathMatches("https://app.example.com/anything", "   "));
  ok('asserting "/" no longer passes on every page', !urlPathMatches("https://app.example.com/dashboard", "/"));
  // The cruel one: the redirect AWAY from the destination carries the destination in its query.
  ok("a bounce back to sign-in does not prove you reached the page",
    !urlPathMatches("https://app.example.com/login?next=/dashboard", "/dashboard"));
  ok("  and neither does the host containing it",
    !urlPathMatches("https://dashboard.example.com/login", "/dashboard"));

  ok('"/" still matches the root itself', urlPathMatches("https://app.example.com/", "/"));
  ok("the real destination still matches", urlPathMatches("https://app.example.com/dashboard", "/dashboard"));
  ok("  with a trailing slash", urlPathMatches("https://app.example.com/dashboard/", "/dashboard"));
  ok("  with a query of its own", urlPathMatches("https://app.example.com/dashboard?tab=notes", "/dashboard"));
  ok("  and a child route, which is still that section", urlPathMatches("https://app.example.com/auth/callback", "/auth"));
  // Anchored at a SEGMENT boundary, so a longer word is a different route.
  ok("but a longer route with the same prefix is not", !urlPathMatches("https://app.example.com/authenticate", "/auth"));
  // The contract asks for a leading slash; an author who omits one meant the route.
  ok("a bare path fragment still means the route", urlPathMatches("https://app.example.com/dashboard", "dashboard"));
  // A URL the parser cannot read must not become a free pass.
  ok("an unparseable url does not match by default", !urlPathMatches("not a url at all", "/dashboard"));
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
