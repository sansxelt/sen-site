-- Migration 25: auto recharge.
--
-- Opt-in. When the balance falls to a trigger the customer chose, top it back up to a target they chose,
-- charging a card they explicitly saved for that purpose, never above a monthly ceiling they set.
--
-- WHY EVERY ONE OF THOSE IS THE CUSTOMER'S NUMBER AND NOT OURS. This is the only place in the product that
-- moves money without a person present. A default we picked would be a charge nobody agreed to, so there
-- is no default: enabled is false, and the three amounts have no meaning until someone sets them.
--
-- THE MONTHLY CEILING IS THE POINT. A trigger and a target alone describe a loop that can run as often as
-- spend empties the balance, which on a runaway integration is unbounded. charged_this_month_cents is
-- reconciled from the event log rather than trusted as a counter, and the ceiling refuses rather than
-- charging a partial amount: a customer who set a limit meant it as a stop, not as a target to approach.
--
-- ADDITIVE ONLY. No existing table is altered and nothing here is read on the launch hot path, so applying
-- this changes nothing about how runs are priced or refused until a customer turns it on.

create table if not exists public.v_auto_recharge (
  user_id                text primary key,
  enabled                boolean     not null default false,

  -- The customer's three numbers. Nullable until they choose: a NOT NULL with a default would be us
  -- deciding when someone gets charged.
  trigger_cents          integer,
  target_cents           integer,
  monthly_cap_cents      integer,

  -- The saved card, and the consent that makes saving it legal. A payment method id alone is not consent;
  -- consent_at records that a person ticked the box and when, which is what an off-session charge has to
  -- be able to point at if it is ever disputed.
  stripe_customer_id     text,
  stripe_payment_method  text,
  consent_at             timestamptz,

  -- Failure handling. Three consecutive failures disables the whole thing rather than retrying forever
  -- against a card that is declining, because a decline loop is how a customer's bank starts treating the
  -- merchant as fraudulent.
  consecutive_failures   integer     not null default 0,
  disabled_reason        text,

  last_charge_at         timestamptz,
  last_attempt_at        timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- EVERY ATTEMPT, INCLUDING THE ONES THAT DID NOT CHARGE.
--
-- A log of successful charges cannot answer "why did this not top up when I expected it to", which is the
-- question a customer actually asks. Refusals are recorded with their reason, so the settings page can say
-- "the monthly cap stopped this on the 14th" instead of showing an unexplained gap.
create table if not exists public.v_auto_recharge_events (
  id                     uuid        primary key default gen_random_uuid(),
  user_id                text        not null,
  created_at             timestamptz not null default now(),

  -- charged  | refused | failed
  --   charged  money moved
  --   refused  the rules said no (cap reached, disabled, already topping up, balance recovered)
  --   failed   the rules said yes and the charge did not succeed
  kind                   text        not null,
  amount_cents           integer,
  balance_before_cents   integer,
  reason                 text,
  stripe_payment_intent  text
);

create index if not exists v_auto_recharge_events_user_created_idx
  on public.v_auto_recharge_events (user_id, created_at desc);

-- The month's total is derived from this log, so it must be cheap to sum for one owner over one month.
create index if not exists v_auto_recharge_events_user_kind_created_idx
  on public.v_auto_recharge_events (user_id, kind, created_at desc);

-- IDEMPOTENCY. Two settlements finishing at once both see a low balance and both decide to top up. The
-- unique index makes the second insert fail rather than charging twice, using a key the caller derives
-- from the owner and a short time bucket.
alter table public.v_auto_recharge_events add column if not exists idempotency_key text;
create unique index if not exists v_auto_recharge_events_idem_idx
  on public.v_auto_recharge_events (idempotency_key) where idempotency_key is not null;
