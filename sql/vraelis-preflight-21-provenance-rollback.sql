-- Rollback for migration 21. Restores every column the backfill wrote, from the snapshots stage 1 captured
-- before writing anything.
--
-- This is a full reversal of the CORRECTION, not of the schema: migrations 19 and 20 stay applied, because
-- additive columns and forward-only constraints are not what a rollback is for. After running this, the 136
-- rows once again claim the human authorship and approval they claimed before, which is the state that was
-- measured, so a re-run of migration 21 will reproduce the same census.
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

-- Confirm the restore before committing: this must report 136 lane rows carrying the original triple again.
select count(*) as restored_false_triple
  from v_contract_requirements r
  join v_production_contracts c on c.id = r.contract_id
  join v_applications a         on a.id = c.application_id
 where a.builder = 'vraelis_api'
   and r.source = 'manual' and r.origin = 'user' and r.review_state = 'approved';

-- commit;   (or)   rollback;
