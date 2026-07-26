-- READ-ONLY schema verification. Paste this whole file into the Supabase SQL editor and run it.
--
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run
--
-- It writes nothing. It answers one question: which provenance migrations are actually applied?
-- These facts are not readable over PostgREST, which is why they cannot be checked from a script.

select
  'default: ' || column_name as item,
  coalesce(column_default, '(none)') as value,
  case
    when column_name = 'origin'       and column_default like '%unspecified%' then 'OK migration 20'
    when column_name = 'review_state' and column_default like '%suggested%'   then 'OK migration 20'
    when column_name = 'origin'       and column_default like '%user%'        then 'MIGRATION 20 NOT APPLIED'
    when column_name = 'review_state' and column_default like '%approved%'    then 'MIGRATION 20 NOT APPLIED'
    else 'unexpected'
  end as verdict
from information_schema.columns
where table_name = 'v_contract_requirements'
  and column_name in ('origin', 'review_state')

union all

select
  'constraint: ' || conname,
  case when convalidated then 'VALIDATED' else 'not valid (expected until the correction commits)' end,
  case
    when conname = 'chk_v_req_approved_matches_review_state' then 'OK migration 22'
    else 'OK migration 20'
  end
from pg_constraint
where conrelid = 'v_contract_requirements'::regclass
  and conname like 'chk_v_req_%'

union all

select 'constraint: ' || conname, case when convalidated then 'VALIDATED' else 'not valid' end, 'OK migration 20'
from pg_constraint
where conrelid = 'v_production_contracts'::regclass
  and conname = 'chk_v_contract_legacy_class_value'

order by item;

-- ── WHAT A CORRECT RESULT LOOKS LIKE ───────────────────────────────────────────────────────────────────
--
-- 11 rows in total:
--
--   default: origin                                      'unspecified'::text   OK migration 20
--   default: review_state                                'suggested'::text     OK migration 20
--   constraint: chk_v_contract_legacy_class_value        not valid             OK migration 20
--   constraint: chk_v_req_approved_has_basis             not valid             OK migration 20
--   constraint: chk_v_req_approved_matches_review_state  not valid             OK migration 22
--   constraint: chk_v_req_basis_complete                 not valid             OK migration 20
--   constraint: chk_v_req_legacy_class_value             not valid             OK migration 20
--   constraint: chk_v_req_origin                         not valid             OK migration 20
--   constraint: chk_v_req_review_basis_value             not valid             OK migration 20
--   constraint: chk_v_req_review_state                   not valid             OK migration 20
--   constraint: chk_v_req_unapproved_clean               not valid             OK migration 20
--
-- 7 chk_v_req_* rows  -> migration 20 applied, migration 22 NOT applied
-- 8 chk_v_req_* rows  -> both applied, including chk_v_req_approved_matches_review_state
--
-- "not valid" is CORRECT at this stage. The constraints bind every new write and are deliberately not
-- validated against existing rows until the manual correction's stage 7, which is the last gate before
-- its COMMIT.
--
-- If a default still reads 'user' or 'approved', migration 20 did not apply. Stop: the freeze must stay on
-- and the runbook order changes.
