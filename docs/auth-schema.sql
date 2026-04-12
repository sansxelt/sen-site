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

alter table public.early_access_signups enable row level security;
alter table public.user_profiles enable row level security;
alter table public.user_credentials enable row level security;
alter table public.password_reset_tokens enable row level security;
