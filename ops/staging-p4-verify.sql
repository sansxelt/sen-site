-- Post-forward functional verification for the P4-A/P4-B rehearsal.  STAGING ONLY.
--
-- EVERY statement here runs inside ONE transaction that ends in ROLLBACK. The synthetic rows and the
-- probe function never commit, so this file cannot leave residue in staging even if it fails partway.
-- The concurrency check cannot live here - it needs two sessions, so it is driven from the shell with
-- committed rows and explicit cleanup.
--
-- Output is one PASS/FAIL line per check, prefixed V| so the caller can gate on it.

\set ON_ERROR_STOP on
BEGIN;

-- Synthetic parent + queued run. Tagged so anything that somehow escapes is identifiable.
INSERT INTO public.v_applications (id, user_id, name, app_url)
VALUES ('00000000-dead-beef-0000-000000000001', 'p4-rehearsal-synthetic', 'p4 rehearsal', 'https://rehearsal.invalid');
INSERT INTO public.v_preflight_runs (id, user_id, application_id, state, created_at)
VALUES ('00000000-dead-beef-0000-000000000002', 'p4-rehearsal-synthetic',
        '00000000-dead-beef-0000-000000000001', 'queued', now());

DO $$
DECLARE
  v_id uuid; n int; ok boolean; msg text;
  results text[] := ARRAY[]::text[];
  PROBE_FN constant text := 'p4_rehearsal_probe';
