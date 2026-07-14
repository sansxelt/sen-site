-- READ-ONLY verification for migration 12 (multi-runtime foundation), SCHEMA-OBJECT half.
-- Paste into the Supabase SQL editor and run. Every row is an assertion with a PASS/FAIL verdict; nothing
-- here writes. This half proves the things the JS data-verifier CANNOT see over PostgREST: index existence,
-- FK constraints, NOT-NULL constraints, and column TYPES. Run BOTH:
--   * this file (schema objects), and
--   * `npm run preflight:verify-mig12` (data shape: one web target/app, runs+issues resolve, no orphans).
-- Neither alone is sufficient — an adversarial audit showed a data-only check can false-PASS on a schema
-- whose objects are missing, and a schema-only check can pass on data the backfill never populated.

-- A. Required new tables exist.
select 'TABLE' as kind, t.tbl,
       case when to_regclass('public.'||t.tbl) is not null then 'PASS' else 'FAIL' end as verdict
from (values ('v_runtime_targets'), ('v_builds'), ('v_platform_decisions')) as t(tbl)
order by verdict desc, t.tbl;

-- B. Required additive columns exist WITH THE CORRECT TYPE (name AND data_type — catches a pre-existing
-- same-named column of the wrong type, which `add column if not exists` would silently leave in place).
-- Covers EVERY column migration 12 declares on the new tables + the additive columns on existing tables, so a
-- wrong-type column anywhere the migration touches is caught (no blind spots).
select 'COLUMN_TYPE' as kind, c.tbl||'.'||c.col||' ('||c.want||')' as col,
       case when exists (
         select 1 from information_schema.columns i
         where i.table_schema='public' and i.table_name=c.tbl and i.column_name=c.col and i.data_type=c.want
       ) then 'PASS' else 'FAIL' end as verdict
from (values
  -- v_runtime_targets
  ('v_runtime_targets','user_id','text'), ('v_runtime_targets','application_id','uuid'),
  ('v_runtime_targets','kind','text'), ('v_runtime_targets','label','text'),
  ('v_runtime_targets','environment','text'), ('v_runtime_targets','created_at','timestamp with time zone'),
  -- v_builds
  ('v_builds','user_id','text'), ('v_builds','runtime_target_id','uuid'), ('v_builds','kind','text'),
  ('v_builds','base_url','text'), ('v_builds','version','text'), ('v_builds','commit_sha','text'),
  ('v_builds','build_ref','text'), ('v_builds','artifact_hash','text'), ('v_builds','detail','jsonb'),
  -- v_platform_decisions
  ('v_platform_decisions','user_id','text'), ('v_platform_decisions','application_id','uuid'),
  ('v_platform_decisions','runtime_target_id','uuid'), ('v_platform_decisions','runtime_kind','text'),
  ('v_platform_decisions','build_id','uuid'), ('v_platform_decisions','environment','text'),
  ('v_platform_decisions','contract_version','integer'), ('v_platform_decisions','matrix_hash','text'),
  ('v_platform_decisions','adapter_version','text'), ('v_platform_decisions','decision','text'),
  ('v_platform_decisions','failure_class','text'), ('v_platform_decisions','summary','jsonb'),
  -- additive columns on existing tables
  ('v_issues','runtime_target_id','uuid'),
  ('v_preflight_runs','runtime_target_id','uuid'), ('v_preflight_runs','adapter_version','text')
) as c(tbl,col,want)
order by verdict desc, col;

