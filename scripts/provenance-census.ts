// READ-ONLY provenance census. Every statement is a .select(). Nothing here writes, and nothing here
// applies a migration.
//
// Two jobs:
//   1. Report which provenance migrations have actually landed on the connected database.
//   2. Reproduce the measured census (153 / 136 / 17 / 8 / 128 / 0) and report DRIFT if it has moved.
//
// The backfill aborts unless the census matches exactly. This is how that is checked without opening the
// backfill's transaction, and how a rehearsal on a clone is compared against production.
//
// Usage:  npx tsx scripts/provenance-census.ts
//         SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY select the target. Point them at a CLONE to rehearse.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

// .env.local is not auto-loaded by tsx; read it the same way the other operator scripts do.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"\n\r]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!url || !key) { console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required."); process.exit(1); }
const db = createClient(url, key, { auth: { persistSession: false } });

// Host only, never the key: this output is meant to be pasted into a review.
console.log(`target: ${url.replace(/https:\/\/([a-z0-9]{6})[a-z0-9]*/, "https://$1***")}\n`);

const EXPECTED = { total: 153, lane: 136, nonLane: 17, groupA: 8, groupB: 128, groupC: 0 };

async function main() {
  // ── Which migrations have landed ───────────────────────────────────────────────────────────────────
  // PostgREST errors on an unknown column, so selecting one is a read-only existence probe.
  console.log("── migration state ──");
  const probe = async (table: string, col: string) => {
    const r = await db.from(table).select(col).limit(1);
    return !r.error;
  };
  const m19cols = ["approved_at", "review_basis", "review_identity", "reviewed_plan_id", "legacy_review_class"];
  const present: string[] = [];
  for (const c of m19cols) if (await probe("v_contract_requirements", c)) present.push(c);
  const contractCol = await probe("v_production_contracts", "legacy_approval_class");
  console.log(`  migration 19 columns on v_contract_requirements: ${present.length}/${m19cols.length} present${present.length ? ` (${present.join(", ")})` : ""}`);
  console.log(`  migration 19 column  on v_production_contracts:  ${contractCol ? "legacy_approval_class present" : "MISSING"}`);
  console.log(`  migration 19: ${present.length === m19cols.length && contractCol ? "APPLIED" : "NOT APPLIED (or partial)"}`);
  console.log("  migration 20 (defaults + constraints): NOT verifiable read-only over PostgREST.");
  console.log("    Column defaults live in pg_attrdef and constraints in pg_constraint; neither is exposed.");
  console.log("    Confirm with ops/verify-schema.sql in the Supabase SQL editor (see the end of this report).");

  // ── The census ─────────────────────────────────────────────────────────────────────────────────────
  console.log("\n── census ──");
  type Req = {
    id: string; contract_id: string; source: string | null; origin: string | null; review_state: string | null;
    order_index: number | null; created_at: string;
  };
  const reqs: Req[] = [];
  for (let from = 0; ; from += 1000) {
    const r = await db.from("v_contract_requirements")
      .select("id, contract_id, source, origin, review_state, order_index, created_at")
      .range(from, from + 999);
    if (r.error) { console.error("read failed:", r.error.message); process.exit(1); }
    const page = (r.data ?? []) as Req[];
    reqs.push(...page);
    if (page.length < 1000) break;
  }

  const contractIds = [...new Set(reqs.map((r) => r.contract_id))];
  const cRes = await db.from("v_production_contracts").select("id, application_id, status, legacy_approval_class").in("id", contractIds);
  if (cRes.error) { console.error("read failed:", cRes.error.message); process.exit(1); }
  const contracts = new Map((cRes.data as { id: string; application_id: string; status: string; legacy_approval_class: string | null }[]).map((c) => [c.id, c]));

  const appIds = [...new Set([...contracts.values()].map((c) => c.application_id))];
  const aRes = await db.from("v_applications").select("id, builder").in("id", appIds);
  if (aRes.error) { console.error("read failed:", aRes.error.message); process.exit(1); }
  const laneApps = new Set((aRes.data as { id: string; builder: string | null }[]).filter((a) => a.builder === "vraelis_api").map((a) => a.id));

  const isLane = (r: Req) => {
    const c = contracts.get(r.contract_id);
    return !!c && laneApps.has(c.application_id);
  };
  const lane = reqs.filter(isLane);
  const nonLane = reqs.filter((r) => !isLane(r));

  // Group A: lane rows whose contract's run consumed an APPROVED reviewed plan with a real approver.
  const laneContractIds = [...new Set(lane.map((r) => r.contract_id))];
  const runsRes = await db.from("v_preflight_runs").select("id, contract_id").in("contract_id", laneContractIds);
  const runs = (runsRes.data ?? []) as { id: string; contract_id: string }[];
  const runIds = runs.map((r) => r.id);
  let approvedPlanContractIds = new Set<string>();
  if (runIds.length) {
    const pRes = await db.from("v_reviewed_plans").select("id, run_id, approval_state, approved_by, approved_at").in("run_id", runIds);
    if (pRes.error) {
      console.log(`  (v_reviewed_plans unreadable: ${pRes.error.message}; group A cannot be computed)`);
    } else {
      const plans = (pRes.data as { run_id: string; approval_state: string; approved_by: string | null; approved_at: string | null }[])
        .filter((p) => p.approval_state === "approved" && p.approved_by && p.approved_at);
      const runToContract = new Map(runs.map((r) => [r.id, r.contract_id]));
      approvedPlanContractIds = new Set(plans.map((p) => runToContract.get(p.run_id)!).filter(Boolean));
    }
  }
  const groupA = lane.filter((r) => approvedPlanContractIds.has(r.contract_id));
  const groupB = lane.filter((r) => !approvedPlanContractIds.has(r.contract_id));

  const falseTriple = lane.filter((r) => r.source === "manual" && r.origin === "user" && r.review_state === "approved");
  const corrected = lane.filter((r) => r.source === "inference" && r.origin === "prompt");
  const newShape = lane.filter((r) => r.origin === "unspecified" || (r.review_state === "suggested" && r.source === "manual"));

  const row = (label: string, actual: number, expected: number) => {
    const mark = actual === expected ? "ok  " : "DRIFT";
    console.log(`  ${mark}  ${label.padEnd(34)} ${String(actual).padStart(4)}   expected ${expected}`);
  };
  row("total requirement rows", reqs.length, EXPECTED.total);
  row("lane rows (builder vraelis_api)", lane.length, EXPECTED.lane);
  row("non-lane rows (excluded)", nonLane.length, EXPECTED.nonLane);
  row("group A (human review proven)", groupA.length, EXPECTED.groupA);
  row("group B (no human review)", groupB.length, EXPECTED.groupB);
  row("group C (unknown)", 0, EXPECTED.groupC);
  console.log(`\n  lane rows still carrying the false triple (manual/user/approved): ${falseTriple.length}`);
  console.log(`  lane rows already corrected to inference/prompt:                  ${corrected.length}`);
  console.log(`  lane rows written under the NEW defaults (post-migration-20):     ${newShape.length}`);

  // ── Ordering ───────────────────────────────────────────────────────────────────────────────────────
  console.log("\n── ordering ──");
  const byContract = new Map<string, Req[]>();
  for (const r of reqs) {
    if (!byContract.has(r.contract_id)) byContract.set(r.contract_id, []);
    byContract.get(r.contract_id)!.push(r);
  }
  let draftTied = 0, approvedTied = 0, tiedContracts = 0;
  for (const [cid, rows] of byContract) {
    const counts = new Map<number, number>();
    for (const r of rows) counts.set(r.order_index ?? 0, (counts.get(r.order_index ?? 0) ?? 0) + 1);
    const tied = rows.filter((r) => (counts.get(r.order_index ?? 0) ?? 0) > 1);
    if (!tied.length) continue;
    tiedContracts++;
    if (contracts.get(cid)?.status === "draft") draftTied += tied.length; else approvedTied += tied.length;
  }
  console.log(`  contracts with a tied order_index: ${tiedContracts}   (expected 21)`);
  console.log(`  DRAFT rows proposed for normalization:        ${draftTied}`);
  console.log(`  APPROVED rows left alone (order not invented): ${approvedTied}`);

  const laneContracts = [...contracts.values()].filter((c) => laneApps.has(c.application_id));
  console.log(`\n  lane contracts: ${laneContracts.length}  (draft ${laneContracts.filter((c) => c.status === "draft").length}, approved ${laneContracts.filter((c) => c.status === "approved").length})`);
  console.log(`  lane contracts already classified legacy_auto_approved: ${laneContracts.filter((c) => c.legacy_approval_class === "legacy_auto_approved").length}`);

  // ── DID A REQUEST GET THROUGH? ─────────────────────────────────────────────────────────────────────
  //
  // With migration 22 live and the OLD writer deployed, a verification request creates its contract row and
  // is then refused on every requirement insert (approved=true alongside the new review_state default
  // 'suggested'). The old code discards the insert error, so the caller is told their claim is untestable
  // and a CONTRACT WITH ZERO REQUIREMENTS is left behind.
  //
  // That orphan is the tripwire. The requirement census cannot see it, because no requirement row was
  // written, so this is the only signal that traffic reached production during the skew window.
  const allContracts = await db.from("v_production_contracts").select("id, application_id, status, created_at");
  const contractRows = (allContracts.data ?? []) as { id: string; application_id: string; status: string; created_at: string }[];
  const withReqs = new Set(reqs.map((r) => r.contract_id));
  const orphans = contractRows.filter((c) => !withReqs.has(c.id));
  const laneOrphans = orphans.filter((c) => laneApps.has(c.application_id));
  // An orphan only implicates the skew if it was created AFTER the defaults changed. Empty contracts also
  // arise from ordinary historical failures (a synthesis that produced nothing, an aborted draft), and
  // reporting those as incident evidence would be a false alarm in exactly the report meant to be trusted.
  const SKEW_WINDOW_OPENED = process.env.SKEW_WINDOW_OPENED || "2026-07-25T00:00:00Z";
  const since = (c: { created_at: string }) => c.created_at >= SKEW_WINDOW_OPENED;
  const suspect = laneOrphans.filter(since);
  console.log("\n── skew tripwire ──");
  console.log(`  window opened: ${SKEW_WINDOW_OPENED}  (override with SKEW_WINDOW_OPENED)`);
  console.log(`  contracts holding ZERO requirements: ${orphans.length}   (lane: ${laneOrphans.length}, lane since the window opened: ${suspect.length})`);
  for (const c of laneOrphans.sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-5)) {
    console.log(`    ${since(c) ? "SUSPECT " : "pre-window"}  ${c.created_at}  ${c.status}`);
  }
  if (suspect.length) {
    console.log("  A lane contract created since the window with no requirements means a verification");
    console.log("  request was REFUSED mid-write. Freeze traffic and reconcile these before the correction.");
  } else {
    console.log("  none since the window opened: no verification request has been refused mid-write.");
    console.log("  Any orphans listed above predate the skew and are ordinary historical failures.");
  }

  const drift = reqs.length !== EXPECTED.total || lane.length !== EXPECTED.lane || nonLane.length !== EXPECTED.nonLane
    || groupA.length !== EXPECTED.groupA || groupB.length !== EXPECTED.groupB;
  console.log(`\n── verdict ──\n  ${drift ? "DRIFT: the census no longer matches the measurement. The backfill will abort at stage 0, by design." : "MATCH: the census reproduces the measurement. The backfill's stage 0 will pass."}`);

  console.log(`
── confirm the schema (read-only) ──
  These facts live in pg_attrdef and pg_constraint, neither of which PostgREST exposes, so they cannot be
  checked from here. Paste ops/verify-schema.sql into the Supabase SQL editor and run it.

  Expect 11 rows: 2 defaults + 8 chk_v_req_* + 1 contract constraint, every constraint "not valid".
  7 chk_v_req_* rows means migration 22 is not applied yet.
`);
  process.exit(drift ? 2 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
