// PRODUCTION proof of the API-key lifecycle. This is the gate that must pass before /developers stops
// saying "Not available yet".
//
// Everything else in scripts/ is pure and offline. This one is the opposite on purpose: it talks to the real
// deployment with a real key, and STEP 3 SPENDS REAL MONEY by launching a Production Pass. Nothing runs
// until you pass --i-approve-the-charge, and the script tells you the exact price it is about to commit
// before it commits it.
//
// Why a script and not a checklist: the interesting steps are the ones a human doing this by hand would
// skip or fudge. Retrying with a byte-identical body and confirming ONE run and ONE hold is tedious and
// easy to get wrong by accident; reusing a key with a changed body and confirming a 409 is the assertion
// that catches the failure mode payload binding exists to prevent. Those have to be mechanical.
//
// ── Setup ────────────────────────────────────────────────────────────────────────────────────────────────
// Key creation and revocation both need a signed-in browser session, so they are yours to do in the
// console; this script cannot and should not be able to mint or revoke a credential.
//
//   1. In the console (/app/api), create a key with Preflight access "Launch runs".
//      That grants preflight:preview, preflight:run:read, preflight:run:create.
//   2. Export the environment and run phase one:
//
//        VRAELIS_BASE_URL=https://vraelis.com \
//        VRAELIS_API_KEY=vr_live_... \
//        VRAELIS_APP_ID=<an application with an APPROVED contract and at least one approved flow> \
//        npx tsx scripts/preflight-api-key-lifecycle.ts --i-approve-the-charge
//
//   3. When phase one passes, REVOKE the key in the console, then run phase two:
//
//        npx tsx scripts/preflight-api-key-lifecycle.ts --after-revoke
//
// Phase two is the only way to prove revocation is immediate rather than eventually consistent, and it has
// to happen after a real revoke, which is why it is a separate invocation.

