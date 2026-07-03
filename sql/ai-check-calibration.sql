-- ══════════════════════════════════════════════════════════════════════════════
-- Calibration (product pivot, stage 3) — standalone migration.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste ALL → Run.
-- Idempotent and additive: safe to run once, safe to re-run, touches nothing that
-- already exists. Same block that lives at the bottom of sql/vraelis-rank.sql.
--
-- Creates ONE table (v_calibration). It links an AI check to the human validation
-- test spawned from the same output, so we can measure how often the check's pick
-- matches what real people pick. Depends only on nothing external (references are by
-- id, not FKs, so it is safe regardless of migration order).
-- ══════════════════════════════════════════════════════════════════════════════
create table if not exists v_calibration (
  id                     uuid primary key default gen_random_uuid(),
  user_id                text not null,
  check_id               uuid not null,                 -- the AI check
  test_id                uuid,                          -- the human validation test (null while 'launching')
  output_type            text,
  model                  text,
  ai_winner_label        text,                          -- AI's predicted winner letter (null on tie/single)
  ai_recommendation      text,
  ai_margin              int,
  status                 text not null default 'pending', -- launching|pending|resolved
  human_winner_label     text,                          -- filled at resolve (null on a human tie)
  human_win_probability  numeric,                       -- 0..1, filled at resolve
  human_valid_judgments  int,
  agreement              boolean,                       -- null unless BOTH sides have a definite winner
  created_at             timestamptz not null default now(),
  resolved_at            timestamptz
);
create index if not exists v_calibration_user_idx on v_calibration (user_id, created_at desc);
create unique index if not exists v_calibration_check_uidx on v_calibration (check_id);
create unique index if not exists v_calibration_test_uidx on v_calibration (test_id) where test_id is not null;
create index if not exists v_calibration_pending_idx on v_calibration (status) where status = 'pending';
