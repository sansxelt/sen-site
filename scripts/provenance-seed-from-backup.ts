// GENERATE THE REHEARSAL SEED FROM THE PRODUCTION EXPORT.
//
// Three times in a row a hand-authored seed passed a check that production then failed, and each time the
// seed was wrong in exactly the place the check looked:
//
//   1. All 17 non-lane rows seeded as manual/user/approved. Production holds 16 discovery + 1 manual, so a
//      postflight assertion expecting 17 got 1.
//   2. All non-lane rows seeded approved=true. Production has 8 rows at review_state 'approved' with
//      approved=false, so validating chk_v_req_approved_matches_review_state failed.
//   3. (the same class, caught earlier) run_id typed uuid rather than text.
//
// A clone that differs from production where the assertion looks is not a rehearsal. It is a rehearsal-
// shaped thing that agrees with you. So the seed is no longer written by hand: it is DERIVED from
// ops/backups/backup-<stamp>.json, which is a read of production itself.
//
// What is preserved: every provenance column, approved, order_index, contract status, lane membership,
// and the run -> reviewed-plan bindings that define group A. The shape is exact.
//
// What is replaced: requirement text, claims, emails, URLs. Those are customer content and must not enter
// version control. Identity is replaced deterministically so the file is stable across regenerations.
//
// Usage:  npx tsx scripts/provenance-seed-from-backup.ts
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type Row = Record<string, unknown>;
const dir = join("ops", "backups");
const latest = readdirSync(dir).filter((f) => f.startsWith("backup-") && f.endsWith(".json")).sort().pop();
if (!latest) { console.error("No ops/backups/backup-*.json. Run npx tsx scripts/provenance-backup.ts first."); process.exit(1); }
const dump = JSON.parse(readFileSync(join(dir, latest), "utf8")) as Record<string, Row[]>;

const reqs = dump.v_contract_requirements ?? [];
const contracts = dump.v_production_contracts ?? [];
const apps = dump.v_applications ?? [];
const runs = dump.v_preflight_runs ?? [];
const plans = dump.v_reviewed_plans ?? [];
if (!apps.length) { console.error(`${latest} predates the structure capture. Re-run scripts/provenance-backup.ts.`); process.exit(1); }

// Deterministic synthetic identity, so regenerating produces an identical file and no real id, email or
// requirement text is ever written to disk here.
const ids = new Map<string, string>();
const synth = (real: unknown, tag: string): string => {
  const k = String(real);
  if (!ids.has(k)) {
    const n = ids.size + 1;
    // CANONICAL 8-4-4-4-12. Postgres accepts any hyphen placement on input as long as there are 32 hex
    // digits, so a malformed spelling inserts happily and then renders canonically on the way out. That
    // silently broke the group A join, which compares v_reviewed_plans.run_id (text, holding whatever
    // spelling was written) against v_preflight_runs.id::text (always canonical). Group A came back empty
    // and the rehearsal reported 136 legacy rows instead of 128.
    ids.set(k, `${tag}-0000-4000-8000-${String(n).padStart(12, "0")}`);
  }
  return ids.get(k)!;
};
const lit = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return `'${String(v).replace(/'/g, "''")}'`;
};


// The seed runs BEFORE migration 19 in the rehearsal, deliberately: proving 19 is inert on existing rows is
// one of the things being rehearsed. So the seed may only write columns that exist before 19. That is only
// honest if those columns are genuinely empty in production, so it is checked rather than assumed. If any
// ever holds a value, this aborts instead of silently seeding a clone that is missing data the checks read.
const POST_19 = ["review_basis", "approved_at", "reviewed_plan_id", "legacy_review_class", "review_identity"] as const;
const populated = POST_19.filter((c) => reqs.some((r) => r[c] !== null && r[c] !== undefined));
if (contracts.some((c) => c.legacy_approval_class !== null && c.legacy_approval_class !== undefined)) populated.push("legacy_approval_class" as never);
if (populated.length) {
  console.error(`ABORT: ${populated.join(", ")} now hold values in production.`);
  console.error("The seed writes pre-migration-19 columns only, so it would drop them. Either the correction");
  console.error("has already run, or the rehearsal must seed after migration 19. Do not proceed on a guess.");
  process.exit(1);
}

const laneApps = new Set(apps.filter((a) => a.builder === "vraelis_api").map((a) => String(a.id)));
const contractById = new Map(contracts.map((c) => [String(c.id), c]));
const isLaneContract = (cid: string) => {
  const c = contractById.get(cid);
  return !!c && laneApps.has(String(c.application_id));
};

