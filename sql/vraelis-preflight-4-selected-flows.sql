-- Vraelis Preflight — Phase 4 additive migration (authoritative flow selection). Run AFTER
-- vraelis-preflight-3-linked-reruns.sql. Idempotent; no destructive change.
--
-- flow_ids is the run snapshot's SELECTED flow set (jsonb array of v_test_flows uuids), written by
-- createRun at enqueue. It is AUTHORITATIVE for execution: the worker executes exactly these flows and
-- fails the run as an internal configuration error (failure_code 'flow_selection_invalid', before any
-- browser session, never billable) when the selection is missing, empty, or references a flow outside the
-- run's enabled+approved contract snapshot. This is what makes a targeted rerun ("rerun the 2 failed
-- flows") execute 2 flows, not the whole contract.
alter table v_preflight_runs add column if not exists flow_ids jsonb;
