-- Authoritative, race-safe rolling caps for agent-initiated payments.
--
-- WHAT WAS WRONG. lib/vraelis-payment-authz.ts summed the caps in application code via
-- sumRecentPaymentCents, which was wrong in four independent ways:
--
--   1. `.limit(5000)` with no ORDER BY and no truncation signal. Past 5000 rows in the window the total
--      silently UNDER-reports, so the cap quietly stops binding on exactly the busy accounts it exists for.
--      The read could not even tell the caller it had been truncated.
--   2. Read-then-act. The sum and the authorization decision were separate round trips with nothing
--      serialising them, so N concurrent authorizations all saw the same pre-spend total and all passed a
--      cap that only one of them should have.
--   3. It counted EVERY vraelis_payments row for the owner, `pending` included. Pending rows are created by
--      /api/vraelis/book, which authenticates with a widely-shared intake key — so an outside caller could
--      mint pending rows until the owner's cap was exhausted and the agent stopped taking payments. A
--      denial-of-service against the business, wearing a spend control's clothes.
--   4. It summed amount_cents across every currency in one total. vraelis_payments.currency defaults to
--      'usd' but is a free column; adding JPY (no minor unit) to USD cents produces a number that means
--      nothing, and it means nothing in the permissive direction.
--
-- ── WHAT THIS CAP GOVERNS, AND WHY ────────────────────────────────────────────────────────────────────
--
-- This is a cap on AGENT-INITIATED payment authorizations, and nothing else. Only reservations written by
-- this function count toward it. That is a deliberate narrowing of the previous behaviour, for three
-- reasons:
--
--   * Anything another actor can create must not consume the cap. That is defect 3 above. A control whose
--     budget a stranger can exhaust is a lever against the owner, not a protection for them.
--   * The owner's own manual invoicing is already human-authorized. Letting it eat the agent's automatic
--     budget means a good sales day silences the agent — the same availability failure, self-inflicted.
--   * Counted once, at authorization. A reservation is the agent's record of what it committed to. If the
--     resulting vraelis_payments row were ALSO counted when it flips to 'paid', the same money would be
--     charged against the cap twice.
--
-- The cap therefore measures what the agent BILLED OUT, not what was collected. That is the conservative
-- reading and the correct one: issuing the link is the outward, hard-to-retract act. A manipulated agent
-- that sends a lead a wrong $2,000 link has already done the damage whether or not the lead pays.
--
-- DEPLOYMENT WINDOW, stated because it is real: reservations begin at zero. Agent payments authorized
-- before this migration ran are not in the history, so the first day after deployment starts with an empty
-- counter. One-time, bounded by the day/cycle window, and noted in the runbook.

create table if not exists v_agent_payment_reservations (
  id           uuid primary key default gen_random_uuid(),
  owner_email  text        not null,
  amount_cents int         not null check (amount_cents > 0),
  -- Scoped so the sum is unit-coherent. Cents of one currency are never added to cents of another; a
  -- second currency gets its own independent budget rather than silently inflating this one.
  currency     text        not null default 'usd',
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null,
  settled_at   timestamptz,
  released_at  timestamptz,
  ext_ref      text
);
-- Covers the aggregation predicate directly: owner + currency, newest first.
create index if not exists v_agent_pay_res_owner_idx
  on v_agent_payment_reservations (owner_email, currency, created_at desc);
-- A reservation carrying an external reference is idempotent: a replayed authorization for the same
-- payment reserves once, not twice.
create unique index if not exists v_agent_pay_res_extref_uidx
  on v_agent_payment_reservations (owner_email, ext_ref) where ext_ref is not null;

alter table v_agent_payment_reservations enable row level security;
revoke all privileges on v_agent_payment_reservations from public;
revoke all privileges on v_agent_payment_reservations from anon, authenticated;
grant all privileges on v_agent_payment_reservations to service_role;

-- Authorize an agent payment against the rolling caps, reserving it atomically.
--
--   { ok: true,  reservation_id: uuid, day_cents: int, cycle_cents: int }
--   { ok: false, reason: 'daily_cap_reached' | 'cycle_cap_reached' | 'invalid', day_cents, cycle_cents }
create or replace function v_reserve_agent_payment(
  p_owner       text,
  p_amount      int,
  p_day_cap     int,
  p_cycle_cap   int,
  p_cycle_days  int  default 30,
  p_ttl_secs    int  default 900,
  p_currency    text default 'usd',
  p_ext_ref     text default null
) returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_owner    text := lower(trim(coalesce(p_owner, '')));
  v_cur      text := lower(trim(coalesce(p_currency, 'usd')));
  v_days     int  := greatest(coalesce(p_cycle_days, 30), 1);
  v_ttl      int  := greatest(coalesce(p_ttl_secs, 900), 1);
  v_day      bigint;
  v_cycle    bigint;
  v_id       uuid;
  v_prior    uuid;
  v_released timestamptz;
