-- Migration 21: staged historical correction of the 136 falsely-attributed requirement rows.
--
-- NOT AUTOMATED. Run it by hand, stage by stage, reading the counts between each. It opens a transaction and
-- does NOT commit: stage 6 prints the postflight, and the operator types commit or rollback.
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
    join v_reviewed_plans p    on p.run_id = run.id
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

-- ══ STAGE 2. AUTHORSHIP. All 136 rows, both groups. ══════════════════════════════════════════════════
--
-- A model wrote these from the caller's claim. source 'inference' is the closed-set tag for text a model
-- inferred; origin 'prompt' is where the material came from, the claim being the contract's source_prompt.
-- The claim is INPUT MATERIAL, never the author, which is why neither column becomes 'claim'.
--
-- Authorship is corrected for group A too. A person approving a model's text does not make them its author.
update v_contract_requirements r
   set source = 'inference',
       origin = 'prompt'
 where exists (select 1 from lane_req l where l.id = r.id);
-- expect 136

-- ══ STAGE 3. REVIEW. The two groups diverge here, and only here. ═════════════════════════════════════

-- Group A (8): human review proven. These rows keep review_state 'approved' because it was TRUE, and gain
-- the evidence that was never recorded: the basis, the approver, the timestamp, the plan. They receive NO
-- legacy classification, because nothing about their review was manufactured.
--
-- review_identity stays NULL: what the reviewer saw was never captured at the time, so it cannot be
-- reconstructed now. A future draft revision will therefore CLEAR these approvals rather than carry them
-- forward, which is the correct fail-closed answer to "we cannot prove the content is unchanged".
update v_contract_requirements r
   set review_state     = 'approved',
       approved         = true,
       review_basis     = 'reviewed_plan',
       approved_by      = a.approved_by,
       approved_at      = a.approved_at,
       reviewed_plan_id = a.plan_id
  from group_a a
 where a.requirement_id = r.id;
-- expect 8

-- Group B (128): no human review. The row stops claiming one. It becomes 'suggested', which is what
-- generated content awaiting a decision has always meant, with every trace of a reviewer removed.
update v_contract_requirements r
   set review_state        = 'suggested',
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
