-- P4-A + P4-B forward migration.  PREPARED, NOT EXECUTED.  Production untouched.
--
-- P4-A: anon/authenticated hold ALL on 101 of 107 public tables, and default privileges keep granting it
--       on every new one. TRUNCATE, REFERENCES and TRIGGER are not gated by RLS.
-- P4-B: every public function grants EXECUTE to anon and authenticated AND retains PostgreSQL's default
--       EXECUTE for PUBLIC. v_preflight_claim is SECURITY DEFINER with no pinned search_path.
--
-- SCOPE NOTES, each established by measurement rather than assumption:
--   * TABLES    - PUBLIC holds nothing (0 grants), so no PUBLIC clause is needed for tables.
--   * SEQUENCES - there are ZERO sequences in public. Those clauses are no-ops today and exist only so the
--                 migration stays correct if a sequence is added before it runs.
--   * FUNCTIONS - PUBLIC holds EXECUTE on all 8, by PostgreSQL's built-in default. Revoking
--                 anon/authenticated ALONE does NOT deny anon: proven on a throwaway restore, where anon
--                 could still execute after such a revoke because PUBLIC's grant remained. Both the
--                 existing grants and the future default are handled below.
--   * service_role keeps everything. Its default privileges are load-bearing: the owner has implicit
--                 rights, service_role does not, so removing them breaks the app on every new table.

BEGIN;

-- == 1. Future objects first. =================================================
-- Ordering is deliberate: doing this AFTER the bulk revoke would leave a window in which a concurrently
-- created table picks up the old defaults and keeps them.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

-- PUBLIC's EXECUTE on functions comes from PostgreSQL's built-in default. A PER-SCHEMA default can only
-- ADD privileges - it cannot revoke what the global default supplies - so the IN SCHEMA form of this
-- statement is silently a no-op. The GLOBAL form (no IN SCHEMA) is the one that works.
-- Measured on 17.11: after the global revoke, a function created by postgres has proacl
--   service_role=X/postgres,postgres=X/postgres   with NO leading =X/postgres (PUBLIC), and
--   has_function_privilege('anon', fn, 'EXECUTE') = false, with a real call refused.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- COVERAGE LIMIT, not a defect in the above: default privileges are per CREATOR role, and postgres cannot
-- set another role's - 'permission denied to change default privileges', the same limitation that made the
-- 12 supabase_admin statements unrunnable during the restore. supabase_admin also holds CREATE on public,
-- so a function it creates is NOT covered by this line. Only supabase_admin itself can run
--   ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- which is platform-managed and not available to us. scripts/check-public-executable.ts is the backstop:
-- it detects any PUBLIC-executable function regardless of which role created it.

-- == 2. Existing objects. =====================================================
REVOKE ALL     ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL     ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL     ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

