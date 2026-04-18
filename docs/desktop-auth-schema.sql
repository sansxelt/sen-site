-- Desktop sign-in flow.
--
-- Two tables:
--   desktop_auth_requests — short-lived (15 min) handshake records
--     created when the desktop opens the browser-side approval flow.
--     The browser approves it (sets email + status='approved'). The
--     desktop then redeems it (status='redeemed') in exchange for a
--     long-lived session token that goes into desktop_sessions.
--
--   desktop_sessions — the long-lived sessions used by every desktop
--     API call. We store only sha256(token), never the token itself.
--     Revoked sessions stay in the table with revoked_at set so users
--     can audit a history later.

create table if not exists public.desktop_auth_requests (
  request_id uuid primary key default gen_random_uuid(),
  email text references public.user_profiles(email) on delete cascade,
  status text not null default 'pending',
  device_label text,
  created_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  redeemed_at timestamptz,
  expires_at timestamptz not null default (timezone('utc', now()) + interval '15 minutes'),
  constraint desktop_auth_requests_status_check
    check (status in ('pending', 'approved', 'redeemed', 'expired'))
);

create index if not exists desktop_auth_requests_status_idx
  on public.desktop_auth_requests(status);
create index if not exists desktop_auth_requests_email_idx
  on public.desktop_auth_requests(email);

create table if not exists public.desktop_sessions (
  id uuid primary key default gen_random_uuid(),
  email text not null references public.user_profiles(email) on delete cascade,
  token_hash text not null unique,
  device_label text,
  created_at timestamptz not null default timezone('utc', now()),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists desktop_sessions_token_hash_idx
  on public.desktop_sessions(token_hash);
create index if not exists desktop_sessions_email_idx
  on public.desktop_sessions(email);
create index if not exists desktop_sessions_active_idx
  on public.desktop_sessions(email)
  where revoked_at is null;
