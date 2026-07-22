// Prove the pre-run coverage gate against a DEPLOYED build, without spending a pass.
//
// dry_run: true runs synthesis + both coverage gates and returns would_launch, but never launches a browser,
// holds credit, or charges. So this is safe to run repeatedly: it is exactly the decision the paid path's
// gate would make, surfaced before any spend.
//
// Usage (PowerShell):
//   $env:VRAELIS_BASE_URL="https://app.vraelis.com/api"
//   $env:VRAELIS_API_KEY="vr_live_..."
//   $env:VRAELIS_TARGET_URL="https://<the deployed broken-checkout fixture>"
//   npm run preflight:coverage:dryrun
//
// VRAELIS_CLAIM overrides the default fixture claim. The script asserts, structurally, that a dry run
// launched nothing and returned a coverage verdict; it does not assert would_launch is true or false, because
// that is the deployment's answer to report, not ours to presume.
export {};

import { classifyStep, analyzeClaim, type StepLite } from "../lib/preflight/coverage";

// ── Human review of the installed journey ───────────────────────────────────────────────────────────────
// Prints the final corrected flow in execution order so a person can confirm it PROVES the claim (reaches
// checkout, asserts the exact value, signs out, signs back in with the same account, asserts the exact value
// again) rather than merely touching plausible pages. Credential material is never printed: fill VALUES are
// replaced with a safe placeholder, and navigate destinations are stripped of any query string.

// A fill value is never shown. Name the field by its role so the reviewer knows what would be typed, without
// the secret itself.
function safeFillNote(target: string): string {
  const f = target.toLowerCase();
  if (/pass|secret|token|cvv|card|ssn|security/.test(f)) return "«stored test account password»";
  if (/email|e-mail|user|login|account/.test(f)) return "«stored test account email»";
  return "«supplied value (hidden)»";
}
// Destinations are app paths; strip any query string so a token in a URL is never printed.
function safeDest(t: string): string { return (t || "").split("?")[0] || "/"; }

function printInstalledJourney(flows: { name?: string; steps_detail?: StepLite[] }[], claim: string) {
  const value = (analyzeClaim(claim).namedValues[0] || "").toLowerCase(); // e.g. "pro"
  const assertsValue = (s: StepLite) => s.action.startsWith("assert") && `${s.target ?? ""} ${s.expect ?? ""}`.toLowerCase().includes(value);
  const looksSuccess = (s: StepLite) => s.action.startsWith("assert") && /success|successful|thank|complete|confirmed/i.test(`${s.target ?? ""} ${s.expect ?? ""}`);

  for (const f of flows) {
    const steps = f.steps_detail ?? [];
    if (!steps.length) continue;
    const kinds = steps.map(classifyStep);
    const firstSignin = kinds.indexOf("signin");

    console.log(`\n── installed journey: ${f.name ?? "(unnamed)"} (${steps.length} steps, execution order) ──`);
    const weak: number[] = [];
    steps.forEach((s, i) => {
      const n = i + 1;
      const kind = kinds[i];
      // Obligation this step covers, derived from what it does and where it sits in the journey.
      let obligation = "-";
      if (kind === "purchase") obligation = i <= (kinds.indexOf("purchase")) ? "reach the Pro purchase path" : "complete checkout";
      else if (looksSuccess(s)) obligation = "confirm checkout success";
      else if (kind === "assert" && assertsValue(s)) obligation = firstSignin !== -1 && i > firstSignin ? `assert exact "${value}" retained after signing back in` : `assert exact "${value}" granted after checkout`;
      else if (kind === "assert") { obligation = "WEAK: generic assertion (not the exact value)"; weak.push(n); }
      else if (kind === "signout") obligation = "sign out (session boundary)";
      else if (kind === "signin") obligation = "sign back in with the same account";
      else if (kind === "navigate") obligation = /account|profile|settings/i.test(safeDest(s.target ?? "")) ? "open the account page" : "navigation";
      else if (s.action === "fill") obligation = "enter a form field";

      const identity = (kind === "signin" || kind === "signout" || s.action === "reset_context") ? "CHANGES identity/session"
        : s.action === "refresh" ? "reloads session" : "-";

      const dest = s.action === "navigate" ? `dest=${safeDest(s.target ?? "")}`
        : s.action === "fill" ? `field="${s.target ?? ""}" value=${safeFillNote(s.target ?? "")}`
        : s.target ? `target="${s.target}"` : "";
      const expect = s.expect ? ` expect="${s.expect}"` : "";
      console.log(`  ${String(n).padStart(2, "0")}  ${s.action.padEnd(12)} ${dest}${expect}`);
      console.log(`      obligation: ${obligation}    identity: ${identity}`);
    });

    // The authoritative YES/NO checklist is the VALIDATOR's (rendered by the caller from execution coverage).
    // Here we only flag generic-text assertions of the value, since those are the classic false-positive.
    if (weak.length) console.log(`  ⚠ step(s) ${weak.join(", ")} assert "${value}" as generic visible text, not the exact account-plan value.`);
  }
}

