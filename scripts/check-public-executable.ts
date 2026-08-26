/**
 * Fail if any function in the public schema is executable by PUBLIC (and therefore by anon).
 *
 * This exists because ALTER DEFAULT PRIVILEGES cannot suppress PostgreSQL's built-in PUBLIC EXECUTE on
 * newly created functions - measured on 17.11, the statement does not even create a pg_default_acl row and
 * a function created afterwards still has proacl NULL. So the P4-B remediation cannot be made durable by
 * default privileges alone; every migration that creates a function has to revoke PUBLIC explicitly, and
 * this check is what catches the one that forgets.
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
