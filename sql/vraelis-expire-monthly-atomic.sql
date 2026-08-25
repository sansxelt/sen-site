-- Atomic monthly-credit expiry.
--
-- THE RACE THIS CLOSES. lib/v-credits.ts expireMonthly() read the live monthly net and then wrote -net,
-- with nothing serialising the two. It is reachable concurrently from the Stripe and PayPal subscription
-- webhooks and from a launch on the same account, so two runs could both read the same positive net and
-- both write a clawback for it — expiring the same credits twice and driving the balance negative. It is
-- the same read-then-write shape as the credit hold, on the same table, and it was missed because only
-- hold() was being looked at.
--
-- HOW. The SAME per-user advisory lock namespace the hold uses, so an expiry and a hold cannot interleave
-- either — two functions guarding one balance must agree on the key or they serialise against nothing.
-- Everything happens inside one transaction: compute the net, refuse if there is nothing to claw back,
-- otherwise write the single clawback row.
--
-- IDEMPOTENCY. p_clawback_ref is written to ext_ref, which carries a partial unique index
-- (v_ledger_extref_uidx on user_id, reason, ext_ref where ext_ref is not null). A replayed webhook
-- therefore hits the constraint and no-ops rather than clawing back twice — the lock stops the concurrent
-- case, the index stops the replayed one, and they are different problems.
--
-- Returns jsonb:
--   { ok: true,  expired: int, net_before: int }        -- expired = 0 means there was nothing to do
--   { ok: false, reason: 'no_user' | 'duplicate' }

-- SCHEMA PRECONDITION, stated and satisfied here rather than assumed. Same lesson as the hold migration:
-- a function that references a column a different migration adds will fail at call time on a database
-- that has not run it, and the caller cannot tell that apart from a real refusal. Both statements are
-- idempotent.
alter table v_credit_ledger add column if not exists unit text not null default 'credit';
alter table v_credit_ledger add column if not exists ext_ref text;

create or replace function v_expire_monthly(
  p_user         text,
  p_except_ref   text default null,
  p_clawback_ref text default null,
  p_unit         text default 'credit'
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user text := lower(trim(p_user));
  v_net  int;
begin
  if v_user is null or v_user = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;

  -- SAME KEY AS v_hold_credits. A hold and an expiry both mutate this user's monthly bucket; guarding them
  -- with different keys would serialise each against itself and neither against the other.
  perform pg_advisory_xact_lock(hashtext('v_hold_credits:' || v_user));

  select coalesce(sum(delta), 0) into v_net
  from v_credit_ledger
  where user_id = v_user
    and bucket = 'monthly'
    and (expires_at is null or expires_at > now())
    and coalesce(unit, 'credit') = coalesce(p_unit, 'credit')
    -- The grant being renewed is excluded so a reset does not immediately claw back the credits it just
    -- issued. Matches the exceptExtRef argument the TypeScript took.
    and (p_except_ref is null or ext_ref is distinct from p_except_ref);

  if v_net <= 0 then
    return jsonb_build_object('ok', true, 'expired', 0, 'net_before', v_net);
  end if;

  begin
    insert into v_credit_ledger (user_id, delta, reason, bucket, ext_ref, unit)
    values (v_user, -v_net, 'monthly_reset', 'monthly', p_clawback_ref, coalesce(p_unit, 'credit'));
  exception
    when unique_violation then
      -- A replay of the same reset. The clawback already exists; report it rather than writing a second.
      return jsonb_build_object('ok', false, 'reason', 'duplicate');
  end;

  return jsonb_build_object('ok', true, 'expired', v_net, 'net_before', v_net);
end;
$$;

-- Service role only. This moves credits, and PostgREST would otherwise expose it as an RPC endpoint.
revoke all on function v_expire_monthly(text, text, text, text) from public, anon, authenticated;
grant execute on function v_expire_monthly(text, text, text, text) to service_role;
