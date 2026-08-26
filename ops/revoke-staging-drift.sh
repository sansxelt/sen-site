#!/usr/bin/env bash
# Step 4c - apply the twelve authorised REVOKE operations to owner-confirmed staging.
#
# RUN THIS YOURSELF. It prompts for a password; an assistant shell has no tty, and the password must
# never enter a transcript.
#
#   usage:  bash ops/revoke-staging-drift.sh
#           bash ops/revoke-staging-drift.sh --preflight-only     # read-only, writes NOTHING
#
# SCOPE: twelve REVOKE statements, six tables, two roles. Nothing else - no GRANT, no ALTER, no
# migration, no event trigger, no table, schema or data change. The SQL asserts that itself, inside the
# transaction, and a failed assertion raises - so a logical mismatch rolls back exactly like an error.
set -uo pipefail

REPO_ROOT="${RESTORE_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
if [ ! -f "$REPO_ROOT/ops/revoke-staging-drift.sql" ]; then
  echo "  STOP: cannot locate the repository root (looked in '$REPO_ROOT')."; exit 1
fi

STAGING_REF='mxxhpfbazbwczrhuxasv'
PROD_REF='gvcqzovxfijvtkhetopn'
STAGING_HOST="${STAGING_POOLER_HOST:-aws-0-us-west-2.pooler.supabase.com}"
STAGING_PORT='5432'
STAGING_USER="postgres.${STAGING_REF}"
STAGING_DB='postgres'
PG_IMAGE='postgres:17-alpine'
EXPECT_TLS='TLSv1.3'
EXPECT_PAIRS=12          # 6 tables x 2 roles
EXPECT_PRIVS=96          # x 8 privileges each

PREFLIGHT_ONLY=0
case "${1:-}" in --preflight-only) PREFLIGHT_ONLY=1 ;; esac

say()  { echo "$@"; }
fail() { echo; echo "  STOP: $*"; echo "  Staging is unchanged."; exit 1; }

say
say "  Step 4c - revoke the twelve drifted role-table privilege sets"
say "  host: ${STAGING_HOST}:${STAGING_PORT}   user: ${STAGING_USER}   ref: ${STAGING_REF}"
if [ "$PREFLIGHT_ONLY" -eq 1 ]; then say "  MODE: --preflight-only - writes nothing"; fi
say

# -- Phase 0: offline guards ------------------------------------------------
say "  -- Phase 0: offline guards --"
for component in "$STAGING_HOST" "$STAGING_USER" "$STAGING_DB"; do
  case "$component" in
    *"$PROD_REF"*) fail "PRODUCTION ref '${PROD_REF}' appears in '${component}'. Permanently denied." ;;
  esac
done
case "$STAGING_USER" in
  *"$STAGING_REF"*) : ;;
  *) fail "user '${STAGING_USER}' does not carry the staging ref '${STAGING_REF}'." ;;
esac
if [ "$STAGING_PORT" != "5432" ]; then fail "port ${STAGING_PORT} is not the session pooler port 5432."; fi
say "    [ok] production ref absent; staging ref present; port 5432"

GATE_URL="postgresql://${STAGING_USER}@${STAGING_HOST}:${STAGING_PORT}/${STAGING_DB}"
cd "$REPO_ROOT" || fail "cannot cd to the repository root"
identify() { npx tsx scripts/db-target-identify.ts --url "$GATE_URL" --identify-only >/dev/null 2>&1; }
identify || fail "the target-identification gate refused this target."
say "    [ok] policy gate: classified STAGING"

# -- Phase 1: credentials ---------------------------------------------------
say
say "  -- Phase 1: credentials --"
read -rsp '  staging DB password (input hidden): ' PGPASSWORD
echo
if [ -z "$PGPASSWORD" ]; then fail "empty password - refusing to continue."; fi
export PGPASSWORD
export PGHOST="$STAGING_HOST" PGPORT="$STAGING_PORT" PGUSER="$STAGING_USER" PGDATABASE="$STAGING_DB"
export PGSSLMODE=require
say "    [ok] password accepted (presence only; never printed, measured or persisted)"
say "    [ok] PGSSLMODE=require"

