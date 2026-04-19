-- Desktop preferences. Per-user UI/behavior knobs that the desktop
-- reads on launch and writes when the user changes them. Stored as a
-- single jsonb blob so we can add new keys without migrations.

create table if not exists public.desktop_preferences (
  email text primary key references public.user_profiles(email) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);