-- == 3. P4-B: harden v_preflight_claim itself. ================================
-- Signature confirmed unique - one overload only: (text, integer).
CREATE OR REPLACE FUNCTION public.v_preflight_claim(p_worker text, p_lease_secs integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
-- pg_temp LAST so a caller's temp table cannot shadow a referenced object, and public.v_preflight_runs is
-- schema-qualified regardless. Without this the function resolved v_preflight_runs through the CALLER's
-- search_path: demonstrated by having anon create a temp table of that name and watching the SECURITY
-- DEFINER function claim a row out of it.
SET search_path = pg_catalog, pg_temp
AS $$
declare v_id uuid;
begin
  -- Bounds derived from the worker's own configuration (worker/preflight/config.ts), not invented:
  --   PREFLIGHT_WORKER_HEARTBEAT_SECONDS = 20   a lease below this expires between heartbeats
  --   PREFLIGHT_WORKER_LEASE_SECONDS     = 90   the observed operating point
  --   PREFLIGHT_MAX_RUN_SECONDS          = 900  a run is killed here, so a longer lease is never needed
  -- 3600 is four times the hard run cap: ample operator headroom, while bounding a hostile or buggy lease
  -- to one hour rather than the unbounded value previously accepted (999999s is 11.5 days).
  if p_lease_secs is null or p_lease_secs < 1 or p_lease_secs > 3600 then
    raise exception 'v_preflight_claim: p_lease_secs must be between 1 and 3600 (got %)', p_lease_secs
      using errcode = 'invalid_parameter_value';
  end if;
  -- lease_owner is unconstrained text written verbatim. Worker ids are worker-<8 hex> or an operator-set
  -- PREFLIGHT_WORKER_ID, so bound length and reject control characters without imposing a format that
  -- would break an operator's own identifier.
  if p_worker is null or pg_catalog.length(p_worker) = 0 or pg_catalog.length(p_worker) > 128 then
    raise exception 'v_preflight_claim: p_worker must be 1..128 characters'
      using errcode = 'invalid_parameter_value';
  end if;
  if p_worker ~ '[[:cntrl:]]' then
    raise exception 'v_preflight_claim: p_worker must not contain control characters'
      using errcode = 'invalid_parameter_value';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('v_preflight_claim'));
  select id into v_id from public.v_preflight_runs
    where state = 'queued' and (lease_expires_at is null or lease_expires_at < pg_catalog.now())
    order by created_at asc limit 1 for update skip locked;
  if v_id is null then return null; end if;
  update public.v_preflight_runs
    set state = 'running', lease_owner = p_worker,
        lease_expires_at = pg_catalog.now() + pg_catalog.make_interval(secs => p_lease_secs),
        heartbeat_at = pg_catalog.now(), attempts = attempts + 1,
        -- COALESCE is a SQL construct resolved by the parser, not a schema-resolvable function: writing it
        -- as pg_catalog.coalesce fails to resolve, and it is not a search_path hazard for that same reason.
        started_at = coalesce(started_at, pg_catalog.now())
  where id = v_id;
  return v_id;
end $$;

-- Measured: CREATE OR REPLACE PRESERVES the existing ACL (identical proacl before and after), so this is
-- not a repair of something CREATE OR REPLACE broke. It is kept deliberately: PostgreSQL recommends
-- creating/replacing, revoking PUBLIC and granting the intended role in ONE transaction, so a function
-- created fresh by this file can never be publicly executable even momentarily.
REVOKE ALL ON FUNCTION public.v_preflight_claim(text, integer) FROM PUBLIC, anon, authenticated;

-- == 4. service_role continuity. ==============================================
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- == 5. Assertions, inside the transaction. A failure rolls everything back. ==
DO $$
DECLARE t int; f int; sr_t int; sr_f int; pub_f int;
        d_pg int; d_sa int; d_other int; d_sa_unexpected int;
