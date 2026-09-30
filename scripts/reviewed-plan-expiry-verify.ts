// An expired reviewed plan must not be handed out as live. uq_v_reviewed_plans_live keeps ONE unconsumed plan
// per (owner, deployment, claim, plan), expired or not, so mint used to return a plan whose window had closed,
// with an approve_url that opened on "expired", and every later dry run of that claim got the same dead plan.
// Found by the production smoke test on 30 Sep 2026: the dry run of the drone claim returned a plan that had
// expired eight hours earlier. These assertions pin the fix in source order, like the other mint checks.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const src = readFileSync("lib/preflight/reviewed-plan-db.ts", "utf8");
const mint = src.slice(src.indexOf("export async function mintReviewedPlan"), src.indexOf("// ── Read (owner-scoped)"));
const renew = src.slice(src.indexOf("async function renewExpiredPendingPlan"), src.indexOf("// ── Mint (dry run)"));

console.log("── mint only reuses a plan that is still inside its window ──");
ok("the reuse path compares the found plan's expiry with now before returning it",
  /if \(live\) \{\s*if \(new Date\(live\.expires_at\)\.getTime\(\) > input\.nowMs\) return \{ id: live\.id/.test(mint));
ok("an expired match is renewed rather than returned as it is",
  /renewExpiredPendingPlan\(s, live\.id, input\.nowMs, input\.ttlMs\)/.test(mint));
ok("the renewed plan is returned with its NEW expiry",
  /if \(renewed\) return \{ id: live\.id, expiresAt: renewed, reused: true \}/.test(mint));

console.log("── renewal can never touch an approval or a run ──");
ok("renewal only matches a plan nobody approved", /\.eq\("approval_state", "pending"\)/.test(renew));
ok("renewal only matches a plan no run has started", /\.eq\("execution_state", "unconsumed"\)/.test(renew));
ok("renewal only matches a plan that has actually expired (a race with a live one changes nothing)", /\.lte\("expires_at", nowIso\)/.test(renew));
ok("renewal writes only the window, never the plan, the approval or the run binding",
  /\.update\(\{ expires_at: expiresAt, updated_at: nowIso \} as never\)/.test(renew)
  && !/approved_by|approved_at|approval_state:|execution_state:|run_id|plan_hash:/.test(renew.slice(renew.indexOf(".update("), renew.indexOf(".eq(\"id\""))));
ok("the new window is the caller's TTL from now", /const expiresAt = new Date\(nowMs \+ ttlMs\)\.toISOString\(\)/.test(renew));
ok("a failed or non-matching write returns null so the caller keeps what it had",
  /if \(r\.error \|\| !r\.data\) return null;/.test(renew));

console.log("── the read side still hides links that cannot be acted on ──");
const getRoute = readFileSync("app/api/v1/verifications/plans/[id]/route.ts", "utf8");
ok("GET /plans/{id} only shows approve_url while pending, unconsumed and unexpired",
  /v\.approval_state === "pending" && v\.execution_state === "unconsumed" && new Date\(v\.expires_at\)\.getTime\(\) > Date\.now\(\)/.test(getRoute));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
