// The public verification surface — safety proof (pure/offline: no network, no DB, no spend, no model).
//
// /v1/verifications is the first endpoint where Vraelis makes a decision with NO human anywhere in the
// loop. It synthesizes a contract from a sentence, approves that contract itself, spends the caller's
// money, and returns a verdict someone will gate a release on. Every one of those steps is a place where
// being subtly wrong is worse than failing loudly.
//
// What is proven here:
//   - the public decision vocabulary is total, stable, and never turns an unfinished run into a pass
//   - verification ids are opaque and cannot be used to probe internal run ids
//   - the route DELEGATES the launch rather than reimplementing the gates (the one-launch-path invariant)
//   - auto-approval is disclosed on every response, and the derived requirements are always echoed
//   - the lane prepares but never launches, and orders contract writes before the freeze
//
// What is NOT proven here: that a real claim produces a sensible contract. That needs a model and a live
// deployment, and it is what the production proof exists for.
import { readFileSync } from "node:fs";
import { toVerificationId, toRunId, toPublicDecision } from "../app/api/v1/verifications/_shared";

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? `  — ${detail}` : ""}`); }
}
const read = (p: string) => readFileSync(p, "utf8");
const ROUTE_CREATE = "app/api/v1/verifications/route.ts";
const ROUTE_READ = "app/api/v1/verifications/[id]/route.ts";
const LANE = "lib/preflight/verification-lane.ts";

function idTests() {
  console.log("── verification ids are opaque and round-trip ──");
  ok("an id round-trips to its run", toRunId(toVerificationId("run-123")) === "run-123");
  ok("the id is prefixed, not a bare run id", toVerificationId("run-123") === "vrf_run-123");
  // Accepting a bare run id here would turn this endpoint into a way to probe whether an internal id exists.
  ok("a bare run id is NOT a valid verification id", toRunId("run-123") === null);
  ok("an empty or prefix-only id is rejected", toRunId("vrf_") === null && toRunId("") === null);
}

function decisionTests() {
  console.log("\n── the public decision never overstates what happened ──");
  // Running is running. Any mapping that produced a decision here would let a caller gate a release on a
  // run that had not finished.
  for (const s of ["queued", "discovering", "running", "analyzing", "draft"]) {
    ok(`state ${s} yields NO decision yet`, toPublicDecision(s, null) === null && toPublicDecision(s, "ready") === null);
  }

  ok("a completed run that was READY is verified", toPublicDecision("completed", "ready") === "verified");
  ok("a completed run that was BLOCKED failed", toPublicDecision("completed", "blocked") === "failed");

  // The important asymmetry. needs_review is not a pass and not a failure; calling it either would be a
  // false pass or a false alarm, and both are worse than saying no verdict was reached.
  ok("needs_review is BLOCKED, never verified", toPublicDecision("completed", "needs_review") === "blocked");
  ok("an unrecognized decision is BLOCKED, never verified", toPublicDecision("completed", "banana") === "blocked");
  ok("a completed run with NO decision is blocked, never verified", toPublicDecision("completed", null) === "blocked");

  // A run that failed or was cancelled cannot have verified anything, whatever it recorded on the way.
  ok("a FAILED run is blocked even if it recorded ready", toPublicDecision("failed", "ready") === "blocked");
  ok("a CANCELLED run is blocked even if it recorded ready", toPublicDecision("cancelled", "ready") === "blocked");

  // The property that matters most: across the whole input space, a pass requires a COMPLETED run whose
  // decision is 'ready'. Casing is normalized on purpose (an internal rename to "READY" should not silently
  // turn every pass into a blocked), so the assertion is about the decision's identity, not its spelling.
  const states = ["queued", "running", "analyzing", "completed", "failed", "cancelled", "draft", "weird"];
  const decisions = [null, "ready", "blocked", "needs_review", "", "READY", "Ready", "banana", " ready "];
  const verified = states.flatMap((s) => decisions.map((d) => ({ s, d, v: toPublicDecision(s, d) }))).filter((x) => x.v === "verified");
  ok("nothing but a COMPLETED run can ever yield 'verified'", verified.every((x) => x.s === "completed"),
    `got ${JSON.stringify(verified)}`);
  ok("nothing but the 'ready' decision can yield 'verified' (case aside)",
    verified.every((x) => (x.d ?? "").trim().toLowerCase() === "ready"), `got ${JSON.stringify(verified)}`);
  ok("at least one real combination DOES verify (the mapping is not vacuously safe)", verified.length > 0);
  // Whitespace is not normalized, and that is the safe direction: an unrecognized value blocks.
  ok("a padded decision is blocked rather than guessed at", toPublicDecision("completed", " ready ") === "blocked");
}

function delegationTests() {
  console.log("\n── the launch is DELEGATED, never reimplemented ──");
  const create = read(ROUTE_CREATE);
  // The whole safety argument for this endpoint is that it cannot spend differently from the runs route,
  // because it physically calls it.
  ok("the create route imports the runs route handler", /import \{ POST as launchRun \}/.test(create));
  ok("the create route calls it", /await launchRun\(/.test(create));
  ok("the caller's own key is forwarded (nothing is elevated in transit)",
    /"x-api-key": req\.headers\.get\("x-api-key"\)/.test(create));

  // If any gate were re-implemented here, that is the beginning of two copies that drift.
  for (const gate of ["hold(", "gatePassLaunch", "checkAccountVelocity", "ownerRunsToday", "keyCeilingRefusal", "isRunsGovernorPaused"]) {
    ok(`the create route does NOT reimplement ${gate}`, !create.includes(gate));
  }
  // It also must not write a run row itself.
  ok("the create route never creates a run directly", !/createRun\(/.test(create));

  // A refusal from the runs route has to survive translation. An agent branching on key_daily_ceiling must
  // still receive key_daily_ceiling, not a generic error.
  ok("refusals pass through with their own code", /result\?\.error \?\? "internal_error"/.test(create));
  ok("refusals pass through with their own status", /status: launched\.status/.test(create));

  console.log("\n── the lane prepares, and never launches ──");
  const lane = read(LANE);
  ok("the lane never creates a run", !/createRun\(/.test(lane));
  ok("the lane never takes a hold", !/\bhold\(/.test(lane));
  // Ordering is not negotiable: approving a contract freezes it, so every write must precede the approval.
  ok("requirements are written before flows", lane.indexOf("addRequirement(") < lane.indexOf("addFlow("));
  ok("the contract is approved LAST, after every write", lane.indexOf("addFlow(") < lane.indexOf("approveContract("));
  // Model output is not trusted into the browser: steps go through the same validator the dashboard uses.
  ok("model-authored steps go through the shared validator", /validateSteps\(/.test(lane));
}

function disclosureTests() {
  console.log("\n── auto-approval is disclosed, and the claim is echoed ──");
  const create = read(ROUTE_CREATE);
  const readRoute = read(ROUTE_READ);
  // A confidently wrong verdict from a misread claim is this endpoint's main failure mode. The caller
  // cannot detect it from a decision alone, so the requirements are part of the contract, not a nicety.
  ok("the create response echoes the derived requirements", /requirements: prepared\.requirements/.test(create));
  ok("the terminal response echoes the requirements", /\brequirements,/.test(readRoute));
  ok("the terminal response echoes the claim it tested", /claim: contract\?\.source_prompt/.test(readRoute));
  ok("both responses state that no human reviewed the contract",
    /human_reviewed: false/.test(create) && /human_reviewed: false/.test(readRoute));
  // The loop-closing artifact. A decision without it leaves the caller knowing something is wrong and not
  // knowing what to do.
  ok("the terminal response carries the repair prompt", /repair_prompt: repairPrompt/.test(readRoute));

  console.log("\n── the read path re-uses the existing ownership gate ──");
  ok("the read route resolves ownership through applicationAccessForRun", /applicationAccessForRun\(/.test(readRoute));
  ok("the read route enforces the viewer role", /hasAtLeastRole\(access\.role, "viewer"\)/.test(readRoute));
  ok("the read route requires the run:read scope", /PREFLIGHT_SCOPES\.runRead/.test(readRoute));
  ok("the create route requires the run:create scope", /PREFLIGHT_SCOPES\.runCreate/.test(create));
  // An unknown id and an id belonging to someone else must be indistinguishable.
  ok("every miss is a uniform 404", (readRoute.match(/No such verification\./g) || []).length >= 3);

  console.log("\n── the public path is served without a redirect hop ──");
  // A 307/308 would silently drop the body of a POST made without follow-redirects, which is exactly how an
  // agent or a bare curl would call this.
  const proxy = read("proxy.ts");
  ok("/v1/* is rewritten to the handlers, not redirected", /path\.startsWith\("\/v1\/"\)[\s\S]{0,80}"rewrite"/.test(proxy));
}

// ── idempotency reconciliation at the /v1 seam ──────────────────────────────────────────────────────────
// The first real production run found that /v1 treated a 409 conflict from the runs route as success,
// because the 409 carries a runId and the check was only "is there a runId". A caller who reused an
// idempotency key with a CHANGED claim got a 202 with the FIRST verification's id. These lock the fix.
import { canonicalClaim } from "../app/api/v1/verifications/_shared";

function reconciliationTests() {
  console.log("\n── canonical claim decides same-vs-different request ──");
  ok("whitespace-only differences are the SAME claim",
    canonicalClaim("A user  can\n pay ") === canonicalClaim("A user can pay"));
  ok("a changed claim is DIFFERENT", canonicalClaim("A user can pay") !== canonicalClaim("A user can pay twice"));
  ok("an appended sentence is DIFFERENT (the STEP 5 case)",
    canonicalClaim("Pro access is granted") !== canonicalClaim("Pro access is granted And billing is never charged twice."));
  ok("empty and null canonicalize the same", canonicalClaim(null) === canonicalClaim(""));

  console.log("\n── the route respects the launch verdict, not just the presence of a runId ──");
  const src = read(ROUTE_CREATE);
  ok("a 409 from the runs route is handled explicitly", /launched\.status === 409 && result\?\.runId/.test(src));
  ok("a reused key with the SAME claim returns the ORIGINAL verification at status 200",
    /sameRequest[\s\S]{0,400}status: 200/.test(src));
  ok("a reused key with a DIFFERENT claim is refused as idempotency_key_reused",
    /idempotency_key_reused[\s\S]{0,220}status: 409/.test(src));
  // The old bug: success was inferred from a runId alone. Success must now gate on the HTTP result too.
  ok("success now requires an ok status, not merely a runId", /if \(!launched\.ok \|\| !result\?\.runId\)/.test(src));
  ok("the sameRequest check compares BOTH the claim and the deployment url",
    /canonicalClaim\(priorClaim\) === canonicalClaim\(claim\)[\s\S]{0,140}idn\.deploymentUrl === deploymentUrl/.test(src));
}

function main() {
  idTests();
  decisionTests();
  delegationTests();
  disclosureTests();
  reconciliationTests();
  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
