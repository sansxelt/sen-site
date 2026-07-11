-- Vraelis Preflight — Phase 3 additive migration (linked reruns). Run AFTER vraelis-preflight-2-discovery.sql.
-- Idempotent; no destructive change.
--
-- parent_run_id links a rerun to the run it verifies. Provenance only: the parent stays immutable, and issue
-- resolution correlates on (application, flow, category), not on this column, so a missing linkage never
-- breaks correctness. on delete set null: deleting a parent never cascades into its verification history.
alter table v_preflight_runs add column if not exists parent_run_id uuid references v_preflight_runs(id) on delete set null;
create index if not exists v_preflight_runs_parent_idx on v_preflight_runs (parent_run_id) where parent_run_id is not null;
