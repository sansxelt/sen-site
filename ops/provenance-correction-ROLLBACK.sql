-- MANUAL OPERATOR SCRIPT. Rollback for ops/provenance-correction-MANUAL.sql.
--
-- Like the correction itself, this carries no migration number and lives outside sql/, so no migration runner
-- can execute it. Restores every column the correction wrote, from the snapshots its stage 1 captured before
-- writing anything.
--
-- This is a full reversal of the CORRECTION, not of the schema: migrations 19 and 20 stay applied, because
-- additive columns and forward-only constraints are not what a rollback is for. After running this, the 136
-- rows once again claim the human authorship and approval they claimed before, which is the state that was
-- measured, so a re-run of the correction will reproduce the same census.
--
-- ONE CAVEAT, AND IT MATTERS: migration 20's constraints are NOT VALID, which grandfathers existing rows but
-- binds every UPDATE. The state being restored is precisely the state those constraints exist to forbid: 136
-- rows at review_state 'approved' with no review_basis, no approved_by and no approved_at. Restoring it with
-- the constraint in place would fail on the first row.
--
-- So the rollback drops that one constraint, restores, and re-adds it NOT VALID, which returns the database
-- to exactly the state it was in before the correction, constraints included. The other five constraints are
-- untouched, because nothing being restored violates them.
--
-- It refuses to run against an empty snapshot rather than silently restoring nothing.

begin;

do $$
declare n int;
begin
  select count(*) into n from v_contract_requirements_provenance_backup_21;
  if n = 0 then
    raise exception 'refusing to roll back: v_contract_requirements_provenance_backup_21 is empty, so there is nothing to restore and this would be a no-op reported as a success';
  end if;
  raise notice 'restoring % requirement rows', n;
end $$;

-- The state being restored is the one these constraints forbid, so both are dropped and re-added exactly as
-- their migrations created them.
--
--   chk_v_req_approved_has_basis             17 rows: approved with a null review_basis
--   chk_v_req_approved_matches_review_state   8 rows: approved with the vestigial boolean false
--
-- The second was missing until a rehearsal seeded from a real production export reproduced those 8 rows.
-- A hand-authored seed had them all consistent, so the rollback looked correct and would have failed.
alter table v_contract_requirements drop constraint if exists chk_v_req_approved_has_basis;
alter table v_contract_requirements drop constraint if exists chk_v_req_approved_matches_review_state;

update v_contract_requirements r
   set source              = b.source,
       origin              = b.origin,
       review_state        = b.review_state,
       approved            = b.approved,
       review_basis        = b.review_basis,
       approved_by         = b.approved_by,
       approved_at         = b.approved_at,
       reviewed_plan_id    = b.reviewed_plan_id,
       legacy_review_class = b.legacy_review_class,
       review_identity     = b.review_identity,
       order_index         = b.order_index
  from v_contract_requirements_provenance_backup_21 b
 where b.id = r.id;

update v_production_contracts c
   set legacy_approval_class = b.legacy_approval_class
  from v_production_contracts_provenance_backup_21 b
 where b.id = c.id;

-- Re-add both exactly as their migrations did: NOT VALID, so the restored rows are grandfathered again and
-- every future write is still bound.
alter table v_contract_requirements add constraint chk_v_req_approved_has_basis
  check (review_state <> 'approved' or review_basis is not null) not valid;
alter table v_contract_requirements add constraint chk_v_req_approved_matches_review_state
  check (approved is not distinct from (review_state = 'approved')) not valid;

-- Confirm the restore before committing: this must report 136 lane rows carrying the original triple again.
select count(*) as restored_false_triple
  from v_contract_requirements r
  join v_production_contracts c on c.id = r.contract_id
  join v_applications a         on a.id = c.application_id
 where a.builder = 'vraelis_api'
   and r.source = 'manual' and r.origin = 'user' and r.review_state = 'approved';

-- commit;   (or)   rollback;
