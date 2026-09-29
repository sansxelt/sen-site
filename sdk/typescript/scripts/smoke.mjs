// Package smoke test: what an npm consumer gets. Run after `npm run build`.
// ESM import, CJS require, the whole verification loop against a local mock of the API
// (prepare -> getPlan/waitForApproval -> run -> waitForResult -> recheck -> waitForResult),
// the wait helpers' refusals, an offline webhook-signature check, and `npm pack --dry-run`
// to confirm ONLY safe files ship (no src, scripts, env, secrets, or build config).
import { createRequire } from "module";
import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";
import { createHmac } from "crypto";

const require = createRequire(import.meta.url);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log("  PASS  " + m); } else { fail++; console.log("  FAIL  " + m); } };
const u = (p) => new URL(p, import.meta.url);
const rejection = async (p) => { try { await p; return null; } catch (e) { return e; } };

console.log("[dist present]");
for (const f of ["../dist/index.js", "../dist/index.cjs", "../dist/index.d.ts"]) ok(existsSync(u(f)), `dist file ${f.replace("../", "")}`);

console.log("\n[ESM import]");
const esm = await import(u("../dist/index.js"));
ok(typeof esm.Vraelis === "function", "ESM: Vraelis exported");
ok(typeof esm.VraelisAPIError === "function", "ESM: VraelisAPIError exported");
ok(typeof esm.verifyWebhookSignature === "function", "ESM: verifyWebhookSignature exported");

console.log("\n[shipped types describe the current API]");
const dts = readFileSync(u("../dist/index.d.ts"), "utf8");
ok(/"verified" \| "failed" \| "blocked"/.test(dts), "VerificationDecision is lowercase verified | failed | blocked");
ok(!/"Verified" \| "Failed" \| "Blocked"/.test(dts), "no capitalized decision union remains");
for (const gone of ["approvePlan", "evaluations", "DecisionPackage", "EvaluationResult", "VerificationPlanApproval", "decision_package"]) ok(!dts.includes(gone), `types no longer mention ${gone}`);
for (const added of ["getPlan", "recheck", "waitForApproval", "waitForResult", "VerificationPlanStatus", "RecheckVerificationInput", "approve_url", "recheck_of", "rechecks_left"]) ok(dts.includes(added), `types declare ${added}`);

// ── A local mock of the /api/v1 verification API ──
const FUTURE = new Date(Date.now() + 3600_000).toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();
const APPROVE_URL = "https://app.vraelis.com/review/rvp_test";
const CLAIM = "A customer can upgrade to Pro and keep Pro after signing in again.";
const planView = (id, over) => ({
  reviewed_plan_id: id, approval_state: "pending", execution_state: "unconsumed", plan_hash: "hash_" + id,
  deployment_url: "https://app.example.com", claim: CLAIM, coverage: { ready: true }, role_refs: [],
  approved_by: null, approved_at: null, run_id: null, expires_at: FUTURE,
  requirements: ["Pro stays active after signing in again"], flows: [{ name: "Upgrade", goal: "Upgrade to Pro", steps: 6 }],
  human_reviewed: false, ...over,
});
const completed = (id, over) => ({
  verification_id: id, state: "completed", decision: "verified", guarantee_id: null, reverification_of: null, recheck_of: null,
  console_url: "https://app.vraelis.com/systems/app_test/passes/" + id.slice(4), claim: CLAIM,
  requirements: ["Pro stays active after signing in again"], failures: [], evidence: [{ checking: "Upgrade", result: "passed", failed_at_step: null }],
  repair_prompt: null, human_reviewed: true, reviewed_by: "owner@example.com", reviewed_at: PAST, reviewed_plan_id: "rvp_test",
  decision_status: "current", contract_review_status: "human_reviewed", requirement_order: "reviewed_plan", ...over,
});
const reads = {};
const nth = (key) => (reads[key] = (reads[key] ?? 0) + 1);
const apiErr = (status, code, message, extra = {}) => [status, { error: { code, message, request_id: "req_smoke" }, ...extra }];

