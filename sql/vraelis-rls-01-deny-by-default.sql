-- ============================================================================
-- RLS: deny-by-default across the application schema.
--
-- WHY NO POLICIES. This app authenticates with NextAuth, not Supabase Auth, so there is no
-- Supabase-authenticated user in any request and auth.uid() is NULL for every caller. A policy written
-- against auth.uid() would match nothing and would be security theatre. Every database access goes through
-- the SERVICE-ROLE client (lib/supabase-admin.ts), which has BYPASSRLS, with the owner filter applied in
-- application code. So the meaningful control is: enable RLS with NO permissive policies. The service role
-- keeps working; anon and authenticated reach zero rows. Same reasoning as sql/ai-check-attachments-rls.sql,
-- generalised from one table to the whole schema.
--
-- CATALOG-ONLY. No table is rewritten and no row is touched, so this runs in milliseconds at any size.
--
-- Sections:
--   0. lock_timeout, so a blocked statement fails fast instead of stalling traffic
--   A. Record which tables this migration actually changes, then enable RLS on them
--   B. Revoke table/sequence privileges from anon / authenticated / PUBLIC
--   C. Revoke DEFAULT privileges so future objects do not silently reopen the hole
--   D. Revoke EXECUTE on application functions from anon / authenticated / PUBLIC
--   E. Pin search_path on every SECURITY DEFINER function
--   F. Re-assert what service_role needs, so nothing above can strand the application
--
-- FORCE ROW LEVEL SECURITY is deliberately NOT used: it affects only the table OWNER, which is the
-- migration/admin role that maintenance and future migrations run as. Forcing it would break those without
-- adding any protection against anon or authenticated, who are not owners.
-- ============================================================================

-- ── 0. Fail fast rather than queueing behind a long-running query ───────────
-- Every statement below takes a brief ACCESS EXCLUSIVE lock. That is microseconds of work, but it still
-- queues behind an in-flight query on the same table and blocks everything arriving after it. With a
-- timeout, a contended table aborts the transaction cleanly instead of stalling the site; just re-run.
set lock_timeout = '5s';

begin;

-- ── A. Record, then enable ─────────────────────────────────────────────────
-- The ledger is what makes the rollback EXACT. A hardcoded list cannot know which tables were already
-- protected before this ran, so rolling back a hardcoded list would strip RLS from tables that were never
-- part of this change. This records precisely what was flipped.
create table if not exists public._rls_migration_01_applied (
  tablename  text primary key,
  applied_at timestamptz not null default now()
);
alter table public._rls_migration_01_applied enable row level security;

insert into public._rls_migration_01_applied (tablename)
select tablename
from pg_tables
where schemaname = 'public'
  and not rowsecurity
  and tablename <> '_rls_migration_01_applied'
on conflict (tablename) do nothing;

-- The explicit statements below are the reviewable form of the same set. Enabling RLS twice is a no-op, so
-- they stay correct even if the live schema differs slightly from the one they were generated against; the
-- catch-all after them covers anything this list misses (a table added by a later migration).
alter table public.analytics_events enable row level security;
alter table public.boost_credits enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_sources enable row level security;
alter table public.chat_threads enable row level security;
alter table public.credit_transactions enable row level security;
alter table public.desktop_auth_requests enable row level security;
alter table public.desktop_preferences enable row level security;
alter table public.desktop_sessions enable row level security;
alter table public.email_broadcasts enable row level security;
alter table public.flip_accounts enable row level security;
alter table public.flip_connections enable row level security;
alter table public.flip_crypto_invoices enable row level security;
alter table public.flip_items enable row level security;
alter table public.flip_listings enable row level security;
alter table public.github_integrations enable row level security;
alter table public.learn_chapters enable row level security;
alter table public.learn_contributors enable row level security;
alter table public.learn_pieces enable row level security;
alter table public.learn_sources enable row level security;
alter table public.notes enable row level security;
alter table public.project_pinned_items enable row level security;
alter table public.projects enable row level security;
alter table public.shared_threads enable row level security;
alter table public.stripe_notifications_sent enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.usage_events enable row level security;
alter table public.user_credits enable row level security;
alter table public.v_api_keys enable row level security;
alter table public.v_applications enable row level security;
alter table public.v_auto_recharge enable row level security;
alter table public.v_auto_recharge_events enable row level security;
alter table public.v_billing_disputes enable row level security;
alter table public.v_builds enable row level security;
alter table public.v_calibration enable row level security;
alter table public.v_check_attachments enable row level security;
alter table public.v_checks enable row level security;
alter table public.v_collection_links enable row level security;
alter table public.v_context_snapshots enable row level security;
alter table public.v_contract_requirements enable row level security;
alter table public.v_cost_ledger enable row level security;
alter table public.v_credit_ledger enable row level security;
alter table public.v_data_requests enable row level security;
alter table public.v_deployments enable row level security;
alter table public.v_discovery_snapshots enable row level security;
alter table public.v_events enable row level security;
alter table public.v_flow_runs enable row level security;
alter table public.v_free_grant_overrides enable row level security;
alter table public.v_free_grant_risk enable row level security;
alter table public.v_free_pass_claims enable row level security;
alter table public.v_guarantees enable row level security;
alter table public.v_judgments enable row level security;
alter table public.v_organization_domains enable row level security;
alter table public.v_organization_join_requests enable row level security;
alter table public.v_organization_members enable row level security;
alter table public.v_organization_sso_providers enable row level security;
alter table public.v_organizations enable row level security;
alter table public.v_payments enable row level security;
alter table public.v_platform_decisions enable row level security;
alter table public.v_preflight_runs enable row level security;
alter table public.v_production_contracts enable row level security;
alter table public.v_profiles enable row level security;
alter table public.v_project_members enable row level security;
alter table public.v_projects enable row level security;
alter table public.v_provider_attempts enable row level security;
alter table public.v_provider_breaker enable row level security;
alter table public.v_repairs enable row level security;
alter table public.v_reports enable row level security;
alter table public.v_reviewed_plans enable row level security;
alter table public.v_run_steps enable row level security;
alter table public.v_runs_governor enable row level security;
alter table public.v_runtime_targets enable row level security;
alter table public.v_screening_questions enable row level security;
alter table public.v_screening_responses enable row level security;
alter table public.v_subscriptions enable row level security;
alter table public.v_test_flows enable row level security;
alter table public.v_test_options enable row level security;
alter table public.v_tests enable row level security;
alter table public.v_verification_idempotency enable row level security;
alter table public.v_voter_rep enable row level security;
alter table public.v_webhook_deliveries enable row level security;
alter table public.v_webhook_endpoints enable row level security;
alter table public.v_workspace_billing enable row level security;
alter table public.v_workspace_members enable row level security;
alter table public.v_workspace_ownership_transfers enable row level security;
alter table public.v_workspaces enable row level security;
alter table public.vraelis_bookings enable row level security;
alter table public.vraelis_contacts enable row level security;
alter table public.vraelis_leads enable row level security;
alter table public.vraelis_messages enable row level security;
alter table public.vraelis_payments enable row level security;
alter table public.vraelis_rate_limits enable row level security;
alter table public.vraelis_workspaces enable row level security;
alter table public.waitlist enable row level security;

