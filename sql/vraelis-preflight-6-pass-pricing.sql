-- Vraelis Preflight — Phase 6 additive migration (per-pass pricing enforcement, VRAELIS_PASS_PRICING).
-- Run AFTER vraelis-preflight-5-connections.sql. Idempotent; no destructive change; nothing is dropped,
-- renamed, or rewritten. Everything here is INERT until the flag flips: `unit` defaults every existing
-- row AND every flag-off insert to 'credit', and the new columns simply stay null on the legacy path.
-- APPLY THIS BEFORE setting VRAELIS_PASS_PRICING=1 anywhere (web, worker, operator shells) — the flag-on
-- code selects the `unit` column and fails closed (empty balance) if it is missing.

-- v_credit_ledger.unit — which currency a ledger row is denominated in.
--   'credit'  legacy credits (1 credit = $0.10 at top-up). Every pre-migration row and every flag-off
--             insert lands here via the column default; no legacy code path ever writes the column.
--   'cent'    US cents — the approved per-pass money model (docs/pricing-verdict-final.md, ruling 5:
--             cents ledger first, behind the disabled flag). Written ONLY by the flag-on PAYG
--             hold/refund path (lib/v-credits with unit='cent') and the audited balance-conversion
--             script (scripts/preflight-balance-convert.ts). Balances are NEVER mixed across units:
--             every sum is taken per unit.
alter table v_credit_ledger add column if not exists unit text not null default 'credit';

-- v_preflight_runs.flow_units — the selected-flow count this run consumed, recorded at enqueue when the
-- flag is on (null on every legacy run; legacy runs are never metered). Subscription metering sums this
-- column over the anchor-based monthly window: a full pass consumes its selected flow count and a
-- targeted rerun consumes only ITS selected count (approved ruling: a rerun never burns a full-pass
-- allowance). Infra-failed and cancelled-before-execution runs are EXCLUDED from the sum in code
-- (lib/preflight/entitlements-v1.ts runConsumesAllowance) — a run that never executed consumes nothing.
alter table v_preflight_runs add column if not exists flow_units int;

-- v_preflight_runs.held_cents — the PAYG cents escrowed for this run when the flag is on (audit mirror
-- of the 'cent' ledger hold; credits_held carries the same number so the worker's existing settlement —
-- refund credits_held via the reservation when nothing ran, retain it as the charge on completion —
-- settles cent holds without modification). Null for subscription/free passes (no hold is ever taken;
-- the entitlement gate is the billing decision) and for every legacy credit run.
alter table v_preflight_runs add column if not exists held_cents int;

-- v_profiles.plan_v1 — the versioned per-pass subscription plan key: 'builder_v1' | 'pro_v1' |
-- 'scale_v1' (ruling 2: FRESH keys; the legacy starter/creator/pro/scale meanings are never reused).
-- Set by the Stripe webhook when an invoice/subscription price id matches
-- STRIPE_PRICE_{BUILDER_V1,PRO_V1,SCALE_V1}_{MONTHLY,YEARLY}; cleared ONLY on the subscription
-- deletion event (ruling 8: cancel-at-period-end keeps paid-for access until the period actually ends;
-- no clawback on a mere renewal cancellation). _v1 plans NEVER grant ledger credits — the allowance is
-- METERED in flow units from this plan key, not granted.
alter table v_profiles add column if not exists plan_v1 text;

-- v_profiles.plan_v1_anchor — current_period_start of the subscription's FIRST period. The monthly
-- usage window is computed from this anchor AT REQUEST TIME (monthlyWindow in
-- lib/preflight/pass-pricing.ts), which is what makes ANNUAL billing release usage in MONTHLY buckets
-- with no scheduler (ruling 7: annual charges up front but never releases 12 months of passes on day
-- one). Renewal invoices never move the anchor; only a NEW subscription (subscription_create) resets it.
alter table v_profiles add column if not exists plan_v1_anchor timestamptz;

-- v_profiles.plan_v1_cycle — 'monthly' | 'yearly'. Display/audit only: metering reads the anchor, and
-- the window is one month for BOTH cycles (that is the whole point of the anchor mechanism).
alter table v_profiles add column if not exists plan_v1_cycle text;

-- Owner-scoped time-window reads: subscription metering (runs in the anchor month), the lifetime
-- free-pass check, and the existing ownerRunsToday daily cap all filter (user_id, created_at).
create index if not exists v_preflight_runs_user_time_idx on v_preflight_runs (user_id, created_at desc);

-- ── Unit-aware balance RPCs ─────────────────────────────────────────────────────────────────────────
-- v_launch_test and v_spend_credit (defined in sql/vraelis-rank.sql) sum the ledger WITHOUT a unit
-- filter. Once conversion mints 'cent' rows, an unfiltered sum would mix cents into the CREDIT balance
-- (250 cents would read as 250 credits). Re-created here byte-for-byte from sql/vraelis-rank.sql with
-- exactly one change: every ledger sum/max adds `and coalesce(unit, 'credit') = 'credit'`. While only
-- credit rows exist (i.e. the entire flag-off world) the filter matches every row, so behavior is
-- identical; it only starts mattering when 'cent' rows appear post-flip.
create or replace function v_launch_test(
  p_user text, p_title text, p_context text, p_category text, p_audience text,
  p_votes int, p_options jsonb, p_active_limit int, p_max_options int
) returns jsonb language plpgsql as $$
declare
  v_user text := lower(trim(p_user));
  v_used int; v_bal int; v_monthly int; v_monthly_exp timestamptz;
  v_from_monthly int; v_from_purchased int;
  v_id uuid; v_opt jsonb; v_pos int := 0;
