-- Post-migration verification for PRODUCTION.  READ-ONLY.
--
-- This is deliberately NOT the staging verify file. That one inserts synthetic rows into v_applications
-- and v_preflight_runs and relies on ROLLBACK to discard them. Against production that would take real
-- locks, consume sequence values, and fire whatever the application has watching those tables - for no
-- benefit, because staging already proved the behaviour with real data flowing through it.
--
-- Everything here is a catalog SELECT inside a read-only transaction. It asserts the POSTURE the ordered
-- set is supposed to produce. Behavioural proof lives in the staging rehearsal, which ran the same four
-- migrations against the same schema and exercised claim, replay, concurrency, bounds and the shadow-table
-- attack end to end.

\set ON_ERROR_STOP on
BEGIN READ ONLY;

DO $$
DECLARE
  n int; ok boolean; msg text;
  results text[] := ARRAY[]::text[];
  app_fns text[] := ARRAY['usage_summary','v_preflight_claim','v_record_vote','v_spend_credit',
                          'vraelis_rate_check','v_complete_test','v_launch_test',
                          'v_expire_monthly','v_reserve_agent_payment','v_settle_agent_payment'];
  fn text;
BEGIN
  -- P4-A: no anon/authenticated privileges anywhere in public.
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE ns.nspname='public' AND r.rolname IN ('anon','authenticated');
  results := results || format('V|%s|anon/authenticated privileges in public = %s (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- P4-B: nothing in public is executable by PUBLIC, including the proacl-NULL case.
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public'
     AND (p.proacl IS NULL
          OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'));
  results := results || format('V|%s|functions executable by PUBLIC = %s (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  SELECT EXISTS (SELECT 1 FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole
                  WHERE d.defaclnamespace=0 AND d.defaclobjtype='f' AND r.rolname='postgres') INTO ok;
  results := results || format('V|%s|GLOBAL default-privilege row exists (future functions are not PUBLIC)',
                               CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

  -- THE ONE THAT BREAKS THE SITE IF IT IS WRONG.
  n := 0;
  FOREACH fn IN ARRAY app_fns LOOP
    IF to_regproc('public.' || fn) IS NULL THEN
      results := results || format('V|FAIL|app function %s does not exist', fn);
    ELSIF NOT has_function_privilege('service_role', to_regproc('public.'||fn)::oid, 'EXECUTE') THEN
      results := results || format('V|FAIL|service_role cannot EXECUTE %s - THE APPLICATION IS BROKEN, roll back', fn);
    ELSIF has_function_privilege('anon', to_regproc('public.'||fn)::oid, 'EXECUTE')
       OR has_function_privilege('authenticated', to_regproc('public.'||fn)::oid, 'EXECUTE') THEN
      results := results || format('V|FAIL|%s is still executable by anon or authenticated', fn);
    ELSE n := n + 1;
    END IF;
  END LOOP;
  results := results || format('V|%s|all app functions reachable by service_role and no one else (%s of %s)',
                               CASE WHEN n=array_length(app_fns,1) THEN 'PASS' ELSE 'FAIL' END,
                               n, array_length(app_fns,1));

  -- service_role must retain table access, or every read path fails.
  SELECT count(DISTINCT c.oid) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE ns.nspname='public' AND r.rolname='service_role' AND c.relkind IN ('r','p');
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relkind IN ('r','p')
     AND NOT EXISTS (SELECT 1 FROM aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
                      WHERE r.rolname='service_role');
  results := results || format('V|%s|tables service_role CANNOT reach = %s (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- P3-D objects.
  results := results || format('V|%s|P3-D: v_agent_payment_reservations exists',
    CASE WHEN to_regclass('public.v_agent_payment_reservations') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO n FROM pg_indexes WHERE schemaname='public'
     AND indexname IN ('v_agent_pay_res_owner_idx','v_agent_pay_res_extref_uidx');
  results := results || format('V|%s|P3-D: both cap indexes present (%s of 2)',
                               CASE WHEN n=2 THEN 'PASS' ELSE 'FAIL' END, n);

  -- H3 posture.
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity;
  results := results || format('V|%s|H3: tables without RLS = %s (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
  results := results || format('V|%s|H3: rollback ledger table exists',
    CASE WHEN to_regclass('public._rls_migration_01_applied') IS NOT NULL THEN 'PASS' ELSE 'FAIL' END);

  -- search_path pins survived, in both directions.
  SELECT array_to_string(p.proconfig,',') INTO msg FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname='v_preflight_claim';
  results := results || format('V|%s|v_preflight_claim search_path = %s',
    CASE WHEN msg='search_path=pg_catalog, pg_temp' THEN 'PASS' ELSE 'FAIL' END, coalesce(msg,'NOT SET'));
  SELECT array_to_string(p.proconfig,',') INTO msg FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname='rls_auto_enable';
  results := results || format('V|%s|rls_auto_enable search_path = %s (H3 must not have clobbered it)',
    CASE WHEN msg='search_path=pg_catalog' THEN 'PASS' ELSE 'FAIL' END, coalesce(msg,'NOT SET'));
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.prosecdef AND p.proconfig IS NULL;
  results := results || format('V|%s|SECURITY DEFINER functions left unpinned = %s (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- v_preflight_claim must carry the bounds. Asserted from the source, not by calling it: calling it in
  -- production would claim a real queued run away from a real worker.
  SELECT prosrc LIKE '%p_lease_secs must be between 1 and 3600%'
     AND prosrc LIKE '%p_worker must be 1..128 characters%' INTO ok
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname='v_preflight_claim';
  results := results || format('V|%s|P4-B: lease and worker-id bounds present in the deployed function body',
                               CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

  -- The accepted platform limitation, reported so it is visible in the run, not buried in a document.
  SELECT count(*) INTO n FROM pg_default_acl da JOIN pg_namespace ns ON ns.oid=da.defaclnamespace
    JOIN pg_roles cr ON cr.oid=da.defaclrole
    CROSS JOIN LATERAL aclexplode(da.defaclacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE ns.nspname='public' AND cr.rolname='supabase_admin' AND r.rolname IN ('anon','authenticated');
  results := results || format('V|%s|ACCEPTED LIMITATION: supabase_admin retains %s default-privilege facts (expected 24, platform-managed, not remediable by postgres)',
                               CASE WHEN n=24 THEN 'PASS' ELSE 'FAIL' END, n);

  FOREACH msg IN ARRAY results LOOP RAISE NOTICE '%', msg; END LOOP;
END $$;

ROLLBACK;
