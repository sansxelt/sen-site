-- v0.2.0 phase G: side-by-side model duel.
--
-- A "duel turn" is one user prompt with TWO assistant responses,
-- one from GPT and one from Claude, streamed in parallel and shown
-- in side-by-side columns. The user picks a winner (or retries
-- both); the loser row is deleted and the winner becomes the
-- canonical assistant turn for the rest of the thread.
--
-- Schema-wise we just decorate chat_messages with three nullable
-- columns. Solo turns leave them all null and behave exactly as
-- before; duel turns share a duel_group_id across both assistant
-- rows and the API uses duel_side / duel_model to label them.
--
-- Run in Supabase after v0.2.0-projects.sql. Helpers in
-- lib/duel-history.ts fail open when these columns are missing
-- so a deploy without the migration just falls back to solo mode.

alter table public.chat_messages
  add column if not exists duel_group_id uuid,
  add column if not exists duel_side     text,    -- 'left' | 'right'
  add column if not exists duel_model    text,    -- 'gpt-4o' | 'claude-sonnet-4-6' | …
  add column if not exists duel_winner   boolean; -- null = open, true = picked

create index if not exists chat_messages_duel_group_idx
  on public.chat_messages(duel_group_id);
