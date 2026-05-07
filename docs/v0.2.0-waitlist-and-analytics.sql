-- v0.2.0: waitlist + landing analytics tables.
--
-- waitlist tracks early-access signups per product. Single row per
-- (email, product) pair: a user can sign up for both Lens and
-- Whisper, but each product gets its own row so we can email them
-- per-product when an early-access window opens.
--
-- analytics_events is the lightweight server-side event log for the
-- marketing site: section-viewed, cta-clicked, waitlist-joined.
-- Anonymous-allowed (no auth required), used to measure landing
-- funnel performance.
--
-- Both tables are fed by /api/waitlist and /api/analytics. Read by
-- /admin/waitlist and /admin/analytics.
--
-- Run via Supabase SQL editor or psql.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product text not null,
  source text,                           -- e.g. 'lens-page', 'pricing'
  utm jsonb,                             -- captured if available
  user_email text references public.user_profiles(email) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  contacted_at timestamptz,              -- set when we email them
  notes text,
  constraint waitlist_email_check  check (char_length(email) between 3 and 320),
  constraint waitlist_product_check check (
    product in ('workshop', 'whisper', 'lens', 'lens-day-kit', 'platform')
  ),
  constraint waitlist_unique_email_product unique (email, product)
);

create index if not exists waitlist_product_created_idx
  on public.waitlist(product, created_at desc);

create index if not exists waitlist_user_idx
  on public.waitlist(user_email);

-- Lightweight event log for the marketing site. Append-only, no PII
-- by design. session_id is a random client-generated id that lives
-- in localStorage so we can stitch a single visitor's events without
-- ever touching auth.

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  session_id text,
  path text,
  props jsonb,
  user_email text references public.user_profiles(email) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint analytics_name_check check (char_length(name) between 1 and 100),
  constraint analytics_path_check check (path is null or char_length(path) <= 500)
);

create index if not exists analytics_events_name_created_idx
  on public.analytics_events(name, created_at desc);

create index if not exists analytics_events_session_idx
  on public.analytics_events(session_id);

create index if not exists analytics_events_path_created_idx
  on public.analytics_events(path, created_at desc);

-- Optional: RLS off for these. They are written via the service-role
-- key in the API routes, never read from the browser. The admin
-- dashboard fetches them server-side with the same key.
alter table public.waitlist           disable row level security;
alter table public.analytics_events   disable row level security;
