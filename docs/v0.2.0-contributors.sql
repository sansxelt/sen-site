-- Learn contributor application + display-name lock.
--
-- Anyone signed in can apply via /contribute (future). Admins
-- review on /account/contributors, approve with a hardlocked
-- display name, and that name is snapshotted onto every piece the
-- contributor publishes from then on.
--
-- Run this in Supabase after v0.1.16-learn-content.sql. Helpers in
-- lib/contributors.ts fail open so the rest of the site stays up
-- if this hasn't been applied yet.

create table if not exists public.learn_contributors (
  email          text primary key,
  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  applied_name   text,           -- what the applicant typed when applying
  display_name   text,           -- the hardlocked name the admin assigned
  applied_reason text,           -- short pitch from the application
  applied_at     timestamptz not null default timezone('utc', now()),
  decided_at     timestamptz,
  decided_by     text,           -- admin email that approved/rejected
  notes          text            -- internal admin notes
);

create index if not exists learn_contributors_status_idx
  on public.learn_contributors(status, applied_at desc);

-- Snapshot the display name onto each piece at write time so a
-- later rename of the contributor doesn't rewrite published bylines.
-- Nullable: legacy pieces and admin-authored pieces leave it null
-- (the renderer falls back to "Sansxel (OWNER)" for admins).
alter table public.learn_pieces
  add column if not exists author_display_name text;
