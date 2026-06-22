-- Vraelis Rank schema. Run once in the Supabase SQL editor (Dashboard → SQL).
-- Idempotent: safe to re-run. Prefixed `v_` so it never collides with the
-- archived flip_*/vraelis_* tables. Access is server-only via the service-role
-- key (lib/supabase-admin); every query is scoped by user_id in app code.

create extension if not exists "pgcrypto";

-- One row per signed-in user.
create table if not exists v_profiles (
  user_id            text primary key,         -- lowercased email
  display_name       text,
  roles              text[] not null default '{buyer}',  -- buyer | voter | admin
  stripe_customer_id text,
  created_at         timestamptz not null default now()
);

-- Plan state (set by the Stripe webhook).
create table if not exists v_subscriptions (
  user_id          text primary key,
  plan             text not null default 'free',   -- free|starter|creator|pro|scale|enterprise
  status           text not null default 'active', -- active|past_due|canceled
  cycle            text,                            -- monthly|yearly
  stripe_subscription_id text,
  monthly_credits  int not null default 0,
  current_period_end timestamptz,
  updated_at       timestamptz not null default now()
);

-- Credits: append-only ledger is the SOURCE OF TRUTH.
-- balance(user) = sum(delta) where (expires_at is null or expires_at > now()).
create table if not exists v_credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  delta       int not null,                    -- + grant, - spend/hold
  reason      text not null,                   -- signup|monthly_reset|pack|test_pack|hold|refund|reward
  ref_type    text,                            -- test|payment
  ref_id      uuid,
  bucket      text not null default 'purchased', -- monthly (expires) | purchased (persists)
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists v_ledger_user_idx on v_credit_ledger (user_id, created_at desc);

-- Tests.
create table if not exists v_tests (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  title          text not null,
  context        text,
  category       text not null,
  audience       text not null default 'general',
  visibility     text not null default 'public',  -- public|private|pool
  status         text not null default 'draft',   -- draft|active|complete|canceled
  votes_target   int not null,
  votes_valid    int not null default 0,
  credits_held   int not null default 0,
  addons         jsonb not null default '[]',
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index if not exists v_tests_user_idx on v_tests (user_id, created_at desc);
create index if not exists v_tests_route_idx on v_tests (status, audience);

create table if not exists v_test_options (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references v_tests(id) on delete cascade,
  position    int not null,                    -- A=0, B=1, ...
  asset_url   text,                            -- image (data URL for MVP; Storage later) OR
  label       text,                            -- text option (brand name / hook)
  created_at  timestamptz not null default now()
);
create index if not exists v_options_test_idx on v_test_options (test_id);

-- Judgments (votes). One per voter per test.
create table if not exists v_judgments (
  id            uuid primary key default gen_random_uuid(),
  test_id       uuid not null references v_tests(id) on delete cascade,
  voter_id      text not null,                 -- v_profiles.user_id (or discord:<id> later)
  option_id     uuid not null references v_test_options(id),
  reason        text,
  scores        jsonb,
  time_spent_ms int,
  source        text not null default 'web',
  status        text not null default 'valid', -- valid|rejected
  reject_reason text,
  created_at    timestamptz not null default now(),
  unique (test_id, voter_id)
);
create index if not exists v_judg_test_idx on v_judgments (test_id);

create table if not exists v_reports (
  test_id        uuid primary key references v_tests(id) on delete cascade,
  winner_option_id uuid,
  results        jsonb not null,
  generated_at   timestamptz not null default now()
);

create table if not exists v_payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  stripe_id    text,
  kind         text not null,                  -- subscription|test_pack|credit_pack|addon
  sku          text,
  amount_cents int,
  credits      int not null default 0,
  status       text not null default 'paid',
  created_at   timestamptz not null default now()
);