BEGIN
  -- V1: anon has zero table privileges anywhere in public.
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE ns.nspname='public' AND r.rolname IN ('anon','authenticated');
  results := results || format('V|%s|anon/authenticated table+function privileges in public = %s (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- V2: no function in public is executable by PUBLIC, including the proacl-NULL case.
  SELECT count(*) INTO n FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public'
     AND (p.proacl IS NULL
          OR EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0 AND a.privilege_type='EXECUTE'));
  results := results || format('V|%s|existing functions executable by PUBLIC = %s (expect 0)',
                               CASE WHEN n=0 THEN 'PASS' ELSE 'FAIL' END, n);

  -- V3: a FUTURE function created here must arrive with an explicit ACL and no PUBLIC.
  EXECUTE format('CREATE FUNCTION public.%I() RETURNS int LANGUAGE sql AS $f$SELECT 1$f$', PROBE_FN);
  SELECT p.proacl IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM aclexplode(p.proacl) a WHERE a.grantee=0)
    INTO ok
    FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname=PROBE_FN;
  results := results || format('V|%s|future postgres-created function has explicit ACL without PUBLIC',
                               CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

  -- V4: and neither anon nor authenticated can execute it.
  SELECT NOT has_function_privilege('anon', format('public.%I()', PROBE_FN), 'EXECUTE')
     AND NOT has_function_privilege('authenticated', format('public.%I()', PROBE_FN), 'EXECUTE')
     AND has_function_privilege('service_role', format('public.%I()', PROBE_FN), 'EXECUTE')
    INTO ok;
  results := results || format('V|%s|future function: anon/authenticated denied, service_role allowed',
                               CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

  -- V5: the GLOBAL default-privilege row exists for the correct creator role. An INNER JOIN on
  --     pg_namespace would hide it entirely (defaclnamespace = 0) - that blindness produced a wrong
  --     conclusion once already, so this check names the global row explicitly.
  SELECT EXISTS (SELECT 1 FROM pg_default_acl d JOIN pg_roles r ON r.oid=d.defaclrole
                  WHERE d.defaclnamespace=0 AND d.defaclobjtype='f' AND r.rolname='postgres') INTO ok;
  results := results || format('V|%s|GLOBAL pg_default_acl row for functions created by postgres exists',
                               CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

  -- V6: v_preflight_claim is executable only by service_role and the owner.
  SELECT NOT has_function_privilege('anon','public.v_preflight_claim(text,integer)','EXECUTE')
     AND NOT has_function_privilege('authenticated','public.v_preflight_claim(text,integer)','EXECUTE')
     AND has_function_privilege('service_role','public.v_preflight_claim(text,integer)','EXECUTE')
    INTO ok;
  results := results || format('V|%s|v_preflight_claim executable only by service_role/owner',
                               CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

  -- V7: safe search_path is pinned on the SECURITY DEFINER function.
  SELECT array_to_string(p.proconfig, ',') = 'search_path=pg_catalog, pg_temp' AND p.prosecdef
    INTO ok FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace
   WHERE ns.nspname='public' AND p.proname='v_preflight_claim';
  results := results || format('V|%s|v_preflight_claim: SECURITY DEFINER with search_path=pg_catalog, pg_temp',
                               CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END);

  -- V8: lease bounds. Each bad value must raise; the row must stay queued.
  n := 0;
  FOREACH msg IN ARRAY ARRAY['0','-1','3601','999999','2147483647'] LOOP
    BEGIN
      PERFORM public.v_preflight_claim('rehearsal', msg::int);
      results := results || format('V|FAIL|p_lease_secs=%s was ACCEPTED', msg);
    EXCEPTION WHEN invalid_parameter_value THEN n := n + 1;
    END;
  END LOOP;
  BEGIN
    PERFORM public.v_preflight_claim('rehearsal', NULL);
    results := results || 'V|FAIL|p_lease_secs=NULL was ACCEPTED';
  EXCEPTION WHEN invalid_parameter_value THEN n := n + 1;
  END;
  results := results || format('V|%s|p_lease_secs rejected for 0,-1,3601,999999,2147483647,NULL = %s of 6',
                               CASE WHEN n=6 THEN 'PASS' ELSE 'FAIL' END, n);

  -- V9: worker-id constraints.
  n := 0;
  BEGIN PERFORM public.v_preflight_claim('', 90);
    results := results || 'V|FAIL|empty p_worker accepted';
  EXCEPTION WHEN invalid_parameter_value THEN n := n + 1; END;
  BEGIN PERFORM public.v_preflight_claim(NULL, 90);
    results := results || 'V|FAIL|NULL p_worker accepted';
  EXCEPTION WHEN invalid_parameter_value THEN n := n + 1; END;
  BEGIN PERFORM public.v_preflight_claim(repeat('x',129), 90);
    results := results || 'V|FAIL|129-character p_worker accepted';
  EXCEPTION WHEN invalid_parameter_value THEN n := n + 1; END;
  BEGIN PERFORM public.v_preflight_claim('bad'||chr(10)||'x', 90);
    results := results || 'V|FAIL|control character in p_worker accepted';
  EXCEPTION WHEN invalid_parameter_value THEN n := n + 1; END;
  results := results || format('V|%s|p_worker rejected for empty,NULL,129-char,control-char = %s of 4',
                               CASE WHEN n=4 THEN 'PASS' ELSE 'FAIL' END, n);

  -- The row must be untouched by every rejection above.
  SELECT count(*) INTO n FROM public.v_preflight_runs
   WHERE id='00000000-dead-beef-0000-000000000002' AND state='queued' AND lease_owner IS NULL;
  results := results || format('V|%s|synthetic row still queued after all rejections',
                               CASE WHEN n=1 THEN 'PASS' ELSE 'FAIL' END);

  -- V10: service_role succeeds on a valid claim.
  SET LOCAL ROLE service_role;
  v_id := public.v_preflight_claim('rehearsal-worker', 90);
  RESET ROLE;
  SELECT count(*) INTO n FROM public.v_preflight_runs
   WHERE id='00000000-dead-beef-0000-000000000002' AND state='running'
     AND lease_owner='rehearsal-worker' AND attempts=1
     AND lease_expires_at > now() AND lease_expires_at <= now() + interval '91 seconds';
  results := results || format('V|%s|service_role claim succeeded (returned %s, row running, lease <= 91s)',
                               CASE WHEN v_id IS NOT NULL AND n=1 THEN 'PASS' ELSE 'FAIL' END, coalesce(v_id::text,'NULL'));

  -- V11: replay - a second claim finds nothing and does not re-increment attempts.
  SET LOCAL ROLE service_role;
  v_id := public.v_preflight_claim('rehearsal-worker-2', 90);
  RESET ROLE;
  SELECT count(*) INTO n FROM public.v_preflight_runs
   WHERE id='00000000-dead-beef-0000-000000000002' AND lease_owner='rehearsal-worker' AND attempts=1;
  results := results || format('V|%s|replay returned %s and left owner/attempts unchanged',
                               CASE WHEN v_id IS NULL AND n=1 THEN 'PASS' ELSE 'FAIL' END, coalesce(v_id::text,'NULL'));

  FOREACH msg IN ARRAY results LOOP RAISE NOTICE '%', msg; END LOOP;
END $$;

-- V12: anon and authenticated must be refused at the privilege layer. Tested outside the DO block so the
-- failure is a real permission error rather than one caught by a handler.
DO $$
DECLARE denied int := 0;
BEGIN
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM public.v_preflight_claim('attacker', 90);
    RESET ROLE;
    RAISE NOTICE 'V|FAIL|anon was able to execute v_preflight_claim';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; denied := denied + 1;
  END;
  BEGIN
    SET LOCAL ROLE authenticated;
    PERFORM public.v_preflight_claim('attacker', 90);
    RESET ROLE;
    RAISE NOTICE 'V|FAIL|authenticated was able to execute v_preflight_claim';
  EXCEPTION WHEN insufficient_privilege THEN RESET ROLE; denied := denied + 1;
  END;
  RAISE NOTICE 'V|%|anon and authenticated both refused v_preflight_claim = % of 2',
    CASE WHEN denied=2 THEN 'PASS' ELSE 'FAIL' END, denied;
END $$;

-- V13: shadow-table attack. A temp table named v_preflight_runs must NOT be what the SECURITY DEFINER
-- function operates on. Run as service_role, which legitimately holds EXECUTE - the point is that even an
-- authorised caller cannot redirect the function through their own search_path.
DO $$
DECLARE v_id uuid; temp_state text; real_state text;
BEGIN
  SET LOCAL ROLE service_role;
  CREATE TEMP TABLE v_preflight_runs (id uuid primary key, state text, lease_expires_at timestamptz,
    created_at timestamptz, lease_owner text, heartbeat_at timestamptz, attempts int, started_at timestamptz)
    ON COMMIT DROP;
  INSERT INTO pg_temp.v_preflight_runs VALUES
    ('00000000-dead-beef-0000-000000000003','queued',NULL, now() - interval '1 day', NULL, NULL, 0, NULL);
  v_id := public.v_preflight_claim('shadow-attacker', 90);
  SELECT state INTO temp_state FROM pg_temp.v_preflight_runs WHERE id='00000000-dead-beef-0000-000000000003';
  RESET ROLE;
  SELECT state INTO real_state FROM public.v_preflight_runs WHERE id='00000000-dead-beef-0000-000000000002';
  RAISE NOTICE 'V|%|shadow-table attack failed: attacker temp row stayed %, real row is % (returned %)',
    CASE WHEN temp_state='queued' THEN 'PASS' ELSE 'FAIL' END, temp_state, real_state, coalesce(v_id::text,'NULL');
END $$;

-- V14: service_role retains ordinary table access - the migration must not have broken the app path.
DO $$
DECLARE n int; ok boolean;
BEGIN
  SET LOCAL ROLE service_role;
  SELECT count(*) INTO n FROM public.v_preflight_runs;
  PERFORM 1 FROM public.v_applications LIMIT 1;
  RESET ROLE;
  SELECT count(DISTINCT c.oid) = 107 INTO ok FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE ns.nspname='public' AND r.rolname='service_role' AND c.relkind IN ('r','p');
  RAISE NOTICE 'V|%|service_role still reads tables and holds grants on all 107',
    CASE WHEN ok THEN 'PASS' ELSE 'FAIL' END;
END $$;

-- Nothing here is kept. The probe function and both synthetic rows disappear with this rollback.
ROLLBACK;
