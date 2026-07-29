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
import { textPresentInScope, urlPathMatches, parentScopeAcceptable } from "../worker/preflight/assert-scope";
import { PlaywrightPreflightPage } from "../worker/preflight/providers/browserbase";
import { preferredProductionHost } from "../lib/preflight/oauth/vercel-deploy";
import { before } from "./_source-order";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};


(async () => {
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

console.log("\n── a crashed deployment must not navigate successfully ──");
{
  // page.goto RESOLVES for a 500 — it only rejects on a network-level failure — and the response was
  // discarded, so navigate returned ok against a wholly crashed deployment. The 5xx was not even unknown:
  // the page listener records it into `evidence`, which decideRun never reads. The run persisted the 500
  // and the word "ready" in the same transaction.
  const pageStub = (status: number | null, url = "https://app.example.com/dashboard") => ({
    url: () => url,
    goto: async () => (status === null ? null : { status: () => status }),
    reload: async () => (status === null ? null : { status: () => status }),
    on: () => {},
    context: () => ({ cookies: async () => [], clearCookies: async () => {} }),
  });
  const perform = async (status: number | null, action: "navigate" | "refresh" = "navigate") => {
    const p = new PlaywrightPreflightPage(pageStub(status) as never);
    return p.perform({ action, target: "/dashboard" } as never);
  };

  for (const code of [500, 502, 503, 404, 400]) {
    const o = await perform(code);
    ok(`a ${code} is not a successful navigation`, o.ok === false, o.detail);
    ok(`  and the status is on the record`, o.detail.includes(String(code)), o.detail);
  }
  for (const code of [200, 201, 304]) {
    const o = await perform(code);
    ok(`a ${code} still navigates`, o.ok === true, o.detail);
  }
  // goto returns null for a same-document navigation. That is not a failure.
  const same = await perform(null);
  ok("a same-document navigation with no response is still fine", same.ok === true, same.detail);
  // The same hole existed on refresh.
  const refreshed = await perform(503, "refresh");
  ok("refresh does not swallow a 503 either", refreshed.ok === false, refreshed.detail);
}

console.log("\n── the assert STEPS themselves must be able to fail ──");
{
  // A MUTATION CAMPAIGN FOUND THIS. Replacing the return of assert_visible and assert_text with a constant
  // `true` survived all 93 suites: nothing in four and a half thousand assertions noticed that both
  // assertions had stopped being able to fail.
  //
  // The reason is the wrong-layer trap, in this very file. The tests above exercise textPresentInScope, the
  // pure decision — which is correct and worth testing — while the STEP that calls it was covered by
  // nothing. A pure function cannot vouch for its caller.
  //
  // So these drive perform() itself, through a page stub that behaves like the DOM does: a locator matches
  // hidden elements, innerText returns text from a display:none subtree, and getByText resolves to the
  // deepest node.
  type El = { text: string; visible: boolean; parentText?: string };
  const pageWith = (els: El[]) => {
    const find = (t: string) => els.filter((e) => e.text.toLowerCase().includes(t.toLowerCase()));
    const loc = (matches: El[]) => {
      const self: Record<string, unknown> = {
        first: () => self,
        filter: (o: { visible?: boolean }) => loc(o?.visible ? matches.filter((m) => m.visible) : matches),
        count: async () => matches.length,
        isVisible: async () => matches.length > 0 && matches[0].visible,
        innerText: async () => matches[0]?.text ?? "",
        // xpath=.. is the parent widening
        locator: () => loc(matches[0]?.parentText ? [{ text: matches[0].parentText, visible: matches[0].visible }] : []),
      };
      return self;
    };
    const none = loc([]);
    return {
      url: () => "https://app.example.com/x",
      on: () => {},
      context: () => ({ cookies: async () => [], clearCookies: async () => {} }),
      getByText: (t: string) => loc(find(t)),
      getByLabel: () => none, getByPlaceholder: () => none, getByRole: () => none,
      locator: () => none,
    };
  };
  const perform = async (els: El[], step: Record<string, unknown>) =>
    new PlaywrightPreflightPage(pageWith(els) as never).perform(step as never);

  // assert_visible
  const seen = await perform([{ text: "Saved", visible: true }], { action: "assert_visible", target: "Saved" });
  ok("assert_visible passes when the text really is on screen", seen.ok === true, seen.detail);
  const missing = await perform([], { action: "assert_visible", target: "Saved" });
  ok("assert_visible FAILS when nothing matches", missing.ok === false, missing.detail);
  const hidden = await perform([{ text: "Saved", visible: false }], { action: "assert_visible", target: "Saved" });
  ok("  and when the element exists but is not visible", hidden.ok === false, hidden.detail);
  const noTarget = await perform([{ text: "Saved", visible: true }], { action: "assert_visible" });
  ok("  and with no target at all, rather than passing vacuously", noTarget.ok === false, noTarget.detail);

  // assert_text
  const present = await perform([{ text: "Changes saved", visible: true }], { action: "assert_text", target: "Changes", expect: "saved" });
  ok("assert_text passes when the value is inside the target", present.ok === true, present.detail);
  const absent = await perform([{ text: "Changes pending", visible: true }], { action: "assert_text", target: "Changes", expect: "saved" });
  ok("assert_text FAILS when the value is not there", absent.ok === false, absent.detail);
  // The whole point of the scope rule, exercised through the step.
  const negated = await perform([{ text: "Unsaved changes", visible: true }], { action: "assert_text", target: "Unsaved", expect: "saved" });
  ok("  and when the target says the OPPOSITE", negated.ok === false, negated.detail);
  // display:none content still yields innerText, which is how a broken drawer satisfied this.
  const invisible = await perform([{ text: "Changes saved", visible: false }], { action: "assert_text", target: "Changes", expect: "saved" });
  ok("  and when the text exists only in a hidden subtree", invisible.ok === false, invisible.detail);
  const noTargetFound = await perform([], { action: "assert_text", target: "Changes", expect: "saved" });
  ok("  and when the target element does not exist", noTargetFound.ok === false, noTargetFound.detail);
  // The VERDICT is the same either way here, so only the wording distinguishes "we could not find the
  // place to look" from "we looked and the value was not there". That difference is the whole of what a
  // customer acts on: one is a plan pointing at the wrong element, the other is their product. A mutation
  // deleting the distinction changed no pass or fail, which is exactly how it would have been lost.
  ok("    saying the TARGET was missing, not that the value was absent",
    noTargetFound.detail.includes("target_not_found"), noTargetFound.detail);
  const noExpect = await perform([{ text: "Changes saved", visible: true }], { action: "assert_text", target: "Changes" });
  ok("  and with no expected text, rather than passing vacuously", noExpect.ok === false, noExpect.detail);
  // The bounded parent fallback, through the step: a small label reaches its value...
  const viaParent = await perform([{ text: "Plan", visible: true, parentText: "Plan Current plan: Pro" }], { action: "assert_text", target: "Plan", expect: "Pro" });
  ok("the label/value fallback still reaches a real container", viaParent.ok === true, viaParent.detail);
  // ...but a whole section does not license a page-wide match.
  const wholeSection = "Notes Dashboard Settings Billing Current plan: Free Get Pro for unlimited notebooks Upgrade Sign out Help Terms Privacy and a great deal more besides".padEnd(900, " x");
  const viaSection = await perform([{ text: "Notes", visible: true, parentText: wholeSection }], { action: "assert_text", target: "Notes", expect: "Pro" });
  ok("  but a whole section does not", viaSection.ok === false, viaSection.detail);
}

console.log("\n── widening to the parent must not restore the page-wide match ──");
{
  // getByText resolves to the DEEPEST node containing the text, so when a target names a REGION — which is
  // exactly what the plan contract asks authors for — its parent is the section, or <main>, or the body.
  // Widening there is the Free-vs-Pro false pass again, reached from the other side.
  const label = "Plan";
  ok("a small label reaches its value container", parentScopeAcceptable(label, "Plan Current plan: Pro"));
  ok("  even when the label is very short and the container is a normal size",
    parentScopeAcceptable("Plan", "Plan".padEnd(200, " x")));
  // A whole section is not a container.
  const wholePage = "Notes Dashboard Settings Billing Current plan: Free Get Pro for unlimited notebooks Upgrade Sign out Help Terms Privacy".padEnd(900, " more page text");
  ok("a whole section is refused", !parentScopeAcceptable("Notes", wholePage));
  // And a long target does not license an unbounded parent.
  ok("a long target still cannot license a page-sized parent",
    !parentScopeAcceptable("a".repeat(100), "b".repeat(2000)));
  ok("  but its own proportionate container is fine", parentScopeAcceptable("a".repeat(100), "b".repeat(280)));
}

console.log("\n── the verified host must be the one customers reach ──");
{
  // The old code asked /v6/deployments?target=production&state=READY&limit=1 and took deployments[0].url.
  // That list is ordered by CREATION, not by what the domain serves, and `url` is the deployment's own
  // immutable project-hash.vercel.app host that no customer ever visits. After a rollback or a staged
  // promotion the newest READY build is serving nobody while production serves the broken one.
  ok("a custom domain wins, because that is what a customer types",
    preferredProductionHost(["app.example.com", "myproj.vercel.app"]) === "app.example.com");
  // A branch alias is not production.
  ok("a branch alias is never production",
    preferredProductionHost(["myproj-git-main-team.vercel.app", "myproj.vercel.app"]) === "myproj.vercel.app");
  ok("  even when it is the only vercel.app host left",
    preferredProductionHost(["myproj-git-main-team.vercel.app"]) === null);
  // The canonical name over a longer generated variant.
  ok("the canonical project host beats a longer generated one",
    preferredProductionHost(["myproj-abc123xyz.vercel.app", "myproj.vercel.app"]) === "myproj.vercel.app");
  ok("hosts are normalised, not trusted as given",
    preferredProductionHost(["HTTPS://App.Example.com/some/path"]) === "app.example.com");
  ok("object-shaped aliases are read too", preferredProductionHost([{ domain: "app.example.com" }]) === "app.example.com");
  // NO ALIAS MEANS FALL BACK TO THE STORED URL, never to a host nobody uses.
  ok("no alias resolves to nothing rather than to a deployment host", preferredProductionHost([]) === null);
  ok("  and neither does a missing field", preferredProductionHost(undefined) === null);
  ok("  nor a malformed one", preferredProductionHost("app.example.com") === null);
  // Comments stripped first. The banned endpoint is NAMED in the comment explaining why it is banned, so
  // asserting over the raw file failed on the very note that documents the fix.
  const src = readFileSync("lib/preflight/oauth/vercel-deploy.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok("the resolver asks for the project's alias, not the newest deployment",
    /v9\/projects\//.test(src) && !/v6\/deployments/.test(src));
  ok("  and returns the alias host rather than a deployment url",
    /preferredProductionHost\(j\.targets\?\.production\?\.alias\)/.test(src));
}

console.log(fail === 0 ? `\nALL PASS  ${pass} passed, 0 failed` : `\nFAILURES  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
})();
