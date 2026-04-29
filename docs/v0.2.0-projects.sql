-- v0.2.0 memory wedge: projects + pinned-context.
--
-- A project is a long-running container of context (description,
-- goals, pinned items) that auto-injects into every chat thread
-- attached to it. Threads live inside zero or one project; pinned
-- items live inside one project; both belong to one owner_email.
--
-- Run in Supabase after v0.1.x migrations. Helpers in lib/projects.ts
-- fail open (return empty / null) if these tables are missing, so
-- the chat surface stays up while the migration is pending.

create table if not exists public.projects (
  id           uuid primary key default gen_random_uuid(),
  owner_email  text not null,
  name         text not null,
  description  text,
  goals        text,
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now())
);

create index if not exists projects_owner_idx
  on public.projects(owner_email, updated_at desc);

create table if not exists public.project_pinned_items (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  label       text,           -- short title shown in the side panel
  content     text not null,  -- the actual text injected into the system message
  ord         integer not null default 0,
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now())
);

create index if not exists project_pinned_items_project_idx
  on public.project_pinned_items(project_id, ord);

-- Attach existing chat_threads to a project. Nullable so old threads
-- and quick "no project" chats keep working.
alter table public.chat_threads
  add column if not exists project_id uuid references public.projects(id) on delete set null;

create index if not exists chat_threads_project_idx
  on public.chat_threads(project_id, updated_at desc);
