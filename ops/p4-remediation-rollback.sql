-- EXACT rollback for the P4-A/P4-B migration.  GENERATED - do not edit by hand.
--   generator: scripts/gen-p4-rollback.ts
--   source:    the verified production public-schema dump
--
-- Restores precisely the ACL state the dump records. It deliberately does NOT use
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
-- because that would grant all 107 tables where production grants 101,
-- re-exposing the six tables hardened by hand. Each grant below is reproduced individually.
--
-- table grants: 309   function grants: 24   schema: 4   sequence: 0   defaults: 12

BEGIN;

-- 1. Restore the original v_preflight_claim definition (no pinned search_path, no bounds).
CREATE OR REPLACE FUNCTION public.v_preflight_claim(p_worker text, p_lease_secs integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('v_preflight_claim'));
  select id into v_id from v_preflight_runs
    where state = 'queued' and (lease_expires_at is null or lease_expires_at < now())
    order by created_at asc limit 1 for update skip locked;
  if v_id is null then return null; end if;
  update v_preflight_runs
    set state = 'running', lease_owner = p_worker, lease_expires_at = now() + make_interval(secs => p_lease_secs),
        heartbeat_at = now(), attempts = attempts + 1, started_at = coalesce(started_at, now())
    where id = v_id;
  return v_id;
end $$;

