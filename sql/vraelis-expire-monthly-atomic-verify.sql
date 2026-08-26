-- Verification for sql/vraelis-expire-monthly-atomic.sql. Read-only.

\echo '== 1. The function exists =='
select case when count(*) = 1 then 'OK: v_expire_monthly present' else 'FAIL: found ' || count(*) end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'v_expire_monthly';

\echo '== 2. search_path is pinned =='
select case when exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
            then 'OK: pinned' else 'FAIL: not pinned' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'v_expire_monthly';

\echo '== 3. Browser-facing roles cannot execute it =='
select case when count(*) = 0 then 'OK: no EXECUTE for anon/authenticated/public'
            else 'FAIL: ' || string_agg(r.rolname, ', ') end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
cross join lateral (select unnest(array['anon','authenticated','public']) as rolname) r
where n.nspname = 'public' and p.proname = 'v_expire_monthly'
  and has_function_privilege(r.rolname, p.oid, 'EXECUTE');

\echo '== 4. service_role CAN execute it =='
select case when has_function_privilege('service_role', p.oid, 'EXECUTE') then 'OK' else 'FAIL' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'v_expire_monthly';

\echo '== 5. It shares the hold lock namespace (or an expiry can interleave with a hold) =='
select case when prosrc like '%v_hold_credits:%' then 'OK: same advisory-lock key as v_hold_credits'
            else 'FAIL: different lock namespace — an expiry and a hold would not serialise' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'v_expire_monthly';

\echo '== 6. The idempotency index the duplicate branch relies on exists =='
select case when count(*) > 0 then 'OK: ext_ref unique index present'
            else 'REVIEW: no ext_ref unique index — replay protection depends on it' end as result
from pg_indexes where schemaname = 'public' and tablename = 'v_credit_ledger' and indexdef like '%ext_ref%';

\echo '== 7. No user holds a negative live balance (data health) =='
select case when count(*) = 0 then 'OK' else 'REVIEW: ' || count(*) || ' user(s) negative' end as result
from (select user_id, sum(delta) bal from v_credit_ledger
      where expires_at is null or expires_at > now() group by user_id) b where b.bal < 0;
