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

-- PRIVILEGE RESTORATION IS DELIBERATELY ABSENT FROM THIS FILE.
--
-- It used to begin with `grant all on all tables in schema public to anon, authenticated`. That grants
-- all 107 tables where production grants 101, re-exposing the six deliberately hardened to service_role
-- only: analytics_events, vraelis_bookings, vraelis_leads, vraelis_payments, vraelis_workspaces,
-- waitlist. It also re-granted EXECUTE on every function to PUBLIC. A rollback that ends more permissive
-- than the state it claims to restore is not a rollback.
--
-- Privilege restoration is owned EXCLUSIVELY by ops/p4-remediation-rollback.sql, which is generated from
-- the verified production dump and reproduces each grant individually - proven to restore the 5187-fact
-- fingerprint with zero differences.
--
-- CONSEQUENCE: this migration is reversible only WITHIN the ordered set
--     forward   P4 -> P3-C -> P3-D -> H3
--     rollback  H3 -> P3-D -> P3-C -> P4
-- where P4's rollback runs last and restores privileges exactly. Running H3 standalone and rolling it
-- back alone would leave anon/authenticated without the privileges section B revoked. Do not do that.

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
