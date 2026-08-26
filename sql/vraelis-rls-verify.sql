-- ============================================================================
-- Verification for sql/vraelis-rls-01-deny-by-default.sql
-- Read-only. Run after applying the forward migration. Every check should report OK.
-- ============================================================================

\echo '== 1. Every table in public has RLS enabled =='
select case when count(*) = 0 then 'OK: all tables have RLS'
            else 'FAIL: ' || count(*) || ' without RLS: ' || string_agg(tablename, ', ') end as result
from pg_tables where schemaname = 'public' and not rowsecurity;

\echo '== 2. No permissive policy grants anon/authenticated access =='
select case when count(*) = 0 then 'OK: no policies present (deny-by-default)'
            else 'REVIEW: ' || count(*) || ' policy(ies): ' || string_agg(policyname || ' on ' || tablename, ', ') end as result
from pg_policies where schemaname = 'public';

\echo '== 3. anon and authenticated hold no table privileges =='
select case when count(*) = 0 then 'OK: no table grants to anon/authenticated'
            else 'FAIL: ' || count(*) || ' grant(s) remain' end as result
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated');

\echo '== 4. anon/authenticated/PUBLIC cannot execute application functions =='
select case when count(*) = 0 then 'OK: no EXECUTE granted on application functions'
            else 'FAIL: ' || string_agg(distinct p.proname || ' -> ' || r.rolname, ', ') end as result
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral (select unnest(array['anon','authenticated','public']) as rolname) r
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d join pg_extension e on e.oid = d.refobjid where d.objid = p.oid and d.deptype = 'e')
  and has_function_privilege(r.rolname, p.oid, 'EXECUTE');

\echo '== 5. Every SECURITY DEFINER function pins search_path =='
select case when count(*) = 0 then 'OK: all SECURITY DEFINER functions pin search_path'
            else 'FAIL: ' || string_agg(p.proname, ', ') end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
  and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%'));

\echo '== 6. service_role can still READ every table (this is the check that catches an outage) =='
select case when count(*) = 0 then 'OK: service_role can select every table'
            else 'FAIL: service_role cannot select ' || count(*) || ': ' || string_agg(tablename, ', ') end as result
from pg_tables
where schemaname = 'public'
  and not has_table_privilege('service_role', (quote_ident(schemaname) || '.' || quote_ident(tablename))::regclass, 'SELECT');

\echo '== 7. service_role can still WRITE every table =='
select case when count(*) = 0 then 'OK: service_role can insert/update/delete everywhere'
            else 'FAIL: service_role cannot write ' || count(*) || ': ' || string_agg(tablename, ', ') end as result
from pg_tables
where schemaname = 'public'
  and not (
    has_table_privilege('service_role', (quote_ident(schemaname) || '.' || quote_ident(tablename))::regclass, 'INSERT')
    and has_table_privilege('service_role', (quote_ident(schemaname) || '.' || quote_ident(tablename))::regclass, 'UPDATE')
    and has_table_privilege('service_role', (quote_ident(schemaname) || '.' || quote_ident(tablename))::regclass, 'DELETE')
  );

\echo '== 8. service_role can still EXECUTE every application function =='
select case when count(*) = 0 then 'OK: service_role retains EXECUTE'
            else 'FAIL: service_role lost EXECUTE on ' || string_agg(p.proname, ', ') end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and not exists (select 1 from pg_depend d join pg_extension e on e.oid = d.refobjid where d.objid = p.oid and d.deptype = 'e')
  and not has_function_privilege('service_role', p.oid, 'EXECUTE');

\echo '== 9. service_role still bypasses RLS =='
select case when rolbypassrls then 'OK: service_role has BYPASSRLS' else 'FAIL: service_role lost BYPASSRLS' end as result
from pg_roles where rolname = 'service_role';

\echo '== 10. The rollback ledger exists (the rollback refuses to run without it) =='
select case when to_regclass('public._rls_migration_01_applied') is not null
            then 'OK: ledger present with ' || (select count(*) from public._rls_migration_01_applied) || ' row(s)'
            else 'FAIL: ledger missing — rollback would refuse to run' end as result;
