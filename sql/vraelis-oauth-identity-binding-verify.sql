-- Verification for sql/vraelis-oauth-identity-binding.sql. Read-only.

\echo '== 1. Table and function exist =='
select case when to_regclass('public.v_oauth_identities') is not null
             and exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='public' and p.proname='v_bind_oauth_identity')
            then 'OK' else 'FAIL: missing object(s)' end as result;

\echo '== 2. One subject per address per provider is enforced by an INDEX, not just by code =='
select case when count(*) > 0 then 'OK' else 'FAIL: no unique index on (provider, email)' end as result
from pg_indexes where schemaname='public' and indexname='v_oauth_identities_email_uidx';

\echo '== 3. search_path is pinned =='
select case when exists (select 1 from unnest(coalesce(proconfig,'{}')) c where c like 'search_path=%')
            then 'OK' else 'FAIL: not pinned' end as result
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='v_bind_oauth_identity';

\echo '== 4. Browser-facing roles cannot read the identity table =='
select case when count(*) = 0 then 'OK' else 'FAIL: ' || count(*) || ' grant(s)' end as result
from information_schema.role_table_grants
where table_schema='public' and table_name='v_oauth_identities' and grantee in ('anon','authenticated');

\echo '== 5. Browser-facing roles cannot execute the binding function =='
select case when count(*) = 0 then 'OK' else 'FAIL: ' || count(*) || ' execute grant(s)' end as result
from information_schema.role_routine_grants
where routine_schema='public' and routine_name='v_bind_oauth_identity'
  and grantee in ('anon','authenticated','PUBLIC');

\echo '== 6. RLS is enabled =='
select case when rowsecurity then 'OK' else 'FAIL: RLS off' end as result
from pg_tables where schemaname='public' and tablename='v_oauth_identities';

\echo '== 7. Concurrent first sign-ins for one address are serialised =='
select case when prosrc like '%pg_advisory_xact_lock%' then 'OK' else 'FAIL: no serialisation' end as result
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='v_bind_oauth_identity';
