-- v0.1.4 — Chat sources (RAG) — file uploads as conversation context.
--
-- A user uploads PDFs / MD / TXT files and the desktop app passes the
-- chosen source ids on each chat turn. The chat route fetches the bodies
-- and injects them into the system prompt as reference material.
--
-- Hard delete on user request — these are materials the user uploaded,
-- not generated content, so we don't keep tombstones.

create table if not exists public.chat_sources (
  id text primary key,
  owner_email text not null,
  title text not null,
  body text not null default '',
  byte_size int not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists chat_sources_owner_idx
  on public.chat_sources(owner_email);

create index if not exists chat_sources_owner_created_idx
  on public.chat_sources(owner_email, created_at desc);
