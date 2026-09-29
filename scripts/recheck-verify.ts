// Tests for lib/preflight/recheck.ts: the rules that let a coding agent run an approved plan again after a
// fix without another click, and that keep "without another click" from becoming "the agent approves its own
// work". Pure, no DB, fixed clock.
import { decideRecheck, approvedByPerson, sameOrigin, RECHECK_WINDOW_MS, MAX_RECHECKS_PER_APPROVAL, type RecheckInput, type RecheckRoot } from "../lib/preflight/recheck";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => { console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? `  (${d})` : ""}`); if (c) pass++; else fail++; };

const NOW = Date.parse("2026-09-28T12:00:00Z");
const root = (over: Partial<RecheckRoot["plan"]> = {}): RecheckRoot => ({
  rootRunId: "run_root", hops: 1,
  plan: {
    id: "rvp_1", approvalState: "approved", approvedBy: "founder@example.com",
    approvedAt: new Date(NOW - 60 * 60 * 1000).toISOString(), planHash: "h", executionState: "consumed",
    requirementTexts: ["A signed-in user can cancel"],
    ...over,
  },
});
const base = (over: Partial<RecheckInput> = {}): RecheckInput => ({
  parentCompleted: true, parentGuaranteeId: null, root: root(), used: 0,
  approvedUrl: "https://app.example.com", targetUrl: "https://app.example.com/billing", nowMs: NOW,
  ...over,
});
const code = (v: ReturnType<typeof decideRecheck>) => (v.ok ? "ok" : v.code);

console.log("── who approved ──");
ok("an email is a person", approvedByPerson("founder@example.com"));
ok("a key prefix is not", !approvedByPerson("vr_live_abcd"));
ok("nobody is not", !approvedByPerson(null) && !approvedByPerson(""));
ok("a plan a person approved can be re-checked", code(decideRecheck(base())) === "ok");
ok("a plan an API key approved cannot", code(decideRecheck(base({ root: root({ approvedBy: "vr_live_abcd" }) }))) === "plan_requires_human");
ok("a plan still pending cannot", code(decideRecheck(base({ root: root({ approvalState: "pending" }) }))) === "plan_requires_human");
ok("a run that consumed no plan cannot", code(decideRecheck(base({ root: null }))) === "recheck_not_available");

console.log("\n── what and where ──");
ok("a run still going cannot be re-checked yet", code(decideRecheck(base({ parentCompleted: false }))) === "verification_running");
ok("a guarantee run goes through its own route", code(decideRecheck(base({ parentGuaranteeId: "g_1" }))) === "guarantee_verification");
ok("same origin, different path, is allowed", sameOrigin("https://app.example.com", "https://APP.example.com/billing"));
ok("a different host is refused", code(decideRecheck(base({ targetUrl: "https://evil.example.net" }))) === "recheck_origin_changed");
ok("a sibling preview host is refused too", code(decideRecheck(base({ approvedUrl: "https://app-abc.vercel.app", targetUrl: "https://app-def.vercel.app" }))) === "recheck_origin_changed");
ok("http instead of https is a different origin", !sameOrigin("https://app.example.com", "http://app.example.com"));
ok("garbage is never the same origin", !sameOrigin("not a url", "not a url"));

console.log("\n── the bounds ──");
ok("inside the window is fine", code(decideRecheck(base({ root: root({ approvedAt: new Date(NOW - RECHECK_WINDOW_MS + 1000).toISOString() }) }))) === "ok");
ok("at the window's end it closes", code(decideRecheck(base({ root: root({ approvedAt: new Date(NOW - RECHECK_WINDOW_MS).toISOString() }) }))) === "recheck_window_closed");
ok("an approval with no time is refused", code(decideRecheck(base({ root: root({ approvedAt: null }) }))) === "plan_requires_human");
ok(`the ${MAX_RECHECKS_PER_APPROVAL}th re-check is allowed`, code(decideRecheck(base({ used: MAX_RECHECKS_PER_APPROVAL - 1 }))) === "ok");
ok("one more is not", code(decideRecheck(base({ used: MAX_RECHECKS_PER_APPROVAL }))) === "recheck_limit_reached");
{
  const v = decideRecheck(base({ used: 3 }));
  ok("it reports how many are left after this one", v.ok && v.left === MAX_RECHECKS_PER_APPROVAL - 4, JSON.stringify(v));
  ok("and when the window ends", v.ok && Date.parse(v.windowEndsAt) === Date.parse(root().plan.approvedAt as string) + RECHECK_WINDOW_MS);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
