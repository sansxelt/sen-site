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
import { readFileSync } from "node:fs";
import { textPresentInScope, urlPathMatches } from "../worker/preflight/assert-scope";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

/** `a` appears in `hay`, before `b` does. Both halves matter: indexOf returns -1 for something absent, and
 *  -1 is less than every real index, so a plain `indexOf(a) < indexOf(b)` PASSES when `a` was deleted —
 *  an ordering guard that reads as protecting `a` while quietly permitting its removal. */
export function before(hay: string, a: string, b: string): boolean {
  const i = hay.indexOf(a), j = hay.indexOf(b);
  return i >= 0 && j >= 0 && i < j;
}

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

console.log("\n── a rejected sign-in must not be recorded as a successful one ──");
{
  // Sign-in was confirmed by the PRESENCE of a cookie or storage key whose NAME matched
  // /sess|auth|token|sid|__secure|csrf|jwt|login|.../ . Every one of these is on an anonymous visitor's
  // browser before anybody signs in:
  //
  //   next-auth.csrf-token             matches csrf, and also auth
  //   __Host-authjs.csrf-token         matches auth
  //   sb-xyz-auth-token-code-verifier  Supabase's PKCE verifier, written at page load
  //   sidebar_state                    matches sid
  //
  // So when a login the application REJECTED left the browser somewhere without a password field — an
  // error page, a generic "something went wrong" — the run recorded a successful sign-in with a
  // verifiedAuthAt stamp. auth_rejected_by_app is the ONE auth outcome the subsystem calls the customer's
  // defect, and it was being converted into proof that their login works.
  //
  // Narrowing the pattern cannot fix it, because next-auth.csrf-token matches `auth` as well as `csrf`.
  // The question is not whether an auth-shaped key exists, it is whether signing in CHANGED anything.
  const src = readFileSync("worker/preflight/providers/browserbase.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

  // A baseline turns presence into a delta.
  ok("only a session key that APPEARED counts as a session",
    /opts\?\.baselineKeys \? keys\.filter\(\(k\) => !opts\.baselineKeys!\.includes\(k\)\) : keys/.test(src));
  // And the pre-auth artefacts are excluded outright, which also stops sign_out reporting a cleared
  // session as uncleared because the csrf cookie survives it.
  ok("anti-CSRF and PKCE artefacts are never session evidence", /const NOT_SESSION = /.test(src)
    && /csrf/.test(src) && /code\[-_\]\?verifier/.test(src) && /sidebar/.test(src));
  ok("  and the broad pattern no longer claims csrf or login by itself",
    /const SESSION_KEY = \/sess\|auth\|token\|sid\|__secure\|jwt\|supabase\|firebase\|clerk\/i/.test(src));
  // EVERY answering path, not "somewhere in the file". A single occurrence satisfied this while another
  // return dropped the keys, and the caller that diffs them would silently get undefined and fall back to
  // the presence rule this whole change exists to remove.
  ok("every state it returns reports which keys it saw, names only, so a caller can diff them",
    (src.match(/sessionKeys: keys/g) ?? []).length === 3 && !/cookie\.value|c\?\.value/.test(src));

  const exec = readFileSync("worker/preflight/auth-executor.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // `a appears before b` MUST also require that a appears at all. indexOf returns -1 when it does not, and
  // -1 is less than every real index, so deleting the baseline read outright PASSED an ordering check that
  // reads like it is protecting the baseline read. Four assertions written today had this hole.
  ok("the baseline is taken BEFORE the credentials are submitted",
    before(exec, "const baselineKeys = (await page.readAuthState()", "await page.submitLogin()"));
  ok("  and carried into every settle read, not just the first",
    /readAuthState\(\{ expectRoute: expect\.route, expectElement: expect\.element, baselineKeys \}\)/.test(exec));
  // A transient storage error must not refuse a legitimate sign-in outright.
  ok("  degrading to the old rule if the baseline cannot be read", /\.catch\(\(\) => null\)\)\?\.sessionKeys/.test(exec));
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
