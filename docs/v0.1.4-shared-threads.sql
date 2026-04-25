-- v0.1.4 — shared threads
--
-- A snapshot store for "Share thread" links. The desktop client POSTs
-- a thread's messages + title here and gets back a public id; the URL
-- pattern is https://sansxel.ai/s/{public_id}. The public viewing
-- page itself lands in v0.1.5.
--
-- Run from the Supabase SQL editor.

create table if not exists public.shared_threads (
  id text primary key,
  owner_email text not null,
  title text not null default 'Shared chat',
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists shared_threads_owner_email_idx
  on public.shared_threads (owner_email);

create index if not exists shared_threads_created_at_idx
  on public.shared_threads (created_at desc);
