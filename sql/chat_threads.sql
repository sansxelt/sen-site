-- v0.1.16 — Persistent chat history per account.
--
-- Run this once in the Supabase SQL editor. The library code in
-- lib/chat-history.ts assumes these tables + indexes exist.
--
-- Schema:
--   chat_threads   — one row per conversation, owned by an email.
--   chat_messages  — append-only message log per thread.
--
-- Cross-device sync just falls out of being server-side: any client
-- (web mobile, web desktop, Tauri) signed into the same email sees
-- the same thread list + message history.

create table if not exists chat_threads (
  id              uuid          primary key default gen_random_uuid(),
  email           text          not null,
  title           text          not null default 'New chat',
  created_at      timestamptz   not null default now(),
  updated_at      timestamptz   not null default now()
);

-- Quick "recent threads" lookup ordered by activity, scoped to user.
create index if not exists chat_threads_email_updated_idx
  on chat_threads (email, updated_at desc);

create table if not exists chat_messages (
  id              uuid          primary key default gen_random_uuid(),
  thread_id       uuid          not null references chat_threads(id) on delete cascade,
  role            text          not null check (role in ('user','assistant','system')),
  content         text          not null,
  -- Image attachments stored as JSONB array of {media_type, data}.
  -- Null for text-only turns; keeps row size small for the common case.
  images          jsonb,
  created_at      timestamptz   not null default now()
);

-- Hot path: load all messages for a thread in order.
create index if not exists chat_messages_thread_created_idx
  on chat_messages (thread_id, created_at);