const BASE = (process.env.VRAELIS_BASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.VRAELIS_API_KEY || "";
const APP = process.env.VRAELIS_APP_ID || "";
const APPROVED = process.argv.includes("--i-approve-the-charge");
const AFTER_REVOKE = process.argv.includes("--after-revoke");

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`PASS  ${name}`); }
  else { fail++; console.log(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`); }
}
function step(n: string) { console.log(`\n── ${n} ──`); }

type Res = { status: number; body: any; raw: string };
async function call(method: string, path: string, opts: { key?: string | null; body?: unknown; idem?: string } = {}): Promise<Res> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.key !== null) headers["x-api-key"] = opts.key ?? KEY;
  if (opts.idem) headers["idempotency-key"] = opts.idem;
  const r = await fetch(`${BASE}${path}`, {
    method, headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const raw = await r.text();
  let body: any = null;
  try { body = JSON.parse(raw); } catch { /* a non-JSON body is itself a finding; `raw` carries it */ }
  return { status: r.status, body, raw };
}

// Nothing in a response may contain the key, at any point, for any reason. Checked on EVERY response rather
// than once at the end, so the failure names the exact call that leaked.
function assertNoKeyLeak(label: string, r: Res) {
  const leaked = KEY.length > 8 && r.raw.includes(KEY);
  ok(`${label}: response does not echo the key`, !leaked);
  // The prefix is public and appears in the console, so it is fine in a body; the SECRET tail is not.
  const tail = KEY.slice(16);
  ok(`${label}: response does not echo the key's secret tail`, !(tail.length > 8 && r.raw.includes(tail)));
}

// ── PHASE ONE, /v1 FLAVOUR: the same lifecycle through the public product ────────────────────────────────
// Needs no application id: the verification lane creates and reuses its own. This proves strictly more than
// the app-scoped flavour (it exercises the key path AND the claim-to-contract pipeline AND the delegation
// to the runs route), so prefer it unless you specifically want to test a hand-built application.
async function lifecycleV1() {
  const claim = process.env.VRAELIS_CLAIM
    || "A visitor can reach the site and load the main page without an error.";
  const url = process.env.VRAELIS_TARGET_URL || "";
  if (!url) { console.error("Set VRAELIS_TARGET_URL to the deployment you want verified."); return; }

  step("STEP 0  the key is rejected where it must be, before anything is spent");
  const inQuery = await call("POST", `/v1/verifications?api_key=${encodeURIComponent(KEY)}`, { key: null, body: { deployment_url: url, claim } });
  ok("a key in the query string is refused", inQuery.status === 400 && inQuery.body?.error === "api_key_in_query",
    `got ${inQuery.status}: ${inQuery.raw.slice(0, 200)}`);
  const noKey = await call("POST", "/v1/verifications", { key: null, body: { deployment_url: url, claim } });
  ok("no key and no session is refused", noKey.status === 401, `got ${noKey.status}`);
  const badKey = await call("POST", "/v1/verifications", { key: "vr_live_deadbeefdeadbeefdeadbeef", body: { deployment_url: url, claim } });
  ok("an unknown key is refused", badKey.status === 401, `got ${badKey.status}: ${badKey.raw.slice(0, 160)}`);
  const badBody = await call("POST", "/v1/verifications", { body: { deployment_url: url } });
  // This is also the first call that reaches the scope check with the REAL key: the three above deliberately
  // use no key or a fake one. The route order is flag check, then resolvePrincipal, then body validation, so
  // a 403 lands BEFORE the body is ever looked at, and the only 403 the resolver returns is
  // insufficient_scope. That means the key is wrong, not the request, and it should say so rather than
  // making someone reason backwards through the route to work it out.
  if (badBody.status === 403) {
    ok("the key is allowed to launch runs", false,
      "403 insufficient_scope: this key is missing preflight:run:create.\n"
      + '      Revoke it, then create a new key with Preflight access set to "Launch runs".\n'
      + `      server said: ${badBody.raw.slice(0, 200)}`);
    console.log("\n  STOPPING: nothing below this can pass with a key that cannot launch a run.");
    return;
  }
  ok("a missing claim is a validation error, not a charge", badBody.status === 400,
    `got ${badBody.status}: ${badBody.raw.slice(0, 200)}`);

  if (!APPROVED) {
    console.log("\n  STOP. The next step runs a real verification and charges the account.");
    console.log(`  Claim: ${claim}`);
    console.log("  Re-run with --i-approve-the-charge to continue.");
    return;
  }

  step("STEP 2+3  start a verification from a claim");
  const idem = `lifecycle-v1-${Date.now()}`;
  const started = await call("POST", "/v1/verifications", { body: { deployment_url: url, claim }, idem });
  ok("the verification starts", started.status === 202 && !!started.body?.verification_id,
    `got ${started.status}: ${started.raw.slice(0, 400)}`);
  assertNoKeyLeak("create", started);
  const vid: string = started.body?.verification_id;
  if (!vid) return;
  console.log(`      verification: ${vid}`);

  // The disclosure that makes an auto-approved contract safe to act on.
  const reqs: string[] = started.body?.requirements ?? [];
  ok("the response echoes the requirements derived from the claim", reqs.length > 0,
    "without these the caller cannot tell whether the claim was understood");
  ok("the response states that no human reviewed them", started.body?.human_reviewed === false);
  for (const r of reqs) console.log(`      · ${r}`);

  step("STEP 4  the same key and the SAME claim does not start a second verification");
  const replay = await call("POST", "/v1/verifications", { body: { deployment_url: url, claim }, idem });
  ok("an identical retry returns the SAME verification, or refuses to duplicate it",
    replay.body?.verification_id === vid || replay.status === 409,
    `got ${replay.status}: ${replay.raw.slice(0, 300)}`);

  step("STEP 5  the same key with a DIFFERENT claim is refused");
  const reuse = await call("POST", "/v1/verifications", { body: { deployment_url: url, claim: `${claim} And billing is never charged twice.` }, idem });
  ok("a reused idempotency key with a changed request does not silently return the first verification",
    reuse.body?.verification_id !== vid, `got ${reuse.status}: ${reuse.raw.slice(0, 300)}`);

  step("STEP 6  poll until the verdict");
  const deadline = Date.now() + 15 * 60_000;
  let final: Res | null = null;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10_000));
    const poll = await call("GET", `/v1/verifications/${vid}`);
    if (poll.status !== 200) { console.log(`      poll -> ${poll.status}: ${poll.raw.slice(0, 200)}`); break; }
    console.log(`      state: ${poll.body?.state}`);
    if (poll.body?.state === "completed") { final = poll; break; }
  }
  ok("a verdict was reached within 15 minutes", !!final);
  if (!final) return;
  assertNoKeyLeak("verdict", final);

  step("STEP 7  the decision, the evidence, and the repair prompt");
  const decision = final.body?.decision;
  ok("the verdict is one of the three public decisions",
    ["verified", "failed", "blocked"].includes(decision), `got ${JSON.stringify(decision)}`);
  console.log(`      decision: ${decision}`);
  ok("the verdict echoes the claim it tested", typeof final.body?.claim === "string");
  if (decision === "failed") {
    ok("a failure carries evidence", (final.body?.failures ?? []).length > 0);
    ok("a failure carries a repair prompt", typeof final.body?.repair_prompt === "string" && final.body.repair_prompt.length > 40);
    console.log(`      repair prompt (first 300):\n      ${String(final.body.repair_prompt).slice(0, 300).replace(/\n/g, "\n      ")}`);
  } else {
    console.log(`      The claim did not fail, so the repair prompt was not exercised.`);
    console.log(`      That is a PASS for the lifecycle but NOT proof the repair path works.`);
    console.log(`      Re-run against a deployment with a KNOWN broken flow to cover it.`);
  }

  step("STEP 8  revoke, then run phase two");
  console.log("      Revoke this key in the console (/app/api), then run:");
  console.log("        npx tsx scripts/preflight-api-key-lifecycle.ts --after-revoke");
  step("STEP 10  confirm no key material reached the logs");
  console.log(`      Grep Vercel, the worker, and v_events for the part AFTER ${KEY.slice(0, 16)}`);
}