function mockApi(method, path, body) {
  if (method === "POST" && path === "/api/v1/verifications") {
    if (body.claim === "nothing here can be proven") {
      return apiErr(422, "claim_not_provable", "Vraelis could not build a test that would prove it.", { requirements: [], remaining_obligations: ["a signed-in state"], repair_prompt: "Describe what the user sees after signing in." });
    }
    if (!body.reviewed_plan_id) {
      return [202, { state: "review_required", claim: body.claim, requirements: ["Pro stays active after signing in again"], human_reviewed: false, review_required: true, contract_id: "ctr_test", contract_version: 1, reviewed_plan_id: "rvp_test", reviewed_plan_expires_at: FUTURE, approve_url: APPROVE_URL, message: "A person approves it at approve_url." }];
    }
    return [202, { verification_id: "vrf_test", state: "running", status_url: "/v1/verifications/vrf_test", claim: body.claim, requirements: ["Pro stays active after signing in again"], reviewed_plan_id: body.reviewed_plan_id, human_reviewed: true }];
  }
  let m = path.match(/^\/api\/v1\/verifications\/plans\/([^/]+)$/);
  if (method === "GET" && m) {
    const id = m[1], n = nth("plan:" + id);
    if (id === "rvp_test") return [200, n === 1 ? planView(id, { approve_url: APPROVE_URL }) : planView(id, { approval_state: "approved", approved_by: "owner@example.com", approved_at: PAST, human_reviewed: true })];
    if (id === "rvp_expired") return [200, planView(id, { expires_at: PAST })];
    if (id === "rvp_approved_expired") return [200, planView(id, { expires_at: PAST, approval_state: "approved", approved_by: "owner@example.com", approved_at: PAST })];
    if (id === "rvp_used") return [200, planView(id, { approval_state: "approved", execution_state: "consumed", run_id: "run_old", approved_by: "owner@example.com", approved_at: PAST })];
    if (id === "rvp_pending") return [200, planView(id, { approve_url: "https://app.vraelis.com/review/rvp_pending" })];
    return apiErr(404, "reviewed_plan_not_found", "No reviewed plan with that id.");
  }
  m = path.match(/^\/api\/v1\/verifications\/([^/]+)\/recheck$/);
  if (method === "POST" && m) {
    if (m[1] === "vrf_test") return [202, { verification_id: "vrf_test2", state: "running", status_url: "/v1/verifications/vrf_test2", recheck_of: "vrf_test", claim: CLAIM, requirements: ["Pro stays active after signing in again"], deployment_url: body.deployment_url ?? "https://app.example.com", human_reviewed: true, reviewed_by: "owner@example.com", reviewed_at: PAST, reviewed_plan_id: "rvp_test", rechecks_left: 9, recheck_window_ends_at: FUTURE }];
    return apiErr(403, "plan_requires_human", "A person has to approve a plan before it can be re-checked.");
  }
  m = path.match(/^\/api\/v1\/verifications\/([^/]+)$/);
  if (method === "GET" && m) {
    const id = m[1], n = nth("run:" + id);
    const running = [200, { verification_id: id, state: "running", status_url: "/v1/verifications/" + id }];
    if (id === "vrf_test") {
      if (n === 1) return running;
      if (n === 2) return apiErr(503, "runs_busy", "Try again in a moment."); // transient: the wait must survive it
      return [200, completed(id, { decision: "failed", failures: [{ severity: "high", title: "Pro is lost after sign-in", expected: "Pro badge", observed: "Free badge", reproduce: "Upgrade, sign out, sign in" }], evidence: [{ checking: "Upgrade", result: "failed", failed_at_step: 5 }], repair_prompt: "Persist the plan on the account, not the session." })];
    }
    if (id === "vrf_test2") return n === 1 ? running : [200, completed(id, { recheck_of: "vrf_test", reverification_of: "test" })];
    if (id === "vrf_down") return [200, completed(id, { decision: "blocked" })];
    return apiErr(404, "not_found", "No such verification.");
  }
  return apiErr(404, "not_found", "No route in the smoke mock for " + method + " " + path);
}

const calls = [];
const mockFetch = async (url, init = {}) => {
  if (init.signal?.aborted) throw init.signal.reason;
  const { pathname } = new URL(String(url));
  const body = init.body ? JSON.parse(init.body) : {};
  calls.push({ method: init.method, path: pathname, headers: init.headers, rawBody: init.body, body });
  if (init.method === "GET" && pathname === "/api/v1/verifications/vrf_down" && nth("net:vrf_down") === 1) {
    throw new TypeError("fetch failed"); // a network failure: the wait must survive it too
  }
  const [status, json] = mockApi(init.method, pathname, body);
  return new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });
};
const lastCall = (method, path) => calls.filter((c) => c.method === method && c.path === path).at(-1);
const fast = { intervalMs: 5 };

console.log("\n[old surface is gone]");
const client = new esm.Vraelis({ apiKey: "vr_live_smoke", baseUrl: "https://sdk.test/", fetch: mockFetch });
ok(!("approvePlan" in client.verifications) && client.verifications.approvePlan === undefined, "verifications.approvePlan no longer exists (only a person approves)");
ok(client.evaluations === undefined, "evaluations no longer exists (the API was retired)");
for (const name of ["prepare", "getPlan", "waitForApproval", "run", "get", "waitForResult", "recheck"]) ok(typeof client.verifications[name] === "function", `verifications.${name} is a function`);

