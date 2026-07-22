// Spend ONE paid verification and report the decision. This is the real product action, not a dry run: it
// launches a browser, holds credit, and settles. It refuses to run without an explicit approval flag, so a
// charge is never a surprise.
//
// Usage (cmd):
//   set VRAELIS_BASE_URL=https://app.vraelis.com/api
//   set VRAELIS_API_KEY=vr_live_<key with preflight:run:create scope + balance>
//   set VRAELIS_TARGET_URL=https://broken-checkout.vercel.app
//   set VRAELIS_CLAIM=A customer can upgrade to Pro receive access immediately and retain Pro after signing out and signing back in
//   npm run preflight:verify-run -- --i-approve-the-charge
//
// It POSTs /v1/verifications (no dry_run), then polls the status until a decision lands, and prints the
// decision, the observed failures (expected vs observed vs how to reproduce), per-flow evidence, and the
// repair prompt. No credential is ever printed.
export {};

const BASE = (process.env.VRAELIS_BASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.VRAELIS_API_KEY || "";
const URL_ = process.env.VRAELIS_TARGET_URL || "";
const CLAIM = process.env.VRAELIS_CLAIM
  || "A customer can upgrade to Pro, receive access immediately, and retain Pro after signing out and signing back in with the same account";
const APPROVED = process.argv.includes("--i-approve-the-charge");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function req(method: string, path: string, body?: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-api-key": KEY },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await r.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try { json = JSON.parse(raw); } catch { /* non-JSON is itself a finding */ }
  return { status: r.status, json, raw };
}

async function main(): Promise<boolean> {
  for (const [name, val] of [["VRAELIS_BASE_URL", BASE], ["VRAELIS_API_KEY", KEY], ["VRAELIS_TARGET_URL", URL_]] as const) {
    if (!val) { console.error(`Set ${name}.`); return false; }
  }
  if (!KEY.startsWith("vr_live_")) { console.error("VRAELIS_API_KEY does not look like a Vraelis key."); return false; }
  if (!APPROVED) {
    console.error("This SPENDS a paid verification (launches a browser and settles credit).");
    console.error("Re-run with --i-approve-the-charge once you are ready:");
    console.error("  npm run preflight:verify-run -- --i-approve-the-charge");
    return false;
  }

  console.log(`Claim:  ${CLAIM}`);
  console.log(`Target: ${URL_}\n`);
  console.log("Launching a paid verification...");
  const started = await req("POST", "/v1/verifications", { deployment_url: URL_, claim: CLAIM });

  if (started.status === 402) {
    console.error(`\nInsufficient balance (402): ${started.json?.error?.message ?? started.raw.slice(0, 300)}`);
    console.error("Top up credits, then re-run. Nothing was charged.");
    return false;
  }
  if (started.status === 422 && started.json?.error?.code === "claim_not_provable") {
    console.error("\nThe gate blocked this before spending (claim_not_provable). Run the dry run to see why.");
    return false;
  }
  const vid = started.json?.verification_id;
  if (!vid) {
    console.error(`\nLaunch failed (${started.status}): ${started.json?.error?.message ?? started.raw.slice(0, 400)}`);
    return false;
  }
  console.log(`Verification: ${vid}   state: ${started.json?.state}`);
  console.log("Requirements Vraelis is judging:");
  for (const r of started.json?.requirements ?? []) console.log(`  - ${r}`);
  console.log(`human_reviewed: ${started.json?.human_reviewed}\n`);

  // Poll the status until a decision lands. The browser run takes a couple of minutes; poll gently.
  const statusPath = started.json?.status_url || `/v1/verifications/${vid}`;
  let decision: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let final: any = null;
  const MAX = 60; // ~ up to 8 minutes at 8s
  for (let i = 0; i < MAX; i++) {
    await sleep(8000);
    const s = await req("GET", statusPath.startsWith("/") ? statusPath : `/${statusPath}`);
    const state = s.json?.state;
    process.stdout.write(`  [${i + 1}] state=${state} decision=${s.json?.decision ?? "-"}\n`);
    if (s.json?.decision) { decision = s.json.decision; final = s.json; break; }
    if (state && !["running", "queued", "pending"].includes(state) && s.json?.decision === undefined) { final = s.json; break; }
  }

  if (!decision) {
    console.error("\nNo decision within the polling window. Check the verification later at its status_url.");
    return false;
  }

  console.log(`\n════ DECISION: ${decision.toUpperCase()} ════`);
  if (final?.failures?.length) {
    console.log("\nWhat failed:");
    for (const f of final.failures) {
      console.log(`  - [${f.severity}] ${f.title}`);
      if (f.expected) console.log(`      expected:  ${f.expected}`);
      if (f.observed) console.log(`      observed:  ${f.observed}`);
      if (f.reproduce) console.log(`      reproduce: ${f.reproduce}`);
    }
  }
  if (final?.evidence?.length) {
    console.log("\nEvidence (per flow):");
    for (const e of final.evidence) console.log(`  - ${e.checking}: ${e.result}${e.failed_at_step ? ` (failed at step ${e.failed_at_step})` : ""}`);
  }
  if (final?.repair_prompt) {
    console.log("\nRepair prompt (feed this to the builder):\n" + final.repair_prompt);
  }
  console.log(`\nGuarantee checked: ${CLAIM}`);
  return true;
}

main().then((ok) => { process.exitCode = ok ? 0 : 1; }).catch((e) => { console.error(e); process.exitCode = 1; });
