/**
 * Fail if any function in the public schema is executable by PUBLIC (and therefore by anon).
 *
 * The GLOBAL form of ALTER DEFAULT PRIVILEGES does suppress PostgreSQL's built-in PUBLIC EXECUTE for a
 * given creator role (the per-schema form cannot - it may only ADD privileges). But default privileges are
 * per CREATOR, and postgres cannot set another role's: supabase_admin also holds CREATE on public, and a
 * function it creates arrives with proacl NULL and is anon-executable. Verified: our migration covers
 * postgres-created functions completely and supabase_admin-created ones not at all.
 *
 * This check is the backstop for the creators we cannot configure, and for any migration that creates a
 * function without revoking PUBLIC.
 *
 *   usage:  npx tsx scripts/check-public-executable.ts --url <postgres-url>
 *
 * Read-only: a single catalog SELECT inside a read-only transaction.
 */
export const CHECK_SQL = `
begin read only;
select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as public_executable
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join lateral aclexplode(p.proacl) a
 where n.nspname = 'public' and a.grantee = 0 and a.privilege_type = 'EXECUTE'
union all
-- proacl NULL means the pure built-in default, which grants PUBLIC EXECUTE. It is the case a naive
-- aclexplode check misses entirely, because there is no ACL row to explode.
select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')  [proacl NULL = built-in default]'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proacl is null
order by 1;
rollback;
`;

if (process.argv[1] && process.argv[1].endsWith("check-public-executable.ts")) {
  console.log("  Run this query against the target and fail the build if it returns any row:");
  console.log(CHECK_SQL);
}
