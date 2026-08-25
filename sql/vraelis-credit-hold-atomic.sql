-- Atomic credit hold.
--
-- THE RACE THIS CLOSES. lib/v-credits.ts hold() read the live balance, decided the split between the
-- expiring monthly bucket and the persistent purchased bucket, and then inserted the debit rows — three
-- round trips with nothing serialising them. Two concurrent launches both read the same balance, both
-- decided they could afford it, and both debited. The ledger is append-only and the balance is a SUM, so
-- the result is a NEGATIVE balance: credits spent that were never held.
--
-- The compensation logic in hold() is careful about a failed INSERT, but no amount of care after the read
-- can fix a decision made from a stale read. This function makes the read and the write one operation.
--
-- HOW. A transaction-scoped advisory lock keyed on the user serialises every hold for that user, and only
-- for that user — two different users never contend. The lock is released automatically at commit or
-- rollback, so a crashed session cannot strand it. Everything then happens inside that one transaction:
-- compute the live balance, refuse if short, otherwise insert the debits.
--
-- Returns jsonb so the caller gets the same information the TypeScript did:
--   { ok: true,  from_monthly: int, from_purchased: int, balance_before: int, balance_after: int }
--   { ok: false, reason: 'insufficient', balance: int, requested: int }
--
-- SECURITY DEFINER is deliberately NOT used: the caller is the service role, which already has the rights
-- it needs, and a definer function here would be a privilege boundary with nothing to gain. search_path is
-- pinned regardless, so a later change cannot silently inherit a mutable path.

create or replace function v_hold_credits(
  p_user   text,
  p_test   uuid,
  p_amount int,
  p_unit   text default 'credit'
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_user        text := lower(trim(p_user));
  v_balance     int;
  v_monthly_net int;
  v_expiry      timestamptz;
  v_from_month  int;
  v_from_purch  int;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('ok', true, 'from_monthly', 0, 'from_purchased', 0,
                              'balance_before', 0, 'balance_after', 0);
  end if;
  if v_user is null or v_user = '' then
    return jsonb_build_object('ok', false, 'reason', 'no_user');
  end if;

  -- Serialise concurrent holds for THIS user only. hashtext is stable within a major version, and a
  -- collision between two users would only mean they briefly queue behind each other, never a wrong answer.
  perform pg_advisory_xact_lock(hashtext('v_hold_credits:' || v_user));

  -- Live rows for this unit. A row with no unit predates the column and is a 'credit' row — reading it as
  -- anything else would silently reclassify every legacy row, which is the same rule rowInUnit applies.
  select
    coalesce(sum(delta), 0),
    coalesce(sum(delta) filter (where bucket = 'monthly'), 0),
    max(expires_at) filter (where bucket = 'monthly' and expires_at is not null)
  into v_balance, v_monthly_net, v_expiry
  from v_credit_ledger
  where user_id = v_user
    and (expires_at is null or expires_at > now())
    and coalesce(unit, 'credit') = coalesce(p_unit, 'credit');

  if v_balance < p_amount then
    return jsonb_build_object('ok', false, 'reason', 'insufficient',
                              'balance', v_balance, 'requested', p_amount);
  end if;

  -- Spend the EXPIRING bucket first, so the customer does not lose credits that were about to expire while
  -- persistent ones sit unused. Clamp at zero: a negative monthly net must not turn into a purchased credit.
  v_from_month := greatest(0, least(p_amount, v_monthly_net));
  v_from_purch := p_amount - v_from_month;

  if v_from_month > 0 then
    insert into v_credit_ledger (user_id, delta, reason, bucket, expires_at, ref_type, ref_id, unit)
    values (v_user, -v_from_month, 'hold', 'monthly', v_expiry, 'test', p_test, coalesce(p_unit, 'credit'));
  end if;

  if v_from_purch > 0 then
    insert into v_credit_ledger (user_id, delta, reason, bucket, ref_type, ref_id, unit)
    values (v_user, -v_from_purch, 'hold', 'purchased', 'test', p_test, coalesce(p_unit, 'credit'));
  end if;

  -- Both inserts are in the same transaction as the balance read and the lock, so there is no window in
  -- which another session can observe or act on a partial hold.
  return jsonb_build_object(
    'ok', true,
    'from_monthly', v_from_month,
    'from_purchased', v_from_purch,
    'balance_before', v_balance,
    'balance_after', v_balance - p_amount
  );
end;
$$;

-- The application connects as the service role. PUBLIC/anon/authenticated get nothing: this function moves
-- money and PostgREST would otherwise expose it as an RPC endpoint (Postgres grants EXECUTE to PUBLIC on
-- new functions by default).
revoke all on function v_hold_credits(text, uuid, int, text) from public, anon, authenticated;
grant execute on function v_hold_credits(text, uuid, int, text) to service_role;