-- API keys for the public Vraelis API (external apps / AI tools). Only the hash
-- is stored; the raw key is shown to the user once at creation.
create table if not exists v_api_keys (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  key_hash   text not null unique,
  prefix     text not null,                    -- shown in UI, e.g. vr_live_ab12cd34
  scopes     text[] not null default '{tests:write,tests:read,credits:read}',
  last_used  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists v_api_keys_user_idx on v_api_keys (user_id, created_at desc);
-- Optional label so owners can name their keys (e.g. "Production", "Zapier").
alter table v_api_keys add column if not exists name text;

-- ── Idempotency / hardening (added after the credit + webhook security review) ──
-- 1) Dedup Stripe events at the DB level so concurrent/retried webhook deliveries
--    can't double-record a payment (partial: stripe_id is nullable).
create unique index if not exists v_payments_stripe_id_uidx
  on v_payments (stripe_id) where stripe_id is not null;

-- 2) Idempotent credit grants. ext_ref holds the Stripe invoice/session id; a
--    given (user, reason, ext_ref) can mint only ONE ledger row, so a replayed or
--    raced webhook can never double-grant credits regardless of app-level checks.
alter table v_credit_ledger add column if not exists ext_ref text;
create unique index if not exists v_ledger_extref_uidx
  on v_credit_ledger (user_id, reason, ext_ref) where ext_ref is not null;

-- ── Atomic credit / quota RPCs (close concurrency races at the DB level) ──
-- These wrap the check-then-write money paths in a single transaction under a
-- per-user advisory lock, so concurrent/double-submitted requests can't overdraw
-- the balance or slip past the active-test / reward caps. Idempotent to re-run.

-- Launch a test atomically: verify the monthly active-test quota and the credit
-- balance, then create + activate the test, insert its options, and escrow the
-- hold (monthly bucket first, then purchased) — all or nothing.
-- Returns jsonb: {status: ok|insufficient_credits|plan_limit|bad_request, id, needed, limit}.
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
    where user_id = v_user and status <> 'draft'
      and created_at >= (date_trunc('month', now() at time zone 'utc') at time zone 'utc');
  if v_used >= p_active_limit then
    return jsonb_build_object('status','plan_limit','limit',p_active_limit);
  end if;

  select coalesce(sum(delta),0) into v_bal from v_credit_ledger
    where user_id = v_user and (expires_at is null or expires_at > now());
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
    where user_id = v_user and bucket = 'monthly' and (expires_at is null or expires_at > now());
  select max(expires_at) into v_monthly_exp from v_credit_ledger
    where user_id = v_user and bucket = 'monthly' and delta > 0 and (expires_at is null or expires_at > now());
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

-- Record a vote atomically: validate, insert the judgment (one per voter/test via
-- the unique constraint), recount votes_valid, and grant the daily-capped reward
-- (idempotent per voter/test via ext_ref) — all in one transaction.
-- Returns jsonb: {status: ok|dup|invalid, earned, votes_valid, should_complete}.
create or replace function v_record_vote(
  p_test uuid, p_voter text, p_option uuid, p_reason text, p_time_spent int, p_reward_cap int
) returns jsonb language plpgsql as $$
declare
  v_voter text := lower(trim(p_voter));
  v_owner text; v_status text; v_valid_cur int; v_target int;
  v_opt_ok int; v_valid int; v_reward_today int; v_earned boolean := false;
begin
  select user_id, status, votes_valid, votes_target
    into v_owner, v_status, v_valid_cur, v_target
    from v_tests where id = p_test;
  if not found or v_status <> 'active' or v_owner = v_voter or v_valid_cur >= v_target then
    return jsonb_build_object('status','invalid');
  end if;
  select count(*) into v_opt_ok from v_test_options where id = p_option and test_id = p_test;
  if v_opt_ok = 0 then return jsonb_build_object('status','invalid'); end if;

  begin
    insert into v_judgments (test_id, voter_id, option_id, reason, time_spent_ms, status)
      values (p_test, v_voter, p_option, nullif(p_reason,''), p_time_spent, 'valid');
  exception when unique_violation then
    return jsonb_build_object('status','dup');
  end;

  select count(*) into v_valid from v_judgments where test_id = p_test and status = 'valid';
  update v_tests set votes_valid = v_valid where id = p_test;

  perform pg_advisory_xact_lock(hashtext('reward:' || v_voter)::bigint);
  select coalesce(sum(delta),0) into v_reward_today from v_credit_ledger
    where user_id = v_voter and reason = 'reward'
      and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');
  if v_reward_today < p_reward_cap then
    begin
      insert into v_credit_ledger (user_id, delta, reason, bucket, ref_type, ref_id, ext_ref)
        values (v_voter, 1, 'reward', 'purchased', 'vote', p_test, 'reward:' || p_test::text);
      v_earned := true;
    exception when unique_violation then
      v_earned := false; -- already rewarded for this test
    end;
  end if;

  return jsonb_build_object('status','ok','earned',v_earned,'votes_valid',v_valid,'should_complete', v_valid >= v_target);
