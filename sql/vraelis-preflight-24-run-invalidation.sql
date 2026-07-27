-- Migration 24: a verdict can be INVALIDATED without being rewritten.
--
-- WHY. Vraelis's own locator resolver failed to try valid link candidates, so three verifications reported a
-- working application as broken. Those runs are not customer failures. They are also not deletable and not
-- editable: the decision a customer was shown is a historical fact, and a product whose records change
-- retroactively is worth less than one whose records are wrong but honest.
--
-- So invalidation is ADDITIVE and orthogonal to the verdict. state and decision keep exactly what they said.
-- What changes is whether the run still COUNTS: an invalidated run is excluded from current system health,
-- open-issue counts, guarantee verdicts and coverage summaries, while staying fully inspectable with its
-- evidence intact and clearly labelled.
--
-- This is a product rule for verifier defects, not a demo filter. Any run whose verdict was produced by a
-- defect in the verifier rather than by the software under test belongs here.
--
-- Additive, nullable, indexed, no foreign key, no cascade. Backfills NOTHING: invalidating a run is an
-- explicit operator act with a stated reason, never something a migration infers.

alter table public.v_preflight_runs
  add column if not exists invalidated_at     timestamptz,
  add column if not exists invalidated_reason text,
  add column if not exists invalidated_by     text,
  add column if not exists invalidated_ref    text;

comment on column public.v_preflight_runs.invalidated_at is
  'When this run stopped counting toward current state. NULL for every valid run. The verdict itself is never rewritten.';
comment on column public.v_preflight_runs.invalidated_reason is
  'Customer-readable sentence explaining why the verdict cannot be trusted. Shown in the console beside the preserved result.';
comment on column public.v_preflight_runs.invalidated_by is
  'Who invalidated it (an operator identity), so the act is attributable rather than anonymous.';
comment on column public.v_preflight_runs.invalidated_ref is
  'The defect this is attributed to: a commit SHA, worker version, or issue reference. What makes the claim checkable.';

-- Health reads filter on "not invalidated" per owner and application, so the partial index carries the
-- common case without adding a column to every existing index.
create index if not exists v_preflight_runs_invalidated_idx
  on public.v_preflight_runs (user_id, application_id)
  where invalidated_at is null;

-- ── rollback ────────────────────────────────────────────────────────────────────────────────────────────
-- drop index if exists public.v_preflight_runs_invalidated_idx;
-- alter table public.v_preflight_runs
--   drop column if exists invalidated_at,
--   drop column if exists invalidated_reason,
--   drop column if exists invalidated_by,
--   drop column if exists invalidated_ref;
