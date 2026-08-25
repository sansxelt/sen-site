-- Verification for sql/vraelis-agent-payment-cap.sql. Read-only: every statement is a select.

\echo '== 1. Both functions and the reservations table exist =='
select case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname = 'public'
                     and p.proname in ('v_reserve_agent_payment','v_settle_agent_payment')) = 2
             and to_regclass('public.v_agent_payment_reservations') is not null
            then 'OK' else 'FAIL: missing object(s)' end as result;

\echo '== 2. search_path pinned on both functions =='
select case when count(*) = 2 then 'OK: both pinned'
            else 'FAIL: only ' || count(*) || ' of 2 pinned' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('v_reserve_agent_payment','v_settle_agent_payment')
  and exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');

\echo '== 3. Browser-facing roles cannot reach the reservations table =='
select case when count(*) = 0 then 'OK: no anon/authenticated grants'
            else 'FAIL: ' || count(*) || ' grant(s)' end as result
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'v_agent_payment_reservations'
  and grantee in ('anon','authenticated');

\echo '== 4. Browser-facing roles cannot execute either function =='
select case when count(*) = 0 then 'OK: service_role only'
            else 'FAIL: ' || count(*) || ' execute grant(s)' end as result
from information_schema.role_routine_grants
where routine_schema = 'public'
  and routine_name in ('v_reserve_agent_payment','v_settle_agent_payment')
  and grantee in ('anon','authenticated','PUBLIC');

\echo '== 5. RLS is enabled on the reservations table =='
select case when rowsecurity then 'OK' else 'FAIL: RLS off' end as result
from pg_tables where schemaname = 'public' and tablename = 'v_agent_payment_reservations';

\echo '== 6. The aggregation is unlimited and happens in SQL (the defect this replaced) =='
select case when prosrc like '%sum(amount_cents)%' and prosrc not ilike '%limit 5000%'
            then 'OK: sums in the database, no row limit'
            else 'FAIL: aggregation looks limited' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'v_reserve_agent_payment';

\echo '== 7. Attacker-creatable payment rows cannot consume the cap =='
select case when prosrc not like '%vraelis_payments%'
            then 'OK: only this system''s own reservations count'
            else 'FAIL: reads vraelis_payments, which /api/vraelis/book can write' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'v_reserve_agent_payment';

\echo '== 8. Concurrent authorizations are serialised per owner =='
select case when prosrc like '%pg_advisory_xact_lock%' and prosrc like '%v_agent_payment:%'
            then 'OK: per-owner advisory lock, own namespace'
            else 'FAIL: no serialisation' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'v_reserve_agent_payment';

\echo '== 9. The sum is per-currency, not mixed minor units =='
select case when prosrc like '%currency = v_cur%'
            then 'OK' else 'FAIL: currencies summed together' end as result
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'v_reserve_agent_payment';

\echo '== 10. Replay idempotency index exists =='
select case when count(*) > 0 then 'OK'
            else 'FAIL: a replayed authorization could reserve twice' end as result
from pg_indexes where schemaname = 'public' and indexname = 'v_agent_pay_res_extref_uidx';
