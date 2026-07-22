// FREE smoke test of the reviewed-plan flow against a live deployment: dry-run MINT -> GET -> APPROVE -> GET.
// It never executes and never charges. It proves the two-step contract end to end: a plan is minted pending,
// can be read for review, is approved as a separate event, and reads back approved with a stable plan hash.
//
// Usage (PowerShell):
//   $env:VRAELIS_BASE_URL="https://app.vraelis.com/api"
//   $env:VRAELIS_API_KEY="vr_live_..."      # needs preflight:run:create (approve) + preflight:run:read (get)
//   $env:VRAELIS_TARGET_URL="https://broken-checkout.vercel.app"
//   npm run preflight:reviewed:smoke
//
// It prints the reviewed_plan_id so you can run the PAID execution separately, only when you choose to.
export {};

const BASE = (process.env.VRAELIS_BASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.VRAELIS_API_KEY || "";
const URL_ = process.env.VRAELIS_TARGET_URL || "";
const CLAIM = process.env.VRAELIS_CLAIM
  || "A customer can upgrade to Pro, receive access immediately, and retain Pro after signing out and signing back in with the same account";

async function req(method: string, path: string, body?: unknown) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", "x-api-key": KEY },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await r.text();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let json: any = null;
  try { json = JSON.parse(raw); } catch { /* non-JSON surfaced as-is */ }
  return { status: r.status, json, raw };
}

async function main(): Promise<boolean> {
  for (const [n, v] of [["VRAELIS_BASE_URL", BASE], ["VRAELIS_API_KEY", KEY], ["VRAELIS_TARGET_URL", URL_]] as const) {
    if (!v) { console.error(`Set ${n}.`); return false; }
  }
  console.log(`Claim:  ${CLAIM}`);
  console.log(`Target: ${URL_}\n`);

  // 1. MINT via a dry run. Nothing is launched or charged.
  console.log("1. Dry run (mint reviewed plan)...");
  const dry = await req("POST", "/v1/verifications", { deployment_url: URL_, claim: CLAIM, dry_run: true });
  if (dry.status !== 200) { console.error(`   dry run failed (${dry.status}): ${dry.json?.error?.message ?? dry.raw.slice(0, 300)}`); return false; }
  console.log(`   would_launch: ${dry.json?.would_launch}`);
  const id = dry.json?.reviewed_plan_id;
  if (!id) {
    console.error("   No reviewed_plan_id returned. Either would_launch was false (see remaining_obligations) or migration 18 is not applied.");
    if (dry.json?.remaining_obligations?.length) console.error(`   remaining: ${JSON.stringify(dry.json.remaining_obligations)}`);
    return false;
  }
  console.log(`   reviewed_plan_id: ${id}`);
  console.log(`   expires_at:       ${dry.json?.reviewed_plan_expires_at}`);

  // 2. READ it back for review (pending).
  console.log("\n2. Read the reviewed plan (should be pending)...");
  const g1 = await req("GET", `/v1/verifications/plans/${id}`);
  if (g1.status !== 200) { console.error(`   get failed (${g1.status}): ${g1.json?.error?.message ?? g1.raw.slice(0, 300)}`); return false; }
  console.log(`   approval_state:  ${g1.json?.approval_state}   execution_state: ${g1.json?.execution_state}`);
  console.log(`   plan_hash:       ${g1.json?.plan_hash}`);
  console.log(`   requirements:    ${(g1.json?.requirements ?? []).length}`);
  console.log(`   flows:           ${(g1.json?.flows ?? []).map((f: { name: string; steps: number }) => `${f.name} (${f.steps} steps)`).join(" | ")}`);

  // 3. APPROVE (a distinct event).
  console.log("\n3. Approve the reviewed plan...");
  const ap = await req("POST", `/v1/verifications/plans/${id}/approve`);
  if (ap.status !== 200) { console.error(`   approve failed (${ap.status}): ${ap.json?.error?.message ?? ap.raw.slice(0, 300)}`); return false; }
  console.log(`   approval_state:  ${ap.json?.approval_state}   already_approved: ${ap.json?.already_approved}`);

  // 3b. Approve AGAIN to prove idempotency.
  const ap2 = await req("POST", `/v1/verifications/plans/${id}/approve`);
  console.log(`   approve again -> already_approved: ${ap2.json?.already_approved} (idempotent)`);

  // 4. READ it back (approved).
  console.log("\n4. Read again (should be approved)...");
  const g2 = await req("GET", `/v1/verifications/plans/${id}`);
  console.log(`   approval_state:  ${g2.json?.approval_state}   approved_by: ${g2.json?.approved_by}`);
  const okState = g2.json?.approval_state === "approved" && g2.json?.execution_state === "unconsumed";

  console.log(`\n${okState ? "SMOKE OK" : "SMOKE FAILED"} — reviewed plan ${okState ? "minted, approved, unconsumed" : "did not reach the expected state"}.`);
  if (okState) {
    console.log("\nTo run the PAID execution of this exact approved plan (this WILL charge):");
    console.log(`  $env:VRAELIS_REVIEWED_PLAN_ID="${id}"`);
    console.log("  npm run preflight:verify-run -- --i-approve-the-charge");
  }
  return okState;
}

main().then((ok) => { process.exitCode = ok ? 0 : 1; }).catch((e) => { console.error(e); process.exitCode = 1; });
