-- ─────────────────────────────────────────────────────────────────────────────
-- FOLLOW-UP (not yet shipped): per-test advisory lock to close the late-vote
-- completion-snapshot over-refund race (money-race audit finding #5, medium).
--
-- THE BUG: completeTest() flips active→complete under the v_tests row lock, then
-- COUNTs valid judgments in a SEPARATE query to compute unfilled = target - count.
-- v_record_vote reads v_tests with a PLAIN select (no per-test lock; the only
-- advisory lock there is per-VOTER, for rewards). So a valid vote can commit its
-- judgment AFTER the closer's COUNT but was already in-flight — the closer snapshots
-- one short, refunds 1 extra credit to the buyer for a slot that actually filled,
-- and the platform funds that late voter's reward. Bounded (0–2 votes racing the
-- exact close instant), never a stranded-escrow class bug.
--
-- WHY SEPARATE: this touches the HOT vote path (v_record_vote runs on every vote),
-- so it must be applied + confirmed present in prod BEFORE the completeTest JS lock
-- call ships, and rolled out on its own so a vote-path regression is isolated.
--
-- ROLLOUT ORDER:
--   1. Apply this migration in Supabase (adds the lock to v_record_vote + v_lock_test).
--   2. Confirm both exist (no 42883) in prod.
--   3. THEN ship the JS change in completeTest that calls v_lock_test(testId)
--      immediately before its valid-judgment snapshot.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Tiny locking helper the closer (completeTest) calls before its COUNT snapshot.
create or replace function v_lock_test(p_test uuid) returns void language plpgsql as $$
begin
  perform pg_advisory_xact_lock(hashtext('test:' || p_test::text)::bigint);
end;
$$;

-- 2) Add the SAME per-test advisory lock inside v_record_vote, right after the
--    status guard and BEFORE the judgment INSERT, so a vote holds the lock across
--    its insert + votes_valid recount + commit. This is the full v2 function from
--    sql/vraelis-rank.sql:274 with ONE added `perform pg_advisory_xact_lock(...)`
--    line (marked below). Everything else is unchanged — amounts/semantics identical.
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

  -- ▼▼▼ THE ONLY ADDED LINE: serialize this vote's insert+recount+commit against a
  -- concurrent completeTest() COUNT snapshot, so the closer can't refund a slot this
  -- vote is filling. Same per-test key v_lock_test uses.
  perform pg_advisory_xact_lock(hashtext('test:' || p_test::text)::bigint);
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

-- After applying: verify with a concurrency test on staging (drive to target-1, fire
-- N concurrent votes + a close, assert unfilled == max(0, target - true_valid_count)
-- exactly, no buyer over-refund, reward count == valid votes). Then ship the
-- completeTest JS change that calls: await s.rpc('v_lock_test', { p_test: testId })
-- immediately before the line-~206 valid-judgment snapshot.
