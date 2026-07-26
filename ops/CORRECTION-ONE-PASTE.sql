-- THE PROVENANCE CORRECTION, AS ONE PASTE FOR THE SUPABASE SQL EDITOR.
--
-- Paste this whole file into the SQL editor and run it once. It either applies completely or applies
-- nothing at all.
--
-- ── WHY THIS EXISTS ALONGSIDE ops/provenance-correction-MANUAL.sql ─────────────────────────────────────
--
-- The staged file is written for a psql session, where an operator reads counts between stages and types
-- COMMIT at the end. The Supabase SQL editor does not work that way: it runs a script as one unit and
-- commits it if nothing raised. A transaction cannot be held open across two clicks of Run, so the "read
-- the postflight, then decide" gate cannot exist there.
--
-- Removing that gate would be a downgrade. So it is replaced with something stricter: every check that a
-- human was supposed to read is now a DO block that RAISES an exception on the wrong answer. An exception
-- aborts the transaction, so a failed check applies nothing. The gate is no longer "someone looked at the
-- numbers and felt fine"; it is "the numbers were asserted and the database refused to keep the work if any
-- of them was wrong."
--
-- That is strictly safer than the human read, because it cannot be skimmed.
--
-- ── BEFORE YOU RUN IT ──────────────────────────────────────────────────────────────────────────────────
--
--   1. Verification traffic must be FROZEN, or the census moves under the script and it aborts.
--   2. The corrected writer must be deployed, or the next request writes a row this script did not classify.
--   3. ops/backups/restore-<stamp>.sql must exist. It is the way back if the postflight is wrong.
--
-- If anything raises, NOTHING is applied and the message says which check failed. Send me the message.

begin;

-- ══ GATE 1. THE POPULATION IS EXACTLY THE ONE THIS SCRIPT WAS WRITTEN AGAINST. ══════════════════════
do $$
declare
  v_total int; v_lane int; v_nonlane int; v_a int; v_b int; v_triple int;
begin
  -- Temporary views live for the whole SESSION, not the transaction. Without these drops, a second run in
  -- the same SQL editor session dies on "relation lane_req already exists" before reaching the census check.
  -- A re-run must be refused BY THE CENSUS, with a message that says why, not by a stale leftover object.
  drop view if exists group_a;
  drop view if exists lane_req;

  create temporary view lane_req as
    select r.id, r.contract_id
      from v_contract_requirements r
      join v_production_contracts c on c.id = r.contract_id
      join v_applications a         on a.id = c.application_id
     where a.builder = 'vraelis_api';

  -- Group A: lane rows whose contract's run consumed an APPROVED reviewed plan naming a real approver.
  -- v_preflight_runs.id is uuid and v_reviewed_plans.run_id is text, hence the cast; without it this
  -- raises 42883 before a single count is read.
  create temporary view group_a as
    select distinct r.id as requirement_id, r.contract_id, p.id as plan_id, p.approved_by, p.approved_at
      from v_contract_requirements r
      join lane_req l            on l.id = r.id
      join v_preflight_runs run  on run.contract_id = r.contract_id
      join v_reviewed_plans p    on p.run_id = run.id::text
     where p.approval_state = 'approved'
       and p.approved_by is not null
       and p.approved_at is not null;

  select count(*) into v_total   from v_contract_requirements;
  select count(*) into v_lane    from lane_req;
  select count(*) into v_nonlane from v_contract_requirements r
    where not exists (select 1 from lane_req l where l.id = r.id);
  select count(*) into v_a       from group_a;
  select count(*) into v_b       from lane_req l
    where not exists (select 1 from group_a a where a.requirement_id = l.id);
  select count(*) into v_triple  from v_contract_requirements r join lane_req l on l.id = r.id
    where r.source = 'manual' and r.origin = 'user' and r.review_state = 'approved';

  raise notice 'census: total=% lane=% non-lane=% A=% B=% false-triple=%', v_total, v_lane, v_nonlane, v_a, v_b, v_triple;

  if v_total <> 153 or v_lane <> 136 or v_nonlane <> 17 or v_a <> 8 or v_b <> 128 or v_triple <> 136 then
    raise exception 'CENSUS MISMATCH. Expected 153/136/17/8/128/136, got %/%/%/%/%/%. Nothing applied. The population moved: re-measure and reclassify before correcting.',
      v_total, v_lane, v_nonlane, v_a, v_b, v_triple;
  end if;
