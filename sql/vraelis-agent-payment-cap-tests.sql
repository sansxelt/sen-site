-- BEHAVIOURAL tests for sql/vraelis-agent-payment-cap.sql.
--
-- DESTRUCTIVE. This inserts test data and defines a helper function. Run it ONLY against a scratch
-- database — never against production, and never against a database holding real payments.
-- scripts/phase3-payment-cap-verify.ts stands up a throwaway PostgreSQL and runs it there.
--
-- It raises an exception on the first failed assertion, so a non-zero psql exit means a real failure.

\set ON_ERROR_STOP on
\pset pager off

create or replace function ck(label text, actual text, expected text) returns void language plpgsql as $ck$
begin
  if actual is not distinct from expected then raise notice 'PASS  % -> %', label, coalesce(actual,'<null>');
  else raise exception 'FAIL  %  expected=%  actual=%', label, expected, coalesce(actual,'<null>');
  end if;
end $ck$;

-- == A. Exact aggregation past 5,000 rows ==============================================
-- 6,000 settled reservations x 100c = 600,000c, above the 500,000c day cap.
-- The read this replaced stopped at 5,000 rows, so it would have seen 500,000c and let the
-- next payment through. The database aggregation sees all 6,000.
insert into v_agent_payment_reservations (owner_email, amount_cents, expires_at, settled_at)
select 'a@t.co', 100, now() + interval '1 hour', now() from generate_series(1, 6000);

select ck('A1 rows in the window', (select count(*)::text from v_agent_payment_reservations where owner_email='a@t.co'), '6000');
select ck('A2 day total is exact, not truncated at 5000',
          (v_reserve_agent_payment('a@t.co', 100, 500000, 2000000)->>'day_cents'), '600000');
select ck('A3 payment refused above the cap',
          (v_reserve_agent_payment('a@t.co', 100, 500000, 2000000)->>'reason'), 'daily_cap_reached');
select ck('A4 the old 5000-row read would have UNDER-reported',
          (select sum(amount_cents)::text from (select amount_cents from v_agent_payment_reservations
             where owner_email='a@t.co' limit 5000) s), '500000');

-- == B. Attacker-creatable pending rows cannot consume the cap =========================
-- /api/vraelis/book creates vraelis_payments rows with status pending under a widely-shared
-- intake key. 10,000 of them at $5 is 10x the daily cap.
insert into vraelis_payments (owner_email, amount_cents, status)
select 'b@t.co', 500, 'pending' from generate_series(1, 10000);

select ck('B1 old logic (every row, any status) would have blown the cap',
          (select (sum(amount_cents) > 500000)::text from (select amount_cents from vraelis_payments
             where owner_email='b@t.co' limit 5000) s), 'true');
select ck('B2 agent still authorized despite 10,000 attacker rows',
          (v_reserve_agent_payment('b@t.co', 100, 500000, 2000000)->>'ok'), 'true');
select ck('B3 attacker rows contributed nothing to the total',
          (v_reserve_agent_payment('b@t.co', 100, 500000, 2000000)->>'day_cents'), '100');

-- == C. Boundary equality: exactly on the cap is allowed, one cent past is not ==========
select ck('C1 reserve 900 of a 1000 cap', (v_reserve_agent_payment('c@t.co', 900, 1000, 999999)->>'ok'), 'true');
select ck('C2 exactly reaching the cap is allowed', (v_reserve_agent_payment('c@t.co', 100, 1000, 999999)->>'ok'), 'true');
select ck('C3 one cent past the cap is refused',
          (v_reserve_agent_payment('c@t.co', 1, 1000, 999999)->>'reason'), 'daily_cap_reached');

-- == D. Currency isolation: minor units are never added across currencies ===============
select ck('D1 usd budget consumed',
          (v_reserve_agent_payment('d@t.co', 1000, 1000, 999999, 30, 900, 'usd')->>'ok'), 'true');
select ck('D2 usd now refused',
          (v_reserve_agent_payment('d@t.co', 1, 1000, 999999, 30, 900, 'usd')->>'reason'), 'daily_cap_reached');
select ck('D3 eur has its own budget, unaffected',
          (v_reserve_agent_payment('d@t.co', 1000, 1000, 999999, 30, 900, 'eur')->>'ok'), 'true');

-- == E. Cycle cap enforced independently of the day cap =================================
insert into v_agent_payment_reservations (owner_email, amount_cents, expires_at, settled_at, created_at)
values ('e@t.co', 50000, now() + interval '1 hour', now(), now() - interval '5 days');
select ck('E1 the 5-day-old spend is outside the day window',
          (v_reserve_agent_payment('e@t.co', 100, 500000, 2000000)->>'day_cents'), '0');
select ck('E2 but inside the 30-day cycle window',
          (v_reserve_agent_payment('e@t.co', 100, 500000, 2000000)->>'cycle_cents'), '50100');
select ck('E3 cycle cap refuses independently',
          (v_reserve_agent_payment('e@t.co', 100, 500000, 50000)->>'reason'), 'cycle_cap_reached');

-- == F. Release returns the budget immediately ==========================================
select ck('F1 reserve the whole cap', (v_reserve_agent_payment('f@t.co', 1000, 1000, 999999)->>'ok'), 'true');
select ck('F2 next payment refused', (v_reserve_agent_payment('f@t.co', 100, 1000, 999999)->>'reason'), 'daily_cap_reached');
select ck('F3 release reports it acted',
          (select v_settle_agent_payment(id, false)::text from v_agent_payment_reservations
            where owner_email='f@t.co' order by created_at limit 1), 'true');
