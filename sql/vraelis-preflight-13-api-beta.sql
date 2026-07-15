-- Preflight migration 13 — API beta customer surfaces (additive to migration 12's multi-runtime model).
-- STRICTLY ADDITIVE. Apply BEFORE deploying code that reads these; the code degrades to today's web-only
-- behavior when they are absent. Nothing here renames, drops, or rewrites an existing column or row.
--
-- Two additions, both mirroring the migration-12 additive pattern (nullable, default-safe):
--   1. v_test_flows.runtime_target_id — which runtime target a flow belongs to. NULL = the app's web target
--      (every existing flow reads as web, unchanged). An API flow carries the app's api target id.
--   2. v_run_steps.evidence — a sanitized JSONB array of evidence items (http_txn for API steps). The
--      existing `observed` (text) still holds the human-readable line; `evidence` is new and defaults to an
--      empty array so every existing web step row is valid and unchanged.
--
-- ROLLBACK = ignore these columns; the web path never requires them (both are nullable/defaulted).

-- 1. Which runtime target a flow belongs to (null = web, backward-compatible).
alter table public.v_test_flows add column if not exists runtime_target_id uuid;
create index if not exists v_test_flows_runtime_target_idx on public.v_test_flows (runtime_target_id);

-- 2. Sanitized structured evidence per step (http_txn for API; empty for existing web steps).
alter table public.v_run_steps add column if not exists evidence jsonb not null default '[]'::jsonb;

-- No backfill needed: existing v_test_flows rows are web (null reads as web); existing v_run_steps rows keep
-- an empty evidence array. Verify with sql/vraelis-preflight-verify-13.sql.
