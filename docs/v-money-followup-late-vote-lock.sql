-- ─────────────────────────────────────────────────────────────────────────────
-- MONEY-RACE FIX #5: close the late-vote / completion-snapshot over-refund race.
--
-- SUPERSEDES the earlier draft of this file (a standalone v_lock_test + a separate
-- JS COUNT). That draft was a NO-OP: Supabase-PostgREST runs every .from()/.rpc()
-- as its own autocommit transaction, and pg_advisory_xact_lock() is TRANSACTION-
-- scoped, so a lock taken in a standalone v_lock_test() releases the instant that
-- function returns — the JS COUNT that followed held no lock. The tally COUNT must
-- be CO-TRANSACTIONAL with the lock, so it has to live inside ONE rpc. That is what
-- v_complete_test does below.
--
-- THE BUG: completeTest flips active→complete, then COUNTs valid judgments in a
-- SEPARATE query to compute unfilled = target - count. A valid vote already in
-- flight can commit AFTER that count, so the closer snapshots one short, refunds an
-- extra credit for a slot that actually filled, and the platform funds that late
-- voter's reward. Bounded (0–2 votes racing the exact close instant).
--
-- THE FIX (two parts, both idempotent / safe to re-run):
--   1. v_record_vote takes the per-test advisory lock right after its status guard,
--      AND re-checks status='active' UNDER the lock before inserting. So a vote that
--      was in flight when the test closed is rejected instead of filling a closed
--      slot (this is the "strict" closure — makes the count exact in BOTH orderings).
--   2. v_complete_test takes the SAME lock and, in one transaction, flips + COUNTs,
--      returning the accurate totals for the refund. Because a racing vote holds the
--      same lock across its insert+recount+commit, the closer's count can neither
--      miss a committed vote nor see a half-committed one.
--
-- DEADLOCK-FREE: lock acquisition order is always test → reward (v_record_vote);
-- v_complete_test takes test only; v_launch_test takes user only. The three keyspaces
-- are disjoint (hashtext(user) vs 'test:'||id vs 'reward:'||voter) and no path ever
-- takes reward-then-test, so there is no cycle.
--
-- PERF: the vote hot path pays ONE extra advisory lock, uncontended except at the
-- exact close instant of the same test; the counts under the lock are indexed
-- (v_judg_test_idx, v_judg_status_idx). No throughput cliff in normal voting.
--
-- ROLLOUT ORDER (the JS change must ship LAST):
--   1. Apply BOTH functions below in Supabase (any order — both are safe standalone;
--      until the JS ships, completeTest keeps using its current path).
--   2. Confirm both exist in prod (a call returns without a 42883 "function does not
--      exist" error).
--   3. Ship the completeTest JS change (already prepared) that calls v_complete_test.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) v_record_vote v3 — identical to sql/vraelis-rank.sql:274-324 except for the
--       per-test advisory lock + an under-lock status re-check. No amount/semantic
--       change to counting, rewards, or dedup. Signature unchanged (drop matches v2).
drop function if exists v_record_vote(uuid, text, uuid, text, int, int, text, text, text, text);
create or replace function v_record_vote(
  p_test uuid, p_voter text, p_option uuid, p_reason text, p_time_spent int, p_reward_cap int,
  p_status text default 'valid', p_reject_reason text default null,
  p_ip_hash text default null, p_device_hash text default null
) returns jsonb language plpgsql as $$
declare
  v_voter text := lower(trim(p_voter));
  v_owner text; v_tstatus text; v_valid_cur int; v_target int;
  v_opt_ok int; v_valid int; v_reward_today int; v_earned boolean := false;
  v_vote_status text := case when p_status = 'rejected' then 'rejected' else 'valid' end;