-- Catch-all: anything still without RLS, including tables added since this file was generated.
do $$
declare r record;
begin
  for r in
    select tablename from pg_tables
    where schemaname = 'public' and not rowsecurity
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
  end loop;
end $$;

-- ── B. Revoke table privileges from the browser-facing roles ────────────────
-- RLS alone already denies these roles every row. Revoking the grants as well means a policy added later
-- by mistake cannot silently become reachable, and it makes the intent explicit in the catalog.
revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from authenticated;
revoke all privileges on all tables in schema public from public;
revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all sequences in schema public from authenticated;
revoke all privileges on all sequences in schema public from public;

-- ── C. Stop FUTURE objects from being auto-granted ─────────────────────────
-- Supabase's project defaults grant ALL on newly created objects to anon and authenticated. Without this,
-- the next migration that adds a table reopens exactly the hole this migration closes.
--
-- NOTE ON "FOR ROLE": default privileges are recorded per creating-role. These statements apply to the role
-- executing this migration. If migrations are applied by a DIFFERENT role than the one that created the
-- existing defaults, add matching "alter default privileges for role <that_role> ..." lines. Check with:
--   select pg_get_userbyid(defaclrole), defaclobjtype, defaclacl from pg_default_acl;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on sequences from authenticated;
alter default privileges in schema public revoke all on functions from anon;
alter default privileges in schema public revoke all on functions from authenticated;
-- PUBLIC is the one that actually bites for functions: Postgres grants EXECUTE to PUBLIC on every new
-- function as a BUILT-IN default, independent of the Supabase grants above, and PostgREST exposes
-- public-schema functions as RPC. Without this, the next function added ships anon-callable.
alter default privileges in schema public revoke execute on functions from public;
-- ...and keep granting to service_role, which is what the application actually connects as.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;

-- ── D. Revoke EXECUTE on application functions ─────────────────────────────
-- Looked up from the catalog rather than hardcoded: some of these are defined only in docs/*.sql and one
-- may already be retired, and a REVOKE naming a function that does not exist aborts the whole transaction.
-- Extension-owned functions (pgcrypto) are excluded so the extension keeps working.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1 from pg_depend d join pg_extension e on e.oid = d.refobjid
        where d.objid = p.oid and d.deptype = 'e'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- ── E. Pin search_path on every SECURITY DEFINER function ──────────────────
-- A SECURITY DEFINER function runs with its owner's privileges. Without a pinned search_path, a role that
-- can create objects in an earlier schema on the path could shadow a table or operator the body resolves
-- and have it executed as the owner. pg_temp is placed last explicitly, which is the documented safe form.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('alter function %s set search_path = public, pg_temp', r.sig);
  end loop;
end $$;

-- ── F. Re-assert service_role access ───────────────────────────────────────
-- Section B revoked from PUBLIC, and service_role may have been relying on a PUBLIC grant rather than a
-- direct one. This makes the application's access explicit instead of incidental. service_role also has
-- BYPASSRLS, so RLS itself never blocks it — but privileges are a separate gate from RLS, and only this
-- section guarantees the privilege half.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

commit;

reset lock_timeout;
