-- Learn content publication system.
--
-- Replaces the hardcoded lib/learn-content.tsx pattern with a
-- DB-backed pipeline so we can ship pieces without redeploying.
-- Three content types (article / info / research) cover the full
-- breadth: info is single-page glossary, articles are 1500-3000
-- word essays, research is multi-chapter deep-dives.
--
-- Run this in Supabase before the new /account/content admin or
-- /learn/p/* routes can serve real data. Helpers in lib/learn-db.ts
-- fail open (return null/empty) when these tables don't exist, so
-- the site stays up while the migration is pending.

create table if not exists public.learn_pieces (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('article', 'info', 'research')),
  slug text not null unique,
  title text not null,
  excerpt text,
  topic text not null,
  subtopic text,
  level text not null default 'all',
  cover_emoji text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  read_minutes integer,
  author_email text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz
);

create index if not exists learn_pieces_status_idx
  on public.learn_pieces(status);

create index if not exists learn_pieces_topic_idx
  on public.learn_pieces(topic);

-- Hot query: published pieces, newest first. Partial index keeps
-- the working set small even when the drafts table balloons.
create index if not exists learn_pieces_published_idx
  on public.learn_pieces(status, published_at desc nulls last)
  where status = 'published';

create table if not exists public.learn_chapters (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.learn_pieces(id) on delete cascade,
  ord integer not null,
  slug text not null,
  title text not null,
  body_md text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (piece_id, ord),
  unique (piece_id, slug)
);

create index if not exists learn_chapters_piece_ord_idx
  on public.learn_chapters(piece_id, ord);

-- Citation tracking. Every claim in a research piece should trace
-- back to a row here so the synthesis pipeline produces verifiable
-- output, not hallucinated prose.
create table if not exists public.learn_sources (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.learn_pieces(id) on delete cascade,
  ord integer not null default 0,
  url text not null,
  title text,
  author text,
  source_type text,
  excerpt text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists learn_sources_piece_idx
  on public.learn_sources(piece_id, ord);
