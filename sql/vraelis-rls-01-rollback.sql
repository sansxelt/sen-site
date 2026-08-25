-- ============================================================================
-- ROLLBACK for sql/vraelis-rls-01-deny-by-default.sql
--
-- READ THIS FIRST. Running this restores the PRE-MIGRATION state, in which anon and authenticated can read
-- and write every table in the public schema. Only run it if the migration is shown to break production,
-- and treat the window it opens as an active incident.
--
-- The expected failure mode after the forward migration is NOT partial: every application query uses the
-- service-role client (BYPASSRLS + explicit grants from section F), so either everything works or some
-- access path is not using the client it is documented to use. Prefer finding that path over rolling back.
--
-- EXACTNESS: this reverses RLS for precisely the tables the forward migration flipped, read from the
-- ledger it wrote. It does NOT touch tables that already had RLS before the migration — an earlier
-- hardcoded version of this file would have stripped protection from v_check_attachments and others that
-- were never part of the change.
-- ============================================================================

set lock_timeout = '5s';

begin;

-- Restore the Supabase default grants.
grant all on all tables in schema public to anon, authenticated;
grant all on all sequences in schema public to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant all on sequences to anon, authenticated;
alter default privileges in schema public grant all on functions to anon, authenticated;
alter default privileges in schema public grant execute on functions to public;

-- Restore EXECUTE on the application functions (same catalog-driven set the forward migration revoked).
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
    execute format('grant execute on function %s to public, anon, authenticated', r.sig);
  end loop;
end $$;

-- Disable RLS on EXACTLY the tables this migration enabled it for.
do $$
declare r record;
begin
  if to_regclass('public._rls_migration_01_applied') is null then
    raise exception 'ledger table _rls_migration_01_applied is missing; refusing to guess which tables to unprotect';
  end if;
  for r in select tablename from public._rls_migration_01_applied loop
    if to_regclass(format('public.%I', r.tablename)) is not null then
      execute format('alter table public.%I disable row level security', r.tablename);
    end if;
  end loop;
end $$;

drop table if exists public._rls_migration_01_applied;

-- The search_path pins from section E are deliberately NOT reset: they are a hardening with no
-- compatibility cost, and unpinning them would reintroduce a shadowing risk for no benefit.

commit;

reset lock_timeout;