end; $$;

-- ── Voter quality / anti-abuse ──
-- Per-vote provenance for duplicate/velocity checks, and a per-voter reputation
-- tally. Rejected votes are kept (they still hold the one-vote-per-test slot) but
-- don't count toward the target and earn no reward.
alter table v_judgments add column if not exists ip_hash text;
alter table v_judgments add column if not exists device_hash text;
create index if not exists v_judg_ip_idx on v_judgments (ip_hash, created_at desc);
create index if not exists v_judg_status_idx on v_judgments (status, created_at desc);

create table if not exists v_voter_rep (
  voter_id   text primary key,
  valid      int not null default 0,
  rejected   int not null default 0,
  updated_at timestamptz not null default now()
);

-- v2 of v_record_vote: accepts a quality verdict (status/reject_reason) plus
-- ip/device provenance, counts only VALID votes toward the target, rewards only
-- valid votes, and maintains v_voter_rep. Defaults keep older callers working.
drop function if exists v_record_vote(uuid, text, uuid, text, int, int);
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

-- ── Storage migration: option images move from base64 to Supabase Storage URLs ──
-- asset_url now holds EITHER a Storage public URL (new uploads) or a base64 data
-- URL (old tests) — both render in url()/<img>. The extra columns track Storage
-- objects for cleanup/backfill. Old base64 columns are kept (nothing dropped).
alter table v_test_options add column if not exists asset_path text;   -- storage object path (null for base64 / external)
alter table v_test_options add column if not exists mime_type  text;
alter table v_test_options add column if not exists size_bytes int;

-- Public bucket for creative option assets. Public read (assets are shown to
-- voters/embed anyway); uploads happen only through the service-role server.
-- (You can also create this in the Storage dashboard — bucket name below, Public.)
insert into storage.buckets (id, name, public)
  values ('vraelis-test-assets', 'vraelis-test-assets', true)
  on conflict (id) do nothing;

-- ── Public report sharing (token-gated, read-only) ──
-- An owner can publish a read-only public report at /r/<share_token>. Off by
-- default; the token is a long random unguessable string. Disable flips the
-- boolean (link dies, token kept); regenerate mints a new token (old link dies).
alter table v_tests add column if not exists share_token   text;
alter table v_tests add column if not exists share_enabled boolean not null default false;
create unique index if not exists v_tests_share_token_uidx on v_tests (share_token) where share_token is not null;

