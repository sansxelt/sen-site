-- MANUAL OPERATOR SCRIPT. THIS IS NOT A MIGRATION AND MUST NEVER BE RUN AS ONE.
--
-- It lives in ops/ and carries no migration number precisely so that no migration runner, no glob over
-- sql/vraelis-preflight-*.sql, and no future "apply everything in order" script can pick it up. A historical
-- data correction is a judgement call about 136 rows of recorded history; it is not a schema change, and it
-- must never execute because it happened to sort after migration 20.
--
-- The schema half of this work IS numbered and IS automatic:
--   sql/vraelis-preflight-19-requirement-provenance.sql   additive columns, inert, safe before the deploy
--   sql/vraelis-preflight-20-provenance-defaults.sql      defaults + constraints, safe only AFTER the deploy
--
-- This file is the other half: the staged historical correction of the 136 falsely-attributed requirement
-- rows. Run it BY HAND, stage by stage, reading the counts between each. It opens a transaction and does NOT
-- commit. Stage 6 prints the postflight; a human reads it and types commit or rollback deliberately.
--
-- Rollback after commit: ops/provenance-correction-ROLLBACK.sql, from the snapshots stage 1 captures.
--
-- WHAT IS NEVER TOUCHED, in any statement below:
--   v_preflight_runs.decision        historical decisions stand, unchanged and unreinterpreted
--   v_production_contracts.status    an approval that happened still reads as having happened
--   v_contract_requirements.requirement   no requirement text is edited
--
-- The correction is to the PROVENANCE of those rows: who authored them, and whether a person reviewed them.
-- Legacy decision status and legacy contract review status stay in separate fields, so a record can carry
-- both, either, or neither, and neither one implies the other.
--
-- ── THE POPULATIONS ────────────────────────────────────────────────────────────────────────────────────
--   153  requirement rows in total
--   136  belong to applications with builder = 'vraelis_api' and were synthesized by prepareVerification
--    17  non-lane rows, EXPLICITLY OUT OF SCOPE, not read or written by any stage
--     8  group A: exact human review PROVEN through an approved, consumed reviewed plan
--   128  group B: no human review of any kind
--     0  group C: unknown. There is no ambiguous group, which is why every row can be classified.

begin;

-- ══ STAGE 0. CENSUS. Reproduce the measured facts exactly, or roll back. ══════════════════════════════
--
-- These numbers are the evidence that this file still describes the data it was written against. If the
-- population has moved, the classification below may be wrong for rows nobody has looked at, and a wrong
-- provenance correction is worse than none: it would launder unreviewed content into reviewed content with
-- an audit trail saying it was verified.

create temporary view lane_req as
  select r.id, r.contract_id
    from v_contract_requirements r
    join v_production_contracts c on c.id = r.contract_id
    join v_applications a         on a.id = c.application_id
   where a.builder = 'vraelis_api';

-- Group A: the requirement rows of contracts whose run consumed an APPROVED reviewed plan that records a
-- real approver and a real timestamp. This is the only evidence of human review that exists for lane rows,
-- and it is exact: the plan is immutable, plan_hash binds its ordered content, and execution ran it verbatim.
create temporary view group_a as
  select distinct r.id as requirement_id, r.contract_id, p.id as plan_id, p.approved_by, p.approved_at
    from v_contract_requirements r
    join lane_req l            on l.id = r.id
    join v_preflight_runs run  on run.contract_id = r.contract_id
    -- v_preflight_runs.id is uuid; v_reviewed_plans.run_id is text (migration 18 declared it that way, since
    -- run ids are self-describing strings elsewhere in that table). Postgres has no implicit text = uuid
    -- operator, so this join without the cast raises 42883 and stage 0 aborts before printing a single count.
    -- Found by the clone rehearsal; it would have failed on the first real attempt.
    join v_reviewed_plans p    on p.run_id = run.id::text
   where p.approval_state = 'approved'
     and p.approved_by is not null
     and p.approved_at is not null;

select 'total_requirements'  as metric, count(*) as value from v_contract_requirements          -- expect 153
union all select 'lane_rows',            count(*) from lane_req                                 -- expect 136
union all select 'false_triple',         count(*) from v_contract_requirements r
            join lane_req l on l.id = r.id
           where r.source = 'manual' and r.origin = 'user' and r.review_state = 'approved'      -- expect 136
union all select 'non_lane_excluded',    count(*) from v_contract_requirements r
           where not exists (select 1 from lane_req l where l.id = r.id)                        -- expect 17
union all select 'group_a',              count(*) from group_a                                  -- expect 8
union all select 'group_b',              count(*) from lane_req l
           where not exists (select 1 from group_a a where a.requirement_id = l.id);            -- expect 128

-- Ordering repair scope, reported as TWO SEPARATE LISTS because they are not the same decision.
-- Draft rows may be renumbered: a draft is mutable and nothing has been approved against its order.
select 'draft_rows_proposed_for_normalization' as metric, count(*) as value
  from v_contract_requirements r
  join v_production_contracts c on c.id = r.contract_id
 where c.status = 'draft'
   and exists (select 1 from v_contract_requirements x
                where x.contract_id = r.contract_id and x.order_index = r.order_index and x.id <> r.id);

