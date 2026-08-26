-- Verification for the two follow-up RPCs, on top of the already-applied ordered set.  STAGING ONLY.
--
-- One transaction, ends in ROLLBACK: the synthetic ledger rows and identity bindings never commit.
--
-- These two functions are what the application's guarded call sites reach for and currently do not find.
-- The point of this file is not that the SQL parses - it is that after the migration, the paths that
-- return 503 today actually work, and that they work for service_role ONLY under the new posture.

\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  n int; ok boolean; msg text; m_sp text; res jsonb;
  results text[] := ARRAY[]::text[];
  U constant text := 'rpc-rehearsal-synthetic@invalid.test';
BEGIN
  -- ── Posture: both functions exist, reachable by service_role, by no one else ──
  FOREACH msg IN ARRAY ARRAY['v_hold_credits','v_bind_oauth_identity'] LOOP
    IF to_regproc('public.' || msg) IS NULL THEN
      results := results || format('V|FAIL|%s does not exist', msg);
    ELSE
      SELECT has_function_privilege('service_role', to_regproc('public.'||msg)::oid, 'EXECUTE')
         AND NOT has_function_privilege('anon',          to_regproc('public.'||msg)::oid, 'EXECUTE')
         AND NOT has_function_privilege('authenticated', to_regproc('public.'||msg)::oid, 'EXECUTE')
        INTO ok;
      results := results || format('V|%s|%s: service_role can execute, anon/authenticated cannot',
                                   CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, msg);
      -- PUBLIC must hold nothing, including via the proacl-NULL default.
      SELECT p.proacl IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee = 0)
        INTO ok FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
       WHERE ns.nspname='public' AND p.proname=msg;
      results := results || format('V|%s|%s: explicit ACL, no PUBLIC entry',
                                   CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END, msg);
      -- search_path pinned with pg_temp last.
      SELECT array_to_string(p.proconfig,',') INTO m_sp FROM pg_proc p
        JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='public' AND p.proname=msg;
      results := results || format('V|%s|%s: search_path = %s',
        CASE WHEN m_sp = 'search_path=public, pg_temp' THEN 'PASS' ELSE 'FAIL' END, msg, coalesce(m_sp,'NOT SET'));
    END IF;
  END LOOP;

  -- ── v_oauth_identities: the new table must be secure the moment it exists ──
  SELECT c.relrowsecurity INTO ok FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relname='v_oauth_identities';
  results := results || format('V|%s|v_oauth_identities: RLS enabled', CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
   WHERE ns.nspname='public' AND c.relname='v_oauth_identities'
     AND (coalesce(r.rolname,'PUBLIC') IN ('anon','authenticated') OR a.grantee = 0);
  results := results || format('V|%s|v_oauth_identities: anon/authenticated/PUBLIC privileges = %s (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);
  SELECT count(*) INTO n FROM pg_indexes WHERE schemaname='public'
     AND indexname IN ('v_oauth_identities_email_uidx','v_oauth_identities_email_idx');
  results := results || format('V|%s|v_oauth_identities: both indexes present (%s of 2)',
                               CASE WHEN n=2 THEN 'PASS' ELSE 'FAIL' END, n);

  -- ══ BEHAVIOUR: the guarded paths that return 503 today ══════════════════
  -- The application calls these as service_role via lib/v-credits.ts hold() and
  -- lib/oauth-identity.ts. Exercised here with the same role.
  SET LOCAL ROLE service_role;

  -- Seed 100 purchased credits for a synthetic user.
  INSERT INTO public.v_credit_ledger (user_id, delta, reason, bucket, unit)
  VALUES (U, 100, 'rpc-rehearsal-seed', 'purchased', 'credit');

  -- A hold within balance must succeed and debit.
  res := public.v_hold_credits(U, gen_random_uuid(), 30, 'credit');
  SELECT coalesce(sum(delta),0) INTO n FROM public.v_credit_ledger WHERE user_id = U;
  results := results || format('V|%s|v_hold_credits: 30 of 100 held -> %s, balance now %s (expect ok=true, 70)',
                               CASE WHEN (res->>'ok')::boolean AND n = 70 THEN 'PASS' ELSE 'FAIL' END,
                               coalesce(res->>'ok','null'), n);

  -- A hold beyond balance must be refused, and must NOT debit.
  res := public.v_hold_credits(U, gen_random_uuid(), 500, 'credit');
  SELECT coalesce(sum(delta),0) INTO n FROM public.v_credit_ledger WHERE user_id = U;
  results := results || format('V|%s|v_hold_credits: 500 of 70 refused -> ok=%s reason=%s, balance still %s',
                               CASE WHEN NOT (res->>'ok')::boolean AND res->>'reason' = 'insufficient' AND n = 70
                                    THEN 'PASS' ELSE 'FAIL' END,
                               coalesce(res->>'ok','null'), coalesce(res->>'reason','null'), n);

  -- An empty user must be refused rather than treated as a real account.
  res := public.v_hold_credits('', gen_random_uuid(), 1, 'credit');
  results := results || format('V|%s|v_hold_credits: empty user refused (reason=%s)',
                               CASE WHEN NOT (res->>'ok')::boolean THEN 'PASS' ELSE 'FAIL' END,
                               coalesce(res->>'reason','null'));

  -- Binding: first bind succeeds.
  res := public.v_bind_oauth_identity('github', 'subject-aaa', U);
  results := results || format('V|%s|v_bind_oauth_identity: first bind -> ok=%s status=%s',
                               CASE WHEN (res->>'ok')::boolean AND res->>'status' = 'bound' THEN 'PASS' ELSE 'FAIL' END,
                               coalesce(res->>'ok','null'), coalesce(res->>'status','null'));

  -- THE GUARD THIS TABLE EXISTS FOR: a DIFFERENT subject presenting the SAME address must collide,
  -- not silently take over the account.
  res := public.v_bind_oauth_identity('github', 'subject-bbb', U);
  results := results || format('V|%s|v_bind_oauth_identity: second subject on the same address REFUSED -> ok=%s status=%s',
                               CASE WHEN NOT (res->>'ok')::boolean AND res->>'status' = 'subject_conflict'
                                    THEN 'PASS' ELSE 'FAIL' END,
                               coalesce(res->>'ok','null'), coalesce(res->>'status','null'));

  -- The same subject returning is not a conflict.
  res := public.v_bind_oauth_identity('github', 'subject-aaa', U);
  results := results || format('V|%s|v_bind_oauth_identity: same subject re-binding accepted -> ok=%s status=%s',
                               CASE WHEN (res->>'ok')::boolean THEN 'PASS' ELSE 'FAIL' END,
                               coalesce(res->>'ok','null'), coalesce(res->>'status','null'));

  RESET ROLE;

  FOREACH msg IN ARRAY results LOOP RAISE NOTICE '%', msg; END LOOP;
END $$;

-- anon and authenticated must be refused at the privilege layer, outside the block above so the failure
-- is a real permission error rather than one a handler could mask.
DO $$
DECLARE denied int := 0;
BEGIN
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM public.v_hold_credits('x@invalid.test', gen_random_uuid(), 1, 'credit');
    RESET ROLE;
    RAISE NOTICE 'V|FAIL|anon executed v_hold_credits';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; denied := denied + 1; END;
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.v_bind_oauth_identity('github', 's', 'x@invalid.test');
    RESET ROLE;
    RAISE NOTICE 'V|FAIL|authenticated executed v_bind_oauth_identity';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; denied := denied + 1; END;
  RAISE NOTICE 'V|%|anon and authenticated refused both new RPCs (% of 2)',
    CASE WHEN denied = 2 THEN 'PASS' ELSE 'FAIL' END, denied;
END $$;

-- The four already-applied migrations must be unaffected by these two.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE ns.nspname='public' AND r.rolname IN ('anon','authenticated');
  RAISE NOTICE 'V|%|applied set intact: anon/authenticated table privileges = % (expect 0)',
    CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n;
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
   WHERE ns.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity;
  RAISE NOTICE 'V|%|applied set intact: tables without RLS = % (expect 0, including the new one)',
    CASE WHEN n = 0 THEN 'PASS' ELSE 'FAIL' END, n;
END $$;

ROLLBACK;
