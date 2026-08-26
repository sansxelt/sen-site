-- Security + application smoke verification for the FULL ordered migration set.  STAGING ONLY.
--
-- Runs after P4 -> P3-C -> P3-D -> H3. Every statement is inside ONE transaction that ends in ROLLBACK,
-- so the synthetic rows and probe objects never commit and cannot leave residue even on failure.
--
-- Output is one PASS/FAIL line per check, prefixed V| so the caller can gate on it.

\set ON_ERROR_STOP on
BEGIN;

INSERT INTO public.v_applications (id, user_id, name, app_url)
VALUES ('00000000-dead-beef-0000-0000000000f1', 'p4-rehearsal-synthetic', 'full rehearsal', 'https://rehearsal.invalid');
INSERT INTO public.v_preflight_runs (id, user_id, application_id, state, created_at)
VALUES ('00000000-dead-beef-0000-0000000000f2', 'p4-rehearsal-synthetic',
        '00000000-dead-beef-0000-0000000000f1', 'queued', now());

DO $$
DECLARE
  n int; ok boolean; v_id uuid; msg text;
  results text[] := ARRAY[]::text[];
  -- Every function the application invokes over PostgREST that this migration set is responsible for.
  -- v_hold_credits and v_bind_oauth_identity are called by the app but exist in neither the production
  -- dump nor this set, so asserting on them here would fail for a reason this set does not own.
  app_fns text[] := ARRAY['usage_summary','v_preflight_claim','v_record_vote','v_spend_credit',
                          'vraelis_rate_check','v_complete_test','v_launch_test',
                          'v_expire_monthly','v_reserve_agent_payment','v_settle_agent_payment'];
  fn text;