command -v docker >/dev/null 2>&1 || fail "docker not found; needed to run ${PG_IMAGE}."

umask 077
LOG_DIR="${REVOKE_LOG_DIR:-${TMPDIR:-/tmp}}"
AUDIT_LOG="${LOG_DIR}/revoke-staging-$(date -u +%Y%m%dT%H%M%SZ).log"
: > "$AUDIT_LOG"
chmod 600 "$AUDIT_LOG"

pg() {
  docker run --rm -i -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE \
    -e PGOPTIONS -v "${REPO_ROOT}/ops:/sql:ro" "$PG_IMAGE" psql "$@"
}

# -- Phase 2: read-only preflight -------------------------------------------
say
say "  -- Phase 2: read-only preflight (writes nothing) --"
SIX="'analytics_events','vraelis_bookings','vraelis_leads','vraelis_payments','vraelis_workspaces','waitlist'"
PRE="$(pg -tA -v ON_ERROR_STOP=1 <<SQL 2>&1
\conninfo
begin read only;
select 'K_RO='    || current_setting('transaction_read_only');
select 'K_DB='    || current_database();
select 'K_USER='  || current_user;
select 'K_PAIRS=' || (select count(*) from (
    select c.relname, r.rolname from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) a
      join pg_roles r on r.oid = a.grantee
     where ns.nspname = 'public' and c.relname in (${SIX})
       and r.rolname in ('anon','authenticated')
     group by 1,2) t);
select 'K_PRIVS=' || (select count(*) from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) a
      join pg_roles r on r.oid = a.grantee
     where ns.nspname = 'public' and c.relname in (${SIX})
       and r.rolname in ('anon','authenticated'));
select 'K_SVCROLE=' || (select count(*) from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) a
      join pg_roles r on r.oid = a.grantee
     where ns.nspname = 'public' and c.relname in (${SIX})
       and r.rolname = 'service_role');
select 'K_ACLTOTAL=' || (select count(*) from pg_class c
      join pg_namespace ns on ns.oid = c.relnamespace
      cross join lateral aclexplode(c.relacl) a
     where ns.nspname = 'public' and c.relkind in ('r','p','v','m','S'));
rollback;
SQL
)"
PRE_STATUS=$?
k() { printf '%s\n' "$PRE" | sed -n "s/^[[:space:]]*${1}=//p" | tail -1; }

if [ "$PRE_STATUS" -ne 0 ]; then
  printf '%s\n' "$PRE" | grep -iE 'error|fatal|could not' | head -3 | sed 's/^/      /'
  unset PGPASSWORD; rm -f "$AUDIT_LOG"
  fail "the read-only preflight failed (exit ${PRE_STATUS})."
fi

TLS="$(printf '%s\n' "$PRE" | sed -n 's/.*protocol: \([A-Za-z0-9.]*\).*/\1/p' | tail -1)"
if [ -z "$TLS" ]; then unset PGPASSWORD; rm -f "$AUDIT_LOG"; fail "no SSL protocol reported - the link may not be encrypted."; fi
if [ "$TLS" != "$EXPECT_TLS" ]; then unset PGPASSWORD; rm -f "$AUDIT_LOG"; fail "TLS is ${TLS}, expected ${EXPECT_TLS}."; fi
say "    [ok] TLS ${TLS} (client link, from conninfo)"

if [ "$(k K_RO)"   != "on" ];       then unset PGPASSWORD; rm -f "$AUDIT_LOG"; fail "the preflight transaction is not read-only."; fi
if [ "$(k K_DB)"   != "postgres" ]; then unset PGPASSWORD; rm -f "$AUDIT_LOG"; fail "database is '$(k K_DB)', expected postgres."; fi
if [ "$(k K_USER)" != "postgres" ]; then unset PGPASSWORD; rm -f "$AUDIT_LOG"; fail "current_user is '$(k K_USER)', expected postgres."; fi
say "    [ok] identity: database $(k K_DB), user $(k K_USER); read-only confirmed server-side"

