-- v0.2.0 phase D: owner-controlled email broadcasts.
--
-- Admins compose at /account/broadcasts, the send action fans the
-- message out to every user_profile row matching the audience
-- filter (all, free, paid). Each send persists a row here so the
-- admin board can show what went out, when, and to how many.
-- Run in Supabase before /account/broadcasts is useful.

create table if not exists public.email_broadcasts (
  id              uuid primary key default gen_random_uuid(),
  subject         text not null,
  body_md         text not null,
  audience        text not null
                    check (audience in ('all', 'free', 'paid')),
  sent_by         text not null,
  sent_at         timestamptz not null default timezone('utc', now()),
  recipient_count integer not null default 0,
  delivered       integer not null default 0,
  failed          integer not null default 0
);

create index if not exists email_broadcasts_sent_at_idx
  on public.email_broadcasts(sent_at desc);
