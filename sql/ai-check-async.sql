-- ══════════════════════════════════════════════════════════════════════════════
-- AI Output Check — async lifecycle (UX). Standalone migration.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste ALL → Run.
-- Idempotent and additive: safe to run once, safe to re-run.
--
-- Makes a check a running -> complete/failed job instead of a blocking call, so the
-- UI can create it and route to the activity list immediately. A running row has no
-- result yet; it is filled in when the background eval finishes. Same block lives at
-- the bottom of sql/vraelis-rank.sql.
-- ══════════════════════════════════════════════════════════════════════════════
alter table v_checks add column if not exists status text not null default 'complete'; -- running|complete|failed
alter table v_checks add column if not exists error text;                              -- failure reason, when status='failed'
-- A running check has no result yet, so allow null (existing complete rows are unaffected).
alter table v_checks alter column result drop not null;
create index if not exists v_checks_status_idx on v_checks (user_id, status, created_at desc);