-- C. kind defaults to exactly 'web' (so a backfilled/absent value reads as the web target). Exact match on
-- the default expression — a loose LIKE '%web%' would also pass an unintended default that merely contains
-- the substring (e.g. 'webhook'), so we require the canonical Postgres literal form.
select 'DEFAULT' as kind, 'v_runtime_targets.kind default ''web''' as label,
       coalesce((select column_default from information_schema.columns
                 where table_schema='public' and table_name='v_runtime_targets' and column_name='kind'), '(none)') as actual_default,
       case when exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name='v_runtime_targets' and column_name='kind'
           and column_default in ('''web''::text', '''web''')
       ) then 'PASS' else 'FAIL' end as verdict;

-- D. NOT-NULL constraints exist where the migration declares them (a null in these would mean the constraint
-- was never enforced — the data-verifier flags existing nulls, but this proves the constraint itself).
select 'NOT_NULL' as kind, c.tbl||'.'||c.col as col,
       case when exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name=c.tbl and column_name=c.col and is_nullable='NO'
       ) then 'PASS' else 'FAIL' end as verdict
from (values
  -- every column migration 12 declares NOT NULL (a relaxed constraint on any of these = never enforced)
  ('v_runtime_targets','user_id'), ('v_runtime_targets','application_id'),
  ('v_runtime_targets','kind'), ('v_runtime_targets','label'),
  ('v_builds','user_id'), ('v_builds','runtime_target_id'), ('v_builds','kind'), ('v_builds','detail'),
  ('v_platform_decisions','user_id'), ('v_platform_decisions','application_id'),
  ('v_platform_decisions','runtime_target_id'), ('v_platform_decisions','runtime_kind'),
  ('v_platform_decisions','decision'), ('v_platform_decisions','summary')
) as c(tbl,col)
order by verdict desc, col;

-- E. The UNIQUE INDEX that prevents duplicate targets exists (proves the enforcement object, not just that
-- today's data happens to be dup-free).
select 'UNIQUE_INDEX' as kind, 'v_runtime_targets_unique' as idx,
       case when exists (
         select 1 from pg_indexes where schemaname='public' and indexname='v_runtime_targets_unique'
       ) then 'PASS' else 'FAIL' end as verdict;

-- F. Supporting (non-unique) indexes exist — required by the migration for read performance.
select 'INDEX' as kind, x.idx,
       case when exists (select 1 from pg_indexes where schemaname='public' and indexname=x.idx)
            then 'PASS' else 'FAIL' end as verdict
from (values
  ('v_runtime_targets_app_idx'), ('v_runtime_targets_kind_idx'), ('v_builds_target_idx'),
  ('v_platform_decisions_target_idx'), ('v_platform_decisions_app_idx'), ('v_issues_runtime_target_idx')
) as x(idx)
order by verdict desc, x.idx;

-- G. FOREIGN-KEY constraints exist with the correct ON DELETE action (the load-bearing referential integrity
-- the data-verifier's orphan scan can only observe indirectly).
-- Both child and parent are pinned to schema 'public' (via pg_namespace) so a same-named table/FK in another
-- schema (a shadow/staging schema) cannot satisfy the assertion while the public FK is actually missing.
select 'FK' as kind, f.child||'.'||f.col||' -> '||f.parent||' ('||f.action||')' as fk,
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
       ) then 'PASS' else 'FAIL' end as verdict
from (values
  -- confdeltype: 'c'=cascade, 'n'=set null
  ('v_builds','runtime_target_id','v_runtime_targets','c'),
  ('v_platform_decisions','runtime_target_id','v_runtime_targets','c'),
  ('v_platform_decisions','build_id','v_builds','n')
) as f(child,col,parent,action)
order by verdict desc, fk;

-- H. Backfill population: every existing application has EXACTLY ONE web target (0 uncovered AND 0 apps with
-- >1). Zero apps is reported explicitly so an empty/wrong DB cannot read as a silent PASS.
select 'BACKFILL' as kind,
       (select count(*) from public.v_applications)::text as applications,
       (select count(*) from public.v_runtime_targets where kind='web')::text as web_targets,
       case
         when (select count(*) from public.v_applications) = 0
           then 'FAIL — zero applications visible (wrong DB / nothing to verify)'
         when (select count(*) from public.v_applications a
               where not exists (select 1 from public.v_runtime_targets t
                                 where t.application_id=a.id and t.kind='web')) > 0
           then 'FAIL — some applications have no web target (re-run the backfill INSERT)'
         when exists (select 1 from public.v_runtime_targets where kind='web'
                      group by application_id having count(*) > 1)
           then 'FAIL — an application has a duplicate web target'
         else 'PASS — every application has exactly one web target'
       end as verdict;

-- I. No target carries an unexpected kind (catches a stray/mis-written kind the backfill should never write).
select 'KIND' as kind,
       coalesce((select string_agg(distinct kind, ', ')
                 from public.v_runtime_targets
                 where kind not in ('web','api','android','ios','electron','windows','macos')), '(none)') as unexpected_kinds,
       case when not exists (
         select 1 from public.v_runtime_targets
         where kind not in ('web','api','android','ios','electron','windows','macos')
       ) then 'PASS' else 'FAIL — an unexpected runtime kind exists' end as verdict;

-- J. Rollback remains possible: the new columns on the EXISTING tables are nullable, so ignoring the new
-- tables is lossless (the existing web path never requires them).
select 'ROLLBACK' as kind, c.tbl||'.'||c.col as col,
       case when exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name=c.tbl and column_name=c.col and is_nullable='YES'
       ) then 'PASS — nullable, safely ignorable' else 'FAIL — additive column is NOT NULL (rollback not lossless)' end as verdict
from (values
  ('v_issues','runtime_target_id'), ('v_preflight_runs','runtime_target_id'), ('v_preflight_runs','adapter_version')
) as c(tbl,col)
order by verdict desc, col;

-- K. Historical web records: every run/issue with a non-null runtime_target_id points at a WEB target owned
-- by the same app+user (no historical row was re-pointed incorrectly by the optional correlation backfill).
select 'HISTORY' as kind, 'runs+issues resolve to their app''s web target' as label,
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
       then 'PASS' else 'FAIL — a run/issue resolves to the wrong or a non-web target' end as verdict;
