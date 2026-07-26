// THE REHEARSAL. Runs the entire provenance rollout against a throwaway Postgres, start to finish, and
// fails loudly if any stage does not do exactly what the runbook says it does.
//
// It uses a real embedded Postgres, not a simulation, because the things most likely to go wrong are
// precisely the things a simulation fakes: NOT VALID constraint timing, DO blocks, transaction boundaries,
// window functions. The first run of this file found a genuine defect (an authorship-only UPDATE aborting
// the transaction on chk_v_req_approved_has_basis) that no amount of reading the SQL had surfaced.
//
// Sequence, mirroring ops/ROLLOUT.md exactly:
//   1. base schema + migration 2                      (the world before this work)
//   2. seed to the measured census                    (153/136/17/8/128/0, 21 tied contracts)
//   3. migration 19                                   additive, inert
//   4. migration 20                                   defaults + NOT VALID constraints
//   5. constraint proof                               invalid writes rejected, valid writes accepted
//   6. ops/provenance-correction-MANUAL.sql           stage by stage, with counts between
//   7. postflight                                     every count 0, every invariant held
//   8. rollback proof                                 the correction fully reverses
//
// Run: npx tsx ops/rehearsal/rehearse.ts
import EmbeddedPostgres from "embedded-postgres";
import { readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const ROOT = process.cwd();
const DATA_DIR = join(tmpdir(), "vraelis-provenance-rehearsal");
const PORT = 54999;

let pass = 0, fail = 0;
const log: string[] = [];
function say(s = "") { console.log(s); log.push(s); }
function ok(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; say(`  PASS  ${name}`); }
  else { fail++; say(`  FAIL  ${name}${detail ? `   (${detail})` : ""}`); }
}
const sql = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

// The correction is one file with numbered stages. Splitting on the stage banners lets the rehearsal run it
// the way an operator does: a stage at a time, reading counts in between, and never auto-committing.
function stagesOf(src: string): { title: string; body: string }[] {
  const parts = src.split(/^-- ══ (STAGE \d+[^═]*?) ═+$/m);
  const out: { title: string; body: string }[] = [];
  for (let i = 1; i < parts.length; i += 2) out.push({ title: parts[i].trim(), body: parts[i + 1] });
  return out;
}