const BASE = (process.env.VRAELIS_BASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.VRAELIS_API_KEY || "";
const URL_ = process.env.VRAELIS_TARGET_URL || "";
const CLAIM = process.env.VRAELIS_CLAIM
  || "A customer can upgrade to Pro, receive access immediately, and retain Pro after signing out and signing back in with the same account";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = "") => {
  if (c) { pass++; console.log(`PASS  ${n}`); }
  else { fail++; console.log(`FAIL  ${n}${d ? `\n      ${d}` : ""}`); }
};

async function main(): Promise<boolean> {
  for (const [name, val] of [["VRAELIS_BASE_URL", BASE], ["VRAELIS_API_KEY", KEY], ["VRAELIS_TARGET_URL", URL_]] as const) {
    if (!val) { console.error(`Set ${name}.`); return false; }
  }
  if (!KEY.startsWith("vr_live_")) { console.error("VRAELIS_API_KEY does not look like a Vraelis key."); return false; }

  console.log(`Claim:  ${CLAIM}`);
  console.log(`Target: ${URL_}\n`);

  // Diagnostic mode on by default: this is an operator tool, and when a plan is Blocked we want to see WHY
  // flow correction did or did not help (how many flows the model proposed, how many survived validation, and
  // the reason each was dropped). Set VRAELIS_DIAGNOSTIC=0 for the lean response.
  const diagnostic = process.env.VRAELIS_DIAGNOSTIC !== "0";
  const r = await fetch(`${BASE}/v1/verifications`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY },
    body: JSON.stringify({ deployment_url: URL_, claim: CLAIM, dry_run: true, diagnostic }),
  });
  const raw = await r.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any = null;
  try { body = JSON.parse(raw); } catch { /* non-JSON body is itself a finding */ }

  // Synthesis can legitimately decline (unreachable deployment, claim not testable). That is a real answer,
  // not a script failure: report it and stop, without pretending the gate ran.
  if (r.status !== 200) {
    console.log(`\nThe deployment answered ${r.status}: ${body?.error?.code ?? "?"} — ${body?.error?.message ?? raw.slice(0, 300)}`);
    ok("a dry run never charges (no pass on a non-200 either)", r.status !== 402);
    return fail === 0 && r.status < 500;
  }

  const cov = body?.coverage ?? {};
  ok("the response is marked dry_run", body?.dry_run === true);
  ok("nothing launched: there is no verification_id", body?.verification_id == null);
  ok("a coverage verdict came back", typeof body?.would_launch === "boolean");
  ok("claim coverage is reported before and after correction", cov.claim_before && cov.claim_after && typeof cov.claim_after.ok === "boolean");
  ok("execution coverage is reported before and after correction", cov.execution_before && cov.execution_after && typeof cov.execution_after.ok === "boolean");
  ok("would_launch equals BOTH gates passing after correction", body?.would_launch === (cov.claim_after?.ok && cov.execution_after?.ok));
  ok("correction telemetry is present", typeof body?.requirement_correction_attempted === "boolean" && typeof body?.flow_correction_attempted === "boolean" && typeof body?.recrawl_attempted === "boolean");
  ok("a blocked plan carries a repair prompt and remaining obligations; a ready plan does not",
    body?.would_launch
      ? (body?.repair_prompt == null && (body?.remaining_obligations?.length ?? 0) === 0)
      : (typeof body?.repair_prompt === "string" && body.repair_prompt.length > 0 && (body?.remaining_obligations?.length ?? 0) > 0));

  const fmtFlows = (fs: { name: string; goal: string; steps: number }[]) => (fs ?? []).map((f) => `  - ${f.name} (${f.steps} steps): ${f.goal}`).join("\n") || "  (none)";
  console.log("\n── original plan (from synthesis, before correction) ──");
  console.log(`requirements (${body?.original_requirements?.length ?? 0}):`);
  for (const req of body?.original_requirements ?? []) console.log(`  - ${req}`);
  console.log(`flows:\n${fmtFlows(body?.original_flows)}`);
  console.log(`claim coverage:     ${cov.claim_before?.ok ? "PASS" : "FAIL"}`);
  console.log(`execution coverage: ${cov.execution_before?.ok ? "PASS" : "FAIL"}`);

  console.log("\n── bounded correction ──");
  console.log(`requirement correction attempted: ${body?.requirement_correction_attempted}`);
  console.log(`targeted recrawl attempted:       ${body?.recrawl_attempted}`);
  console.log(`flow correction attempted:        ${body?.flow_correction_attempted}`);
  if (body?.flow_correction) {
    const fcd = body.flow_correction;
    console.log(`  status:                         ${fcd.status}`);
    console.log(`  original flow count:            ${fcd.original_flow_count}`);
    console.log(`  candidate flow count (model):   ${fcd.candidate_flow_count}`);
    console.log(`  accepted flow count (valid):    ${fcd.accepted_flow_count}`);
    console.log(`  final flow count (in plan):     ${fcd.final_flow_count}`);
    if (fcd.rejected?.length) {
      console.log("  flows dropped by the validator:");
      for (const rj of fcd.rejected) console.log(`    - ${rj.name}: ${rj.reason}`);
    }
    // Map the diagnostic to the ONE explicit failure boundary, so there is no ambiguity about what happened.
    const boundary = (() => {
      const acc = fcd.accepted_flow_count, cand = fcd.candidate_flow_count;
      if (fcd.status === "model_call_failed") return "MODEL CALL FAILED (transport/timeout/4xx)";
      if (fcd.status === "no_result") return "CORRECTOR RETURNED NOTHING (no result object)";
      if (fcd.status === "no_content") return "MODEL RETURNED NO CONTENT";
      if (fcd.status === "parse_failed") return "MODEL RETURNED CONTENT BUT PARSING FAILED";
      if (fcd.status === "zero_flows") return "MODEL PARSED OK WITH ZERO FLOWS";
      if (cand > 0 && acc === 0) return "CANDIDATE FLOWS PRODUCED BUT ALL REJECTED BY VALIDATION";
      if (acc > 0 && fcd.final_flow_count === fcd.original_flow_count) return "FLOWS ACCEPTED BUT NOT INSTALLED (should not happen)";
      if (acc > 0 && cov.execution_after && !cov.execution_after.ok) return "FLOWS ACCEPTED AND INSTALLED BUT EXECUTION COVERAGE STILL FAILED";
      if (acc > 0 && cov.execution_after?.ok) return "FLOWS ACCEPTED, INSTALLED, EXECUTION COVERAGE PASSED";
      return "unclassified";
    })();
    console.log(`  >> FAILURE BOUNDARY: ${boundary}`);
  }

  if (body?.requirement_correction_attempted || body?.flow_correction_attempted) {
    console.log("\n── corrected plan ──");
    if (body?.corrected_requirements) { console.log(`requirements (${body.corrected_requirements.length}):`); for (const req of body.corrected_requirements) console.log(`  - ${req}`); }
    if (body?.corrected_flows) console.log(`flows:\n${fmtFlows(body.corrected_flows)}`);
    console.log(`claim coverage:     ${cov.claim_after?.ok ? "PASS" : "FAIL"}`);
    console.log(`execution coverage: ${cov.execution_after?.ok ? "PASS" : "FAIL"}`);
  }

  console.log(`\nwould_launch:  ${body?.would_launch}`);
  if (!body?.would_launch) {
    console.log(`blocked_reason: ${body?.blocked_reason}`);
    console.log("remaining obligations:");
    for (const g of body?.remaining_obligations ?? []) console.log(`  - ${g}`);
    console.log("\nrepair_prompt:\n" + (body?.repair_prompt ?? ""));
  }

  // The final human review before any paid run: print the INSTALLED flow step by step, then the AUTHORITATIVE
  // execution-coverage checklist (from the production validator, not re-derived here). Requires diagnostic
  // mode (default on), which returns steps_detail.
  const hasSteps = (body?.flows ?? []).some((f: { steps_detail?: unknown[] }) => (f.steps_detail?.length ?? 0) > 0);
  if (hasSteps) {
    console.log("\n════ FINAL REVIEW: the exact journey a paid run would execute ════");
    printInstalledJourney(body.flows, CLAIM);
  }
  // The validator's own checklist is the authority; the script only renders it.
  const checklist: { label: string; ok: boolean; required: boolean; weak?: boolean }[] = cov.execution_after?.checklist ?? [];
  if (checklist.length) {
    console.log("\n── execution contract checklist (from the production validator) ──");
    for (const c of checklist) {
      const mark = c.weak ? "WEAK" : c.ok ? "YES " : "NO  ";
      console.log(`  [${mark}] ${c.required ? "" : "(optional) "}${c.label}`);
    }
  }
  const journeyReady = body?.would_launch === true && !checklist.some((c) => (c.required && !c.ok) || c.weak);

  // SCRIPT integrity (did the dry run itself behave) is SEPARATE from JOURNEY readiness (is the plan good
  // enough to spend on). Never collapse them into a single ALL PASS: a clean script run on a plan that does
  // not prove the claim must not read as success.
  console.log("");
  console.log(`SCRIPT CHECKS: ${fail === 0 ? "PASS" : "FAIL"}  (${pass} passed, ${fail} failed)`);
  console.log(`JOURNEY REVIEW: ${journeyReady ? "READY — would_launch true" : "FAIL — would_launch false"}`);
  if (!journeyReady) console.log("Do NOT authorize a paid run: the plan does not yet prove the claim end to end.");
  else console.log("The journey proves the claim end to end. A paid run may be authorized (expect a legitimate failure on this broken fixture).");
  return fail === 0 && journeyReady;
}

// Set exitCode and let the event loop drain rather than process.exit(), which on Windows can abort with a
// libuv assertion (!(handle->flags & UV_HANDLE_CLOSING)) when a keep-alive fetch socket is still closing.
main().then((okAll) => { process.exitCode = okAll ? 0 : 1; }).catch((e) => { console.error(e); process.exitCode = 1; });