begin
  select user_id, status, votes_valid, votes_target into v_owner, v_tstatus, v_valid_cur, v_target from v_tests where id = p_test;
  if not found or v_tstatus <> 'active' or v_owner = v_voter or v_valid_cur >= v_target then
    return jsonb_build_object('status','invalid');
  end if;

  -- ▼▼▼ ADDED vs v2. Serialize this vote's insert + votes_valid recount + commit
  -- against v_complete_test's locked count, using the same per-test key. Taken AFTER
  -- the cheap guard (votes to closed tests never contend) and BEFORE the INSERT.
  perform pg_advisory_xact_lock(hashtext('test:' || p_test::text)::bigint);

  -- Re-check UNDER the lock. If this vote's guard passed while the test was active
  -- but a close committed while we waited for the lock, the test is now 'complete'
  -- (or full) — reject instead of filling an already-closed slot. This makes the
  -- closer's count exact in BOTH lock orderings (no over-fill, no over-reward, and
  -- the closer's refund of the genuinely-unfilled slots stands correct).
  select status, votes_valid, votes_target into v_tstatus, v_valid_cur, v_target from v_tests where id = p_test;
  if v_tstatus <> 'active' or v_valid_cur >= v_target then
    return jsonb_build_object('status','invalid');
  end if;
  -- ▲▲▲

  select count(*) into v_opt_ok from v_test_options where id = p_option and test_id = p_test;
  if v_opt_ok = 0 then return jsonb_build_object('status','invalid'); end if;

  begin
    insert into v_judgments (test_id, voter_id, option_id, reason, time_spent_ms, status, reject_reason, ip_hash, device_hash)
      values (p_test, v_voter, p_option, nullif(p_reason,''), p_time_spent, v_vote_status, p_reject_reason, p_ip_hash, p_device_hash);
  exception when unique_violation then
    return jsonb_build_object('status','dup');
  end;

  insert into v_voter_rep (voter_id, valid, rejected)
    values (v_voter, case when v_vote_status='valid' then 1 else 0 end, case when v_vote_status='rejected' then 1 else 0 end)
    on conflict (voter_id) do update set
      valid = v_voter_rep.valid + (case when v_vote_status='valid' then 1 else 0 end),
      rejected = v_voter_rep.rejected + (case when v_vote_status='rejected' then 1 else 0 end),
      updated_at = now();

  select count(*) into v_valid from v_judgments where test_id = p_test and status = 'valid';
  update v_tests set votes_valid = v_valid where id = p_test;

  if v_vote_status = 'valid' then
    perform pg_advisory_xact_lock(hashtext('reward:' || v_voter)::bigint);
    select coalesce(sum(delta),0) into v_reward_today from v_credit_ledger
      where user_id = v_voter and reason = 'reward'
        and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
    if v_reward_today < p_reward_cap then
      begin
        insert into v_credit_ledger (user_id, delta, reason, bucket, ref_type, ref_id, ext_ref)
          values (v_voter, 1, 'reward', 'purchased', 'vote', p_test, 'reward:' || p_test::text);
        v_earned := true;
      exception when unique_violation then v_earned := false; end;
    end if;
  end if;

  return jsonb_build_object('status','ok','vote_status',v_vote_status,'earned',v_earned,'votes_valid',v_valid,'should_complete', v_valid >= v_target);
end; $$;


-- ── 2) v_complete_test — the atomic close authority. ONE tx holds the per-test
--       advisory lock across the flip + both counts. Idempotent: safe to re-call on
--       an already-complete test (flipped=false, but still returns the accurate
--       totals so a stranded refund from a crashed prior run is backfilled with the
--       right number). Does NOT change credit/reward amounts — it only makes the
--       total used for `unfilled` accurate under concurrency.
create or replace function v_complete_test(p_test uuid) returns jsonb language plpgsql as $$
declare
  v_status text; v_target int; v_user text;
  v_flipped boolean := false;
  v_valid int; v_filtered int;
begin
  perform pg_advisory_xact_lock(hashtext('test:' || p_test::text)::bigint);

  select status, votes_target, user_id into v_status, v_target, v_user
    from v_tests where id = p_test;
  if not found then
    return jsonb_build_object('found', false);
  end if;

  if v_status = 'active' then
    update v_tests set status = 'complete', completed_at = now()
      where id = p_test and status = 'active';
    v_flipped := true;
    v_status := 'complete';
  end if;

  -- Counts taken UNDER the lock, so a racing vote is either fully counted (it
  -- committed before us and released the lock) or fully excluded (it is blocked on
  -- the lock and, on resuming, re-checks status='complete' and rejects itself).
  select count(*) into v_valid    from v_judgments where test_id = p_test and status = 'valid';
  select count(*) into v_filtered from v_judgments where test_id = p_test and status = 'rejected';

  return jsonb_build_object(
    'found', true,
    'flipped', v_flipped,
    'status', v_status,
    'total_valid', v_valid,
    'total_filtered', v_filtered,
    'votes_target', v_target,
    'user_id', v_user
  );
end; $$;

-- Verify after applying (staging): drive a test to target-1 valid, then fire N
-- concurrent valid votes together with a close. Assert: exactly one completion,
-- votes_valid never exceeds target, unfilled == max(0, target - true_valid_count)
-- exactly, buyer refunded for exactly the unfilled slots, each valid voter rewarded
-- once, no reward for a vote rejected by the under-lock re-check.