begin
  if p_votes <= 0 then return jsonb_build_object('status','bad_request'); end if;
  perform pg_advisory_xact_lock(hashtext(v_user)::bigint);

  select count(*) into v_used from v_tests
    where user_id = v_user and status <> 'draft' and coalesce(is_sandbox, false) = false
      and created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc');
  if v_used >= p_active_limit then
    return jsonb_build_object('status','plan_limit','limit',p_active_limit);
  end if;

  select coalesce(sum(delta),0) into v_bal from v_credit_ledger
    where user_id = v_user and coalesce(unit, 'credit') = 'credit'
      and (expires_at is null or expires_at > now());
  if v_bal < p_votes then
    return jsonb_build_object('status','insufficient_credits','needed',p_votes);
  end if;

  insert into v_tests (user_id, title, context, category, audience, votes_target, status, credits_held)
    values (v_user, p_title, nullif(p_context,''), p_category, p_audience, p_votes, 'active', p_votes)
    returning id into v_id;

  for v_opt in select * from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) loop
    exit when v_pos >= p_max_options;
    insert into v_test_options (test_id, position, asset_url, label, asset_path, mime_type, size_bytes)
      values (v_id, v_pos, nullif(v_opt->>'asset',''), nullif(v_opt->>'label',''),
              nullif(v_opt->>'path',''), nullif(v_opt->>'mime',''), nullif(v_opt->>'size','')::int);
    v_pos := v_pos + 1;
  end loop;

  select coalesce(sum(delta),0) into v_monthly from v_credit_ledger
    where user_id = v_user and bucket = 'monthly' and coalesce(unit, 'credit') = 'credit'
      and (expires_at is null or expires_at > now());
  select max(expires_at) into v_monthly_exp from v_credit_ledger
    where user_id = v_user and bucket = 'monthly' and delta > 0 and coalesce(unit, 'credit') = 'credit'
      and (expires_at is null or expires_at > now());
  v_from_monthly := greatest(0, least(p_votes, v_monthly));
  v_from_purchased := p_votes - v_from_monthly;
  if v_from_monthly > 0 then
    insert into v_credit_ledger (user_id, delta, reason, bucket, expires_at, ref_type, ref_id)
      values (v_user, -v_from_monthly, 'hold', 'monthly', v_monthly_exp, 'test', v_id);
  end if;
  if v_from_purchased > 0 then
    insert into v_credit_ledger (user_id, delta, reason, bucket, ref_type, ref_id)
      values (v_user, -v_from_purchased, 'hold', 'purchased', 'test', v_id);
  end if;

  return jsonb_build_object('status','ok','id',v_id);
end; $$;

create or replace function v_spend_credit(
  p_user text, p_ref uuid, p_amount int
) returns jsonb language plpgsql as $$
declare
  v_user text := lower(trim(p_user));
  v_bal int; v_monthly int; v_monthly_exp timestamptz;
  v_from_monthly int; v_from_purchased int;
  v_ext text := 'check:' || p_ref::text;
begin
  if p_amount <= 0 then return jsonb_build_object('status','ok','charged',0); end if;
  perform pg_advisory_xact_lock(hashtext(v_user)::bigint);

  -- Already charged for this check? Idempotent success (never a second debit).
  if exists (select 1 from v_credit_ledger where user_id = v_user and reason = 'check' and ref_id = p_ref) then
    return jsonb_build_object('status','ok','charged',0,'duplicate',true);
  end if;

  select coalesce(sum(delta),0) into v_bal from v_credit_ledger
    where user_id = v_user and coalesce(unit, 'credit') = 'credit'
      and (expires_at is null or expires_at > now());
  if v_bal < p_amount then
    return jsonb_build_object('status','insufficient_credits','needed',p_amount);
  end if;

  select coalesce(sum(delta),0) into v_monthly from v_credit_ledger
    where user_id = v_user and bucket = 'monthly' and coalesce(unit, 'credit') = 'credit'
      and (expires_at is null or expires_at > now());
  select max(expires_at) into v_monthly_exp from v_credit_ledger
    where user_id = v_user and bucket = 'monthly' and delta > 0 and coalesce(unit, 'credit') = 'credit'
      and (expires_at is null or expires_at > now());
  v_from_monthly := greatest(0, least(p_amount, v_monthly));
  v_from_purchased := p_amount - v_from_monthly;
  if v_from_monthly > 0 then
    insert into v_credit_ledger (user_id, delta, reason, bucket, expires_at, ref_type, ref_id, ext_ref)
      values (v_user, -v_from_monthly, 'check', 'monthly', v_monthly_exp, 'check', p_ref, v_ext || ':m');
  end if;
  if v_from_purchased > 0 then
    insert into v_credit_ledger (user_id, delta, reason, bucket, ref_type, ref_id, ext_ref)
      values (v_user, -v_from_purchased, 'check', 'purchased', 'check', p_ref, v_ext || ':p');
  end if;
  return jsonb_build_object('status','ok','charged',p_amount);
end; $$;