async function main() {
  try { rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* first run */ }
  mkdirSync(DATA_DIR, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR, user: "rehearsal", password: "rehearsal",
    port: PORT, persistent: false, createPostgresUser: false,
  });

  say("── standing up a throwaway Postgres ──");
  await pg.initialise();
  await pg.start();

  // UTF8 explicitly. initdb picks the host locale, which on this machine is WIN1252, and every SQL file in
  // this repo uses box-drawing characters in its section banners. A WIN1252 database rejects them outright,
  // which would fail the rehearsal for a reason that has nothing to do with the migration.
  const admin = pg.getPgClient();
  await admin.connect();
  await admin.query("create database clone with encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'");
  // Kept open: section 7c needs a second, independently seeded clone.
  const admin2 = admin;

  const db = pg.getPgClient("clone");
  await db.connect();
  const v = await db.query("select version()");
  say(`  ${String(v.rows[0].version).split(",")[0]}`);
  say(`  data dir: ${DATA_DIR}  (destroyed on exit)`);

  type Row = Record<string, unknown>;
  const q = async (text: string): Promise<Row[]> => (await db.query(text)).rows as Row[];
  const one = async (text: string) => Number((await q(text))[0]?.count ?? 0);
  const count = async (where: string) => Number((await q(`select count(*)::int as count from ${where}`))[0].count);

  try {
    // ── 1. THE WORLD BEFORE THIS WORK ───────────────────────────────────────────────────────────────
    say("\n── 1. base schema + migration 2 (the defect as it shipped) ──");
    await db.query('create extension if not exists pgcrypto');
    await db.query(sql("sql/vraelis-preflight.sql"));
    await db.query(sql("sql/vraelis-preflight-2-discovery.sql"));
    await db.query(sql("sql/vraelis-preflight-18-reviewed-plans.sql"));
    const defaults0 = await q(`select column_name, column_default from information_schema.columns
      where table_name='v_contract_requirements' and column_name in ('origin','review_state') order by column_name`);
    say(`  origin default       = ${defaults0.find((r) => r.column_name === "origin")?.column_default}`);
    say(`  review_state default = ${defaults0.find((r) => r.column_name === "review_state")?.column_default}`);
    ok("the shipped defaults assert human authorship and human approval",
      /'user'/.test(String(defaults0.find((r) => r.column_name === "origin")?.column_default))
      && /'approved'/.test(String(defaults0.find((r) => r.column_name === "review_state")?.column_default)),
      "this is the mechanism that produced 136 false rows");

    // ── 2. SEED TO THE MEASURED CENSUS ──────────────────────────────────────────────────────────────
    say("\n── 2. seed the clone to production's measured shape ──");
    await db.query(sql("ops/rehearsal/seed-clone.sql"));
    const LANE = `v_contract_requirements r
      join v_production_contracts c on c.id = r.contract_id
      join v_applications a on a.id = c.application_id
      where a.builder = 'vraelis_api'`;
    const total = await count("v_contract_requirements");
    const lane = await count(LANE);
    const nonLane = total - lane;
    const groupA = await count(`${LANE} and exists (
        select 1 from v_preflight_runs run join v_reviewed_plans p on p.run_id = run.id::text
         where run.contract_id = r.contract_id and p.approval_state='approved'
           and p.approved_by is not null and p.approved_at is not null)`);
    const groupB = lane - groupA;
    const falseTriple = await count(`${LANE} and r.source='manual' and r.origin='user' and r.review_state='approved'`);
    say(`  total ${total}   lane ${lane}   non-lane ${nonLane}   A ${groupA}   B ${groupB}   false-triple ${falseTriple}`);
    ok("the clone reproduces the measured census exactly",
      total === 153 && lane === 136 && nonLane === 17 && groupA === 8 && groupB === 128,
      `${total}/${lane}/${nonLane}/${groupA}/${groupB}`);
    ok("every lane row carries the false triple, as production does", falseTriple === 136);

    const tiedContracts = await one(`select count(*)::int as count from (
      select contract_id from v_contract_requirements group by contract_id, order_index having count(*) > 1) t`);
    const tiedDraft = await count(`v_contract_requirements r join v_production_contracts c on c.id=r.contract_id
      where c.status='draft' and exists (select 1 from v_contract_requirements x
        where x.contract_id=r.contract_id and x.order_index=r.order_index and x.id<>r.id)`);
    const tiedApproved = await count(`v_contract_requirements r join v_production_contracts c on c.id=r.contract_id
      where c.status='approved' and exists (select 1 from v_contract_requirements x
        where x.contract_id=r.contract_id and x.order_index=r.order_index and x.id<>r.id)`);
    say(`  tied contracts ${tiedContracts}   tied draft rows ${tiedDraft}   tied approved rows ${tiedApproved}`);

    // Snapshots of everything the correction must NOT alter, taken before it runs.
    const textBefore = JSON.stringify((await q("select id, requirement from v_contract_requirements order by id")));
    const plansBefore = JSON.stringify((await q("select id, plan_hash, approval_state, approved_by, approved_at, plan from v_reviewed_plans order by id")));
    ok("the ordering damage matches production", tiedContracts === 21 && tiedDraft === 5 && tiedApproved === 147,
      `${tiedContracts}/${tiedDraft}/${tiedApproved}`);

    // ── 3. MIGRATION 19 ─────────────────────────────────────────────────────────────────────────────
    say("\n── 3. migration 19: additive, inert ──");
    const before19 = await q("select id, source, origin, review_state, approved from v_contract_requirements order by id");
    await db.query(sql("sql/vraelis-preflight-19-requirement-provenance.sql"));
    const after19 = await q("select id, source, origin, review_state, approved from v_contract_requirements order by id");
    ok("migration 19 changes no existing row", JSON.stringify(before19) === JSON.stringify(after19));
    const cols = await q(`select column_name from information_schema.columns
      where table_name='v_contract_requirements' and column_name in
      ('approved_at','review_basis','review_identity','reviewed_plan_id','legacy_review_class')`);
    ok("migration 19 adds all five requirement columns", cols.length === 5, `${cols.length}/5`);
    const cc = await q(`select column_name from information_schema.columns
      where table_name='v_production_contracts' and column_name='legacy_approval_class'`);
    ok("migration 19 adds the contract classification column", cc.length === 1);
    const d19 = await q(`select column_default from information_schema.columns
      where table_name='v_contract_requirements' and column_name='review_state'`);
    ok("migration 19 does NOT change the defaults (that is migration 20's job)",
      /'approved'/.test(String(d19[0].column_default)));

    // ── 4. MIGRATION 20 ─────────────────────────────────────────────────────────────────────────────
    say("\n── 4. migration 20: defaults + NOT VALID constraints ──");
    await db.query(sql("sql/vraelis-preflight-20-provenance-defaults.sql"));
    const d20 = await q(`select column_name, column_default from information_schema.columns
      where table_name='v_contract_requirements' and column_name in ('origin','review_state') order by column_name`);
    say(`  origin default       = ${d20.find((r) => r.column_name === "origin")?.column_default}`);
    say(`  review_state default = ${d20.find((r) => r.column_name === "review_state")?.column_default}`);
    ok("the defaults now claim nothing",
      /'unspecified'/.test(String(d20.find((r) => r.column_name === "origin")?.column_default))
      && /'suggested'/.test(String(d20.find((r) => r.column_name === "review_state")?.column_default)));
    const cons = await q(`select conname, convalidated from pg_constraint
      where conrelid='v_contract_requirements'::regclass and conname like 'chk_v_req_%' order by conname`);
    say(`  constraints: ${cons.map((c) => c.conname).join(", ")}`);
    ok("all seven requirement constraints exist", cons.length === 7, `${cons.length}/7`);
    ok("every one is NOT VALID, so history is grandfathered and the future is bound",
      cons.every((c) => c.convalidated === false));
    ok("migration 20 rewrites no row", await count(`${LANE} and r.source='manual' and r.origin='user'`) === 136);

    // ── 4b. THE HOLE MIGRATION 20 LEFT, AND MIGRATION 22 CLOSING IT ────────────────────────────────
    say("\n── 4b. migration 22: approved must mean what review_state says ──");
    const anyC = String((await q("select id from v_production_contracts limit 1"))[0].id);
    const skewRow = async () => {
      try {
        await db.query(`insert into v_contract_requirements (contract_id, user_id, category, requirement, approved, review_state)
                        values ('${anyC}', 'owner@example.com', 'auth', 'skew probe', true, 'suggested')`);
        return true;
      } catch { return false; }
    };
    const acceptedBefore = await skewRow();
    ok("BEFORE 22: migration 20 accepts approved=true with review_state=suggested",
      acceptedBefore, "this is exactly what old main writes against the new defaults");
    await db.query("delete from v_contract_requirements where requirement = 'skew probe'");

    await db.query(sql("sql/vraelis-preflight-22-approved-review-state-consistency.sql"));
    const acceptedAfter = await skewRow();
    ok("AFTER 22: the contradictory row is REJECTED", !acceptedAfter);
    await db.query("delete from v_contract_requirements where requirement = 'skew probe'");
    const c22 = await q(`select convalidated from pg_constraint
      where conrelid='v_contract_requirements'::regclass and conname='chk_v_req_approved_matches_review_state'`);
    ok("migration 22's constraint exists and is NOT VALID", c22.length === 1 && c22[0].convalidated === false);
    ok("migration 22 rewrites no row", await count("v_contract_requirements") === 153);

    // ── 5. CONSTRAINT PROOF ─────────────────────────────────────────────────────────────────────────
    say("\n── 5. constraints reject the defect and accept the correct shapes ──");
    const anyContract = (await q("select id from v_production_contracts limit 1"))[0].id;
    const tryWrite = async (label: string, cols: string, vals: string) => {
      try {
        await db.query(`insert into v_contract_requirements (contract_id, user_id, category, requirement, ${cols})
                        values ('${anyContract}', 'owner@example.com', 'auth', 'probe', ${vals})`);
        return { rejected: false, why: "" };
      } catch (e) { return { rejected: true, why: String((e as { constraint?: string }).constraint ?? e) }; }
    };
    let r = await tryWrite("approved with no reviewer", "review_state", "'approved'");
    ok("an approved row with no basis is REJECTED", r.rejected, r.why);
    r = await tryWrite("approved with basis but no reviewer", "review_state, review_basis", "'approved', 'human_direct'");
    ok("an approved row naming a basis but no reviewer is REJECTED", r.rejected, r.why);
    r = await tryWrite("suggested carrying a reviewer", "review_state, approved_by, approved_at", "'suggested', 'x@y.com', now()");
    ok("a suggested row carrying approval provenance is REJECTED", r.rejected, r.why);
    r = await tryWrite("invalid origin", "origin", "'somebody_made_this_up'");
    ok("an origin outside the closed set is REJECTED", r.rejected, r.why);
    r = await tryWrite("invalid review_state", "review_state", "'auto_approved'");
    ok("review_state 'auto_approved' is REJECTED (it is not a review outcome)", r.rejected, r.why);
    r = await tryWrite("invalid legacy class", "legacy_review_class", "'whatever'");
    ok("an unknown legacy classification is REJECTED", r.rejected, r.why);

    r = await tryWrite("the generated lane shape", "source, origin, review_state", "'inference', 'prompt', 'suggested'");
    ok("the DIRECT LANE shape is ACCEPTED (inference / prompt / suggested)", !r.rejected, r.why);
    r = await tryWrite("the human-authored shape", "source, origin, review_state", "'manual', 'user', 'suggested'");
    ok("the DASHBOARD shape is ACCEPTED (manual / user / suggested)", !r.rejected, r.why);
    // `approved` must be set alongside review_state. Migration 22 is what makes that mandatory, and the
    // first version of these two probes omitted it and was correctly rejected: a row claiming review_state
    // 'approved' while approved stayed at its false default is precisely the skew 22 exists to forbid.
    r = await tryWrite("a complete human approval",
      "source, origin, review_state, approved, review_basis, approved_by, approved_at, review_identity",
      "'manual', 'user', 'approved', true, 'human_direct', 'reviewer@example.com', now(), 'identity'");
    ok("a COMPLETE human approval is ACCEPTED", !r.rejected, r.why);
    r = await tryWrite("a complete reviewed-plan approval",
      "source, origin, review_state, approved, review_basis, approved_by, approved_at, reviewed_plan_id",
      "'inference', 'prompt', 'approved', true, 'reviewed_plan', 'reviewer@example.com', now(), 'rvp_groupa'");
    ok("a COMPLETE reviewed-plan approval is ACCEPTED", !r.rejected, r.why);

    // Both directions of the skew migration 22 closes.
    r = await tryWrite("approved review_state with approved=false",
      "source, origin, review_state, approved, review_basis, approved_by, approved_at",
      "'manual', 'user', 'approved', false, 'human_direct', 'reviewer@example.com', now()");
    ok("review_state approved with approved=false is REJECTED", r.rejected, r.why);
    r = await tryWrite("approved=true with a suggested review_state",
      "source, origin, review_state, approved", "'inference', 'prompt', 'suggested', true");
    ok("approved=true with review_state suggested is REJECTED (what old main writes)", r.rejected, r.why);

    // The probes that succeeded are not part of the census; remove them before the correction.
    const probes = await db.query("delete from v_contract_requirements where requirement = 'probe'");
    say(`  removed ${probes.rowCount} accepted probe rows before correcting`);
    ok("the census is intact after the constraint probes", await count("v_contract_requirements") === 153);

    // ── 6. THE CORRECTION, STAGE BY STAGE ───────────────────────────────────────────────────────────
    say("\n── 6. ops/provenance-correction-MANUAL.sql, one stage at a time ──");
    const src = sql("ops/provenance-correction-MANUAL.sql");
    ok("the correction never commits itself", !/^\s*commit;/m.test(src));
    const stages = stagesOf(src);
    say(`  parsed ${stages.length} stages: ${stages.map((s) => s.title.split(".")[0]).join(", ")}`);

    await db.query("begin");
    // Stage 0 creates the temporary views the later stages select from; run its DDL, skip its report SELECTs.
    for (const s of stages) {
      const label = s.title.split(".").slice(0, 2).join(".").trim();
      // Strip the operator-facing report SELECTs; keep every DDL and DML statement.
      const body = s.body
        .split(/;\s*(?:\r?\n)/)
        .filter((stmt) => {
          const t = stmt.replace(/--[^\n]*/g, "").trim().toLowerCase();
          if (!t) return false;
          return !(t.startsWith("select") && !t.startsWith("select 'metric'"));
        })
        .join(";\n") + ";";
      if (!body.replace(/--[^\n]*/g, "").trim().replace(/;/g, "")) { say(`  ${label}: report only`); continue; }
      const before = await count("v_contract_requirements");
      await db.query(body);
      const after = await count("v_contract_requirements");
      say(`  ${label}: applied   (rows ${before} -> ${after})`);
    }

    const aFixed = await count(`${LANE} and r.review_basis='reviewed_plan' and r.review_state='approved'`);
    const bFixed = await count(`${LANE} and r.legacy_review_class='legacy_auto_approved' and r.review_state='suggested'`);
    const authorship = await count(`${LANE} and r.source='inference' and r.origin='prompt'`);
    say(`  group A corrected ${aFixed}   group B corrected ${bFixed}   authorship corrected ${authorship}`);
    ok("136 authorship corrections", authorship === 136, String(authorship));
    ok("8 exact reviewed-plan approvals", aFixed === 8, String(aFixed));
    ok("128 legacy auto-approved rows", bFixed === 128, String(bFixed));

    // ── 7. POSTFLIGHT ───────────────────────────────────────────────────────────────────────────────
    say("\n── 7. postflight, inside the open transaction ──");
    ok("zero lane rows still claim human authorship",
      await count(`${LANE} and (r.source='manual' or r.origin='user')`) === 0);
    ok("zero approved rows without a named reviewer",
      await count("v_contract_requirements r where r.review_state='approved' and r.review_basis is not null and (r.approved_by is null or r.approved_at is null)") === 0);
    ok("zero unapproved rows carrying reviewer provenance",
      await count(`${LANE} and r.review_state<>'approved' and (r.approved_by is not null or r.approved_at is not null or r.review_basis is not null)`) === 0);
    ok("zero unknown rows: A + B accounts for every lane row", aFixed + bFixed === 136);

    // UNTOUCHED means untouched, not "has a particular shape". The 17 are two populations: 16 discovery
    // suggestions a person approved, and 1 hand-typed row. An earlier version of this check counted
    // manual/user/approved and expected 17; it passed here only because the seed wrongly made all 17 that
    // shape, and it failed against production, which answered 1.
    const NONLANE = `v_contract_requirements r
      where not exists (select 1 from v_production_contracts c join v_applications a on a.id=c.application_id
                         where c.id=r.contract_id and a.builder='vraelis_api')`;
    ok("17 non-lane rows still exist", await count(NONLANE) === 17);
    ok("and the correction touched none of them",
      await count(`${NONLANE} and (r.origin='prompt' or r.legacy_review_class is not null)`) === 0,
      "origin 'prompt' or a legacy class is the correction's fingerprint; source 'inference' is NOT, since 16 already carry it");
    ok("the two non-lane populations are seeded as production actually holds them",
      await count(`${NONLANE} and r.source='inference' and r.origin='discovery'`) === 16
      && await count(`${NONLANE} and r.source='manual' and r.origin='user'`) === 1);

    ok("zero run-decision changes",
      await count("v_preflight_runs where decision is distinct from 'execution_passed'") === 0);
    ok("zero contract-status changes: every lane contract that was approved still is",
      await count(`v_production_contracts c join v_applications a on a.id=c.application_id
        where a.builder='vraelis_api' and c.legacy_approval_class='legacy_auto_approved' and c.status<>'approved'`) === 0);
    // Compared against a snapshot taken BEFORE the correction rather than against literal strings the seed
    // happened to use. The previous version asserted 'Group A requirement%' and plan_hash 'hash_a', which
    // were artefacts of a hand-authored seed; regenerating the seed from production broke both assertions
    // without anything actually being wrong. An invariant that depends on fixture spelling is not an
    // invariant.
    const textAfter = JSON.stringify((await q("select id, requirement from v_contract_requirements order by id")));
    ok("zero requirement-text changes", textAfter === textBefore);
    const plansAfter = JSON.stringify((await q("select id, plan_hash, approval_state, approved_by, approved_at, plan from v_reviewed_plans order by id")));
    ok("zero reviewed-plan semantic changes", plansAfter === plansBefore);

    const draftTiesLeft = await count(`v_contract_requirements r join v_production_contracts c on c.id=r.contract_id
      where c.status='draft' and exists (select 1 from v_contract_requirements x
        where x.contract_id=r.contract_id and x.order_index=r.order_index and x.id<>r.id)`);
    const approvedTiesLeft = await count(`v_contract_requirements r join v_production_contracts c on c.id=r.contract_id
      where c.status='approved' and exists (select 1 from v_contract_requirements x
        where x.contract_id=r.contract_id and x.order_index=r.order_index and x.id<>r.id)`);
    say(`  draft ties remaining ${draftTiesLeft}   approved ties remaining ${approvedTiesLeft}`);
    ok("only mutable draft ordering changed", draftTiesLeft === 0 && approvedTiesLeft === 147,
      `${draftTiesLeft}/${approvedTiesLeft}`);

    // ── 7b. CONSTRAINT VALIDATION, THE LAST GATE BEFORE COMMIT ─────────────────────────────────────
    say("\n── 7b. validating every provenance constraint ──");
    const VALIDATABLE = [
      "chk_v_req_origin", "chk_v_req_review_state", "chk_v_req_review_basis_value",
      "chk_v_req_legacy_class_value", "chk_v_req_basis_complete", "chk_v_req_unapproved_clean",
    ];
    for (const c of VALIDATABLE) {
      try {
        await db.query(`alter table v_contract_requirements validate constraint ${c}`);
        ok(`${c} validates against every stored row`, true);
      } catch (e) { ok(`${c} validates against every stored row`, false, String(e).slice(0, 120)); }
    }
    try {
      await db.query("alter table v_production_contracts validate constraint chk_v_contract_legacy_class_value");
      ok("chk_v_contract_legacy_class_value validates", true);
    } catch (e) { ok("chk_v_contract_legacy_class_value validates", false, String(e).slice(0, 120)); }

    // The two that cannot validate, and the exact reason.
    const blockers = await count("v_contract_requirements where review_state='approved' and review_basis is null");
    say(`  rows blocking chk_v_req_approved_has_basis: ${blockers}`);
    // A SAVEPOINT, because a failed statement poisons the entire transaction (25P02) and every later stage
    // would be refused. This is exactly why the correction script does NOT attempt this VALIDATE: an
    // operator who ran it inside the open transaction would abort the whole correction and lose it.
    let hasBasisValidated = false;
    await db.query("savepoint try_validate_has_basis");
    try {
      await db.query("alter table v_contract_requirements validate constraint chk_v_req_approved_has_basis");
      hasBasisValidated = true;
      await db.query("release savepoint try_validate_has_basis");
    } catch {
      // expected while the 17 legacy human approvals carry no recorded basis
      await db.query("rollback to savepoint try_validate_has_basis");
    }
    ok("chk_v_req_approved_has_basis is blocked by exactly the 17 out-of-scope rows",
      !hasBasisValidated && blockers === 17,
      `validated=${hasBasisValidated} blockers=${blockers}`);
    ok("and every row blocking it is NON-LANE (the correction left no lane row behind)",
      await count(`v_contract_requirements r
        where r.review_state='approved' and r.review_basis is null
          and exists (select 1 from v_production_contracts c join v_applications a on a.id=c.application_id
                       where c.id=r.contract_id and a.builder='vraelis_api')`) === 0);

    // ── 7c. THE ONE-PASTE VARIANT, RUN EXACTLY AS THE SQL EDITOR WOULD ──────────────────────────────
    // Same correction, self-gating: every check a human was meant to read is an exception instead. Proven
    // here on a SECOND clone seeded identically, because the first is already corrected.
    say("\n── 7c. ops/CORRECTION-ONE-PASTE.sql on a fresh clone ──");
    await admin2.query("create database clone2 with encoding 'UTF8' template template0 lc_collate 'C' lc_ctype 'C'");
    const db2 = pg.getPgClient("clone2");
    await db2.connect();
    try {
      await db2.query("create extension if not exists pgcrypto");
      await db2.query(sql("sql/vraelis-preflight.sql"));
      await db2.query(sql("sql/vraelis-preflight-2-discovery.sql"));
      await db2.query(sql("sql/vraelis-preflight-18-reviewed-plans.sql"));
      await db2.query(sql("ops/rehearsal/seed-clone.sql"));
      await db2.query(sql("sql/vraelis-preflight-19-requirement-provenance.sql"));
      await db2.query(sql("sql/vraelis-preflight-20-provenance-defaults.sql"));
      await db2.query(sql("sql/vraelis-preflight-22-approved-review-state-consistency.sql"));

      const notices: string[] = [];
      db2.on("notice", (n: { message?: string }) => { if (n.message) notices.push(n.message); });
      await db2.query(sql("ops/CORRECTION-ONE-PASTE.sql"));
      ok("the one-paste correction applies cleanly, gates and all", true);
      for (const n of notices) say(`      ${n}`);

      const c2 = async (w: string) => Number((await db2.query(`select count(*)::int as c from ${w}`)).rows[0].c);
      const LANE2 = `v_contract_requirements r
        join v_production_contracts c on c.id = r.contract_id
        join v_applications a on a.id = c.application_id where a.builder = 'vraelis_api'`;
      ok("one-paste: 136 authorship corrections", await c2(`${LANE2} and r.source='inference' and r.origin='prompt'`) === 136);
      ok("one-paste: 8 reviewed-plan approvals", await c2(`${LANE2} and r.review_basis='reviewed_plan'`) === 8);
      ok("one-paste: 128 legacy auto-approved", await c2(`${LANE2} and r.legacy_review_class='legacy_auto_approved'`) === 128);
      ok("one-paste: it COMMITTED (survives a fresh look)",
        await c2(`${LANE2} and r.source='manual'`) === 0);
      const validated = (await db2.query(`select conname from pg_constraint
        where conrelid='v_contract_requirements'::regclass and convalidated and conname like 'chk_v_req_%'`)).rows.length;
      ok("one-paste: 6 requirement constraints are now VALIDATED", validated === 6, String(validated));
      const notValid = (await db2.query(`select conname from pg_constraint
        where conrelid='v_contract_requirements'::regclass and not convalidated`)).rows.map((r: Record<string, unknown>) => String(r.conname));
      // Exactly the two the measurement said would be blocked, and no others.
      ok("one-paste: exactly the two measured constraints are left unvalidated",
        notValid.length === 2
        && notValid.includes("chk_v_req_approved_has_basis")
        && notValid.includes("chk_v_req_approved_matches_review_state"), notValid.join(","));

      // THE GATE ITSELF. Move the population and prove the script refuses rather than half-correcting.
      await db2.query(`insert into v_applications (id, user_id, name, app_url, builder, ownership_confirmed)
        values ('33333333-3333-3333-3333-333333333333','owner@example.com','x','https://x','vraelis_api',true)`);
      let refused = false;
      try { await db2.query(sql("ops/CORRECTION-ONE-PASTE.sql")); }
      catch (e) { refused = /CENSUS MISMATCH/.test(String(e)); }
      ok("one-paste: a moved population is REFUSED, not half-corrected", refused);
    } finally {
      await db2.end().catch(() => {});
    }

    // ── 8. ROLLBACK ─────────────────────────────────────────────────────────────────────────────────
    say("\n── 8. rollback proof ──");
    await db.query("commit");
    say("  correction COMMITTED on the clone (never on production)");
    ok("after commit the correction is durable", await count(`${LANE} and r.source='inference'`) === 136);

    await db.query(sql("ops/provenance-correction-ROLLBACK.sql").replace(/^\s*--\s*commit;.*$/gm, "").replace(/\bbegin;/, "begin;"));
    await db.query("commit").catch(() => { /* the rollback file opens its own transaction */ });
    const restored = await count(`${LANE} and r.source='manual' and r.origin='user' and r.review_state='approved'`);
    ok("the rollback restores all 136 rows to their measured state", restored === 136, String(restored));
    const consAfter = await q(`select conname, convalidated from pg_constraint
      where conrelid='v_contract_requirements'::regclass and conname='chk_v_req_approved_has_basis'`);
    ok("the rollback re-adds the constraint it had to drop", consAfter.length === 1);
    ok("...and re-adds it NOT VALID, exactly as migration 20 created it",
      consAfter.length === 1 && consAfter[0].convalidated === false);
    const c22after = await q(`select convalidated from pg_constraint
      where conrelid='v_contract_requirements'::regclass and conname='chk_v_req_approved_matches_review_state'`);
    ok("migration 22's constraint survives the rollback", c22after.length === 1);
    // A ROLLBACK RESTORES HISTORY, WARTS AND ALL. Production holds 8 rows at review_state 'approved' with
    // approved = false, drifted long before migration 22 named the invariant. The restored state must
    // contain them again: a rollback that quietly "improved" the data would not be a rollback, and the
    // count would no longer match what the backup captured.
    ok("the rollback restores the 8 pre-existing migration-22 violations rather than silently fixing them",
      await count("v_contract_requirements where approved is distinct from (review_state = 'approved')") === 8);

    say(`\n${pass} passed, ${fail} failed`);
  } finally {
    await db.end().catch(() => {});
    await pg.stop().catch(() => {});
    try { rmSync(DATA_DIR, { recursive: true, force: true }); } catch { /* windows file locks */ }
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
