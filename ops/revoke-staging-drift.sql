-- Step 4c — remove the twelve role-table privilege sets staging has and the artifact does not.
--
-- SCOPE: twelve REVOKE statements. Nothing else. No GRANT, no ALTER, no migration, no event trigger,
-- no table, schema or data change.
--
-- Preconditions and postconditions are enforced INSIDE the transaction by DO blocks that RAISE. A raised
-- exception is an error, so ON_ERROR_STOP rolls the whole transaction back - a logical mismatch is
-- therefore as fatal as a syntax error, which is the point.
--
-- The baseline is captured INSIDE this transaction with set_config(..., is_local => true) rather than
-- passed in. Two earlier attempts were worse: psql does not interpolate :variables inside dollar-quoted
-- blocks (the text reaches plpgsql verbatim), and a PGOPTIONS startup parameter is not guaranteed to
-- survive a connection pooler. Capturing it here depends on neither, and closes the window between
-- measuring and acting. The caller separately asserts the total it observed read-only, so both are checked.

begin;

-- ── Baseline, captured inside the transaction so nothing can change between measuring and acting ──
do $$
begin
  perform set_config('vraelis.acl_before',
    (select count(*)::text
       from pg_class c
       join pg_namespace ns on ns.oid = c.relnamespace
       cross join lateral aclexplode(c.relacl) a
      where ns.nspname = 'public' and c.relkind in ('r','p','v','m','S')), true);
  raise notice 'baseline captured: % privileges in public', current_setting('vraelis.acl_before');
end $$;

-- ── Precondition 1: exactly the twelve expected role-table pairs currently hold privileges ──
do $$
declare n int;
begin
  select count(*) into n from (
    select c.relname, r.rolname
      from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) a
      join pg_roles r on r.oid = a.grantee
     where ns.nspname = 'public'
       and c.relname in ('analytics_events','vraelis_bookings','vraelis_leads',
                         'vraelis_payments','vraelis_workspaces','waitlist')
       and r.rolname in ('anon','authenticated')
     group by 1, 2
  ) t;
  if n <> 12 then
    raise exception 'PRECONDITION FAILED: expected 12 anon/authenticated role-table pairs on the six tables, found %', n;
  end if;
  raise notice 'precondition 1 ok: 12 role-table pairs present';
end $$;

-- ── Precondition 2: those twelve pairs hold exactly 96 privileges - eight each, nothing partial ──
do $$
declare n int;
begin
  select count(*) into n
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    join pg_roles r on r.oid = a.grantee
   where ns.nspname = 'public'
     and c.relname in ('analytics_events','vraelis_bookings','vraelis_leads',
                       'vraelis_payments','vraelis_workspaces','waitlist')
     and r.rolname in ('anon','authenticated');
  if n <> 96 then
    raise exception 'PRECONDITION FAILED: the twelve pairs hold % privileges, expected 96', n;
  end if;
  raise notice 'precondition 2 ok: 96 privileges to remove';
end $$;

-- ── The twelve revocations. One statement per role-table pair, for an auditable log. ──
REVOKE ALL ON TABLE public.analytics_events   FROM anon;
REVOKE ALL ON TABLE public.analytics_events   FROM authenticated;
REVOKE ALL ON TABLE public.vraelis_bookings   FROM anon;
REVOKE ALL ON TABLE public.vraelis_bookings   FROM authenticated;
REVOKE ALL ON TABLE public.vraelis_leads      FROM anon;
REVOKE ALL ON TABLE public.vraelis_leads      FROM authenticated;
REVOKE ALL ON TABLE public.vraelis_payments   FROM anon;
REVOKE ALL ON TABLE public.vraelis_payments   FROM authenticated;
REVOKE ALL ON TABLE public.vraelis_workspaces FROM anon;
REVOKE ALL ON TABLE public.vraelis_workspaces FROM authenticated;
REVOKE ALL ON TABLE public.waitlist           FROM anon;
REVOKE ALL ON TABLE public.waitlist           FROM authenticated;

-- ── Postcondition 1: those twelve pairs now hold nothing ──
do $$
declare n int;
begin
  select count(*) into n
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    join pg_roles r on r.oid = a.grantee
   where ns.nspname = 'public'
     and c.relname in ('analytics_events','vraelis_bookings','vraelis_leads',
                       'vraelis_payments','vraelis_workspaces','waitlist')
     and r.rolname in ('anon','authenticated');
  if n <> 0 then
    raise exception 'POSTCONDITION FAILED: % anon/authenticated privileges remain on the six tables', n;
  end if;
  raise notice 'postcondition 1 ok: 0 anon/authenticated privileges remain';
end $$;

-- ── Postcondition 2: service_role was NOT touched - still 8 privileges on each of the six ──
do $$
declare n int;
begin
  select count(*) into n
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    join pg_roles r on r.oid = a.grantee
   where ns.nspname = 'public'
     and c.relname in ('analytics_events','vraelis_bookings','vraelis_leads',
                       'vraelis_payments','vraelis_workspaces','waitlist')
     and r.rolname = 'service_role';
  if n <> 48 then
    raise exception 'POSTCONDITION FAILED: service_role has % privileges on the six tables, expected 48', n;
  end if;
  raise notice 'postcondition 2 ok: service_role intact (48 privileges)';
end $$;

-- ── Postcondition 3: exactly 96 privileges were removed and NOTHING else changed ──
do $$
declare n int; expected int := current_setting('vraelis.acl_before')::int - 96;
begin
  select count(*) into n
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
   where ns.nspname = 'public' and c.relkind in ('r','p','v','m','S');
  if n <> expected then
    raise exception 'POSTCONDITION FAILED: public privilege count is %, expected % - something other than the twelve revocations changed', n, expected;
  end if;
  raise notice 'postcondition 3 ok: exactly 96 privileges removed, total now %', n;
end $$;

commit;