end $$;

-- ══ SNAPSHOT. Reversibility from inside the database, on top of the file-level backup. ══════════════
create table if not exists v_contract_requirements_provenance_backup_21 (
  id uuid primary key,
  source text, origin text, review_state text, approved boolean,
  review_basis text, approved_by text, approved_at timestamptz,
  reviewed_plan_id text, legacy_review_class text, review_identity text, order_index int,
  captured_at timestamptz not null default now()
);
insert into v_contract_requirements_provenance_backup_21
  (id, source, origin, review_state, approved, review_basis, approved_by, approved_at,
   reviewed_plan_id, legacy_review_class, review_identity, order_index)
select r.id, r.source, r.origin, r.review_state, r.approved, r.review_basis, r.approved_by, r.approved_at,
       r.reviewed_plan_id, r.legacy_review_class, r.review_identity, r.order_index
  from v_contract_requirements r
 where exists (select 1 from lane_req l where l.id = r.id)
    or exists (select 1 from v_contract_requirements x
                where x.contract_id = r.contract_id and x.order_index = r.order_index and x.id <> r.id)
on conflict (id) do nothing;

create table if not exists v_production_contracts_provenance_backup_21 (
  id uuid primary key, legacy_approval_class text, captured_at timestamptz not null default now()
);
insert into v_production_contracts_provenance_backup_21 (id, legacy_approval_class)
select c.id, c.legacy_approval_class from v_production_contracts c
 where exists (select 1 from lane_req l where l.contract_id = c.id)
on conflict (id) do nothing;

-- ══ GROUP A (8). Authorship AND review in ONE statement. ═══════════════════════════════════════════
--
-- Both move together because migration 20's constraints are NOT VALID: they grandfather stored rows but
-- bind every UPDATE. Correcting authorship alone would re-check chk_v_req_approved_has_basis on rows whose
-- review columns were not fixed yet, and abort the whole transaction.
--
-- review_identity stays null: what the reviewer saw was never captured, so a future draft revision will
-- correctly refuse to carry this approval forward rather than assume the content is unchanged.
update v_contract_requirements r
   set source           = 'inference',
       origin           = 'prompt',
       review_state     = 'approved',
       approved         = true,
       review_basis     = 'reviewed_plan',
       approved_by      = a.approved_by,
       approved_at      = a.approved_at,
       reviewed_plan_id = a.plan_id
  from group_a a
 where a.requirement_id = r.id;

-- ══ GROUP B (128). No human review of any kind. The row stops claiming one. ════════════════════════
update v_contract_requirements r
   set source              = 'inference',
       origin              = 'prompt',
       review_state        = 'suggested',
       approved            = false,
       review_basis        = null,
       approved_by         = null,
       approved_at         = null,
       review_identity     = null,
       reviewed_plan_id    = null,
       legacy_review_class = 'legacy_auto_approved'
 where exists (select 1 from lane_req l where l.id = r.id)
   and not exists (select 1 from group_a a where a.requirement_id = r.id);

-- ══ CONTRACTS. status is not in this statement and never will be. ══════════════════════════════════
update v_production_contracts c
   set legacy_approval_class = 'legacy_auto_approved'
 where c.status = 'approved'
   and exists (select 1 from lane_req l where l.contract_id = c.id)
   and not exists (select 1 from group_a a where a.contract_id = c.id);

-- ══ ORDERING. DRAFTS ONLY. Approved order is never invented. ═══════════════════════════════════════
with ranked as (
  select r.id,
         row_number() over (
           partition by r.contract_id
           order by r.order_index, r.created_at, r.id
         ) as rn
    from v_contract_requirements r
    join v_production_contracts c on c.id = r.contract_id
   where c.status = 'draft'
     and r.contract_id in (
       select contract_id from v_contract_requirements
        group by contract_id, order_index having count(*) > 1
     )
)
update v_contract_requirements r
   set order_index = ranked.rn
  from ranked
 where ranked.id = r.id
   and r.order_index <> ranked.rn;

