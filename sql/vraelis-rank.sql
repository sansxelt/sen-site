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