PAIRS="$(k K_PAIRS)"; PRIVS="$(k K_PRIVS)"; SVC="$(k K_SVCROLE)"; ACL_BEFORE="$(k K_ACLTOTAL)"
if [ "$PAIRS" != "$EXPECT_PAIRS" ]; then
  unset PGPASSWORD; rm -f "$AUDIT_LOG"
  fail "found ${PAIRS} anon/authenticated role-table pairs on the six tables, expected ${EXPECT_PAIRS}. Nothing revoked."
fi
if [ "$PRIVS" != "$EXPECT_PRIVS" ]; then
  unset PGPASSWORD; rm -f "$AUDIT_LOG"
  fail "those pairs hold ${PRIVS} privileges, expected ${EXPECT_PRIVS}. Nothing revoked."
fi
if [ "$SVC" != "48" ]; then
  unset PGPASSWORD; rm -f "$AUDIT_LOG"
  fail "service_role holds ${SVC} privileges on the six tables, expected 48. Nothing revoked."
fi
say "    [ok] confirmed exactly ${PAIRS} role-table pairs holding ${PRIVS} privileges - the drift to remove"
say "    [ok] service_role holds ${SVC} privileges on those tables and must be left untouched"
say "    [ok] public privilege total before: ${ACL_BEFORE}   expected after: $((ACL_BEFORE - EXPECT_PRIVS))"

if [ "$PREFLIGHT_ONLY" -eq 1 ]; then
  unset PGPASSWORD; rm -f "$AUDIT_LOG"
  say
  say "  --preflight-only: every gate passed. NOTHING was written."
  exit 0
fi

# -- Phase 3: re-identify immediately before execution, then execute --------
say
say "  -- Phase 3: execute --"
identify || { unset PGPASSWORD; rm -f "$AUDIT_LOG"; fail "the gate refused this target on the re-check."; }
say "    [ok] staging re-identified immediately before execution"
say "    12 REVOKE statements in one transaction, ON_ERROR_STOP. Preconditions and postconditions are"
say "    asserted inside that transaction; a failed assertion raises, rolling the whole thing back."
say "    audit log: ${AUDIT_LOG}  (mode 0600)"
say

export PGOPTIONS="-c vraelis.acl_before=${ACL_BEFORE}"
pg --echo-all -v ON_ERROR_STOP=1 -f /sql/revoke-staging-drift.sql >> "$AUDIT_LOG" 2>&1
STATUS=$?
unset PGPASSWORD
say "    [ok] PGPASSWORD unset"

if grep -qEi '(sk_live|pk_live|whsec_|eyJ[A-Za-z0-9_-]{20,}|-----BEGIN|AKIA[0-9A-Z]{16}|password)' "$AUDIT_LOG"; then
  say "    WARNING: the audit log matched a secret-shaped pattern. Review it by hand before sharing."
else
  say "    [ok] audit log scanned: no credential-shaped content"
fi

say
say "    statement results:"
grep -E '^(REVOKE|BEGIN|COMMIT|ROLLBACK|NOTICE|ERROR|psql:)' "$AUDIT_LOG" | sed 's/^/      /'
say

if [ "$STATUS" -ne 0 ]; then
  say "    psql exit: ${STATUS} - the transaction ROLLED BACK. Staging is unchanged."
  grep -iE 'error|fatal' "$AUDIT_LOG" | head -5 | sed 's/^/      /'
  exit "$STATUS"
fi

say "    psql exit: 0 - committed"
say "    revocations applied: $(grep -cx "REVOKE" "$AUDIT_LOG")"
say
say "  NEXT: re-run Step 4b. It must report 0 differing in-scope facts before the verdict"
say "        'staging matches the sanitized transferred public-schema artifact' may be stated."
say
say "      bash ops/reconcile-staging-schema.sh /tmp/vraelis-schema-QJLrVDyU/prod-public-schema.sql"
say
say "  The RLS preflight and security migrations have NOT been run."
say