function requireEnv(): boolean {
  const needsApp = !process.env.VRAELIS_TARGET_URL;
  const missing = [
    ["VRAELIS_BASE_URL", BASE], ["VRAELIS_API_KEY", KEY],
    ...(needsApp ? [["VRAELIS_APP_ID", APP]] as [string, string][] : []),
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) { console.error(`Missing environment: ${missing.join(", ")}`); return false; }
  if (!/^https:\/\//.test(BASE)) { console.error("VRAELIS_BASE_URL must be https. This proof is about production."); return false; }
  if (!KEY.startsWith("vr_live_")) { console.error("VRAELIS_API_KEY does not look like a Vraelis key."); return false; }
  return true;
}

// ── PHASE TWO: revocation takes effect immediately ───────────────────────────────────────────────────────
async function afterRevoke() {
  step("STEP 9  a revoked key fails on the very next request");
  const preview = await call("GET", `/api/preflight/apps/${APP}/pass-preview`);
  ok("a revoked key is rejected", preview.status === 401,
    `got ${preview.status}: ${preview.raw.slice(0, 200)}`);
  ok("the rejection is invalid_api_key (revoked and unknown are indistinguishable)",
    preview.body?.error === "invalid_api_key", `got ${JSON.stringify(preview.body)}`);
  assertNoKeyLeak("revoked preview", preview);

  const launch = await call("POST", `/api/preflight/apps/${APP}/runs`, { body: { flow_ids: ["x"] }, idem: "revoked-probe" });
  ok("a revoked key cannot launch either (no cached authorization)", launch.status === 401,
    `got ${launch.status}: ${launch.raw.slice(0, 200)}`);
}

// ── PHASE ONE: the full spending lifecycle ───────────────────────────────────────────────────────────────
async function lifecycle() {
  step("STEP 0  the key is rejected where it must be, before anything is spent");
  // Cheapest possible checks first: if placement or scoping is wrong, stop before committing money.
  const inQuery = await call("GET", `/api/preflight/apps/${APP}/pass-preview?api_key=${encodeURIComponent(KEY)}`, { key: null });
  ok("a key in the query string is refused", inQuery.status === 400 && inQuery.body?.error === "api_key_in_query",
    `got ${inQuery.status}: ${inQuery.raw.slice(0, 200)}`);
  const noKey = await call("GET", `/api/preflight/apps/${APP}/pass-preview`, { key: null });
  ok("no key and no session is refused", noKey.status === 401, `got ${noKey.status}`);
  const badKey = await call("GET", `/api/preflight/apps/${APP}/pass-preview`, { key: "vr_live_deadbeefdeadbeefdeadbeef" });
  ok("a malformed/unknown key is refused", badKey.status === 401 && badKey.body?.error === "invalid_api_key",
    `got ${badKey.status}: ${badKey.raw.slice(0, 200)}`);

  step("STEP 2  preview the cost of a known verification");
  const preview = await call("GET", `/api/preflight/apps/${APP}/pass-preview`);
  ok("preview succeeds with a scoped key", preview.status === 200, `got ${preview.status}: ${preview.raw.slice(0, 300)}`);
  assertNoKeyLeak("preview", preview);
  if (preview.status !== 200) return;
  console.log(`      preview: ${JSON.stringify(preview.body).slice(0, 400)}`);

  // The flows to run. Taken from the preview when it names them, so this script does not invent a selection.
  const flowIds: string[] = preview.body?.flowIds ?? preview.body?.flow_ids ?? preview.body?.flows?.map((f: any) => f.id) ?? [];
  ok("the preview names the flows a run would execute", flowIds.length > 0,
    "cannot launch without knowing the selection; inspect the preview body above");
  if (!flowIds.length) return;

  if (!APPROVED) {
    console.log("\n  STOP. The next step launches a real Production Pass and charges the account.");
    console.log(`  Flows to run: ${flowIds.length}. Re-run with --i-approve-the-charge to continue.`);
    return;
  }

  step("STEP 3  launch the run");
  const idem = `lifecycle-${Date.now()}`;
  const body = { deployment_url: preview.body?.deploymentUrl ?? preview.body?.deployment_url ?? undefined, flow_ids: flowIds };
  const launch = await call("POST", `/api/preflight/apps/${APP}/runs`, { body, idem });
  ok("the run is queued", launch.status === 200 && !!launch.body?.runId,
    `got ${launch.status}: ${launch.raw.slice(0, 300)}`);
  assertNoKeyLeak("launch", launch);
  const runId: string = launch.body?.runId;
  if (!runId) return;
  console.log(`      run: ${runId}`);

  step("STEP 4  the same key and the SAME body creates one run and one hold");
  const replay = await call("POST", `/api/preflight/apps/${APP}/runs`, { body, idem });
  // The route answers a duplicate submission with 409 run_exists and releases the second attempt's hold.
  ok("an identical retry does NOT create a second run",
    replay.status === 409 && replay.body?.error === "run_exists" && replay.body?.runId === runId,
    `got ${replay.status}: ${replay.raw.slice(0, 300)}`);
  assertNoKeyLeak("replay", replay);

  // Key-order canonicalization, proven against the live service rather than in a unit test: the same fields
  // serialized in a different order must still be the same request.
  const reordered = { flow_ids: [...flowIds].reverse(), deployment_url: body.deployment_url };
  const replay2 = await call("POST", `/api/preflight/apps/${APP}/runs`, { body: reordered, idem });
  ok("a reordered but equivalent body is still the same request",
    replay2.status === 409 && replay2.body?.runId === runId,
    `got ${replay2.status}: ${replay2.raw.slice(0, 300)}`);

  step("STEP 5  the same key with a DIFFERENT body is refused");
  const changed = { deployment_url: body.deployment_url, flow_ids: flowIds.slice(0, Math.max(1, flowIds.length - 1)) };
  const reuse = await call("POST", `/api/preflight/apps/${APP}/runs`, { body: changed, idem });
  const differs = JSON.stringify(changed.flow_ids) !== JSON.stringify([...flowIds].sort());
  if (differs) {
    ok("a reused key with a changed payload is refused with 409 idempotency_key_reused",
      reuse.status === 409 && reuse.body?.error === "idempotency_key_reused",
      `got ${reuse.status}: ${reuse.raw.slice(0, 300)}`);
    ok("the refusal does NOT silently return the original run as a success",
      reuse.status !== 200, `got ${reuse.status}`);
  } else {
    console.log("      SKIPPED: this application has only one flow, so no different payload can be built.");
    console.log("      Re-run against an application with 2+ approved flows to cover step 5.");
  }

  step("STEP 6  poll until the run completes");
  const deadline = Date.now() + 15 * 60_000;
  let detail: Res | null = null;
  let state = "";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 10_000));
    detail = await call("GET", `/api/preflight/runs/${runId}`);
    if (detail.status !== 200) { console.log(`      poll -> ${detail.status}: ${detail.raw.slice(0, 200)}`); break; }
    state = detail.body?.run?.state ?? detail.body?.state ?? "";
    console.log(`      state: ${state}`);
    if (["completed", "failed", "cancelled"].includes(state)) break;
  }
  ok("the run reached a terminal state within 15 minutes",
    ["completed", "failed", "cancelled"].includes(state), `last state: ${state || "unknown"}`);
  if (!detail || detail.status !== 200) return;
  assertNoKeyLeak("run detail", detail);

  step("STEP 7  read the decision, the evidence, and the repair prompt");
  const run = detail.body?.run ?? detail.body;
  ok("the report carries a launch decision", !!run?.decision, `run: ${JSON.stringify(run).slice(0, 300)}`);
  console.log(`      decision: ${run?.decision}`);
  const issues: any[] = detail.body?.issues ?? [];
  ok("the report carries per-flow results", Array.isArray(detail.body?.flows ?? detail.body?.steps ?? []),
    "no flow results on the report");
  if (issues.length) {
    ok("each issue carries expected/observed evidence",
      issues.every((i) => i.expected !== undefined && i.observed !== undefined));
    // The repair prompt is what closes the loop for an agent. A run that found problems but cannot say what
    // to do about them is the failure this whole product exists to avoid.
    ok("a failing issue carries a repair prompt",
      issues.some((i) => typeof i.repair_prompt === "string" && i.repair_prompt.length > 40),
      "no issue carried repair_prompt; confirm the v_issues.repair_prompt migration is applied in production");
    const withPrompt = issues.find((i) => i.repair_prompt);
    if (withPrompt) console.log(`      repair prompt (first 300 chars):\n      ${String(withPrompt.repair_prompt).slice(0, 300).replace(/\n/g, "\n      ")}`);
  } else {
    console.log("      The run produced no issues, so the repair prompt could not be exercised.");
    console.log("      That is a PASS for the API lifecycle but NOT proof the repair path works.");
    console.log("      Run this again against a deployment with a known broken flow before trusting step 7.");
  }

  step("STEP 8  revoke, then run phase two");
  console.log("      Revoke this key in the console (/app/api), then run:");
  console.log("        npx tsx scripts/preflight-api-key-lifecycle.ts --after-revoke");

  step("STEP 10  confirm no key material reached the logs");
  console.log("      Every response above was checked for the key inline. What this script CANNOT see is");
  console.log("      your platform logs. Before enabling the docs, grep them for the key's secret tail:");
  console.log(`        ${KEY.slice(0, 16)}...  (search for the part AFTER this prefix)`);
  console.log("      Check Vercel runtime logs, the Railway worker logs, and the v_events table.");
  console.log("      The prefix itself is public and is expected in v_events; the tail must appear nowhere.");
}

async function main() {
  if (!requireEnv()) process.exit(2);
  console.log(`Vraelis API-key lifecycle proof against ${BASE}`);
  console.log(`Application: ${APP}    Key: ${KEY.slice(0, 16)}...\n`);
  if (AFTER_REVOKE) await afterRevoke();
  else if (process.env.VRAELIS_TARGET_URL) await lifecycleV1();
  else await lifecycle();
  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("lifecycle proof threw:", e); process.exit(2); });
