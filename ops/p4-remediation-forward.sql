-- P4-A + P4-B forward migration.  PREPARED, NOT EXECUTED.  Production untouched.
--
-- P4-A: anon/authenticated hold ALL on 101 of 107 public tables, and default privileges keep granting it
--       on every new one. TRUNCATE, REFERENCES and TRIGGER are not gated by RLS.
-- P4-B: every public function grants EXECUTE to anon and authenticated AND retains PostgreSQL's default
--       EXECUTE for PUBLIC. v_preflight_claim is SECURITY DEFINER with no pinned search_path.
--
-- SCOPE NOTES, each established by measurement rather than assumption:
--   * TABLES    - PUBLIC holds nothing (0 grants), so no PUBLIC clause is needed for tables.
--   * SEQUENCES - there are ZERO sequences in public. The clauses below are no-ops today and exist only so
--                 the migration stays correct if one is added before it runs.
--   * FUNCTIONS - PUBLIC holds EXECUTE on all 8, by PostgreSQL default. Revoking anon/authenticated ALONE
--                 does NOT deny anon: proven on a throwaway restore of this schema, where anon could still
--                 execute after such a revoke because PUBLIC's grant remained. This migration fixes the 8
--                 EXISTING functions. It does NOT fix FUTURE ones - see the KNOWN LIMITATION below.
--   * service_role keeps everything. Its default privileges are load-bearing: the owner has implicit
--     rights, service_role does not, so removing them breaks the app on every newly created table.

BEGIN;

-- == 1. Future objects first. =================================================
-- Ordering is deliberate: doing this AFTER the bulk revoke would leave a window in which a concurrently
-- created table picks up the old defaults and keeps them.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL     ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL     ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL     ON FUNCTIONS FROM anon, authenticated;
-- !! KNOWN LIMITATION - DO NOT ASSUME THIS LINE PROTECTS FUTURE FUNCTIONS !!
-- PUBLIC's EXECUTE on functions comes from PostgreSQL's BUILT-IN default (acldefault), not from
-- pg_default_acl, and ALTER DEFAULT PRIVILEGES cannot suppress it. Measured on PostgreSQL 17.11: with the
-- stored default cleared, this statement does not even create a pg_default_acl row, and a function created
-- afterwards still has proacl NULL - the pure built-in default - so has_function_privilege('anon', fn,
-- 'EXECUTE') remains TRUE. REVOKE ALL, REVOKE EXECUTE, and issuing it as postgres itself all behave the same.
-- The statement is kept because it is harmless and correct in intent, but the control that actually works
-- for FUTURE functions is one of:
--   (a) every migration that creates a function must end with REVOKE ALL ON FUNCTION ... FROM PUBLIC, and
--   (b) scripts/check-public-executable.ts must run in CI so a missed (a) fails the build.
-- An event trigger analogous to rls_auto_enable would also work, but that is a larger change and
-- rls_auto_enable is explicitly out of scope here.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

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

-- CREATE OR REPLACE resets the ACL to the default, which grants PUBLIC EXECUTE again. Re-revoke.
REVOKE ALL ON FUNCTION public.v_preflight_claim(text, integer) FROM PUBLIC, anon, authenticated;

-- == 4. service_role continuity. ==============================================
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- == 5. Assertions, inside the transaction. A failure rolls everything back. ==
DO $$
DECLARE t int; f int; d int; sr_t int; sr_f int; pub_f int;
BEGIN
  SELECT count(*) INTO t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND r.rolname IN ('anon','authenticated');
  SELECT count(*) INTO f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND r.rolname IN ('anon','authenticated');
  SELECT count(*) INTO pub_f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(p.proacl) a WHERE n.nspname='public' AND a.grantee = 0;
  SELECT count(*) INTO d FROM pg_default_acl da JOIN pg_namespace n ON n.oid=da.defaclnamespace
    CROSS JOIN LATERAL aclexplode(da.defaclacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND (r.rolname IN ('anon','authenticated') OR a.grantee = 0);
  IF t <> 0 OR f <> 0 OR d <> 0 OR pub_f <> 0 THEN
    RAISE EXCEPTION 'anon/authenticated/PUBLIC still hold privileges: % table, % function, % default, % PUBLIC-function', t, f, d, pub_f;
  END IF;

  SELECT count(DISTINCT c.oid) INTO sr_t FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND r.rolname='service_role' AND c.relkind IN ('r','p');
  SELECT count(DISTINCT p.oid) INTO sr_f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    CROSS JOIN LATERAL aclexplode(p.proacl) a JOIN pg_roles r ON r.oid=a.grantee
   WHERE n.nspname='public' AND r.rolname='service_role';
  IF sr_t <> 107 OR sr_f <> 8 THEN
    RAISE EXCEPTION 'service_role continuity broken: % tables, % functions (expected 107, 8)', sr_t, sr_f;
  END IF;
  RAISE NOTICE 'forward ok: anon/authenticated/PUBLIC at zero; service_role intact (% tables, % functions)', sr_t, sr_f;
END $$;

COMMIT;
