// The verification composer: the reviewed-plan two-step, enforced from source.
//
// The composer is the front end for a contract that already exists on the server: mint an immutable plan,
// let a human REVIEW it, EXPLICITLY approve it, then run EXACTLY that plan. The whole point of the contract
// is that possessing a plan id is not permission to spend, and that what the UI shows is the PERSISTED state,
// not a hopeful local guess. Those are easy properties to erase by accident (one optimistic setState, one
// button that both approves and runs), so they are asserted here rather than trusted.
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `  — ${d}` : ""}`); }
};

const src = readFileSync("app/rank/app/_components/composer.tsx", "utf8");
const client = readFileSync("lib/verification-client.ts", "utf8");
// Body slices, so a call in the wrong function cannot satisfy a guard meant for another.
const body = (name: string) => {
  const i = src.indexOf(`async function ${name}(`);
  if (i < 0) return "";
  const j = src.indexOf("\n  }", i);
  return src.slice(i, j < 0 ? undefined : j);
};
const review = body("review"), approve = body("approve"), execute = body("execute");

console.log("── nothing runs until the composed request is real ──");
ok("URL validity is the normalized URL being non-empty", /urlOk = normalizeDeploymentUrl\(deployment\)\.length > 0/.test(src));
ok("the outcome must have real substance, not one stray character", /claimOk = normalizeClaim\(claim\)\.length >= \d\d/.test(src));
ok("review is gated on both fields valid and nothing in flight", /canReview = urlOk && claimOk && !busy/.test(src));
ok("the review button is disabled when the request is not reviewable", /disabled=\{!canReview\}/.test(src));
ok("Enter submits only when the request is reviewable", /e\.key === "Enter" && canReview/.test(src));
ok("review() itself refuses an unreviewable request", /if \(!canReview\) return;/.test(review));

console.log("\n── the plan is minted through the CURRENT dry-run endpoint, then grounded in the persisted record ──");
ok("review() mints the plan via the reviewed-plan client, not a bespoke fetch", /createReviewedPlan\(/.test(review));
ok("review() reads the persisted plan before showing it (no local plan object)", /getReviewedPlan\(/.test(review));
ok("an outcome that cannot be proven is shown as such, not as a plan", /not_provable/.test(review) && /wouldLaunch/.test(review));
ok("the composer never fetches an endpoint directly (only the client boundary does)", !/fetch\(/.test(src) && !/\/v1\//.test(src));

console.log("\n── approve and run are two distinct events; holding the id is not approval ──");
ok("approve() calls the approve endpoint and does NOT start a run", /approveReviewedPlan\(/.test(approve) && !/executeReviewedPlan\(/.test(approve));
ok("approve() re-reads the persisted approval state rather than flipping a local flag", /getReviewedPlan\(/.test(approve));
ok("execute() is the only path that runs a verification", /executeReviewedPlan\(/.test(execute) && !/executeReviewedPlan\(/.test(approve) && !/executeReviewedPlan\(/.test(review));
ok("execute() refuses unless the PERSISTED plan is approved (id alone is not enough)", /phase\.plan\.approvalState !== "approved"/.test(execute));
ok("the approved/pending badge is driven by the persisted approvalState", /approved = plan\.approvalState === "approved"/.test(src));
ok("the run button only appears once the plan is approved", /!approved \?[\s\S]*Approve plan[\s\S]*: \([\s\S]*Run approved verification/.test(src));

console.log("\n── a changed deployment or outcome invalidates a visible approval ──");
ok("stale compares the CURRENT normalized inputs against what the plan was bound to",
  /stale = !!bound && \(normalizeDeploymentUrl\(deployment\) !== bound\.deployment \|\| normalizeClaim\(claim\) !== bound\.claim\)/.test(src));
ok("approve() refuses a stale plan", /stale/.test(approve.slice(0, approve.indexOf("\n"))) || /\|\| stale\)/.test(approve.slice(0, 200)));
ok("execute() refuses a stale plan", /\|\| stale \|\|/.test(execute) || /stale/.test(execute.slice(0, 200)));
ok("a stale plan tells the user to review the updated plan", /changed the deployment or the outcome/.test(src));

console.log("\n── an expired or already-consumed plan cannot be run ──");
ok("consumption is any state other than unconsumed", /consumed = plan\.executionState !== "unconsumed"/.test(src));
ok("expiry is computed from the persisted expiresAt", /expiryText\(plan\.expiresAt\)/.test(src));
ok("the action is blocked while busy, stale, expired, or consumed", /blocked = !!busy \|\| stale \|\| expired \|\| consumed/.test(src));
ok("expiry and consumption are surfaced, not silently swallowed", /This plan expired/.test(src));

console.log("\n── execution integrity: exact plan, once ──");
ok("execute() runs the exact reviewed plan id, not a re-synthesis", /reviewedPlanId: phase\.plan\.reviewedPlanId/.test(execute));
ok("execution reuses the bound deployment + claim the plan was minted for", /deploymentUrl: b\.deployment, claim: b\.claim/.test(execute));
ok("the client pins a per-plan idempotency key so a retried run cannot double-charge", /`rvp:\$\{input\.reviewedPlanId\}`/.test(client));
ok("a stale async response cannot overwrite newer state (generation guard)", /gen = useRef\(/.test(src) && (src.match(/g !== gen\.current/g) ?? []).length >= 4);
ok("in-flight work blocks re-entry into every action (no double submit)", /phase\.busy/.test(approve) && /phase\.busy/.test(execute));
ok("a running verification is polled to a verdict", /pollVerification\(/.test(execute));

console.log("\n── honesty: no invented price, no internal vocabulary, no raw server text ──");
// Balance is shown as a count; a per-run dollar cost is never fabricated when the backend returned none.
ok("balance is rendered as a plain count, not a fabricated currency amount", /balance\.toLocaleString\(\)/.test(src) && !/toFixed\(/.test(src));
ok("insufficient balance routes to adding balance rather than inventing a number", /insufficient_balance/.test(src) && /Add balance/.test(src));
for (const term of ["Production Pass", "READY", "NEEDS REVIEW", "REPAIR VERIFIED", "needs_review"]) {
  ok(`the composer never shows the internal term "${term}"`, !src.includes(term));
}
ok("only the three public decisions are ever rendered", /verified: \{ label: "Verified"/.test(src) && /failed: \{ label: "Failed"/.test(src) && /blocked: \{ label: "Blocked"/.test(src));
ok("errors render the client's mapped message, never a raw server body", /phase\.error\.message/.test(src) && !/JSON\.stringify\(.*error/.test(src));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
