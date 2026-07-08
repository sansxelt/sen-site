-- ══════════════════════════════════════════════════════════════════════════════
-- Shareable AI Check reports — public, opt-in share links.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste ALL → Run.
-- Idempotent and additive: safe to run once, safe to re-run.
--
-- The v_checks table was defined WITH share_token + share_enabled from the start
-- (they were "reserved for a future public report link"). This migration only
-- matters if your live v_checks table was created by an older revision that
-- predates those columns — `add column if not exists` is a no-op otherwise.
--
-- Semantics: a report is publicly viewable ONLY when share_enabled = true AND the
-- unguessable share_token matches. Flipping share_enabled to false instantly kills
-- the link. No user identity is ever exposed by the public read path.
-- ══════════════════════════════════════════════════════════════════════════════

alter table v_checks add column if not exists share_token   text;
alter table v_checks add column if not exists share_enabled boolean not null default false;

-- One check per token; partial so the many non-shared rows don't collide on NULL.
create unique index if not exists v_checks_share_token_uidx
  on v_checks (share_token) where share_token is not null;

-- The public report page fetches by (share_token, share_enabled=true, status='complete').
-- This partial index keeps that lookup fast and bounded to shared rows only.
create index if not exists v_checks_shared_lookup_idx
  on v_checks (share_token) where share_enabled = true;