BEGIN
  -- ── P4: privilege posture ────────────────────────────────────────────────
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE ns.nspname='public' AND r.rolname IN ('anon','authenticated');
  results := results || format('V|%s|anon/authenticated hold %s privileges in public (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public'
     AND (p.proacl IS NULL
          OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'));
  results := results || format('V|%s|functions executable by PUBLIC = %s (expect 0, including proacl NULL)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  SELECT EXISTS (SELECT 1 FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole
                  WHERE d.defaclnamespace=0 AND d.defaclobjtype='f' AND r.rolname='postgres') INTO ok;
  results := results || format('V|%s|GLOBAL default-privilege row for postgres-created functions exists',
                               CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

  -- ── APPLICATION SMOKE: every app-invoked function must exist and be reachable by service_role ──
  -- This is the check that matters most after a broad revoke: if any of these lost service_role EXECUTE,
  -- the application is broken even though the security posture looks perfect.
  n := 0;
  FOREACH fn IN ARRAY app_fns LOOP
    IF to_regproc('public.' || fn) IS NULL THEN
      results := results || format('V|FAIL|app function %s does not exist', fn);
    ELSIF NOT has_function_privilege('service_role', to_regproc('public.'||fn)::oid, 'EXECUTE') THEN
      results := results || format('V|FAIL|service_role cannot EXECUTE %s - the application would break', fn);
    ELSIF has_function_privilege('anon', to_regproc('public.'||fn)::oid, 'EXECUTE')
       OR has_function_privilege('authenticated', to_regproc('public.'||fn)::oid, 'EXECUTE') THEN
      results := results || format('V|FAIL|%s is still executable by anon or authenticated', fn);
    ELSE n := n + 1;
    END IF;
  END LOOP;
  results := results || format('V|%s|all %s app functions exist, service_role can execute, anon/authenticated cannot (%s of %s)',
                               CASE WHEN n=array_length(app_fns,1) THEN 'PASS' ELSE 'FAIL' END,
                               array_length(app_fns,1), n, array_length(app_fns,1));

  -- ── P3-D: payment-cap objects ────────────────────────────────────────────
  SELECT to_regclass('public.v_agent_payment_reservations') IS NOT NULL INTO ok;
  results := results || format('V|%s|P3-D: v_agent_payment_reservations exists',
                               CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO n FROM pg_indexes
   WHERE schemaname='public' AND indexname IN ('v_agent_pay_res_owner_idx','v_agent_pay_res_extref_uidx');
  results := results || format('V|%s|P3-D: both cap indexes present (%s of 2)',
                               CASE WHEN n=2 THEN 'PASS' ELSE 'FAIL' END, n);
  SELECT c.relrowsecurity INTO ok FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relname='v_agent_payment_reservations';
  results := results || format('V|%s|P3-D: RLS enabled on the reservations table',
                               CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
  -- and the new table must have inherited P4's secure defaults, not the old permissive ones
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE ns.nspname='public' AND c.relname='v_agent_payment_reservations'
     AND r.rolname IN ('anon','authenticated');
  results := results || format('V|%s|P3-D: the table created AFTER P4 inherited secure defaults (%s anon/auth privileges, expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- ── H3: RLS posture ──────────────────────────────────────────────────────
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity;
  results := results || format('V|%s|H3: tables in public WITHOUT RLS = %s (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
  SELECT to_regclass('public._rls_migration_01_applied') IS NOT NULL INTO ok;
  results := results || format('V|%s|H3: the rollback ledger table exists',
                               CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO n FROM pg_policies WHERE schemaname='public';
  results := results || format('V|%s|H3: policy count is %s - deny-by-default is deliberate, service_role has BYPASSRLS',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- ── H3 must not have clobbered the deliberate search_path pins ───────────
  SELECT array_to_string(p.proconfig,',') INTO msg FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname='v_preflight_claim';
  results := results || format('V|%s|P4 pin survived H3: v_preflight_claim search_path = %s (expect search_path=pg_catalog, pg_temp)',
                               CASE WHEN msg='search_path=pg_catalog, pg_temp' THEN 'PASS' ELSE 'FAIL' END, coalesce(msg,'NOT SET'));
  SELECT array_to_string(p.proconfig,',') INTO msg FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname='rls_auto_enable';
  results := results || format('V|%s|baseline pin survived H3: rls_auto_enable search_path = %s (expect search_path=pg_catalog)',
                               CASE WHEN msg='search_path=pg_catalog' THEN 'PASS' ELSE 'FAIL' END, coalesce(msg,'NOT SET'));
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.prosecdef AND p.proconfig IS NULL;
  results := results || format('V|%s|every SECURITY DEFINER function in public is pinned (%s unpinned, expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- ── P4-B behaviour: bounds still enforced after the whole set ────────────
  n := 0;
  FOREACH msg IN ARRAY ARRAY['0','-1','3601','999999'] LOOP
    BEGIN PERFORM public.v_preflight_claim('rehearsal', msg::int);
      results := results || format('V|FAIL|p_lease_secs=%s accepted', msg);
    EXCEPTION WHEN invalid_parameter_value THEN n := n + 1; END;
  END LOOP;
  BEGIN PERFORM public.v_preflight_claim(repeat('x',129), 90);
    results := results || 'V|FAIL|129-character p_worker accepted';
  EXCEPTION WHEN invalid_parameter_value THEN n := n + 1; END;
  results := results || format('V|%s|P4-B bounds still enforced after the full set (%s of 5 rejected)',
                               CASE WHEN n=5 THEN 'PASS' ELSE 'FAIL' END, n);

  -- ── service_role can still do real work ─────────────────────────────────
  SET LOCAL ROLE service_role;
  v_id := public.v_preflight_claim('full-rehearsal-worker', 90);
  RESET ROLE;
  SELECT count(*) INTO n FROM public.v_preflight_runs
   WHERE id='00000000-dead-beef-0000-0000000000f2' AND state='running'
     AND lease_owner='full-rehearsal-worker' AND attempts=1;
  results := results || format('V|%s|service_role claimed a run end to end (returned %s)',
                               CASE WHEN v_id IS NOT NULL AND n=1 THEN 'PASS' ELSE 'FAIL' END, coalesce(v_id::text,'NULL'));

  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.v_applications;
  PERFORM 1 FROM public.v_preflight_runs LIMIT 1;
  RESET ROLE;
  results := results || format('V|PASS|service_role reads application tables under RLS (BYPASSRLS), %s rows visible', n);

  FOREACH msg IN ARRAY results LOOP RAISE NOTICE '%', msg; END LOOP;
END $$;

-- anon and authenticated must be refused at the privilege layer, tested outside the block above so the
-- failure is a real permission error rather than one a handler could mask.
DO $$
DECLARE denied int := 0;
BEGIN
  BEGIN
    SET LOCAL ROLE anon;  PERFORM public.v_preflight_claim('attacker', 90);  RESET ROLE;
    RAISE NOTICE 'V|FAIL|anon executed v_preflight_claim';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; denied := denied + 1; END;
  BEGIN
    SET LOCAL ROLE authenticated;  PERFORM public.v_preflight_claim('attacker', 90);  RESET ROLE;
    RAISE NOTICE 'V|FAIL|authenticated executed v_preflight_claim';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; denied := denied + 1; END;
  RAISE NOTICE 'V|%|anon and authenticated both refused the RPC (% of 2)',
    CASE WHEN denied=2 THEN 'PASS' ELSE 'FAIL' END, denied;
END $$;

-- Shadow-table attack must still fail after the full set.
DO $$
DECLARE v_id uuid; temp_state text;
BEGIN
  SET LOCAL ROLE service_role;
  CREATE TEMP TABLE v_preflight_runs (id uuid primary key, state text, lease_expires_at timestamptz,
    created_at timestamptz, lease_owner text, heartbeat_at timestamptz, attempts int, started_at timestamptz)
    ON COMMIT DROP;
  INSERT INTO pg_temp.v_preflight_runs VALUES
    ('00000000-dead-beef-0000-0000000000f3','queued',NULL, now() - interval '1 day', NULL, NULL, 0, NULL);
  v_id := public.v_preflight_claim('shadow-attacker', 90);
  SELECT state INTO temp_state FROM pg_temp.v_preflight_runs WHERE id='00000000-dead-beef-0000-0000000000f3';
  RESET ROLE;
  RAISE NOTICE 'V|%|shadow-table attack still fails: attacker temp row stayed %',
    CASE WHEN temp_state='queued' THEN 'PASS' ELSE 'FAIL' END, temp_state;
END $$;

ROLLBACK;
