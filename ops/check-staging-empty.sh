#!/usr/bin/env bash
# Step 3 — verify the STAGING project's public schema is empty. READ-ONLY.
#
# RUN THIS YOURSELF. It prompts for the staging database password; an assistant shell has no tty, and the
# password must never enter an assistant transcript.
#
# WHAT IT DOES:
#   enforces the allowlist/denylist BEFORE asking for a credential, connects to STAGING only, through the
#   SESSION pooler on 5432 with SSL required, sets default_transaction_read_only and VERIFIES it
#   server-side, then reads catalog metadata only.
#
# WHAT IT NEVER DOES:
#   no DROP, no ALTER, no CREATE, no restore, no migration, no write of any kind. No production contact.
#   It does not read .env.local. It does not begin Step 4.
#
# ANY user-created object in `public` is a STOP condition: Step 4 restores into that schema, and restoring
# onto existing objects produces partial failures that are tedious to unpick and easy to misread as success.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STAGING_REF='mxxhpfbazbwczrhuxasv'     # owner-confirmed staging
PROD_REF='gvcqzovxfijvtkhetopn'        # owner-confirmed production — must never be reached from here
PG_IMAGE='postgres:17-alpine'

echo
echo "  Step 3 — is the STAGING public schema empty?  (READ-ONLY)"
echo

# ── The pooler host. Region-specific, so it is required rather than guessed ──
# Staging's Session pooler host, read from the project's Connect dialog on 2026-08-25. A pooler hostname
# is not a secret. It is recorded rather than prompted for because it is region-specific and NOT derivable
# from the ref: staging is us-west-2 while production is us-east-2, so guessing it would have been a guess
# pointed at a database. Override with STAGING_POOLER_HOST if the project ever moves.
POOLER_HOST="${STAGING_POOLER_HOST:-aws-0-us-west-2.pooler.supabase.com}"
if [ -z "$POOLER_HOST" ]; then
  read -rp '  staging Session pooler host: ' POOLER_HOST
fi
POOLER_PORT=5432                        # SESSION mode. 6543 is transaction mode.
STAGING_USER="postgres.${STAGING_REF}"

case "$POOLER_HOST" in
  *.pooler.supabase.com) : ;;
  *) echo "  REFUSING: '${POOLER_HOST}' is not a *.pooler.supabase.com host."
     echo "            This step is restricted to the Session pooler."; exit 1 ;;
esac

# ── Enforce the policy BEFORE a credential is ever requested ────────────────
#
# Deliberately ordered this way: a denied target should never get as far as prompting for a password. The
# gate needs no credential to classify, so it runs on a password-less URL first.
echo "  ── policy gate (no credential involved) ──"
GATE_URL="postgresql://${STAGING_USER}@${POOLER_HOST}:${POOLER_PORT}/postgres"

# RELATIVE path, and cd first. An ABSOLUTE path does not survive this boundary: under WSL, REPO_ROOT is
# /mnt/c/Users/... but `npx`/`node` on this machine are the WINDOWS binaries, so Windows Node reads
# /mnt/c/... relative to the current drive and looks for C:\mnt\c\Users\... — module not found. The
# working directory IS translated correctly by WSL interop, so a relative path resolves on either side.
cd "$REPO_ROOT" || { echo "  FAILED: cannot cd to the repository root"; exit 1; }
if ! STAGING_URL="$GATE_URL" npx tsx scripts/db-target-identify.ts --identify-only; then
  echo
  echo "  REFUSING: the target did not pass the identification gate. No password was requested."
  exit 3
fi

# Belt and braces, independent of the gate: the production ref must not appear anywhere in this target.
case "${POOLER_HOST}${STAGING_USER}" in
  *"$PROD_REF"*) echo "  REFUSING: the production ref appears in this target."; exit 3 ;;
esac
case "$STAGING_USER" in
  *"$STAGING_REF"*) : ;;
  *) echo "  REFUSING: the user does not carry the staging ref."; exit 3 ;;
esac
echo "  gate passed: STAGING, and the production ref appears nowhere in this target."
echo

# ── Credential, read silently ───────────────────────────────────────────────
read -rsp '  staging DB password (input hidden): ' PGPASSWORD
echo
[ -n "$PGPASSWORD" ] || { echo "  FAILED: empty password — refusing to continue."; exit 1; }
export PGPASSWORD
export PGHOST="$POOLER_HOST" PGPORT="$POOLER_PORT" PGUSER="$STAGING_USER" PGDATABASE=postgres
export PGSSLMODE=require                # SSL required, explicitly

command -v docker >/dev/null 2>&1 || { echo "  FAILED: docker is required (no local psql)."; unset PGPASSWORD; exit 1; }

echo "  connecting: ${PGHOST}:${PGPORT} as ${PGUSER}  (sslmode=require, read-only)"
echo

