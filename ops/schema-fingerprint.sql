-- Canonical, deterministic fingerprint of the public schema.
--
-- Run IDENTICALLY against two databases; the outputs are byte-comparable. Anything that legitimately
-- differs between a local reference restore and staging is excluded on purpose:
--   - OIDs (allocation order), owners (the dump was --no-owner, so ownership is the restoring role),
--     grantors, and comments (the dump was --no-comments).
-- Read-only: SELECT against catalogs only.
select 'COL|' || c.relname || '|' || a.attname || '|' || a.attnum || '|'
         || format_type(a.atttypid, a.atttypmod) || '|' || (not a.attnotnull)::text || '|'
         || coalesce(pg_get_expr(d.adbin, d.adrelid), '')
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid
  left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
 where n.nspname = 'public' and c.relkind in ('r','p','v','m') and a.attnum > 0 and not a.attisdropped
union all
select 'IDX|' || c.relname || '|' || i.relname || '|' || pg_get_indexdef(x.indexrelid)
  from pg_index x
  join pg_class i on i.oid = x.indexrelid
  join pg_class c on c.oid = x.indrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
union all
select 'CON|' || c.relname || '|' || k.conname || '|' || k.contype::text || '|' || pg_get_constraintdef(k.oid)
  from pg_constraint k
  join pg_class c on c.oid = k.conrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
union all
select 'RLS|' || c.relname || '|' || c.relrowsecurity::text || '|' || c.relforcerowsecurity::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind in ('r','p')
union all
select 'POL|' || p.tablename || '|' || p.policyname || '|' || p.permissive || '|'
         || coalesce(array_to_string(p.roles, ','), '') || '|' || p.cmd || '|'
         || coalesce(p.qual, '') || '|' || coalesce(p.with_check, '')
  from pg_policies p where p.schemaname = 'public'
union all
-- Grants are part of what is being reconciled: --no-privileges was deliberately NOT used, because the
-- RLS preflight checks what anon and authenticated can reach. Grantor is excluded, grantee is not.
select 'ACL|' || c.relname || '|' || coalesce(r.rolname, 'PUBLIC') || '|' || a.privilege_type
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  cross join lateral aclexplode(c.relacl) a
  left join pg_roles r on r.oid = a.grantee
 where n.nspname = 'public' and c.relkind in ('r','p','v','m','S')
union all
select 'FUN|' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|'
         || l.lanname || '|' || p.prosecdef::text || '|' || p.provolatile::text || '|'
         || coalesce(array_to_string(p.proconfig, ','), '') || '|' || md5(p.prosrc)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_language l on l.oid = p.prolang
 where n.nspname = 'public'
union all
select 'FACL|' || p.proname || '|' || coalesce(r.rolname, 'PUBLIC') || '|' || a.privilege_type
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(p.proacl) a
  left join pg_roles r on r.oid = a.grantee
 where n.nspname = 'public'
union all
select 'SEQ|' || c.relname || '|' || s.seqtypid::regtype::text || '|' || s.seqincrement || '|' || s.seqmin || '|' || s.seqmax
  from pg_sequence s
  join pg_class c on c.oid = s.seqrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public'
union all
select 'TYP|' || t.typname || '|' || t.typtype::text || '|' || coalesce(array_to_string(array(
         select e.enumlabel from pg_enum e where e.enumtypid = t.oid order by e.enumsortorder), ','), '')
  from pg_type t
  join pg_namespace n on n.oid = t.typnamespace
 where n.nspname = 'public' and t.typtype in ('e','d')
union all
select 'TRG|' || c.relname || '|' || g.tgname || '|' || pg_get_triggerdef(g.oid)
  from pg_trigger g
  join pg_class c on c.oid = g.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and not g.tgisinternal
union all
select 'DACL|' || coalesce(r.rolname, '?') || '|' || d.defaclobjtype::text || '|'
         || coalesce(gr.rolname, 'PUBLIC') || '|' || a.privilege_type
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  left join pg_roles r on r.oid = d.defaclrole
  cross join lateral aclexplode(d.defaclacl) a
  left join pg_roles gr on gr.oid = a.grantee
 where n.nspname = 'public'
order by 1;