console.log("\n[prepare: a plan for a person to approve]");
const input = { deployment_url: "https://app.example.com", claim: CLAIM };
const plan = await client.verifications.prepare(input, { idempotencyKey: "idem_prepare" });
const prepCall = calls[0];
ok(prepCall.method === "POST" && prepCall.path === "/api/v1/verifications", "prepare POSTs /api/v1/verifications (trailing slash on baseUrl trimmed)");
ok(prepCall.headers["X-Api-Key"] === "vr_live_smoke", "prepare sends the API key");
ok(prepCall.headers["Idempotency-Key"] === "idem_prepare", "prepare forwards its idempotency key");
ok(plan.state === "review_required" && plan.reviewed_plan_id === "rvp_test" && plan.approve_url === APPROVE_URL, "prepare returns review_required with reviewed_plan_id and approve_url");
const notProvable = await rejection(client.verifications.prepare({ ...input, claim: "nothing here can be proven" }));
ok(notProvable instanceof esm.VraelisAPIError && notProvable.status === 422 && notProvable.code === "claim_not_provable", "an unprovable claim throws VraelisAPIError 422 claim_not_provable");
ok(typeof notProvable?.body?.repair_prompt === "string", "the error body keeps repair_prompt for the caller");

console.log("\n[getPlan + waitForApproval: pending, then approved by a person]");
const pending = await client.verifications.getPlan("rvp_test");
ok(pending.approval_state === "pending" && pending.approve_url === APPROVE_URL, "getPlan reads the pending plan with its approve_url");
ok(lastCall("GET", "/api/v1/verifications/plans/rvp_test") !== undefined, "getPlan GETs /api/v1/verifications/plans/{id}");
reads["plan:rvp_test"] = 0; // start the wait from pending again
const approved = await client.verifications.waitForApproval("rvp_test", fast);
ok(approved.approval_state === "approved" && approved.execution_state === "unconsumed", "waitForApproval resolves with the approved plan");
ok(reads["plan:rvp_test"] === 2, "waitForApproval polled until approval (pending, then approved)");

console.log("\n[run + waitForResult: failed, with evidence]");
const run = await client.verifications.run({ ...input, reviewed_plan_id: approved.reviewed_plan_id }, { idempotencyKey: "idem_run" });
const runCall = lastCall("POST", "/api/v1/verifications");
ok(runCall.body.reviewed_plan_id === "rvp_test" && runCall.body.deployment_url === input.deployment_url && runCall.body.claim === CLAIM, "run resubmits the same deployment_url and claim with reviewed_plan_id");
ok(runCall.headers["Idempotency-Key"] === "idem_run", "run forwards its idempotency key");
ok(run.state === "running" && run.verification_id === "vrf_test", "run returns the running verification");
const failed = await client.verifications.waitForResult(run.verification_id, fast);
ok(failed.state === "completed" && failed.decision === "failed", "waitForResult resolves with the lowercase decision \"failed\"");
ok(reads["run:vrf_test"] === 3, "waitForResult kept polling through running and a transient 503");
ok(failed.failures.length === 1 && typeof failed.repair_prompt === "string", "the failed result carries failures and a repair prompt");

console.log("\n[recheck + waitForResult: same approved plan, verified]");
const again = await client.verifications.recheck(failed.verification_id, { deployment_url: "https://app.example.com/" }, { idempotencyKey: "idem_recheck" });
const recheckCall = lastCall("POST", "/api/v1/verifications/vrf_test/recheck");
ok(recheckCall !== undefined, "recheck POSTs /api/v1/verifications/{id}/recheck");
ok(recheckCall?.body.deployment_url === "https://app.example.com/" && recheckCall?.headers["Idempotency-Key"] === "idem_recheck", "recheck sends deployment_url and its idempotency key");
ok(again.verification_id === "vrf_test2" && again.recheck_of === "vrf_test" && again.rechecks_left === 9 && again.human_reviewed === true, "recheck returns a new running verification tied to the approved plan");
const verified = await client.verifications.waitForResult(again.verification_id, fast);
ok(verified.decision === "verified" && verified.recheck_of === "vrf_test", "the re-check resolves \"verified\" with recheck_of");
const refused = await rejection(client.verifications.recheck("vrf_other"));
ok(lastCall("POST", "/api/v1/verifications/vrf_other/recheck")?.rawBody === "{}", "recheck with no input sends an empty JSON body");
ok(refused instanceof esm.VraelisAPIError && refused.status === 403 && refused.code === "plan_requires_human" && refused.requestId === "req_smoke", "a recheck refusal throws VraelisAPIError with status, code and request id");

