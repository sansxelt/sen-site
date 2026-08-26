-- Post-migration verification for the two follow-up RPCs, on PRODUCTION.  READ-ONLY.
--
-- Deliberately NOT the staging verify file. That one seeds a synthetic credit ledger and OAuth binding
-- and relies on ROLLBACK to discard them. Against production that would write real ledger rows inside a
-- transaction, take locks on v_credit_ledger, and consume identity rows - for no benefit, because staging
-- already exercised the behaviour: a hold within balance debits, a hold beyond it is refused without
-- debiting, an empty user is refused, and a second OAuth subject on the same address is refused with
-- subject_conflict.
--
-- Here we assert only what can be read from the catalog: that the functions exist, that exactly the right
-- role can reach them, and that the new table landed secure.

\set ON_ERROR_STOP on
BEGIN READ ONLY;

DO $$
DECLARE
  n int; ok boolean; sp text; msg text;
  results text[] := ARRAY[]::text[];
  fns text[] := ARRAY['v_hold_credits','v_bind_oauth_identity'];
  fn text;
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    IF to_regproc('public.' || fn) IS NULL THEN
      results := results || format('V|FAIL|%s does not exist - the migration did not take', fn);
    ELSE
      -- The check that decides whether the application works.
      SELECT has_function_privilege('service_role', to_regproc('public.'||fn)::oid, 'EXECUTE') INTO ok;
      results := results || format('V|%s|%s: service_role can EXECUTE%s', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END,
                                   fn, CASE WHEN ok THEN '' ELSE ' - THE APPLICATION PATH IS STILL BROKEN' END);
      SELECT NOT has_function_privilege('anon', to_regproc('public.'||fn)::oid, 'EXECUTE')
         AND NOT has_function_privilege('authenticated', to_regproc('public.'||fn)::oid, 'EXECUTE')
        INTO ok;
      results := results || format('V|%s|%s: anon and authenticated cannot EXECUTE',
                                   CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, fn);
      -- PUBLIC, including the proacl-NULL default a naive check misses.
      SELECT p.proacl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
        INTO ok FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
       WHERE ns.nspname='public' AND p.proname=fn;
      results := results || format('V|%s|%s: explicit ACL with no PUBLIC entry',
                                   CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, fn);
      SELECT array_to_string(p.proconfig,',') INTO sp FROM pg_proc p
        JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname=fn;
      results := results || format('V|%s|%s: search_path = %s',
        CASE WHEN sp = 'search_path=public, pg_temp' THEN 'PASS' ELSE 'FAIL' END, fn, coalesce(sp,'NOT SET'));
      -- Both are SECURITY INVOKER by design: the caller is service_role, which already holds the rights.
      SELECT NOT p.prosecdef INTO ok FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
       WHERE ns.nspname='public' AND p.proname=fn;
      results := results || format('V|%s|%s: SECURITY INVOKER (not DEFINER)',
                                   CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, fn);
    END IF;
  END LOOP;

  -- The new table must be secure the moment it exists, not after a follow-up.
  IF to_regclass('public.v_oauth_identities') IS NULL THEN
    results := results || 'V|FAIL|v_oauth_identities does not exist';
  ELSE
    SELECT c.relrowsecurity INTO ok FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
     WHERE ns.nspname='public' AND c.relname='v_oauth_identities';
    results := results || format('V|%s|v_oauth_identities: RLS enabled', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
    SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(c.relacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
     WHERE ns.nspname='public' AND c.relname='v_oauth_identities'
       AND (coalesce(r.rolname,'PUBLIC') IN ('anon','authenticated') OR a.grantee = 0);
    results := results || format('V|%s|v_oauth_identities: anon/authenticated/PUBLIC privileges = %s (expect 0)',
                                 CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
    SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
      CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
     WHERE ns.nspname='public' AND c.relname='v_oauth_identities' AND r.rolname='service_role';
    results := results || format('V|%s|v_oauth_identities: service_role can reach it (%s privileges)',
                                 CASE WHEN n > 0 THEN 'PASS' ELSE 'FAIL' END, n);
    SELECT count(*) INTO n FROM pg_indexes WHERE schemaname='public'
       AND indexname IN ('v_oauth_identities_email_uidx','v_oauth_identities_email_idx');
    results := results || format('V|%s|v_oauth_identities: both indexes present (%s of 2) - the unique one is the guard',
                                 CASE WHEN n=2 THEN 'PASS' ELSE 'FAIL' END, n);
  END IF;

  -- The four already-applied migrations must be untouched by these two.
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE ns.nspname='public' AND r.rolname IN ('anon','authenticated');
  results := results || format('V|%s|applied set intact: anon/authenticated table privileges = %s (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity;
  results := results || format('V|%s|applied set intact: tables without RLS = %s (expect 0, including the new one)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public'
     AND (p.proacl IS NULL OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'));
  results := results || format('V|%s|applied set intact: functions executable by PUBLIC = %s (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- Every RPC the application invokes must now exist and be reachable. This is the whole point.
  n := 0;
  FOREACH msg IN ARRAY ARRAY['usage_summary','v_preflight_claim','v_record_vote','v_spend_credit',
                             'vraelis_rate_check','v_complete_test','v_launch_test','v_expire_monthly',
                             'v_reserve_agent_payment','v_settle_agent_payment','v_hold_credits',
                             'v_bind_oauth_identity'] LOOP
    IF to_regproc('public.'||msg) IS NOT NULL
       AND has_function_privilege('service_role', to_regproc('public.'||msg)::oid, 'EXECUTE') THEN
      n := n + 1;
    ELSE
      results := results || format('V|FAIL|app RPC %s is missing or unreachable by service_role', msg);
    END IF;
  END LOOP;
  results := results || format('V|%s|ALL 12 application RPCs exist and are reachable by service_role (%s of 12)',
                               CASE WHEN n=12 THEN 'PASS' ELSE 'FAIL' END, n);

  FOREACH msg IN ARRAY results LOOP RAISE NOTICE '%', msg; END LOOP;
END $$;

ROLLBACK;
