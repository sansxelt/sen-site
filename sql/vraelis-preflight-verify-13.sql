-- READ-ONLY verification for migration 13 (API beta additive columns). Paste into the Supabase SQL editor
-- and Run. ONE statement -> ONE result grid (summary row first). Nothing here writes.

with checks as (
  select 'A COLUMN_TYPE' as section, c.tbl||'.'||c.col||' ('||c.want||')' as item,
         case when exists (
           select 1 from information_schema.columns i
           where i.table_schema='public' and i.table_name=c.tbl and i.column_name=c.col and i.data_type=c.want
         ) then 'PASS' else 'FAIL' end as verdict
  from (values
    ('v_test_flows','runtime_target_id','uuid'),
    ('v_run_steps','evidence','jsonb')
  ) as c(tbl,col,want)

  union all

  -- Both new columns must be safely ignorable for rollback: runtime_target_id nullable; evidence has a
  -- default (so an insert omitting it is valid). We check nullability of runtime_target_id and default of
  -- evidence.
  select 'B ROLLBACK', 'v_test_flows.runtime_target_id nullable',
         case when exists (select 1 from information_schema.columns
           where table_schema='public' and table_name='v_test_flows' and column_name='runtime_target_id' and is_nullable='YES')
         then 'PASS' else 'FAIL' end

  union all

  select 'B ROLLBACK', 'v_run_steps.evidence has a default',
         case when exists (select 1 from information_schema.columns
           where table_schema='public' and table_name='v_run_steps' and column_name='evidence' and column_default is not null)
         then 'PASS' else 'FAIL' end

  union all

  select 'C INDEX', 'v_test_flows_runtime_target_idx',
         case when exists (select 1 from pg_indexes where schemaname='public' and indexname='v_test_flows_runtime_target_idx')
         then 'PASS' else 'FAIL' end

  union all

  -- Existing web flows are unchanged: every current v_test_flows row has a null runtime_target_id (nothing
  -- backfilled it, and API flows don't exist yet). A non-null here before any API flow exists would be an
  -- anomaly. (After API flows are authored this count is informational, not a failure.)
  select 'D BACKCOMPAT',
         'web flows still null: '||(select count(*) from public.v_test_flows where runtime_target_id is null)::text
           ||' of '||(select count(*) from public.v_test_flows)::text,
         'INFO'
)
select * from (
  select '0 SUMMARY' as section,
         (select count(*) from checks where verdict='FAIL')::text||' failing / '
           ||(select count(*) from checks where verdict in ('PASS','FAIL'))::text||' assertions' as item,
         case when not exists (select 1 from checks where verdict='FAIL')
              then 'ALL PASS - migration 13 applied' else 'FAIL - see rows below' end as verdict
  union all
  select * from checks
) x
order by case when section='0 SUMMARY' then 0 when verdict='FAIL' then 1 else 2 end, section, item;
