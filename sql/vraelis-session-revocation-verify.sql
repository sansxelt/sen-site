-- Verification for sql/vraelis-session-revocation.sql. Read-only.
--
-- Written during Phase 4: the staging runbook listed a verifier for this migration and there was not one.
-- Every other migration on this branch ships with one, and a migration that touches session validity
-- should not be the exception.

\echo '== 1. The revocation table exists =='
select case when to_regclass('public.v_session_revocation') is not null
            then 'OK' else 'FAIL: table missing' end as result;

\echo '== 2. One row per user — the counter must not be able to fork =='
select case when count(*) = 1 then 'OK: user_id is the primary key'
            else 'FAIL: no primary key on user_id' end as result
from information_schema.table_constraints tc
join information_schema.key_column_usage k
  on k.constraint_name = tc.constraint_name and k.table_name = tc.table_name
where tc.table_schema = 'public' and tc.table_name = 'v_session_revocation'
  and tc.constraint_type = 'PRIMARY KEY' and k.column_name = 'user_id';

\echo '== 3. token_version is NOT NULL with a default, so a fresh row reads as 0 =='
select case when is_nullable = 'NO' and column_default is not null then 'OK'
            else 'FAIL: a null or defaultless token_version would make revocation ambiguous' end as result
from information_schema.columns
where table_schema = 'public' and table_name = 'v_session_revocation' and column_name = 'token_version';

\echo '== 4. RLS is enabled =='
select case when rowsecurity then 'OK' else 'FAIL: RLS off' end as result
from pg_tables where schemaname = 'public' and tablename = 'v_session_revocation';

\echo '== 5. No policy exists, so deny-by-default really denies =='
select case when count(*) = 0 then 'OK: no policy, so non-BYPASSRLS roles reach zero rows'
            else 'FAIL: ' || count(*) || ' policy(ies) grant row access' end as result
from pg_policies where schemaname = 'public' and tablename = 'v_session_revocation';

\echo '== 6. Browser-facing roles hold no privileges =='
select case when count(*) = 0 then 'OK' else 'FAIL: ' || count(*) || ' grant(s) to anon/authenticated' end as result
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'v_session_revocation'
  and grantee in ('anon', 'authenticated');

\echo '== 7. service_role can still read and write it (the app depends on this) =='
select case when count(*) >= 2 then 'OK'
            else 'FAIL: service_role cannot maintain the counter — revocation would break' end as result
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'v_session_revocation'
  and grantee = 'service_role' and privilege_type in ('SELECT', 'INSERT', 'UPDATE');
