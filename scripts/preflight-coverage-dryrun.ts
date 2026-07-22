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

  const r = await fetch(`${BASE}/v1/verifications`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY },
    body: JSON.stringify({ deployment_url: URL_, claim: CLAIM, dry_run: true }),
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

  ok("the response is marked dry_run", body?.dry_run === true);
  ok("nothing launched: there is no verification_id", body?.verification_id == null);
  ok("a coverage verdict came back", typeof body?.would_launch === "boolean");
  ok("claim coverage is reported", body?.coverage?.claim && typeof body.coverage.claim.ok === "boolean");
  ok("execution coverage is reported", body?.coverage?.execution && typeof body.coverage.execution.ok === "boolean");
  ok("would_launch equals both gates passing", body?.would_launch === (body?.coverage?.claim?.ok && body?.coverage?.execution?.ok));
  ok("a blocked plan carries a repair prompt; a ready plan does not",
    body?.would_launch ? body?.repair_prompt == null : typeof body?.repair_prompt === "string" && body.repair_prompt.length > 0);

  console.log("\n── what the deployment would do with this claim ──");
  console.log(`would_launch:        ${body?.would_launch}`);
  console.log(`requirements (${body?.requirements?.length ?? 0}):`);
  for (const req of body?.requirements ?? []) console.log(`  - ${req}`);
  console.log(`flows (${body?.flows?.length ?? 0}):`);
  for (const f of body?.flows ?? []) console.log(`  - ${f.name} (${f.steps} steps): ${f.goal}`);
  if (!body?.coverage?.claim?.ok || !body?.coverage?.execution?.ok) {
    console.log("gaps:");
    for (const g of body?.gaps ?? []) console.log(`  - ${g}`);
    console.log("\nrepair_prompt:\n" + (body?.repair_prompt ?? ""));
  }

  console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}  ${pass} passed, ${fail} failed`);
  return fail === 0;
}

main().then((okAll) => process.exit(okAll ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
