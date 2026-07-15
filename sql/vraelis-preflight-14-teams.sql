-- Preflight migration 14 — team/workspace collaboration on applications (additive to migration 13).
-- STRICTLY ADDITIVE. Apply BEFORE deploying code that reads shared-workspace access; the code degrades to
-- today's single-user (owner-only) behavior when workspace_id is NULL or the workspace tables are absent.
-- Nothing here renames, drops, or rewrites an existing column or row. No billing/credit/plan/free-pass table
-- is touched: Preflight teams use OWNER-ANCHORED billing (the app creator's user_id remains the billing +
-- credit + free-pass + submission-uniqueness key exactly as today; a workspace only SHARES access to the
-- application and everything hanging off it — contract, flows, runs, issues, deployments).
--
-- ARCHITECTURE: access resolves resource -> application -> v_applications.workspace_id -> v_workspace_members
-- role (owner|admin|editor|viewer|client_viewer, from the existing Rank workspace machinery in
-- lib/v-workspace.ts). A solo user is the owner of their own 1-member personal workspace, so single-user
-- behavior is preserved automatically. This migration only makes the ALREADY-EXISTING but write-only
-- v_applications.workspace_id column usable: it indexes it and backfills each existing app to its owner's
-- personal workspace so current apps immediately belong to a (single-member) workspace.
--
-- DEPENDS ON: v_workspaces / v_workspace_members (sql/vraelis-rank.sql). If those tables do not exist yet in
-- this database, run vraelis-rank.sql first (or skip the backfill — the code lazily creates each owner's
-- personal workspace on next visit and heals apps whose workspace_id is still NULL).
--
-- ROLLBACK = ignore workspace_id; every read falls back to owner-only scoping (the column is nullable and the
-- code treats NULL as "personal / owner-only").

-- 1. Reverse-lookup index: given a workspace, find its applications (the dashboard lists a member's shared
--    apps by workspace). The forward per-owner index (v_applications_user_idx) already exists.
create index if not exists v_applications_workspace_idx on public.v_applications (workspace_id);

-- 2. Backfill: attach every existing application to its owner's personal workspace (the oldest workspace the
--    owner owns — the same one lib/v-workspace.ts getOrCreatePersonalWorkspace returns). Only fills apps that
--    do not already carry a workspace_id, and only when the owner actually has a personal workspace; apps
--    whose owner has no workspace yet stay NULL and are healed lazily by the app on next visit. Idempotent:
--    re-running changes nothing once every app is attached.
update public.v_applications a
set workspace_id = ws.id
from lateral (
  select w.id
  from public.v_workspaces w
  where w.owner_user_id = a.user_id
  order by w.created_at asc
  limit 1
) ws
where a.workspace_id is null;

-- No other Preflight table gains a column: runs / issues / contracts / flows / connections / deployments are
-- all reachable via application_id -> v_applications.workspace_id, and billing stays keyed to the owner's
-- user_id. Verify with sql/vraelis-preflight-verify-14.sql.