select ck('F4 budget is back', (v_reserve_agent_payment('f@t.co', 100, 1000, 999999)->>'ok'), 'true');
select ck('F5 release is idempotent',
          (select v_settle_agent_payment(id, false)::text from v_agent_payment_reservations
            where owner_email='f@t.co' and released_at is not null order by created_at limit 1), 'false');

-- == G. Settlement keeps the budget held ================================================
-- A settled reservation is a payment that really was issued, so it must keep counting.
select ck('G1 reserve', (v_reserve_agent_payment('g@t.co', 1000, 1000, 999999)->>'ok'), 'true');
select ck('G2 settle it',
          (select v_settle_agent_payment(id, true)::text from v_agent_payment_reservations
            where owner_email='g@t.co' limit 1), 'true');
select ck('G3 settled spend still counts',
          (v_reserve_agent_payment('g@t.co', 1, 1000, 999999)->>'reason'), 'daily_cap_reached');

-- == H. An abandoned authorization frees its budget when it expires =====================
select ck('H1 reserve with a 1s TTL, never settled',
          (v_reserve_agent_payment('h@t.co', 1000, 1000, 999999, 30, 1)->>'ok'), 'true');
select ck('H2 immediately refused',
          (v_reserve_agent_payment('h@t.co', 1, 1000, 999999, 30, 1)->>'reason'), 'daily_cap_reached');
select pg_sleep(1.3);
select ck('H3 expired reservation no longer counts',
          (v_reserve_agent_payment('h@t.co', 1000, 1000, 999999, 30, 1)->>'ok'), 'true');

-- == I. Replay idempotency: the same authorization does not reserve twice ===============
select ck('I1 first call',  (v_reserve_agent_payment('i@t.co', 600, 1000, 999999, 30, 900, 'usd', 'pay-1')->>'ok'), 'true');
select ck('I2 replay is accepted', (v_reserve_agent_payment('i@t.co', 600, 1000, 999999, 30, 900, 'usd', 'pay-1')->>'ok'), 'true');
select ck('I3 replay returns the SAME reservation',
          (select (count(distinct id) = 1)::text from v_agent_payment_reservations where owner_email='i@t.co'), 'true');
select ck('I4 budget consumed once, not twice',
          (v_reserve_agent_payment('i@t.co', 1, 1000, 999999, 30, 900, 'usd')->>'day_cents'), '600');
select ck('I5 replay is reported as a replay, not a new reservation',
          (v_reserve_agent_payment('i@t.co', 600, 1000, 999999, 30, 900, 'usd', 'pay-1')->>'replay'), 'true');
-- A RELEASED reference is a different situation: the payment it stood for was never created, so a retry
-- must genuinely re-authorize and face the cap again.
select ck('I6 release it',
          (select v_settle_agent_payment(id, false)::text from v_agent_payment_reservations
            where owner_email='i@t.co' and ext_ref='pay-1'), 'true');
select ck('I7 a real retry after release is re-authorized',
          (v_reserve_agent_payment('i@t.co', 600, 1000, 999999, 30, 900, 'usd', 'pay-1')->>'ok'), 'true');
select ck('I8 still exactly one row for that reference',
          (select count(*)::text from v_agent_payment_reservations where owner_email='i@t.co' and ext_ref='pay-1'), '1');
-- 601, not 600: the 1c probe in I4 SUCCEEDED, so it reserved a cent of its own. A successful
-- authorization is a mutation, and a test that forgets that is measuring its own footprint.
select ck('I9 the retry consumed the budget once, not twice',
          (v_reserve_agent_payment('i@t.co', 1, 1000, 999999, 30, 900, 'usd')->>'day_cents'), '601');
-- And a released reference that no longer fits must still be refused, not waved through as a replay.
select ck('I10 release again',
          (select v_settle_agent_payment(id, false)::text from v_agent_payment_reservations
            where owner_email='i@t.co' and ext_ref='pay-1'), 'true');
insert into v_agent_payment_reservations (owner_email, amount_cents, expires_at, settled_at)
values ('i@t.co', 900, now() + interval '1 hour', now());
select ck('I11 retry that no longer fits the cap is refused',
          (v_reserve_agent_payment('i@t.co', 600, 1000, 999999, 30, 900, 'usd', 'pay-1')->>'reason'), 'daily_cap_reached');

-- == J. Malformed input fails closed ====================================================
select ck('J1 zero amount',     (v_reserve_agent_payment('j@t.co', 0,    1000, 999999)->>'reason'), 'invalid');
select ck('J2 negative amount', (v_reserve_agent_payment('j@t.co', -100, 1000, 999999)->>'reason'), 'invalid');
select ck('J3 empty owner',     (v_reserve_agent_payment('',       100,  1000, 999999)->>'reason'), 'invalid');
select ck('J4 null owner',      (v_reserve_agent_payment(null,     100,  1000, 999999)->>'reason'), 'invalid');
select ck('J5 negative cap',    (v_reserve_agent_payment('j@t.co', 100,  -1,   999999)->>'reason'), 'invalid');
select ck('J6 nothing was reserved',
          (select count(*)::text from v_agent_payment_reservations where owner_email='j@t.co'), '0');

-- == K. Owner normalisation: case and whitespace cannot split one budget into several ===
select ck('K1 reserve as lowercase', (v_reserve_agent_payment('k@t.co', 900, 1000, 999999)->>'ok'), 'true');
select ck('K2 uppercase hits the SAME budget',
          (v_reserve_agent_payment('  K@T.CO  ', 200, 1000, 999999)->>'reason'), 'daily_cap_reached');
