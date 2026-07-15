-- CP3 (zero provider cost) — prove the free-pass atomic claim is per CANONICAL INBOX and that a second
-- claim on the same inbox CANNOT be inserted (the DB-level double-spend guard). Run in the Supabase SQL
-- editor. It inserts two TEST claim rows for a fake canonical inbox, shows the second fails on the PK,
-- then DELETES the test rows. It never touches a real account and never starts a run.
--
-- Read each RAISE NOTICE / result. Expected: first insert succeeds, second raises unique_violation
-- (23505), final select shows exactly ONE surviving test row, cleanup removes it.

do $$
declare
  test_canon text := 'cp3-proof@example-test.invalid';   -- fake canonical inbox, not a real user
  second_failed boolean := false;
begin
  -- clean any leftover from a prior run
  delete from public.v_free_pass_claims where canonical_email = test_canon;

  -- First claim for this canonical inbox: must SUCCEED (this is the "one free pass" winner).
  insert into public.v_free_pass_claims (canonical_email, user_id, run_id)
  values (test_canon, 'cp3-proof+a@example-test.invalid', null);
  raise notice 'CP3: first claim inserted OK (the winner holds the inbox''s one free pass).';

  -- Second claim for the SAME canonical inbox (a different alias account): must FAIL on the PK.
  -- This is the concurrent-double-spend guard: two aliases of one inbox cannot both hold a free claim.
  begin
    insert into public.v_free_pass_claims (canonical_email, user_id, run_id)
    values (test_canon, 'cp3-proof+b@example-test.invalid', null);
    raise notice 'CP3: *** FAIL *** second claim inserted — the PK guard is NOT protecting the inbox!';
  exception when unique_violation then
    second_failed := true;
    raise notice 'CP3: second claim correctly REJECTED (unique_violation) — one free pass per canonical inbox holds.';
  end;

  if not second_failed then
    raise exception 'CP3 FAILED: the second claim was NOT rejected. The double-spend guard is broken.';
  end if;
end $$;

-- Exactly one surviving test row for the fake inbox (the winner):
select canonical_email, user_id, run_id, claimed_at
from public.v_free_pass_claims
where canonical_email = 'cp3-proof@example-test.invalid';

-- Cleanup: remove the test row so nothing lingers.
delete from public.v_free_pass_claims where canonical_email = 'cp3-proof@example-test.invalid';

-- Confirm cleanup (should return 0 rows):
select count(*) as leftover_test_rows
from public.v_free_pass_claims
where canonical_email = 'cp3-proof@example-test.invalid';