-- 2. PostgreSQL grants PUBLIC EXECUTE on functions by default; the dump carries no REVOKE ... FROM
--    PUBLIC, which is how we know production still had it. Restore it explicitly.
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.usage_summary(p_email text, p_since timestamp with time zone) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.v_complete_test(p_test uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.v_launch_test(p_user text, p_title text, p_context text, p_category text, p_audience text, p_votes integer, p_options jsonb, p_active_limit integer, p_max_options integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.v_preflight_claim(p_worker text, p_lease_secs integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.v_record_vote(p_test uuid, p_voter text, p_option uuid, p_reason text, p_time_spent integer, p_reward_cap integer, p_status text, p_reject_reason text, p_ip_hash text, p_device_hash text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.v_spend_credit(p_user text, p_ref uuid, p_amount integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.vraelis_rate_check(p_key text, p_limit integer, p_window_secs integer) TO PUBLIC;

-- 3. Undo the GLOBAL default-privilege revoke, restoring PostgreSQL's built-in PUBLIC EXECUTE for
--    functions created by postgres. Without this the rollback leaves future functions hardened, which is
--    a better state but NOT the state the dump records - and a rollback that does not restore is not exact.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO PUBLIC;

-- 4. Function grants, exactly as the dump records them. CREATE OR REPLACE preserves an existing ACL, but
--    the forward migration revoked anon/authenticated, so these must be replayed to restore them.
GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;
GRANT ALL ON FUNCTION public.usage_summary(p_email text, p_since timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.usage_summary(p_email text, p_since timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.usage_summary(p_email text, p_since timestamp with time zone) TO service_role;
GRANT ALL ON FUNCTION public.v_complete_test(p_test uuid) TO anon;
GRANT ALL ON FUNCTION public.v_complete_test(p_test uuid) TO authenticated;
GRANT ALL ON FUNCTION public.v_complete_test(p_test uuid) TO service_role;
GRANT ALL ON FUNCTION public.v_launch_test(p_user text, p_title text, p_context text, p_category text, p_audience text, p_votes integer, p_options jsonb, p_active_limit integer, p_max_options integer) TO anon;
GRANT ALL ON FUNCTION public.v_launch_test(p_user text, p_title text, p_context text, p_category text, p_audience text, p_votes integer, p_options jsonb, p_active_limit integer, p_max_options integer) TO authenticated;
GRANT ALL ON FUNCTION public.v_launch_test(p_user text, p_title text, p_context text, p_category text, p_audience text, p_votes integer, p_options jsonb, p_active_limit integer, p_max_options integer) TO service_role;
GRANT ALL ON FUNCTION public.v_preflight_claim(p_worker text, p_lease_secs integer) TO anon;
GRANT ALL ON FUNCTION public.v_preflight_claim(p_worker text, p_lease_secs integer) TO authenticated;
GRANT ALL ON FUNCTION public.v_preflight_claim(p_worker text, p_lease_secs integer) TO service_role;
GRANT ALL ON FUNCTION public.v_record_vote(p_test uuid, p_voter text, p_option uuid, p_reason text, p_time_spent integer, p_reward_cap integer, p_status text, p_reject_reason text, p_ip_hash text, p_device_hash text) TO anon;
GRANT ALL ON FUNCTION public.v_record_vote(p_test uuid, p_voter text, p_option uuid, p_reason text, p_time_spent integer, p_reward_cap integer, p_status text, p_reject_reason text, p_ip_hash text, p_device_hash text) TO authenticated;
GRANT ALL ON FUNCTION public.v_record_vote(p_test uuid, p_voter text, p_option uuid, p_reason text, p_time_spent integer, p_reward_cap integer, p_status text, p_reject_reason text, p_ip_hash text, p_device_hash text) TO service_role;
GRANT ALL ON FUNCTION public.v_spend_credit(p_user text, p_ref uuid, p_amount integer) TO anon;
GRANT ALL ON FUNCTION public.v_spend_credit(p_user text, p_ref uuid, p_amount integer) TO authenticated;
GRANT ALL ON FUNCTION public.v_spend_credit(p_user text, p_ref uuid, p_amount integer) TO service_role;
GRANT ALL ON FUNCTION public.vraelis_rate_check(p_key text, p_limit integer, p_window_secs integer) TO anon;
GRANT ALL ON FUNCTION public.vraelis_rate_check(p_key text, p_limit integer, p_window_secs integer) TO authenticated;
GRANT ALL ON FUNCTION public.vraelis_rate_check(p_key text, p_limit integer, p_window_secs integer) TO service_role;

-- 5. Schema-level grants.
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

-- 6. Table grants, exactly as the dump records them.
GRANT ALL ON TABLE public.account_subscriptions TO anon;
GRANT ALL ON TABLE public.account_subscriptions TO authenticated;
GRANT ALL ON TABLE public.account_subscriptions TO service_role;
GRANT ALL ON TABLE public.analytics_events TO service_role;
GRANT ALL ON TABLE public.api_keys TO anon;
GRANT ALL ON TABLE public.api_keys TO authenticated;
GRANT ALL ON TABLE public.api_keys TO service_role;
GRANT ALL ON TABLE public.boost_credits TO anon;
GRANT ALL ON TABLE public.boost_credits TO authenticated;
GRANT ALL ON TABLE public.boost_credits TO service_role;
GRANT ALL ON TABLE public.chat_messages TO anon;
GRANT ALL ON TABLE public.chat_messages TO authenticated;
GRANT ALL ON TABLE public.chat_messages TO service_role;
GRANT ALL ON TABLE public.chat_threads TO anon;
GRANT ALL ON TABLE public.chat_threads TO authenticated;
GRANT ALL ON TABLE public.chat_threads TO service_role;
GRANT ALL ON TABLE public.credit_transactions TO anon;
GRANT ALL ON TABLE public.credit_transactions TO authenticated;
GRANT ALL ON TABLE public.credit_transactions TO service_role;
GRANT ALL ON TABLE public.desktop_auth_requests TO anon;
GRANT ALL ON TABLE public.desktop_auth_requests TO authenticated;
GRANT ALL ON TABLE public.desktop_auth_requests TO service_role;
GRANT ALL ON TABLE public.desktop_preferences TO anon;
GRANT ALL ON TABLE public.desktop_preferences TO authenticated;
GRANT ALL ON TABLE public.desktop_preferences TO service_role;
GRANT ALL ON TABLE public.desktop_sessions TO anon;
GRANT ALL ON TABLE public.desktop_sessions TO authenticated;
GRANT ALL ON TABLE public.desktop_sessions TO service_role;
GRANT ALL ON TABLE public.early_access_signups TO anon;
GRANT ALL ON TABLE public.early_access_signups TO authenticated;
GRANT ALL ON TABLE public.early_access_signups TO service_role;
GRANT ALL ON TABLE public.email_broadcasts TO anon;
GRANT ALL ON TABLE public.email_broadcasts TO authenticated;
GRANT ALL ON TABLE public.email_broadcasts TO service_role;
GRANT ALL ON TABLE public.flip_accounts TO anon;
GRANT ALL ON TABLE public.flip_accounts TO authenticated;
GRANT ALL ON TABLE public.flip_accounts TO service_role;
GRANT ALL ON TABLE public.flip_connections TO anon;
GRANT ALL ON TABLE public.flip_connections TO authenticated;
GRANT ALL ON TABLE public.flip_connections TO service_role;
GRANT ALL ON TABLE public.flip_crypto_invoices TO anon;
GRANT ALL ON TABLE public.flip_crypto_invoices TO authenticated;
GRANT ALL ON TABLE public.flip_crypto_invoices TO service_role;
GRANT ALL ON TABLE public.flip_items TO anon;
GRANT ALL ON TABLE public.flip_items TO authenticated;
GRANT ALL ON TABLE public.flip_items TO service_role;
GRANT ALL ON TABLE public.flip_listings TO anon;
GRANT ALL ON TABLE public.flip_listings TO authenticated;
GRANT ALL ON TABLE public.flip_listings TO service_role;
GRANT ALL ON TABLE public.github_integrations TO anon;
GRANT ALL ON TABLE public.github_integrations TO authenticated;
GRANT ALL ON TABLE public.github_integrations TO service_role;
GRANT ALL ON TABLE public.learn_chapters TO anon;
GRANT ALL ON TABLE public.learn_chapters TO authenticated;
GRANT ALL ON TABLE public.learn_chapters TO service_role;
GRANT ALL ON TABLE public.learn_contributors TO anon;
GRANT ALL ON TABLE public.learn_contributors TO authenticated;
GRANT ALL ON TABLE public.learn_contributors TO service_role;
GRANT ALL ON TABLE public.learn_pieces TO anon;
GRANT ALL ON TABLE public.learn_pieces TO authenticated;
GRANT ALL ON TABLE public.learn_pieces TO service_role;
GRANT ALL ON TABLE public.learn_sources TO anon;
GRANT ALL ON TABLE public.learn_sources TO authenticated;
GRANT ALL ON TABLE public.learn_sources TO service_role;
GRANT ALL ON TABLE public.notes TO anon;
GRANT ALL ON TABLE public.notes TO authenticated;
GRANT ALL ON TABLE public.notes TO service_role;
GRANT ALL ON TABLE public.password_reset_tokens TO anon;
GRANT ALL ON TABLE public.password_reset_tokens TO authenticated;
GRANT ALL ON TABLE public.password_reset_tokens TO service_role;
GRANT ALL ON TABLE public.pending_signups TO anon;
GRANT ALL ON TABLE public.pending_signups TO authenticated;
GRANT ALL ON TABLE public.pending_signups TO service_role;
GRANT ALL ON TABLE public.project_pinned_items TO anon;
GRANT ALL ON TABLE public.project_pinned_items TO authenticated;
GRANT ALL ON TABLE public.project_pinned_items TO service_role;
GRANT ALL ON TABLE public.projects TO anon;
GRANT ALL ON TABLE public.projects TO authenticated;
GRANT ALL ON TABLE public.projects TO service_role;
GRANT ALL ON TABLE public.stripe_notifications_sent TO anon;
GRANT ALL ON TABLE public.stripe_notifications_sent TO authenticated;
GRANT ALL ON TABLE public.stripe_notifications_sent TO service_role;
GRANT ALL ON TABLE public.stripe_webhook_events TO anon;
GRANT ALL ON TABLE public.stripe_webhook_events TO authenticated;
GRANT ALL ON TABLE public.stripe_webhook_events TO service_role;
GRANT ALL ON TABLE public.usage_events TO anon;
GRANT ALL ON TABLE public.usage_events TO authenticated;
GRANT ALL ON TABLE public.usage_events TO service_role;
GRANT ALL ON TABLE public.user_credentials TO anon;
GRANT ALL ON TABLE public.user_credentials TO authenticated;
GRANT ALL ON TABLE public.user_credentials TO service_role;
GRANT ALL ON TABLE public.user_credits TO anon;
GRANT ALL ON TABLE public.user_credits TO authenticated;
GRANT ALL ON TABLE public.user_credits TO service_role;
GRANT ALL ON TABLE public.user_profiles TO anon;
GRANT ALL ON TABLE public.user_profiles TO authenticated;
GRANT ALL ON TABLE public.user_profiles TO service_role;
GRANT ALL ON TABLE public.v_account_connections TO anon;
GRANT ALL ON TABLE public.v_account_connections TO authenticated;
GRANT ALL ON TABLE public.v_account_connections TO service_role;
GRANT ALL ON TABLE public.v_api_keys TO anon;
GRANT ALL ON TABLE public.v_api_keys TO authenticated;
GRANT ALL ON TABLE public.v_api_keys TO service_role;
GRANT ALL ON TABLE public.v_app_connection_links TO anon;
GRANT ALL ON TABLE public.v_app_connection_links TO authenticated;
GRANT ALL ON TABLE public.v_app_connection_links TO service_role;
GRANT ALL ON TABLE public.v_app_connections TO anon;
GRANT ALL ON TABLE public.v_app_connections TO authenticated;
GRANT ALL ON TABLE public.v_app_connections TO service_role;
GRANT ALL ON TABLE public.v_applications TO anon;
GRANT ALL ON TABLE public.v_applications TO authenticated;
GRANT ALL ON TABLE public.v_applications TO service_role;
GRANT ALL ON TABLE public.v_auto_recharge TO anon;
GRANT ALL ON TABLE public.v_auto_recharge TO authenticated;
GRANT ALL ON TABLE public.v_auto_recharge TO service_role;
GRANT ALL ON TABLE public.v_auto_recharge_events TO anon;
GRANT ALL ON TABLE public.v_auto_recharge_events TO authenticated;
GRANT ALL ON TABLE public.v_auto_recharge_events TO service_role;
GRANT ALL ON TABLE public.v_billing_disputes TO anon;
GRANT ALL ON TABLE public.v_billing_disputes TO authenticated;
GRANT ALL ON TABLE public.v_billing_disputes TO service_role;
GRANT ALL ON TABLE public.v_builds TO anon;
GRANT ALL ON TABLE public.v_builds TO authenticated;
GRANT ALL ON TABLE public.v_builds TO service_role;
GRANT ALL ON TABLE public.v_calibration TO anon;
GRANT ALL ON TABLE public.v_calibration TO authenticated;
GRANT ALL ON TABLE public.v_calibration TO service_role;
GRANT ALL ON TABLE public.v_check_attachments TO anon;
GRANT ALL ON TABLE public.v_check_attachments TO authenticated;
GRANT ALL ON TABLE public.v_check_attachments TO service_role;
GRANT ALL ON TABLE public.v_check_idempotency TO anon;
GRANT ALL ON TABLE public.v_check_idempotency TO authenticated;
GRANT ALL ON TABLE public.v_check_idempotency TO service_role;
GRANT ALL ON TABLE public.v_checks TO anon;
GRANT ALL ON TABLE public.v_checks TO authenticated;
GRANT ALL ON TABLE public.v_checks TO service_role;
GRANT ALL ON TABLE public.v_collection_links TO anon;
GRANT ALL ON TABLE public.v_collection_links TO authenticated;
GRANT ALL ON TABLE public.v_collection_links TO service_role;
GRANT ALL ON TABLE public.v_context_snapshots TO anon;
GRANT ALL ON TABLE public.v_context_snapshots TO authenticated;
GRANT ALL ON TABLE public.v_context_snapshots TO service_role;
GRANT ALL ON TABLE public.v_contract_requirements TO anon;
GRANT ALL ON TABLE public.v_contract_requirements TO authenticated;
GRANT ALL ON TABLE public.v_contract_requirements TO service_role;
GRANT ALL ON TABLE public.v_contract_requirements_provenance_backup_21 TO anon;
GRANT ALL ON TABLE public.v_contract_requirements_provenance_backup_21 TO authenticated;
GRANT ALL ON TABLE public.v_contract_requirements_provenance_backup_21 TO service_role;
GRANT ALL ON TABLE public.v_cost_ledger TO anon;
GRANT ALL ON TABLE public.v_cost_ledger TO authenticated;
GRANT ALL ON TABLE public.v_cost_ledger TO service_role;
GRANT ALL ON TABLE public.v_credit_ledger TO anon;
GRANT ALL ON TABLE public.v_credit_ledger TO authenticated;
GRANT ALL ON TABLE public.v_credit_ledger TO service_role;
GRANT ALL ON TABLE public.v_data_requests TO anon;
GRANT ALL ON TABLE public.v_data_requests TO authenticated;
GRANT ALL ON TABLE public.v_data_requests TO service_role;
GRANT ALL ON TABLE public.v_deployments TO anon;
GRANT ALL ON TABLE public.v_deployments TO authenticated;
GRANT ALL ON TABLE public.v_deployments TO service_role;
GRANT ALL ON TABLE public.v_discovery_snapshots TO anon;
GRANT ALL ON TABLE public.v_discovery_snapshots TO authenticated;
GRANT ALL ON TABLE public.v_discovery_snapshots TO service_role;
GRANT ALL ON TABLE public.v_events TO anon;
GRANT ALL ON TABLE public.v_events TO authenticated;
GRANT ALL ON TABLE public.v_events TO service_role;
GRANT ALL ON TABLE public.v_flow_runs TO anon;
GRANT ALL ON TABLE public.v_flow_runs TO authenticated;
GRANT ALL ON TABLE public.v_flow_runs TO service_role;
GRANT ALL ON TABLE public.v_free_grant_overrides TO anon;
GRANT ALL ON TABLE public.v_free_grant_overrides TO authenticated;
GRANT ALL ON TABLE public.v_free_grant_overrides TO service_role;
GRANT ALL ON TABLE public.v_free_grant_risk TO anon;
GRANT ALL ON TABLE public.v_free_grant_risk TO authenticated;
GRANT ALL ON TABLE public.v_free_grant_risk TO service_role;
GRANT ALL ON TABLE public.v_free_pass_claims TO anon;
GRANT ALL ON TABLE public.v_free_pass_claims TO authenticated;
GRANT ALL ON TABLE public.v_free_pass_claims TO service_role;
GRANT ALL ON TABLE public.v_guarantees TO anon;
GRANT ALL ON TABLE public.v_guarantees TO authenticated;
GRANT ALL ON TABLE public.v_guarantees TO service_role;
GRANT ALL ON TABLE public.v_issues TO anon;
GRANT ALL ON TABLE public.v_issues TO authenticated;
GRANT ALL ON TABLE public.v_issues TO service_role;
GRANT ALL ON TABLE public.v_judgments TO anon;
GRANT ALL ON TABLE public.v_judgments TO authenticated;
GRANT ALL ON TABLE public.v_judgments TO service_role;
GRANT ALL ON TABLE public.v_organization_domains TO anon;
GRANT ALL ON TABLE public.v_organization_domains TO authenticated;
GRANT ALL ON TABLE public.v_organization_domains TO service_role;
GRANT ALL ON TABLE public.v_organization_join_requests TO anon;
GRANT ALL ON TABLE public.v_organization_join_requests TO authenticated;
GRANT ALL ON TABLE public.v_organization_join_requests TO service_role;
GRANT ALL ON TABLE public.v_organization_members TO anon;
GRANT ALL ON TABLE public.v_organization_members TO authenticated;
GRANT ALL ON TABLE public.v_organization_members TO service_role;
GRANT ALL ON TABLE public.v_organization_sso_providers TO anon;
GRANT ALL ON TABLE public.v_organization_sso_providers TO authenticated;
GRANT ALL ON TABLE public.v_organization_sso_providers TO service_role;
GRANT ALL ON TABLE public.v_organizations TO anon;
GRANT ALL ON TABLE public.v_organizations TO authenticated;
GRANT ALL ON TABLE public.v_organizations TO service_role;
GRANT ALL ON TABLE public.v_payments TO anon;
GRANT ALL ON TABLE public.v_payments TO authenticated;
GRANT ALL ON TABLE public.v_payments TO service_role;
GRANT ALL ON TABLE public.v_platform_decisions TO anon;
GRANT ALL ON TABLE public.v_platform_decisions TO authenticated;
GRANT ALL ON TABLE public.v_platform_decisions TO service_role;
GRANT ALL ON TABLE public.v_preflight_runs TO anon;
GRANT ALL ON TABLE public.v_preflight_runs TO authenticated;
GRANT ALL ON TABLE public.v_preflight_runs TO service_role;
GRANT ALL ON TABLE public.v_production_contracts TO anon;
GRANT ALL ON TABLE public.v_production_contracts TO authenticated;
GRANT ALL ON TABLE public.v_production_contracts TO service_role;
GRANT ALL ON TABLE public.v_production_contracts_provenance_backup_21 TO anon;
GRANT ALL ON TABLE public.v_production_contracts_provenance_backup_21 TO authenticated;
GRANT ALL ON TABLE public.v_production_contracts_provenance_backup_21 TO service_role;
GRANT ALL ON TABLE public.v_profiles TO anon;
GRANT ALL ON TABLE public.v_profiles TO authenticated;
GRANT ALL ON TABLE public.v_profiles TO service_role;
GRANT ALL ON TABLE public.v_project_members TO anon;
GRANT ALL ON TABLE public.v_project_members TO authenticated;
GRANT ALL ON TABLE public.v_project_members TO service_role;
GRANT ALL ON TABLE public.v_projects TO anon;
GRANT ALL ON TABLE public.v_projects TO authenticated;
GRANT ALL ON TABLE public.v_projects TO service_role;
GRANT ALL ON TABLE public.v_provider_attempts TO anon;
GRANT ALL ON TABLE public.v_provider_attempts TO authenticated;
GRANT ALL ON TABLE public.v_provider_attempts TO service_role;
GRANT ALL ON TABLE public.v_provider_breaker TO anon;
GRANT ALL ON TABLE public.v_provider_breaker TO authenticated;
GRANT ALL ON TABLE public.v_provider_breaker TO service_role;
GRANT ALL ON TABLE public.v_repairs TO anon;
GRANT ALL ON TABLE public.v_repairs TO authenticated;
GRANT ALL ON TABLE public.v_repairs TO service_role;
GRANT ALL ON TABLE public.v_reports TO anon;
GRANT ALL ON TABLE public.v_reports TO authenticated;
GRANT ALL ON TABLE public.v_reports TO service_role;
GRANT ALL ON TABLE public.v_reviewed_plans TO anon;
GRANT ALL ON TABLE public.v_reviewed_plans TO authenticated;
GRANT ALL ON TABLE public.v_reviewed_plans TO service_role;
GRANT ALL ON TABLE public.v_run_artifacts TO anon;
GRANT ALL ON TABLE public.v_run_artifacts TO authenticated;
GRANT ALL ON TABLE public.v_run_artifacts TO service_role;
GRANT ALL ON TABLE public.v_run_steps TO anon;
GRANT ALL ON TABLE public.v_run_steps TO authenticated;
GRANT ALL ON TABLE public.v_run_steps TO service_role;
GRANT ALL ON TABLE public.v_runs_governor TO anon;
GRANT ALL ON TABLE public.v_runs_governor TO authenticated;
GRANT ALL ON TABLE public.v_runs_governor TO service_role;
GRANT ALL ON TABLE public.v_runtime_targets TO anon;
GRANT ALL ON TABLE public.v_runtime_targets TO authenticated;
GRANT ALL ON TABLE public.v_runtime_targets TO service_role;
GRANT ALL ON TABLE public.v_screening_questions TO anon;
GRANT ALL ON TABLE public.v_screening_questions TO authenticated;
GRANT ALL ON TABLE public.v_screening_questions TO service_role;
GRANT ALL ON TABLE public.v_screening_responses TO anon;
GRANT ALL ON TABLE public.v_screening_responses TO authenticated;
GRANT ALL ON TABLE public.v_screening_responses TO service_role;
GRANT ALL ON TABLE public.v_subscriptions TO anon;
GRANT ALL ON TABLE public.v_subscriptions TO authenticated;
GRANT ALL ON TABLE public.v_subscriptions TO service_role;
GRANT ALL ON TABLE public.v_test_flows TO anon;
GRANT ALL ON TABLE public.v_test_flows TO authenticated;
GRANT ALL ON TABLE public.v_test_flows TO service_role;
GRANT ALL ON TABLE public.v_test_options TO anon;
GRANT ALL ON TABLE public.v_test_options TO authenticated;
GRANT ALL ON TABLE public.v_test_options TO service_role;
GRANT ALL ON TABLE public.v_tests TO anon;
GRANT ALL ON TABLE public.v_tests TO authenticated;
GRANT ALL ON TABLE public.v_tests TO service_role;
GRANT ALL ON TABLE public.v_verification_idempotency TO anon;
GRANT ALL ON TABLE public.v_verification_idempotency TO authenticated;
GRANT ALL ON TABLE public.v_verification_idempotency TO service_role;
GRANT ALL ON TABLE public.v_voter_rep TO anon;
GRANT ALL ON TABLE public.v_voter_rep TO authenticated;
GRANT ALL ON TABLE public.v_voter_rep TO service_role;
GRANT ALL ON TABLE public.v_webhook_deliveries TO anon;
GRANT ALL ON TABLE public.v_webhook_deliveries TO authenticated;
GRANT ALL ON TABLE public.v_webhook_deliveries TO service_role;
GRANT ALL ON TABLE public.v_webhook_endpoints TO anon;
GRANT ALL ON TABLE public.v_webhook_endpoints TO authenticated;
GRANT ALL ON TABLE public.v_webhook_endpoints TO service_role;
GRANT ALL ON TABLE public.v_workspace_billing TO anon;
GRANT ALL ON TABLE public.v_workspace_billing TO authenticated;
GRANT ALL ON TABLE public.v_workspace_billing TO service_role;
GRANT ALL ON TABLE public.v_workspace_members TO anon;
GRANT ALL ON TABLE public.v_workspace_members TO authenticated;
GRANT ALL ON TABLE public.v_workspace_members TO service_role;
GRANT ALL ON TABLE public.v_workspace_ownership_transfers TO anon;
GRANT ALL ON TABLE public.v_workspace_ownership_transfers TO authenticated;
GRANT ALL ON TABLE public.v_workspace_ownership_transfers TO service_role;
GRANT ALL ON TABLE public.v_workspaces TO anon;
GRANT ALL ON TABLE public.v_workspaces TO authenticated;
GRANT ALL ON TABLE public.v_workspaces TO service_role;
GRANT ALL ON TABLE public.vraelis_bookings TO service_role;
GRANT ALL ON TABLE public.vraelis_contacts TO anon;
GRANT ALL ON TABLE public.vraelis_contacts TO authenticated;
GRANT ALL ON TABLE public.vraelis_contacts TO service_role;
GRANT ALL ON TABLE public.vraelis_leads TO service_role;
GRANT ALL ON TABLE public.vraelis_messages TO anon;
GRANT ALL ON TABLE public.vraelis_messages TO authenticated;
GRANT ALL ON TABLE public.vraelis_messages TO service_role;
GRANT ALL ON TABLE public.vraelis_payments TO service_role;
GRANT ALL ON TABLE public.vraelis_rate_limits TO anon;
GRANT ALL ON TABLE public.vraelis_rate_limits TO authenticated;
GRANT ALL ON TABLE public.vraelis_rate_limits TO service_role;
GRANT ALL ON TABLE public.vraelis_workspaces TO service_role;
GRANT ALL ON TABLE public.waitlist TO service_role;

-- 7. No sequence grants in the dump (there are no sequences in public).

-- 8. Schema-scoped default privileges for ROLE postgres.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;

-- 9. Assert the restoration matches the dump's own counts.
DO $$
DECLARE anon_t int; auth_t int; pub_f int; anon_f int;
BEGIN
  SELECT count(DISTINCT c.oid) INTO anon_t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND r.rolname='anon' AND c.relkind IN ('r','p');
  SELECT count(DISTINCT c.oid) INTO auth_t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND r.rolname='authenticated' AND c.relkind IN ('r','p');
  SELECT count(DISTINCT p.oid) INTO pub_f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE n.nspname='public' AND a.grantee = 0;
  SELECT count(DISTINCT p.oid) INTO anon_f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND r.rolname='anon';
  IF anon_t <> 101 OR auth_t <> 101 OR pub_f <> 8 OR anon_f <> 8 THEN
    RAISE EXCEPTION 'rollback did not restore the dump state: anon % tables, authenticated % tables, PUBLIC % functions (expected 101, 101, 8)', anon_t, auth_t, pub_f;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_default_acl da JOIN pg_roles r ON r.oid=da.defaclrole
              WHERE da.defaclnamespace = 0 AND da.defaclobjtype = 'f' AND r.rolname = 'postgres') THEN
    RAISE EXCEPTION 'the GLOBAL default-privilege row for functions still exists - PUBLIC EXECUTE was not restored';
  END IF;
  RAISE NOTICE 'rollback ok: anon % tables, authenticated % tables, PUBLIC % functions, anon % functions', anon_t, auth_t, pub_f, anon_f;
END $$;

COMMIT;