# ── Catalog metadata only. Every statement below is a SELECT or a SET. ──────
SQL=$(cat <<'ENDSQL'
set default_transaction_read_only = on;
begin;

\echo '── read-only, verified by the server ──'
select '  transaction_read_only = ' || current_setting('transaction_read_only')
    || ' | default = ' || current_setting('default_transaction_read_only')
    || ' | ssl = ' || coalesce((select case when ssl then 'on' else 'off' end
                                from pg_stat_ssl where pid = pg_backend_pid()), 'unknown')
    || ' | server ' || split_part(version(), ' ', 2);

\echo ''
\echo '── counts of USER-CREATED objects in public ──'
select '  tables              ' || (select count(*) from pg_tables where schemaname='public')
union all select '  views               ' || (select count(*) from pg_views where schemaname='public')
union all select '  materialized views  ' || (select count(*) from pg_matviews where schemaname='public')
union all select '  sequences           ' || (select count(*) from pg_sequences where schemaname='public')
union all select '  functions           ' || (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                                               where n.nspname='public'
                                                 and not exists (select 1 from pg_depend d
                                                                  where d.objid=p.oid and d.deptype='e'))
union all select '  types (non-table)   ' || (select count(*) from pg_type t join pg_namespace n on n.oid=t.typnamespace
                                               where n.nspname='public' and t.typtype in ('c','e','d','r')
                                                 and not exists (select 1 from pg_class c
                                                                  where c.reltype=t.oid and c.relkind in ('r','v','m','p','f'))
                                                 and not exists (select 1 from pg_depend d
                                                                  where d.objid=t.oid and d.deptype='e'))
union all select '  policies            ' || (select count(*) from pg_policies where schemaname='public')
union all select '  triggers            ' || (select count(*) from pg_trigger g join pg_class c on c.oid=g.tgrelid
                                               join pg_namespace n on n.oid=c.relnamespace
                                               where n.nspname='public' and not g.tgisinternal)
union all select '  extensions in public' || (select count(*) from pg_extension e join pg_namespace n on n.oid=e.extnamespace
                                               where n.nspname='public');

\echo ''
\echo '── names (empty sections mean none) ──'
\echo '  tables:'
select '    ' || tablename from pg_tables where schemaname='public' order by 1;
\echo '  views:'
select '    ' || viewname from pg_views where schemaname='public' order by 1;
\echo '  materialized views:'
select '    ' || matviewname from pg_matviews where schemaname='public' order by 1;
\echo '  sequences:'
select '    ' || sequencename from pg_sequences where schemaname='public' order by 1;
\echo '  functions:'
select '    ' || p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
 order by 1;
\echo '  types:'
select '    ' || t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace
 where n.nspname='public' and t.typtype in ('c','e','d','r')
   and not exists (select 1 from pg_class c where c.reltype=t.oid and c.relkind in ('r','v','m','p','f'))
   and not exists (select 1 from pg_depend d where d.objid=t.oid and d.deptype='e')
 order by 1;
\echo '  policies:'
select '    ' || tablename || '.' || policyname from pg_policies where schemaname='public' order by 1;
\echo '  triggers:'
select '    ' || c.relname || '.' || g.tgname from pg_trigger g join pg_class c on c.oid=g.tgrelid
 join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not g.tgisinternal order by 1;
\echo '  extensions installed INTO public (informational, not user objects):'
select '    ' || e.extname from pg_extension e join pg_namespace n on n.oid=e.extnamespace
 where n.nspname='public' order by 1;

\echo ''
\echo '── migration history ──'
select '  supabase_migrations.schema_migrations: ' ||
       case when to_regclass('supabase_migrations.schema_migrations') is null
            then 'table absent (no Supabase CLI migrations recorded)'
            else (select count(*)::text || ' row(s)' from supabase_migrations.schema_migrations) end;

\echo ''
\echo '── VERDICT ──'
select case when (select count(*) from pg_tables where schemaname='public')
              + (select count(*) from pg_views where schemaname='public')
              + (select count(*) from pg_matviews where schemaname='public')
              + (select count(*) from pg_sequences where schemaname='public')
              + (select count(*) from pg_policies where schemaname='public')
              + (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e'))
              + (select count(*) from pg_trigger g join pg_class c on c.oid=g.tgrelid
                  join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not g.tgisinternal) = 0
            then '  EMPTY — no user-created objects in public. Step 4 may proceed on separate approval.'
            else '  NOT EMPTY — STOP. Step 4 must not run against a populated public schema.' end;

rollback;
ENDSQL
)

MSYS_NO_PATHCONV=1 docker run --rm -i \
  -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE \
  "$PG_IMAGE" psql -v ON_ERROR_STOP=1 -tAq <<< "$SQL"
PSQL_STATUS=$?

unset PGPASSWORD
echo
echo "  PGPASSWORD unset"
echo "  psql exit: $PSQL_STATUS"

if [ "$PSQL_STATUS" -ne 0 ]; then
  echo "  FAILED — nothing was read successfully. Nothing was written either; every statement was a SELECT."
  exit "$PSQL_STATUS"
fi

echo
echo "  Read the VERDICT line above."
echo "  If it says NOT EMPTY, that is a STOP condition — do not proceed to Step 4."
echo "  Step 4 has NOT been started and requires separate approval either way."
