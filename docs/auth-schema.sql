create table if not exists public.early_access_signups (
  email text primary key,
  name text,
  focus_area text,
  source text not null default 'website',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_profiles (
  email text primary key,
  display_name text,
  focus_area text,
  work_style text,
  summary_style text not null default 'balanced',
  release_channel text not null default 'stable',
  early_access_requested_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_profiles_summary_style_check
    check (summary_style in ('concise', 'balanced', 'detailed')),
  constraint user_profiles_release_channel_check
    check (release_channel in ('stable', 'preview'))
);

create table if not exists public.user_credentials (
  email text primary key,
  password_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.password_reset_tokens (
  token text primary key,
  email text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  key_hash text not null unique,
  key_prefix text not null,
  created_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.account_subscriptions (
  email text primary key,
  plan_key text not null default 'free',
  billing_cycle text not null default 'monthly',
  status text not null default 'free',
  seat_count integer not null default 1,
  enterprise_verified_business boolean not null default false,
  current_period_end timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint account_subscriptions_plan_key_check
    check (plan_key in ('free', 'apprentice', 'studio', 'pro', 'teams', 'enterprise')),
  constraint account_subscriptions_billing_cycle_check
    check (billing_cycle in ('monthly', 'yearly', 'custom')),
  constraint account_subscriptions_status_check
    check (status in ('free', 'selection_pending', 'active', 'contact_required', 'canceled')),
  constraint account_subscriptions_seat_count_check
    check (seat_count >= 1)
);

alter table public.early_access_signups enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_credentials enable row level security;
alter table public.password_reset_tokens enable row level security;
alter table public.api_keys enable row level security;
alter table public.account_subscriptions enable row level security;
