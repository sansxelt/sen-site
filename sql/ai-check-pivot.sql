-- ══════════════════════════════════════════════════════════════════════════════
-- AI Output Check (product pivot) — standalone migration.
--
-- HOW TO RUN: open the Supabase dashboard → SQL Editor → New query → paste ALL of
-- this → Run. Idempotent and additive: safe to run once, safe to re-run, touches
-- nothing that already exists. This is the SAME block that lives at the bottom of
-- sql/vraelis-rank.sql (the canonical schema) — this file is just a clean copy so
-- you can run it without scrolling.
--
-- It creates ONE table (v_checks) and ONE function (v_spend_credit). The table is
-- REQUIRED for checks to store a result; the function is optional (the app has a JS
-- fallback), but running both gives you the atomic, race-safe credit charge.
-- Depends only on v_credit_ledger, which already exists.
-- ══════════════════════════════════════════════════════════════════════════════

-- A "check" is an instant AI evaluation of 1..N versions of an AI-generated output.
-- It is NOT a human test: no votes, no options table, no collect/complete lifecycle.
-- The whole structured result (per-criterion scores, computed recommendation,
-- line-level flags) lives in `result` jsonb, the same way v_reports.results does.
create table if not exists v_checks (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null,                 -- lowercased email (tenant scope)
  output_type      text not null,                 -- support_reply|onboarding|marketing_copy|agent_action|other
  title            text,                          -- optional label
  audience         text,
  goal             text,
  candidate_count  int not null default 0,
  result           jsonb not null,                -- the full EvalResult from lib/v-evaluator.ts
  model            text,
  credits_charged  int not null default 0,
  share_token      text,                          -- reserved for a future public report link
  share_enabled    boolean not null default false,
  source           text not null default 'app',   -- app|api (where the check was run)
  created_at       timestamptz not null default now()
);
create index if not exists v_checks_user_idx on v_checks (user_id, created_at desc);
create unique index if not exists v_checks_share_token_uidx on v_checks (share_token) where share_token is not null;

-- Spend credits for a single AI check, atomically. Mirrors v_launch_test: a per-user
-- advisory lock serializes the check-then-write, so concurrent requests can't overdraw
-- the balance. Idempotent per check via (reason='check', ref_id=<check id>) — a retried
-- request carrying the same check id no-ops instead of double-charging. Spends the
-- expiring monthly bucket first, then purchased. Returns jsonb {status, charged}.
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
    where user_id = v_user and (expires_at is null or expires_at > now());
  if v_bal < p_amount then
    return jsonb_build_object('status','insufficient_credits','needed',p_amount);
  end if;

  select coalesce(sum(delta),0) into v_monthly from v_credit_ledger
    where user_id = v_user and bucket = 'monthly' and (expires_at is null or expires_at > now());
  select max(expires_at) into v_monthly_exp from v_credit_ledger
    where user_id = v_user and bucket = 'monthly' and delta > 0 and (expires_at is null or expires_at > now());
  v_from_monthly := greatest(0, least(p_amount, v_monthly));
  v_from_purchased := p_amount - v_from_monthly;
  -- Bucket-suffixed ext_ref keeps each leg idempotent under the existing
  -- v_ledger_extref_uidx (user_id, reason, ext_ref) index.
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
