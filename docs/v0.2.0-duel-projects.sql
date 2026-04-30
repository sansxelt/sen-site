-- v0.2.0 phase G+ — duel-amplifier projects.
--
-- Pinned items now have a kind: 'context' (the existing memory wedge
-- behavior, auto-injected into every chat) OR 'prompt' (a one-click
-- saved prompt you can fire as a duel from the project panel).
-- Existing rows default to 'context' so the migration is invisible
-- on already-set-up projects.
--
-- Run after v0.2.0-projects.sql + v0.2.0-duel.sql.

alter table public.project_pinned_items
  add column if not exists kind text not null default 'context';

create index if not exists project_pinned_items_kind_idx
  on public.project_pinned_items(project_id, kind, ord);