begin
  -- Fail closed on anything malformed rather than reserving a nonsense amount or an unbounded one.
  if v_owner = '' or v_cur = ''
     or p_amount is null or p_amount <= 0
     or p_day_cap is null or p_day_cap < 0
     or p_cycle_cap is null or p_cycle_cap < 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  -- Serialise every authorization for THIS owner, so concurrent attempts cannot all read the same
  -- pre-spend total and all pass. Own key namespace: this guards the payment cap, not the credit balance,
  -- and the two must not block each other.
  perform pg_advisory_xact_lock(hashtext('v_agent_payment:' || v_owner));

  -- IDEMPOTENCY IS CHECKED BEFORE THE CAP, and the order matters. An authorization already reserved under
  -- this reference has ALREADY consumed its budget, so re-measuring it against the cap counts the same
  -- money twice and refuses a retry that should simply return the original answer. Getting this backwards
  -- meant a replayed webhook near the cap was told 'daily_cap_reached' — a refusal caused by its own
  -- earlier success. Caught by test I2.
  if p_ext_ref is not null then
    select id, released_at into v_prior, v_released
      from v_agent_payment_reservations
     where owner_email = v_owner and ext_ref = p_ext_ref;
  end if;

  -- Authoritative aggregation IN THE DATABASE. No row limit, so the total is exact at any volume — this is
  -- the whole point of moving it here. A reservation counts while it is live: not released, and either
  -- settled (a real payment was created for it) or still inside its TTL. An authorization that never became
  -- a payment therefore stops consuming the cap on its own, with nothing to remember to clean up.
  select coalesce(sum(amount_cents), 0) into v_day
    from v_agent_payment_reservations
   where owner_email = v_owner and currency = v_cur
     and released_at is null
     and (settled_at is not null or expires_at > now())
     and created_at > now() - interval '1 day';

  select coalesce(sum(amount_cents), 0) into v_cycle
    from v_agent_payment_reservations
   where owner_email = v_owner and currency = v_cur
     and released_at is null
     and (settled_at is not null or expires_at > now())
     and created_at > now() - make_interval(days => v_days);

  -- A live prior reservation for this reference: hand back the same answer, having charged nothing more.
  -- A RELEASED one is different — the payment it stood for was never created, so this is a real retry and
  -- it has to face the cap again below before the row is re-armed.
  if v_prior is not null and v_released is null then
    return jsonb_build_object('ok', true, 'reservation_id', v_prior, 'replay', true,
                              'day_cents', v_day, 'cycle_cents', v_cycle);
  end if;

  -- Boundary: landing exactly ON the cap is allowed, exceeding it is not.
  if v_day + p_amount > p_day_cap then
    return jsonb_build_object('ok', false, 'reason', 'daily_cap_reached',
                              'day_cents', v_day, 'cycle_cents', v_cycle);
  end if;
  if v_cycle + p_amount > p_cycle_cap then
    return jsonb_build_object('ok', false, 'reason', 'cycle_cap_reached',
                              'day_cents', v_day, 'cycle_cents', v_cycle);
  end if;

  if v_prior is not null then
    -- Re-arm the released reservation rather than inserting a second row, because the unique index on
    -- (owner_email, ext_ref) is what makes replay safe and there must stay exactly one row per reference.
    update v_agent_payment_reservations
       set amount_cents = p_amount, currency = v_cur, created_at = now(),
           expires_at = now() + make_interval(secs => v_ttl), released_at = null, settled_at = null
     where id = v_prior;
    v_id := v_prior;
  else
    begin
      insert into v_agent_payment_reservations (owner_email, amount_cents, currency, expires_at, ext_ref)
      values (v_owner, p_amount, v_cur, now() + make_interval(secs => v_ttl), p_ext_ref)
      returning id into v_id;
    exception
      when unique_violation then
        -- Belt and braces. The advisory lock already serialises same-owner callers, so two inserts for one
        -- reference should be unreachable; if it happens anyway, return the existing row rather than error.
        select id into v_id from v_agent_payment_reservations
         where owner_email = v_owner and ext_ref = p_ext_ref;
    end;
  end if;

  return jsonb_build_object('ok', true, 'reservation_id', v_id,
                            'day_cents', v_day, 'cycle_cents', v_cycle);
end;
$$;

-- Settle a reservation (the payment really was created) or release it (it was not, so give the budget
-- back immediately instead of waiting out the TTL). Idempotent: a reservation already settled or released
-- is not changed again, and the function reports whether it acted.
create or replace function v_settle_agent_payment(p_reservation uuid, p_settled boolean)
returns boolean
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if p_reservation is null then return false; end if;
  update v_agent_payment_reservations
     set settled_at  = case when p_settled then now() else settled_at end,
         released_at = case when p_settled then released_at else now() end
   where id = p_reservation and settled_at is null and released_at is null;
  return found;
end;
$$;

-- Service role only. PostgREST would otherwise publish both of these as callable RPC endpoints, and
-- v_settle_agent_payment releasing reservations is exactly how an outsider would uncap the agent.
revoke all on function v_reserve_agent_payment(text, int, int, int, int, int, text, text) from public;
revoke all on function v_reserve_agent_payment(text, int, int, int, int, int, text, text) from anon, authenticated;
revoke all on function v_settle_agent_payment(uuid, boolean) from public;
revoke all on function v_settle_agent_payment(uuid, boolean) from anon, authenticated;
grant execute on function v_reserve_agent_payment(text, int, int, int, int, int, text, text) to service_role;
grant execute on function v_settle_agent_payment(uuid, boolean) to service_role;