const out: string[] = [
  "-- REHEARSAL SEED, GENERATED FROM A PRODUCTION EXPORT. DO NOT EDIT BY HAND.",
  "--",
  "-- Regenerate with: npx tsx scripts/provenance-seed-from-backup.ts",
  "--",
  "-- Hand-authored seeds passed three checks that production then failed, each time because the seed",
  "-- differed from production in exactly the place the check looked. This file is derived from a read of",
  "-- production instead, so the clone matches by construction rather than by my recollection.",
  "--",
  "-- Structure is exact: every provenance column, approved, order_index, contract status, lane membership,",
  "-- and the run to reviewed-plan bindings that define group A.",
  "-- Content is synthetic: requirement text, claims, emails and URLs are replaced. Those are customer data.",
  "",
  "begin;",
  "",
];

out.push("-- applications");
for (const a of apps) {
  out.push(`insert into v_applications (id, user_id, name, app_url, builder, ownership_confirmed) values (`
    + `${lit(synth(a.id, "aaaaaaaa"))}, 'owner@example.com', 'app', 'https://app.example', ${lit(a.builder)}, true);`);
}
out.push("", "-- contracts");
for (const c of contracts) {
  out.push(`insert into v_production_contracts (id, user_id, application_id, version, status, source_prompt, approved_at) values (`
    + `${lit(synth(c.id, "cccccccc"))}, 'owner@example.com', ${lit(synth(c.application_id, "aaaaaaaa"))}, ${lit(c.version)}, `
    + `${lit(c.status)}, 'synthetic claim', ${c.approved_at ? "now()" : "null"});`);
}
out.push("", "-- runs (only the columns the classification needs)");
for (const r of runs) {
  if (!r.contract_id) continue;
  out.push(`insert into v_preflight_runs (id, user_id, application_id, contract_id, state, decision) values (`
    + `${lit(synth(r.id, "11111111"))}, 'owner@example.com', `
    + `${lit(synth(contractById.get(String(r.contract_id))?.application_id ?? apps[0].id, "aaaaaaaa"))}, `
    + `${lit(synth(r.contract_id, "cccccccc"))}, 'completed', 'execution_passed');`);
}
out.push("", "-- reviewed plans: the run binding and approval state are what define group A");
for (const [i, p] of plans.entries()) {
  out.push(`insert into v_reviewed_plans (id, user_id, deployment_url, deployment_fp, claim, claim_fp, plan, plan_hash, coverage, approval_state, approved_by, approved_at, execution_state, run_id, expires_at) values (`
    + `'rvp_seed_${i}', 'owner@example.com', 'https://app.example', 'dfp_${i}', 'synthetic claim', 'cfp_${i}', `
    + `'{"requirements":[],"flows":[]}'::jsonb, 'hash_${i}', '{"ready":true}'::jsonb, ${lit(p.approval_state)}, `
    + `${p.approved_by ? "'reviewer@example.com'" : "null"}, ${p.approved_at ? "now() - interval '3 days'" : "null"}, `
    + `'consumed', ${p.run_id ? lit(synth(p.run_id, "11111111")) : "null"}, now() + interval '30 days');`);
}
out.push("", "-- requirements: every provenance column exactly as production holds it");
for (const [i, r] of reqs.entries()) {
  const lane = isLaneContract(String(r.contract_id));
  // Pre-migration-19 columns only; POST_19 is proven empty above.
  out.push(`insert into v_contract_requirements (id, contract_id, user_id, category, requirement, severity, enabled, source, origin, review_state, approved, approved_by, order_index) values (`
    + `${lit(synth(r.id, "22222222"))}, ${lit(synth(r.contract_id, "cccccccc"))}, 'owner@example.com', ${lit(r.category)}, `
    + `'${lane ? "lane" : "non-lane"} requirement ${i}', ${lit(r.severity)}, ${lit(r.enabled)}, `
    + `${lit(r.source)}, ${lit(r.origin)}, ${lit(r.review_state)}, ${lit(r.approved)}, `
    + `${r.approved_by ? "'reviewer@example.com'" : "null"}, ${lit(r.order_index)});`);
}
out.push("", "commit;", "");

writeFileSync(join("ops", "rehearsal", "seed-clone.sql"), out.join("\n"), "utf8");

const lane = reqs.filter((r) => isLaneContract(String(r.contract_id)));
const inconsistent = reqs.filter((r) => (r.approved === true) !== (r.review_state === "approved"));
const noBasis = reqs.filter((r) => r.review_state === "approved" && !r.review_basis);
console.log(`generated ops/rehearsal/seed-clone.sql from ${latest}`);
console.log(`  applications ${apps.length}   contracts ${contracts.length}   runs ${runs.length}   plans ${plans.length}`);
console.log(`  requirements ${reqs.length}   lane ${lane.length}   non-lane ${reqs.length - lane.length}`);
console.log(`  rows where approved disagrees with review_state: ${inconsistent.length}  (block validating chk_v_req_approved_matches_review_state)`);
console.log(`  approved rows with no review_basis:              ${noBasis.length}  (block validating chk_v_req_approved_has_basis)`);
