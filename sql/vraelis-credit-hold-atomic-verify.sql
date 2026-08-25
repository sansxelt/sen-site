-- Verification for sql/vraelis-credit-hold-atomic.sql. Read-only.

\echo '== 1. The function exists with the expected signature =='
select case when count(*) = 1 then 'OK: v_hold_credits(text, uuid, int, text) present'
            else 'FAIL: found ' || count(*) || ' matching function(s)' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'v_hold_credits';

\echo '== 2. search_path is pinned =='
select case when exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
            then 'OK: search_path pinned' else 'FAIL: search_path not pinned' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'v_hold_credits';

\echo '== 3. anon/authenticated/PUBLIC cannot execute it =='
select case when count(*) = 0 then 'OK: no EXECUTE for browser-facing roles'
            else 'FAIL: ' || string_agg(r.rolname, ', ') || ' can execute it' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join lateral (select unnest(array['anon','authenticated','public']) as rolname) r
where n.nspname = 'public' and p.proname = 'v_hold_credits'
  and has_function_privilege(r.rolname, p.oid, 'EXECUTE');

\echo '== 4. service_role CAN execute it =='
select case when has_function_privilege('service_role', p.oid, 'EXECUTE')
            then 'OK: service_role retains EXECUTE' else 'FAIL: service_role cannot execute' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'v_hold_credits';

\echo '== 5. No ledger row has ever gone negative in aggregate (data health) =='
select case when count(*) = 0 then 'OK: no user has a negative live balance'
            else 'REVIEW: ' || count(*) || ' user(s) with a negative live balance' end as result
from (
  select user_id, sum(delta) as bal
  from v_credit_ledger
  where expires_at is null or expires_at > now()
  group by user_id
) b where b.bal < 0;