console.log("\n[wait helpers refuse clearly]");
const expired = await rejection(client.verifications.waitForApproval("rvp_expired", fast));
ok(expired instanceof Error && /expired/.test(expired.message), "waitForApproval rejects an expired plan");
const approvedExpired = await rejection(client.verifications.waitForApproval("rvp_approved_expired", fast));
ok(approvedExpired instanceof Error && /expired/.test(approvedExpired.message), "waitForApproval rejects an approved plan that expired (it can no longer run)");
const used = await rejection(client.verifications.waitForApproval("rvp_used", fast));
ok(used instanceof Error && /already used/.test(used.message) && used.message.includes("vrf_run_old"), "waitForApproval rejects a plan already used by a run, naming its verification");
const timedOut = await rejection(client.verifications.waitForApproval("rvp_pending", { intervalMs: 5, timeoutMs: 40 }));
ok(timedOut instanceof Error && /still waiting/.test(timedOut.message), "waitForApproval times out while still pending");
const ac = new AbortController();
const stop = new Error("stop waiting");
setTimeout(() => ac.abort(stop), 30);
const aborted = await rejection(client.verifications.waitForApproval("rvp_pending", { intervalMs: 5, timeoutMs: 60_000, signal: ac.signal }));
ok(aborted === stop, "waitForApproval rejects with the abort signal's reason");
const missing = await rejection(client.verifications.waitForResult("vrf_missing", fast));
ok(missing instanceof esm.VraelisAPIError && missing.status === 404 && reads["run:vrf_missing"] === 1, "waitForResult does not retry a 404");
const blocked = await client.verifications.waitForResult("vrf_down", fast);
ok(blocked.decision === "blocked" && reads["net:vrf_down"] === 2, "waitForResult retries a network failure, then resolves \"blocked\"");

console.log("\n[CJS require]");
const cjs = require("../dist/index.cjs");
ok(typeof cjs.Vraelis === "function", "CJS: Vraelis exported");
ok(typeof cjs.VraelisAPIError === "function", "CJS: VraelisAPIError exported");
ok(typeof cjs.verifyWebhookSignature === "function", "CJS: verifyWebhookSignature exported");
const cjsClient = new cjs.Vraelis({ apiKey: "vr_live_smoke", fetch: mockFetch });
ok(cjsClient.verifications.approvePlan === undefined && typeof cjsClient.verifications.waitForResult === "function", "CJS: same verification surface, no approvePlan");

console.log("\n[webhook helper matches server formula, offline]");
const secret = "whsec_smoke", ts = "1718000000";
const body = JSON.stringify({ event: "verification.completed", run_id: "run_1", application_id: "app_1", decision: "failed", flows_total: 3, flows_passed: 2, deployment_url: "https://app.example.com", completed_at: "2026-09-28T00:00:00.000Z", report_url: null });
const sig = "sha256=" + createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
ok(esm.verifyWebhookSignature({ payload: body, signature: sig, timestamp: ts, secret }) === true, "valid server signature -> true");
ok(esm.verifyWebhookSignature({ payload: body + "x", signature: sig, timestamp: ts, secret }) === false, "tampered body -> false");
ok(client.webhooks.verifySignature === esm.verifyWebhookSignature, "client.webhooks.verifySignature is the same helper");

console.log("\n[npm pack --dry-run: only safe files ship]");
// --ignore-scripts so prepack/build logs don't pollute --json; slice from the
// first JSON bracket defensively in case npm prints a leading notice.
const out = execSync("npm pack --dry-run --json --ignore-scripts", { encoding: "utf8", cwd: fileURLToPath(u("..")) });
const json = out.slice(Math.max(out.search(/[[{]/), 0));
const files = (JSON.parse(json)[0]?.files ?? []).map((f) => f.path.replace(/\\/g, "/"));
console.log("  packed:", files.join(", "));
const allowed = (p) => p === "package.json" || p === "README.md" || p === "LICENSE" || p === "CHANGELOG.md" || p.startsWith("dist/");
const stray = files.filter((p) => !allowed(p));
ok(stray.length === 0, "no stray files in the tarball" + (stray.length ? " :: " + stray.join(",") : ""));
const forbidden = files.filter((p) => /(^|\/)(src|scripts|examples|node_modules)\/|\.env|tsconfig|tsup\.config|\.map$|secret|_.*\.cjs/i.test(p));
ok(forbidden.length === 0, "no source/scripts/env/secrets/config in the tarball" + (forbidden.length ? " :: " + forbidden.join(",") : ""));
for (const need of ["package.json", "README.md", "LICENSE", "CHANGELOG.md", "dist/index.js", "dist/index.cjs", "dist/index.d.ts"]) ok(files.includes(need), `ships ${need}`);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
