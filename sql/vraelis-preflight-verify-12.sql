-- READ-ONLY verification for migration 12 (multi-runtime foundation), SCHEMA-OBJECT half.
-- Paste into the Supabase SQL editor and Run. ONE statement -> ONE result grid with every assertion
-- (the editor only displays the last statement's result, so a multi-statement script hides all but one).
-- The first row is the SUMMARY; any FAIL rows float to the top right under it. Nothing here writes.
--
-- This half proves the things the JS data-verifier CANNOT see over PostgREST: index existence, FK
-- constraints with ON DELETE actions, NOT-NULL constraints, column TYPES, and the 'web' default. Run BOTH:
--   * this file (schema objects), and
--   * `npm run preflight:verify-mig12` (data shape: one web target/app, runs+issues resolve, no orphans).
-- Neither alone is sufficient — an adversarial audit showed a data-only check can false-PASS on a schema
-- whose objects are missing, and a schema-only check can pass on data the backfill never populated.

with checks as (

  -- A. Required new tables exist.
  select 'A TABLE' as section, t.tbl as item,
         case when to_regclass('public.'||t.tbl) is not null then 'PASS' else 'FAIL' end as verdict
  from (values ('v_runtime_targets'), ('v_builds'), ('v_platform_decisions')) as t(tbl)

  union all

  -- B. Every column migration 12 declares exists WITH THE CORRECT TYPE (catches a pre-existing same-named
  -- column of the wrong type, which `add column if not exists` would silently leave in place).
  select 'B COLUMN_TYPE', c.tbl||'.'||c.col||' ('||c.want||')',
         case when exists (
           select 1 from information_schema.columns i
           where i.table_schema='public' and i.table_name=c.tbl and i.column_name=c.col and i.data_type=c.want
         ) then 'PASS' else 'FAIL' end
  from (values
    ('v_runtime_targets','user_id','text'), ('v_runtime_targets','application_id','uuid'),
    ('v_runtime_targets','kind','text'), ('v_runtime_targets','label','text'),
    ('v_runtime_targets','environment','text'), ('v_runtime_targets','created_at','timestamp with time zone'),
    ('v_builds','user_id','text'), ('v_builds','runtime_target_id','uuid'), ('v_builds','kind','text'),
    ('v_builds','base_url','text'), ('v_builds','version','text'), ('v_builds','commit_sha','text'),
    ('v_builds','build_ref','text'), ('v_builds','artifact_hash','text'), ('v_builds','detail','jsonb'),
    ('v_platform_decisions','user_id','text'), ('v_platform_decisions','application_id','uuid'),
    ('v_platform_decisions','runtime_target_id','uuid'), ('v_platform_decisions','runtime_kind','text'),
    ('v_platform_decisions','build_id','uuid'), ('v_platform_decisions','environment','text'),
    ('v_platform_decisions','contract_version','integer'), ('v_platform_decisions','matrix_hash','text'),
    ('v_platform_decisions','adapter_version','text'), ('v_platform_decisions','decision','text'),
    ('v_platform_decisions','failure_class','text'), ('v_platform_decisions','summary','jsonb'),
    ('v_issues','runtime_target_id','uuid'),
    ('v_preflight_runs','runtime_target_id','uuid'), ('v_preflight_runs','adapter_version','text')
  ) as c(tbl,col,want)

  union all

  -- C. kind defaults to exactly 'web' (exact literal match; LIKE '%web%' would also pass e.g. 'webhook').
  select 'C DEFAULT',
         'v_runtime_targets.kind default ''web'' (actual: '||coalesce(
           (select column_default from information_schema.columns
            where table_schema='public' and table_name='v_runtime_targets' and column_name='kind'), '(none)')||')',
         case when exists (
           select 1 from information_schema.columns
           where table_schema='public' and table_name='v_runtime_targets' and column_name='kind'
             and column_default in ('''web''::text', '''web''')
         ) then 'PASS' else 'FAIL' end

  union all

  -- D. NOT-NULL constraints exist on every column the migration declares NOT NULL (a relaxed constraint on
  -- any of these = never enforced; the data-verifier can only flag existing nulls, this proves the object).
  select 'D NOT_NULL', c.tbl||'.'||c.col,
         case when exists (
           select 1 from information_schema.columns
           where table_schema='public' and table_name=c.tbl and column_name=c.col and is_nullable='NO'
         ) then 'PASS' else 'FAIL' end
  from (values
    ('v_runtime_targets','user_id'), ('v_runtime_targets','application_id'),
    ('v_runtime_targets','kind'), ('v_runtime_targets','label'),
    ('v_builds','user_id'), ('v_builds','runtime_target_id'), ('v_builds','kind'), ('v_builds','detail'),
    ('v_platform_decisions','user_id'), ('v_platform_decisions','application_id'),
    ('v_platform_decisions','runtime_target_id'), ('v_platform_decisions','runtime_kind'),
    ('v_platform_decisions','decision'), ('v_platform_decisions','summary')
  ) as c(tbl,col)

  union all

  -- E. The UNIQUE INDEX that prevents duplicate targets exists (the enforcement object itself, not just
  -- that today's data happens to be dup-free).
  select 'E UNIQUE_INDEX', 'v_runtime_targets_unique',
         case when exists (
           select 1 from pg_indexes where schemaname='public' and indexname='v_runtime_targets_unique'
         ) then 'PASS' else 'FAIL' end

  union all

  -- F. Supporting (non-unique) indexes exist.
  select 'F INDEX', x.idx,
         case when exists (select 1 from pg_indexes where schemaname='public' and indexname=x.idx)
              then 'PASS' else 'FAIL' end
  from (values
    ('v_runtime_targets_app_idx'), ('v_runtime_targets_kind_idx'), ('v_builds_target_idx'),
    ('v_platform_decisions_target_idx'), ('v_platform_decisions_app_idx'), ('v_issues_runtime_target_idx')
  ) as x(idx)

  union all

  -- G. FOREIGN-KEY constraints exist with the correct ON DELETE action. Child AND parent pinned to schema
  -- 'public' so a same-named FK in a shadow/staging schema cannot satisfy the assertion.
  select 'G FK', f.child||'.'||f.col||' -> '||f.parent||' ('||case f.action when 'c' then 'cascade' else 'set null' end||')',
         case when exists (
           select 1
           from pg_constraint con
           join pg_class child on child.oid = con.conrelid
           join pg_namespace cn on cn.oid = child.relnamespace and cn.nspname='public'
           join pg_class parent on parent.oid = con.confrelid
           join pg_namespace pn on pn.oid = parent.relnamespace and pn.nspname='public'
           join pg_attribute a on a.attrelid = con.conrelid and a.attnum = con.conkey[1]
           where con.contype='f' and array_length(con.conkey,1)=1
             and child.relname=f.child and parent.relname=f.parent
             and a.attname=f.col and con.confdeltype=f.action
         ) then 'PASS' else 'FAIL' end
  from (values
    ('v_builds','runtime_target_id','v_runtime_targets','c'),
    ('v_platform_decisions','runtime_target_id','v_runtime_targets','c'),
    ('v_platform_decisions','build_id','v_builds','n')
  ) as f(child,col,parent,action)

  union all

  -- H. Backfill population: every existing application has EXACTLY ONE web target. Zero apps is an explicit
  -- FAIL so an empty/wrong DB cannot read as a silent PASS.
  select 'H BACKFILL',
         'apps='||(select count(*) from public.v_applications)::text
           ||' web_targets='||(select count(*) from public.v_runtime_targets where kind='web')::text,
         case
           when (select count(*) from public.v_applications) = 0
             then 'FAIL - zero applications visible (wrong DB / nothing to verify)'
           when (select count(*) from public.v_applications a
                 where not exists (select 1 from public.v_runtime_targets t
                                   where t.application_id=a.id and t.kind='web')) > 0
             then 'FAIL - some applications have no web target (re-run the backfill INSERT)'
           when exists (select 1 from public.v_runtime_targets where kind='web'
                        group by application_id having count(*) > 1)
             then 'FAIL - an application has a duplicate web target'
           else 'PASS'
         end

  union all

  -- I. No target carries an unexpected kind.
  select 'I KIND',
         'unexpected kinds: '||coalesce(
           (select string_agg(distinct kind, ', ') from public.v_runtime_targets
            where kind not in ('web','api','android','ios','electron','windows','macos')), '(none)'),
         case when not exists (
           select 1 from public.v_runtime_targets
           where kind not in ('web','api','android','ios','electron','windows','macos')
         ) then 'PASS' else 'FAIL' end

  union all

  -- J. Rollback remains possible: additive columns on EXISTING tables are nullable (ignoring the new tables
  -- is lossless; the existing web path never requires them).
  select 'J ROLLBACK', c.tbl||'.'||c.col||' nullable',
         case when exists (
           select 1 from information_schema.columns
           where table_schema='public' and table_name=c.tbl and column_name=c.col and is_nullable='YES'
         ) then 'PASS' else 'FAIL - additive column is NOT NULL (rollback not lossless)' end
  from (values
    ('v_issues','runtime_target_id'), ('v_preflight_runs','runtime_target_id'), ('v_preflight_runs','adapter_version')
  ) as c(tbl,col)

  union all

  -- K. Historical web records: every run/issue with a non-null runtime_target_id points at a WEB target
  -- owned by the same app+user (no historical row was re-pointed incorrectly).
  select 'K HISTORY', 'runs+issues resolve to their app''s web target',
         case when
           not exists (
             select 1 from public.v_preflight_runs r
             left join public.v_runtime_targets t on t.id = r.runtime_target_id
             where r.runtime_target_id is not null
               and (t.id is null or t.kind <> 'web' or t.application_id <> r.application_id or t.user_id <> r.user_id))
           and not exists (
             select 1 from public.v_issues i
             left join public.v_runtime_targets t on t.id = i.runtime_target_id
             where i.runtime_target_id is not null
               and (t.id is null or t.kind <> 'web' or t.application_id <> i.application_id or t.user_id <> i.user_id))
         then 'PASS' else 'FAIL - a run/issue resolves to the wrong or a non-web target' end
)

select * from (
  select '0 SUMMARY' as section,
         (select count(*) from checks where verdict not like 'PASS%')::text||' failing / '
           ||(select count(*) from checks)::text||' assertions' as item,
         case when not exists (select 1 from checks where verdict not like 'PASS%')
              then 'ALL PASS - migration 12 schema verified' else 'FAIL - see rows below' end as verdict
  union all
  select * from checks
) x
order by case when section = '0 SUMMARY' then 0 when verdict not like 'PASS%' then 1 else 2 end, section, item;