-- ══ GATE 2. THE POSTFLIGHT, ASSERTED RATHER THAN READ. ═════════════════════════════════════════════
do $$
declare
  v_authorship int; v_a int; v_b int; v_claiming int; v_unattributed int;
  v_dirty int; v_excluded int; v_excluded_touched int; v_draft_ties int; v_approved_ties int; v_status_lost int;
begin
  select count(*) into v_authorship from v_contract_requirements r join lane_req l on l.id = r.id
    where r.source = 'inference' and r.origin = 'prompt';
  select count(*) into v_a from v_contract_requirements r join lane_req l on l.id = r.id
    where r.review_basis = 'reviewed_plan' and r.review_state = 'approved';
  select count(*) into v_b from v_contract_requirements r join lane_req l on l.id = r.id
    where r.legacy_review_class = 'legacy_auto_approved' and r.review_state = 'suggested';
  select count(*) into v_claiming from v_contract_requirements r join lane_req l on l.id = r.id
    where r.source = 'manual' or r.origin = 'user';
  select count(*) into v_unattributed from v_contract_requirements r join lane_req l on l.id = r.id
    where r.review_state = 'approved' and (r.approved_by is null or r.approved_at is null or r.review_basis is null);
  select count(*) into v_dirty from v_contract_requirements r join lane_req l on l.id = r.id
    where r.review_state <> 'approved' and (r.approved_by is not null or r.approved_at is not null or r.review_basis is not null);
  -- "UNTOUCHED" MEANS UNTOUCHED, NOT "HAS A PARTICULAR SHAPE".
  --
  -- The first version of this check counted non-lane rows carrying manual/user/approved and expected 17.
  -- It got 1, because the 17 are not one population: 16 are discovery suggestions a person approved
  -- (inference/discovery/approved) and exactly 1 is hand-typed (manual/user/approved). The check encoded an
  -- assumption about their content rather than the property that actually matters.
  --
  -- What matters is that the correction did not reach them. The correction's fingerprint is origin 'prompt'
  -- or a legacy classification; note that source 'inference' is NOT a fingerprint, since 16 of them already
  -- carry it for entirely legitimate reasons.
  select count(*) into v_excluded from v_contract_requirements r
    where not exists (select 1 from lane_req l where l.id = r.id);
  select count(*) into v_excluded_touched from v_contract_requirements r
    where not exists (select 1 from lane_req l where l.id = r.id)
      and (r.origin = 'prompt' or r.legacy_review_class is not null);
  select count(*) into v_draft_ties from (
    select 1 from v_contract_requirements r join v_production_contracts c on c.id = r.contract_id
     where c.status = 'draft' group by r.contract_id, r.order_index having count(*) > 1) t;
  select count(*) into v_approved_ties from v_contract_requirements r
    join v_production_contracts c on c.id = r.contract_id
   where c.status = 'approved' and exists (select 1 from v_contract_requirements x
     where x.contract_id = r.contract_id and x.order_index = r.order_index and x.id <> r.id);
  select count(*) into v_status_lost from v_production_contracts c
   where c.legacy_approval_class = 'legacy_auto_approved' and c.status <> 'approved';

  raise notice 'postflight: authorship=% A=% B=% still-claiming=% unattributed=% dirty=% excluded=% excluded-touched=% draft-ties=% approved-ties=% status-lost=%',
    v_authorship, v_a, v_b, v_claiming, v_unattributed, v_dirty, v_excluded, v_excluded_touched, v_draft_ties, v_approved_ties, v_status_lost;

  if v_authorship <> 136 then raise exception 'POSTFLIGHT: expected 136 authorship corrections, got %', v_authorship; end if;
  if v_a <> 8            then raise exception 'POSTFLIGHT: expected 8 reviewed-plan approvals, got %', v_a; end if;
  if v_b <> 128          then raise exception 'POSTFLIGHT: expected 128 legacy auto-approved rows, got %', v_b; end if;
  if v_claiming <> 0     then raise exception 'POSTFLIGHT: % lane rows still claim human authorship', v_claiming; end if;
  if v_unattributed <> 0 then raise exception 'POSTFLIGHT: % approved lane rows name no reviewer', v_unattributed; end if;
  if v_dirty <> 0        then raise exception 'POSTFLIGHT: % unapproved lane rows carry reviewer provenance', v_dirty; end if;
  if v_excluded <> 17    then raise exception 'POSTFLIGHT: expected 17 non-lane rows to still exist, found %', v_excluded; end if;
  if v_excluded_touched <> 0 then raise exception 'POSTFLIGHT: % non-lane rows were touched by the correction and must not have been', v_excluded_touched; end if;
  if v_draft_ties <> 0   then raise exception 'POSTFLIGHT: % draft contracts still hold a tied order_index', v_draft_ties; end if;
  if v_approved_ties <> 147 then raise exception 'POSTFLIGHT: approved ordering was altered, expected 147 tied rows preserved, got %', v_approved_ties; end if;
  if v_status_lost <> 0  then raise exception 'POSTFLIGHT: % contracts lost their approved status', v_status_lost; end if;