-- Approved rows are NOT renumbered by this file. Reported so the count is known, not so it can be fixed.
select 'approved_rows_with_duplicate_order_left_alone' as metric, count(*) as value
  from v_contract_requirements r
  join v_production_contracts c on c.id = r.contract_id
 where c.status = 'approved'
   and exists (select 1 from v_contract_requirements x
                where x.contract_id = r.contract_id and x.order_index = r.order_index and x.id <> r.id);

-- STOP HERE unless the census reads 153 / 136 / 136 / 17 / 8 / 128. Any other number: rollback.

-- ══ STAGE 1. REVERSIBILITY. Snapshot exactly the columns about to change. ════════════════════════════
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

-- ══ STAGE 2. GROUP A (8): authorship AND review, in ONE statement. ══════════════════════════════════
--
-- AUTHORSHIP: a model wrote these from the caller's claim. source 'inference' is the closed-set tag for text
-- a model inferred; origin 'prompt' is where the material came from, the claim being the contract's
-- source_prompt. The claim is INPUT MATERIAL, never the author, which is why neither column becomes 'claim'.
-- Group A's authorship is corrected too: a person approving a model's text does not make them its author.
--
-- REVIEW: human review is proven here, so review_state stays 'approved' because it was TRUE, and gains the
-- evidence that was never recorded: the basis, the approver, the timestamp, the plan. NO legacy
-- classification, because nothing about this review was manufactured.
--
-- WHY AUTHORSHIP AND REVIEW MOVE TOGETHER, AND NOT IN SEPARATE STAGES:
--
-- Migration 20's constraints are NOT VALID, which grandfathers existing rows but binds every UPDATE. Before
-- this correction runs, all 136 rows are review_state 'approved' with review_basis NULL, which violates
-- chk_v_req_approved_has_basis. An earlier draft of this file corrected authorship for all 136 first and
-- review afterwards; that first UPDATE re-checked the constraint on rows whose review columns had not been
-- fixed yet, and the whole transaction aborted. Each row must reach a VALID final state within a single
-- statement, so the groups are corrected one statement each. Found by the clone rehearsal, which is what a
-- rehearsal is for.
--
-- review_identity stays NULL: what the reviewer saw was never captured at the time and cannot be
-- reconstructed now. A future draft revision will therefore CLEAR these approvals rather than carry them
-- forward, which is the correct fail-closed answer to "we cannot prove the content is unchanged".
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
-- expect 8

-- ══ STAGE 3. GROUP B (128): authorship AND review, in ONE statement. ════════════════════════════════
--
-- Same authorship correction. No human review of any kind, so the row stops claiming one: it becomes
-- 'suggested', which is what generated content awaiting a decision has always meant, with every trace of a
-- reviewer removed and the legacy classification recorded so the correction stays auditable.
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
-- expect 128

-- ══ STAGE 4. CONTRACT-LEVEL CLASSIFICATION. status is not in this statement. ═════════════════════════
--
-- An approved lane contract with no proven human review keeps its status and its history, and gains a
-- separate field recording that its approval was manufactured. It remains readable, its past decisions
-- stand, and it is no longer usable as evidence that a person agreed to anything.
update v_production_contracts c
   set legacy_approval_class = 'legacy_auto_approved'
 where c.status = 'approved'
   and exists (select 1 from lane_req l where l.contract_id = c.id)
   and not exists (select 1 from group_a a where a.contract_id = c.id);

-- ══ STAGE 5. ORDERING. DRAFTS ONLY. ══════════════════════════════════════════════════════════════════
--
-- Draft contracts are mutable and nothing was approved against their ordering, so duplicates are normalized
-- to unique sequential indexes using existing order_index, then created_at, then id as a final deterministic
-- tie-break.
--
-- APPROVED CONTRACTS ARE NOT TOUCHED. For an approved contract with a reviewed plan, the authoritative order
-- is the plan's, which is immutable and already read directly (lib/preflight/requirements-for-run.ts). For an
-- approved contract WITHOUT a plan, the authored order is simply gone: prepareVerification did insert
-- sequentially, but two inserts can share a created_at and a UUIDv4 carries no sequence, so reconstructing
-- one here would manufacture an approved order from evidence that does not support it. Those rows are
-- classified legacy/incomplete at read time and reported as such.
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

-- ══ STAGE 6. POSTFLIGHT. Every count must be 0. ══════════════════════════════════════════════════════
select 'lane_rows_still_claiming_human_authorship' as check_name, count(*) as violations
  from v_contract_requirements r join lane_req l on l.id = r.id
 where r.source = 'manual' or r.origin = 'user'
union all
select 'approved_without_a_named_reviewer', count(*) from v_contract_requirements r
  join lane_req l on l.id = r.id
 where r.review_state = 'approved' and (r.approved_by is null or r.approved_at is null or r.review_basis is null)