-- ── Webhooks (push events to API customers; pull data via the export endpoints) ──
-- Each owner can register https endpoints. On test.completed we POST a signed
-- (HMAC-SHA256) JSON event. The secret is symmetric (both sides need it to verify),
-- stored in plaintext and revealable to the owner only. Deliveries are logged and
-- idempotent per (endpoint, test, event).
create table if not exists v_webhook_endpoints (
  id              uuid primary key default gen_random_uuid(),
  user_id         text not null,
  url             text not null,
  secret          text not null,
  enabled         boolean not null default true,
  event_types     text[] not null default '{test.completed}',
  failure_count   int not null default 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists v_webhook_ep_user_idx on v_webhook_endpoints (user_id, created_at desc);

create table if not exists v_webhook_deliveries (
  id              uuid primary key default gen_random_uuid(),
  endpoint_id     uuid not null references v_webhook_endpoints(id) on delete cascade,
  test_id         uuid,
  event           text not null,
  status          text not null default 'pending',  -- pending|success|failed
  response_status int,
  error           text,
  attempts        int not null default 0,
  payload         jsonb,
  created_at      timestamptz not null default now(),
  delivered_at    timestamptz
);
create index if not exists v_webhook_del_ep_idx on v_webhook_deliveries (endpoint_id, created_at desc);
-- idempotency: a real test.completed is delivered at most once per endpoint.
create unique index if not exists v_webhook_del_uniq on v_webhook_deliveries (endpoint_id, test_id, event) where test_id is not null;
-- Retry/backoff: a failed delivery carries next_retry_at; the cron sweep re-sends
-- due rows (transient failures only) until they succeed or hit the attempt cap.
alter table v_webhook_deliveries add column if not exists next_retry_at timestamptz;
create index if not exists v_webhook_del_retry_idx on v_webhook_deliveries (next_retry_at)
  where status = 'failed' and next_retry_at is not null;

-- ── Product analytics events (append-only) ──
-- Safe, minimal event log powering customer analytics (/app/data), API/webhook
-- usage, and future audit logs. The app NEVER writes raw API keys/hashes, webhook
-- secrets, raw IP/device signals, full payment details, or voter identity here —
-- only the small, already-safe fields the logEvent() helper allows. Tolerant: the
-- app degrades gracefully (table-aggregate fallbacks) until this is applied.
create table if not exists v_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     text,                              -- owner/actor where safe (null for anonymous voter events)
  test_id     uuid,                              -- related test where relevant
  event_type  text not null,                     -- test_launched|vote_recorded|export_downloaded|...
  actor_type  text not null,                     -- owner|voter|api|webhook|system|admin
  source      text,                              -- web|embed|api|cron|stripe|...
  route       text,                              -- coarse endpoint group, not a sensitive URL
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists v_events_user_idx  on v_events (user_id, created_at desc);
create index if not exists v_events_test_idx  on v_events (test_id, created_at desc);
create index if not exists v_events_type_idx  on v_events (event_type, created_at desc);
create index if not exists v_events_time_idx  on v_events (created_at desc);

-- ── Rate limiting (shared fixed-window counter) ──
-- Backs lib/vraelis-ratelimit.ts allow()/vraelis_rate_check, used to throttle the
-- public /api/v1/* endpoints per API key. Atomic single upsert; returns true while
-- under the limit. Same definition as sql/vraelis.sql (idempotent — safe to re-run).
-- The limiter FAILS OPEN if this isn't applied, so the API never breaks before it runs.
create table if not exists vraelis_rate_limits (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);
create or replace function vraelis_rate_check(p_key text, p_limit int, p_window_secs int)
returns boolean language plpgsql as $$
declare c int;
begin
  insert into vraelis_rate_limits (key, count, window_start)
    values (p_key, 1, now())
    on conflict (key) do update set
      count = case
        when now() - vraelis_rate_limits.window_start > make_interval(secs => p_window_secs)
          then 1 else vraelis_rate_limits.count + 1 end,
      window_start = case
        when now() - vraelis_rate_limits.window_start > make_interval(secs => p_window_secs)
          then now() else vraelis_rate_limits.window_start end
    returning count into c;
  return c <= p_limit;
end $$;

-- ── Data / privacy request workflow (intake only — NOT destructive) ──
-- Signed-in users submit access/export, correction, and account-deletion requests;
-- an admin reviews and resolves them manually. No automated deletion. The message
-- is a short user note (avoid storing sensitive data); admin_note is admin-only.
create table if not exists v_data_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,                  -- lowercased email of the requester
  request_type text not null,                  -- data_export|data_correction|account_deletion|privacy_question
  status       text not null default 'open',   -- open|in_review|completed|rejected|cancelled
  message      text,                           -- short user-provided detail
  admin_note   text,                           -- admin-only resolution note
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index if not exists v_data_requests_user_idx on v_data_requests (user_id, created_at desc);
create index if not exists v_data_requests_status_idx on v_data_requests (status, created_at desc);
