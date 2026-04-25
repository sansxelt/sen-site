-- Notes — first real product surface for sansxel.
--
-- Soft-delete only (deleted_at). Hard delete happens via a Supabase
-- cron later if/when storage matters; for now keeping the rows lets
-- us recover anything a user nukes by accident.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  email text not null references public.user_profiles(email) on delete cascade,
  title text not null default 'Untitled',
  body text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  deleted_at timestamptz
);

create index if not exists notes_email_idx
  on public.notes(email);

-- The hot query: list a user's active notes, newest first
create index if not exists notes_email_active_updated_idx
  on public.notes(email, updated_at desc)
  where deleted_at is null;