union all
select 'unapproved_carrying_reviewer_provenance', count(*) from v_contract_requirements
 where review_state <> 'approved' and (approved_by is not null or approved_at is not null or review_basis is not null)
union all
select 'group_b_rows_still_approved', count(*) from v_contract_requirements r
  join lane_req l on l.id = r.id
 where r.legacy_review_class = 'legacy_auto_approved' and r.review_state = 'approved'
union all
select 'draft_rows_with_duplicate_order', count(*) from (
  select r.contract_id from v_contract_requirements r
    join v_production_contracts c on c.id = r.contract_id
   where c.status = 'draft'
   group by r.contract_id, r.order_index having count(*) > 1
) t
union all
-- Proof that nothing historical moved: no contract lost its approved status, and this file wrote no run row.
select 'lane_contracts_that_lost_approved_status', count(*) from v_production_contracts c
 where c.legacy_approval_class = 'legacy_auto_approved' and c.status <> 'approved';

-- ══ STAGE 7. VALIDATE EVERY PROVENANCE CONSTRAINT. ══════════════════════════════════════════════════
--
-- Migrations 20 and 22 added their constraints NOT VALID, which binds future writes while grandfathering
-- history. That was the right posture for landing them. It is the WRONG posture to stop at: a constraint
-- that is never validated is a rule nobody has checked the existing data against, and "it protects new
-- writes" is not the same claim as "no row violates it".
--
-- Validation takes a SHARE UPDATE EXCLUSIVE lock and scans the table. At 153 rows that is instant.
--
-- Each VALIDATE below will FAIL LOUDLY if any stored row violates the rule, which is the point: it is the
-- last gate before COMMIT. A failure here means the correction did not fully correct, and the transaction
-- must be rolled back rather than committed with a known-violating row.
alter table v_contract_requirements validate constraint chk_v_req_origin;
alter table v_contract_requirements validate constraint chk_v_req_review_state;
alter table v_contract_requirements validate constraint chk_v_req_review_basis_value;
alter table v_contract_requirements validate constraint chk_v_req_legacy_class_value;
alter table v_contract_requirements validate constraint chk_v_req_basis_complete;
alter table v_contract_requirements validate constraint chk_v_req_unapproved_clean;
alter table v_production_contracts  validate constraint chk_v_contract_legacy_class_value;

-- chk_v_req_approved_has_basis and chk_v_req_approved_matches_review_state are NOT in the list above. That
-- is a measured decision, not an oversight. See STAGE 7b.

-- ══ STAGE 7b. THE ONE CONSTRAINT THAT CANNOT BE VALIDATED, AND WHY. ═════════════════════════════════
--
-- chk_v_req_approved_has_basis says: a row at review_state 'approved' must name the basis on which it was
-- approved. Every row this correction touches satisfies it. The 17 NON-LANE rows do not.
--
-- Those 17 are human-authored requirements (source 'manual', origin 'user') that a person really did approve
-- by clicking approve in the dashboard. Their approval was genuine. It simply predates the columns that
-- record who gave it, so they sit at review_state 'approved' with review_basis, approved_by and approved_at
-- all null. They are OUT OF SCOPE for this correction by explicit decision, and correcting them is a
-- different judgement about a different population.
--
-- Validating this constraint would therefore fail on rows nobody has agreed to change. Forcing it through
-- would mean either editing those 17 rows without a decision, or weakening the constraint until it passes.
-- Both are worse than leaving one constraint honestly unvalidated with the reason written down.
--
-- TWO constraints are blocked, both by out-of-scope non-lane rows, and the counts were measured against a
-- full export of production rather than assumed:
--
--   chk_v_req_approved_has_basis             17 rows: approved with a null review_basis
--   chk_v_req_approved_matches_review_state   8 rows: approved with the vestigial boolean set false
--
-- Run this to see the first set. Expect 17, all non-lane.
select count(*) as rows_blocking_validation
  from v_contract_requirements
 where review_state = 'approved' and review_basis is null;

-- DO NOT RUN THE VALIDATE BELOW INSIDE THIS TRANSACTION.
--
-- A failed statement poisons the whole transaction (SQLSTATE 25P02: "current transaction is aborted,
-- commands ignored until end of transaction block"). Attempting a VALIDATE that is going to fail would
-- therefore discard the entire correction, several stages after it succeeded. The rehearsal reproduces this
-- exactly, and only survives it by wrapping the attempt in a SAVEPOINT.
--
-- When those 17 rows are dealt with, run this on its own, OUTSIDE any open transaction, and delete this stage:
--   alter table v_contract_requirements validate constraint chk_v_req_approved_has_basis;

-- Read the six postflight rows, confirm every violations column is 0, then:
--
--   commit;
--
-- or, on any surprise:
--
--   rollback;
--
-- After a commit, the correction is still reversible from the two backup tables written in stage 1; see
-- sql/vraelis-preflight-21-provenance-rollback.sql.