end $$;

-- ══ GATE 3. VALIDATE EVERY CONSTRAINT THAT CAN BE VALIDATED. ═══════════════════════════════════════
--
-- Each of these scans the table and FAILS if any stored row violates the rule, which is the last gate
-- before the work is kept. A constraint nobody validated is a rule nobody checked the data against.
alter table v_contract_requirements validate constraint chk_v_req_origin;
alter table v_contract_requirements validate constraint chk_v_req_review_state;
alter table v_contract_requirements validate constraint chk_v_req_review_basis_value;
alter table v_contract_requirements validate constraint chk_v_req_legacy_class_value;
alter table v_contract_requirements validate constraint chk_v_req_basis_complete;
alter table v_contract_requirements validate constraint chk_v_req_unapproved_clean;
alter table v_production_contracts  validate constraint chk_v_contract_legacy_class_value;

-- ── TWO CONSTRAINTS ARE DELIBERATELY NOT VALIDATED, AND WHICH TWO WAS MEASURED, NOT GUESSED ──────────
--
-- Both are blocked by the same thing: out-of-scope non-lane rows that predate these columns. The exact
-- violation counts were computed by simulating this correction against a full export of production, not
-- by reasoning about what the data probably looks like. An earlier version of this file listed
-- chk_v_req_approved_matches_review_state among the validations and failed on production with 23514,
-- because 8 rows already violate it and nobody had checked.
--
--   chk_v_req_approved_has_basis              17 violations
--       All 17 non-lane rows sit at review_state 'approved' with a null review_basis. They are genuine
--       human approvals recorded before the column existed to say who gave them.
--
--   chk_v_req_approved_matches_review_state    8 violations
--       8 non-lane discovery rows are review_state 'approved' with approved = false. The vestigial boolean
--       drifted from the state column long before migration 22 named the invariant.
--
-- Attempting either VALIDATE here would raise and abort the whole correction several statements after it
-- had succeeded. When those non-lane rows are dealt with as their own decision, run each ALONE, OUTSIDE
-- any transaction:
--
--   alter table v_contract_requirements validate constraint chk_v_req_approved_has_basis;
--   alter table v_contract_requirements validate constraint chk_v_req_approved_matches_review_state;
--
-- Both still bind every insert and update in the meantime. Unvalidated is not unenforced.

commit;

-- ══ AFTERWARDS ═════════════════════════════════════════════════════════════════════════════════════
--
-- Expect: "census: ..." and "postflight: ..." notices, then a successful commit.
--
-- If anything raised, NOTHING was applied. The message names the failed check.
--
-- To reverse a committed correction: ops/backups/restore-<stamp>.sql, or the in-database snapshots via
-- ops/provenance-correction-ROLLBACK.sql.