BEGIN
  SELECT count(*) INTO t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND r.rolname IN ('anon','authenticated');
  SELECT count(*) INTO f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND r.rolname IN ('anon','authenticated');
  SELECT count(*) INTO pub_f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE n.nspname='public' AND a.grantee = 0;
  IF t <> 0 OR f <> 0 OR pub_f <> 0 THEN
    RAISE EXCEPTION 'anon/authenticated/PUBLIC still hold privileges: % table, % function, % PUBLIC-function', t, f, pub_f;
  END IF;

  -- Default privileges are split by CREATOR ROLE, not counted in aggregate.
  --
  -- An aggregate count is wrong here and cost a staging run: default privileges belong to the role that
  -- creates the object, this migration runs as postgres, and postgres cannot alter another role's - so a
  -- blanket "must be zero" demanded something the migration is not permitted to do. On a real Supabase
  -- project supabase_admin carries the platform's own defaults, which contributed exactly 24 facts
  -- (12 anon + 12 authenticated) and raised. A local restore has none, which is why the fixture passed.
  --
  -- LEFT JOIN and allow defaclnamespace = 0 throughout: an INNER JOIN on pg_namespace hides GLOBAL rows.

  -- (a) postgres-controlled unsafe defaults must be GONE. This is the part the migration owns.
  SELECT count(*) INTO d_pg
    FROM pg_default_acl da LEFT JOIN pg_namespace n ON n.oid=da.defaclnamespace
    JOIN pg_roles cr ON cr.oid=da.defaclrole
    CROSS JOIN LATERAL aclexplode(da.defaclacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
   WHERE (n.nspname='public' OR da.defaclnamespace = 0)
     AND cr.rolname = 'postgres'
     AND (r.rolname IN ('anon','authenticated') OR a.grantee = 0);
  IF d_pg <> 0 THEN
    RAISE EXCEPTION 'postgres-controlled default privileges still grant anon/authenticated/PUBLIC: % fact(s)', d_pg;
  END IF;

  -- (b) supabase_admin's platform-managed defaults must be EXACTLY the known baseline - no more, no fewer.
  SELECT count(*) INTO d_sa
    FROM pg_default_acl da JOIN pg_namespace n ON n.oid=da.defaclnamespace
    JOIN pg_roles cr ON cr.oid=da.defaclrole
    CROSS JOIN LATERAL aclexplode(da.defaclacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND cr.rolname='supabase_admin' AND r.rolname IN ('anon','authenticated');
  -- and every one of them must match the expected (objtype, grantee, privilege) shape, so a changed
  -- privilege or a move to another schema fails even when the count happens to stay the same.
  SELECT count(*) INTO d_sa_unexpected
    FROM pg_default_acl da JOIN pg_namespace n ON n.oid=da.defaclnamespace
    JOIN pg_roles cr ON cr.oid=da.defaclrole
    CROSS JOIN LATERAL aclexplode(da.defaclacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE cr.rolname='supabase_admin' AND r.rolname IN ('anon','authenticated')
     AND (n.nspname <> 'public'
          OR (da.defaclobjtype, a.privilege_type) NOT IN (
               ('r','INSERT'),('r','SELECT'),('r','UPDATE'),('r','DELETE'),
               ('r','TRUNCATE'),('r','REFERENCES'),('r','TRIGGER'),('r','MAINTAIN'),
               ('S','SELECT'),('S','UPDATE'),('S','USAGE'),
               ('f','EXECUTE')));
  IF d_sa <> 24 OR d_sa_unexpected <> 0 THEN
    RAISE EXCEPTION 'supabase_admin default privileges are not the expected platform baseline: % fact(s) (expected 24), % outside the expected shape (expected 0)', d_sa, d_sa_unexpected;
  END IF;

  -- (c) no OTHER creator role may hold defaults granting anon/authenticated/PUBLIC.
  SELECT count(*) INTO d_other
    FROM pg_default_acl da LEFT JOIN pg_namespace n ON n.oid=da.defaclnamespace
    LEFT JOIN pg_roles cr ON cr.oid=da.defaclrole
    CROSS JOIN LATERAL aclexplode(da.defaclacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
   WHERE (n.nspname='public' OR da.defaclnamespace = 0)
     AND coalesce(cr.rolname,'?') NOT IN ('postgres','supabase_admin')
     AND (r.rolname IN ('anon','authenticated') OR a.grantee = 0);
  IF d_other <> 0 THEN
    RAISE EXCEPTION 'an unexpected creator role holds default privileges granting anon/authenticated/PUBLIC: % fact(s)', d_other;
  END IF;

  RAISE NOTICE 'ACCEPTED PLATFORM LIMITATION (not remediated): supabase_admin retains % default-privilege facts granting anon/authenticated. postgres cannot alter another role''s defaults, so objects created BY supabase_admin remain outside this migration. scripts/check-public-executable.ts is the standing backstop.', d_sa;

  SELECT count(DISTINCT c.oid) INTO sr_t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND r.rolname='service_role' AND c.relkind IN ('r','p');
  SELECT count(DISTINCT p.oid) INTO sr_f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND r.rolname='service_role';
  IF sr_t <> 107 OR sr_f <> 8 THEN
    RAISE EXCEPTION 'service_role continuity broken: % tables, % functions (expected 107, 8)', sr_t, sr_f;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_default_acl da JOIN pg_roles r ON r.oid=da.defaclrole
                  WHERE da.defaclnamespace = 0 AND da.defaclobjtype = 'f' AND r.rolname = 'postgres') THEN
    RAISE EXCEPTION 'the GLOBAL default-privilege row for functions created by postgres was not created - the PUBLIC revoke was a no-op';
  END IF;
  RAISE NOTICE 'forward ok: anon/authenticated/PUBLIC at zero; service_role intact (% tables, % functions)', sr_t, sr_f;
END $$;

COMMIT;
