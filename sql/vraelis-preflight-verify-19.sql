-- READ-ONLY verification for migration 19 (guarantees), SCHEMA-OBJECT half.
-- Paste into the Supabase SQL editor and Run. ONE statement -> ONE result grid with every assertion.
-- The first row is the SUMMARY; any FAIL rows float to the top under it. Nothing here writes.
--
-- This half proves what the JS data-verifier CANNOT see over PostgREST: index existence, the FK with its
-- ON DELETE action, NOT-NULL constraints, column TYPES, and defaults. Run BOTH:
--   * this file (schema objects), and
--   * `npm run guarantees:test` (data shape: FK/owner integrity, run->guarantee links, plan_state domain).
-- Neither alone is sufficient.

with checks as (

  -- A. The new table exists.
  select 'A TABLE' as section, 'v_guarantees' as item,
         case when to_regclass('public.v_guarantees') is not null then 'PASS' else 'FAIL' end as verdict

  union all

  -- B. Every column migration 19 declares exists WITH THE CORRECT TYPE (text[] reports as 'ARRAY').
  select 'B COLUMN_TYPE', c.tbl||'.'||c.col||' ('||c.want||')',
         case when exists (
           select 1 from information_schema.columns i
           where i.table_schema='public' and i.table_name=c.tbl and i.column_name=c.col and i.data_type=c.want
         ) then 'PASS' else 'FAIL' end
  from (values
    ('v_guarantees','id','text'), ('v_guarantees','user_id','text'), ('v_guarantees','application_id','uuid'),
    ('v_guarantees','title','text'), ('v_guarantees','scope','text'), ('v_guarantees','criticality','text'),
    ('v_guarantees','approved_claim','text'), ('v_guarantees','approved_plan','jsonb'),
    ('v_guarantees','approved_plan_hash','text'), ('v_guarantees','approved_role_refs','ARRAY'),
    ('v_guarantees','plan_version','integer'), ('v_guarantees','plan_approved_by','text'),
    ('v_guarantees','plan_approved_at','timestamp with time zone'), ('v_guarantees','plan_state','text'),
    ('v_guarantees','last_evaluated_at','timestamp with time zone'), ('v_guarantees','status','text'),
    ('v_guarantees','created_at','timestamp with time zone'), ('v_guarantees','updated_at','timestamp with time zone'),
    ('v_preflight_runs','guarantee_id','text')
  ) as c(tbl,col,want)

  union all

  -- C. Column defaults are the exact literals the migration declares.
  select 'C DEFAULT', d.tbl||'.'||d.col||' default '||d.want,
         case when exists (
           select 1 from information_schema.columns
           where table_schema='public' and table_name=d.tbl and column_name=d.col
             and column_default in (d.want||'::text', d.want)
         ) then 'PASS' else 'FAIL' end
  from (values
    ('v_guarantees','criticality',''''||'critical'||''''),
    ('v_guarantees','plan_state',''''||'draft'||''''),
    ('v_guarantees','status',''''||'active'||'''')
  ) as d(tbl,col,want)

  union all

  -- D. NOT-NULL constraints exist on every column the migration declares NOT NULL.
  select 'D NOT_NULL', c.tbl||'.'||c.col,
         case when exists (
           select 1 from information_schema.columns
           where table_schema='public' and table_name=c.tbl and column_name=c.col and is_nullable='NO'
         ) then 'PASS' else 'FAIL' end
  from (values
    ('v_guarantees','id'), ('v_guarantees','user_id'), ('v_guarantees','application_id'),
    ('v_guarantees','title'), ('v_guarantees','criticality'), ('v_guarantees','approved_role_refs'),
    ('v_guarantees','plan_version'), ('v_guarantees','plan_state'), ('v_guarantees','status'),
    ('v_guarantees','created_at'), ('v_guarantees','updated_at')
  ) as c(tbl,col)

  union all

  -- E. Supporting indexes exist (the objects themselves, not just that today's data is fine).
  select 'E INDEX', x.idx,
         case when exists (select 1 from pg_indexes where schemaname='public' and indexname=x.idx)
              then 'PASS' else 'FAIL' end
  from (values ('idx_v_guarantees_app'), ('idx_v_preflight_runs_guarantee')) as x(idx)

  union all

  -- F. The FK v_guarantees.application_id -> v_applications exists WITH ON DELETE CASCADE. Child and parent
  -- pinned to schema 'public' so a same-named FK in a shadow schema cannot satisfy the assertion.
  select 'F FK', 'v_guarantees.application_id -> v_applications (cascade)',
         case when exists (
           select 1
           from pg_constraint con
           join pg_class child on child.oid = con.conrelid
           join pg_namespace cn on cn.oid = child.relnamespace and cn.nspname='public'
           join pg_class parent on parent.oid = con.confrelid
           join pg_namespace pn on pn.oid = parent.relnamespace and pn.nspname='public'
           join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
           where con.contype='f' and array_length(con.conkey,1)=1
             and child.relname='v_guarantees' and parent.relname='v_applications'
             and a.attname='application_id' and con.confdeltype='c'
         ) then 'PASS' else 'FAIL' end

  union all

  -- G. Rollback remains lossless: the additive column on the EXISTING runs table is nullable, and there is
  -- deliberately NO FK on guarantee_id (archiving a guarantee must never rewrite historical run rows).
  select 'G ROLLBACK', 'v_preflight_runs.guarantee_id nullable + no FK',
         case when exists (
           select 1 from information_schema.columns
           where table_schema='public' and table_name='v_preflight_runs' and column_name='guarantee_id' and is_nullable='YES'
         ) and not exists (
           select 1 from pg_constraint con
           join pg_class child on child.oid = con.conrelid and child.relname='v_preflight_runs'
           join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
           where con.contype='f' and a.attname='guarantee_id'
         ) then 'PASS' else 'FAIL - guarantee_id must be nullable and carry no FK' end
)

select * from (
  select '0 SUMMARY' as section,
         (select count(*) from checks where verdict not like 'PASS%')::text||' failing / '
           ||(select count(*) from checks)::text||' assertions' as item,
         case when not exists (select 1 from checks where verdict not like 'PASS%')
              then 'ALL PASS - migration 19 schema verified' else 'FAIL - see rows below' end as verdict
  union all
  select * from checks
) x
order by case when section = '0 SUMMARY' then 0 when verdict not like 'PASS%' then 1 else 2 end, section, item;
