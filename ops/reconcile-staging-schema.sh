#!/usr/bin/env bash
# Step 4b — deep structural reconciliation of staging against the verified production dump.
#
# WHY THIS EXISTS: the restore script's own reconciliation compares COUNTS and table NAMES. A column
# whose type differs still counts as one column; an index rebuilt differently still counts as one index.
# Before the RLS rehearsal leans on this clone, compare the actual structure.
#
# HOW: build a local reference by restoring the same file into a throwaway PostgreSQL, fingerprint both
# it and staging with the IDENTICAL query (ops/schema-fingerprint.sql), and diff. The fingerprint covers
# every column with its type/nullability/default, every index definition, every constraint definition,
# every RLS flag, every policy, every table and function grant, sequences, enum types, triggers, and
# default privileges — roughly 5,200 facts.
#
# THIS SCRIPT WRITES NOTHING TO STAGING. Every staging statement is a SELECT inside BEGIN READ ONLY.
#
#   usage:  bash ops/reconcile-staging-schema.sh /tmp/vraelis-schema-XXXXXXXX/prod-public-schema.sql
set -uo pipefail

REPO_ROOT="${RESTORE_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
if [ ! -f "$REPO_ROOT/ops/schema-fingerprint.sql" ]; then
  echo "  STOP: cannot locate the repository root (looked in '$REPO_ROOT')."; exit 1
fi

STAGING_REF='mxxhpfbazbwczrhuxasv'
PROD_REF='gvcqzovxfijvtkhetopn'
STAGING_HOST="${STAGING_POOLER_HOST:-aws-0-us-west-2.pooler.supabase.com}"
STAGING_PORT='5432'
STAGING_USER="postgres.${STAGING_REF}"
STAGING_DB='postgres'
PG_IMAGE='postgres:17-alpine'
REF_CONTAINER="vraelis-schema-ref-$$"

DUMP_FILE="${1:-}"
if [ -n "$DUMP_FILE" ] && [ -f "$DUMP_FILE" ]; then
  DUMP_FILE="$(cd "$(dirname "$DUMP_FILE")" && pwd)/$(basename "$DUMP_FILE")"
fi

host_path() {
  local p="$1" npx_bin; npx_bin="$(command -v npx 2>/dev/null || true)"
  case "$npx_bin" in /mnt/*) if command -v wslpath >/dev/null 2>&1; then wslpath -w "$p" 2>/dev/null && return 0; fi ;; esac
  printf '%s' "$p"
}
say()  { echo "$@"; }
cleanup() { docker rm -f "$REF_CONTAINER" >/dev/null 2>&1; }
fail() { echo; echo "  STOP: $*"; cleanup; exit 1; }
trap cleanup EXIT INT TERM

say
say "  Step 4b — deep structural reconciliation (READ-ONLY against staging)"
say "  host: ${STAGING_HOST}:${STAGING_PORT}   user: ${STAGING_USER}   ref: ${STAGING_REF}"
say

# ── Phase 0: the same offline guards as the restore ─────────────────────────
say "  ── Phase 0: offline guards ──"
for component in "$STAGING_HOST" "$STAGING_USER" "$STAGING_DB"; do
  case "$component" in *"$PROD_REF"*) fail "PRODUCTION ref '${PROD_REF}' appears in '${component}'. Permanently denied." ;; esac
done
case "$STAGING_USER" in *"$STAGING_REF"*) : ;; *) fail "user does not carry the staging ref." ;; esac
[ "$STAGING_PORT" = "5432" ] || fail "port ${STAGING_PORT} is not the session pooler port 5432."
say "    [ok] production ref absent; staging ref present; port 5432"

GATE_URL="postgresql://${STAGING_USER}@${STAGING_HOST}:${STAGING_PORT}/${STAGING_DB}"
cd "$REPO_ROOT" || fail "cannot cd to the repository root"
npx tsx scripts/db-target-identify.ts --url "$GATE_URL" --identify-only >/dev/null 2>&1 \
  || fail "the target-identification gate refused this target."
say "    [ok] policy gate: classified STAGING"

[ -n "$DUMP_FILE" ] || fail "no dump path given."
[ -f "$DUMP_FILE" ] || fail "dump not found: ${DUMP_FILE}"
DUMP_DIR="$(cd "$(dirname "$DUMP_FILE")" && pwd)"
case "${DUMP_DIR%/}/" in "${REPO_ROOT%/}/"*) fail "the dump is INSIDE the repository." ;; esac
[ -s "$DUMP_FILE" ] || fail "the dump is empty."
npx tsx scripts/verify-schema-dump.ts "$(host_path "$DUMP_FILE")" >/dev/null 2>&1 \
  || fail "the dump FAILED safety verification."
say "    [ok] dump outside the repo, non-empty, verification passed"

# ── Phase 1: the reference, built offline from the same file ────────────────
say
say "  ── Phase 1: build the local reference (offline, no network) ──"
RESTORE_FILE="${DUMP_DIR}/prod-public-schema.restore.sql"
umask 077
sed -e 's|^CREATE SCHEMA public;$|-- [NEUTRALISED A: target schema already exists] &|' \
    -e 's|^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin |-- [NEUTRALISED B: requires supabase_admin membership] &|' \
    "$DUMP_FILE" > "$RESTORE_FILE" || fail "could not derive the restore file"
chmod 600 "$RESTORE_FILE"
CHANGED="$(diff "$DUMP_FILE" "$RESTORE_FILE" | grep -c '^> ')"
[ "$CHANGED" -eq 13 ] || fail "expected exactly 13 neutralised lines, got ${CHANGED}."
say "    [ok] restore file re-derived identically (13 neutralised lines)"

command -v docker >/dev/null 2>&1 || fail "docker not found; needed to build the reference."
say "    starting a throwaway ${PG_IMAGE} ..."
docker run -d --name "$REF_CONTAINER" -e POSTGRES_PASSWORD=ref -e POSTGRES_USER=supabase_admin \
  "$PG_IMAGE" >/dev/null 2>&1 || fail "could not start the reference container."
# initdb briefly runs a temporary server, so wait for a real query to succeed repeatedly - pg_isready
# alone reports ready during that window and the role setup below then fails against a shutting-down node.
ok=0
for _ in $(seq 1 90); do
  if docker exec "$REF_CONTAINER" psql -U supabase_admin -tAc "select 1" >/dev/null 2>&1; then
    ok=$((ok+1)); [ "$ok" -ge 3 ] && break
  else ok=0; fi
  sleep 1
done
[ "$ok" -ge 3 ] || fail "the reference container never became ready."

# The Supabase role shape: supabase_admin superuser, postgres a non-superuser that is not a member of it.
docker exec -i "$REF_CONTAINER" psql -U supabase_admin -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<'SQL' \
  || fail "could not create the reference roles."
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role postgres login createrole createdb password 'ref';
grant anon, authenticated, service_role to postgres with admin option;
SQL

# Schema ownership is per-database, and the heredoc above connects to the DEFAULT database
# (supabase_admin, from POSTGRES_USER) - so this ALTER has to be issued against the database
# the restore actually targets, or the restore runs as postgres against a public schema it
# does not own and fails with "permission denied for schema public".
docker exec -i "$REF_CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q -c "alter schema public owner to postgres;" >/dev/null 2>&1 || fail "could not set public-schema ownership in the reference database."
docker cp "$RESTORE_FILE" "$REF_CONTAINER":/tmp/restore.sql >/dev/null 2>&1
docker cp "$REPO_ROOT/ops/schema-fingerprint.sql" "$REF_CONTAINER":/tmp/fp.sql >/dev/null 2>&1
if ! docker exec -i -e PGPASSWORD=ref "$REF_CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 --single-transaction -f /tmp/restore.sql > /tmp/.ref-restore.$$ 2>&1; then
  grep -iE 'error|fatal' /tmp/.ref-restore.$$ | head -3 | sed 's/^/      /'
  rm -f /tmp/.ref-restore.$$
  fail "the reference restore failed - the dump does not apply cleanly even locally."
fi
rm -f /tmp/.ref-restore.$$
REF_FP="${DUMP_DIR}/fingerprint-reference.txt"
docker exec -i -e PGPASSWORD=ref "$REF_CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres \
  -tA -v ON_ERROR_STOP=1 -f /tmp/fp.sql > "$REF_FP" 2>&1 || fail "the reference fingerprint failed."
chmod 600 "$REF_FP"
grep -q '^ERROR' "$REF_FP" && { head -3 "$REF_FP" | sed 's/^/      /'; fail "the reference fingerprint contains errors."; }
say "    [ok] reference built and fingerprinted: $(wc -l < "$REF_FP") facts"

# ── Phase 2: fingerprint staging, read-only ────────────────────────────────
say
say "  ── Phase 2: fingerprint staging (BEGIN READ ONLY; every statement a SELECT) ──"
read -rsp '  staging DB password (input hidden): ' PGPASSWORD
echo
[ -n "$PGPASSWORD" ] || fail "empty password — refusing to continue."
export PGPASSWORD
export PGHOST="$STAGING_HOST" PGPORT="$STAGING_PORT" PGUSER="$STAGING_USER" PGDATABASE="$STAGING_DB"
export PGSSLMODE=require

# Wrap the identical fingerprint query in a read-only transaction that asserts its own read-only-ness.
WRAPPED="${DUMP_DIR}/.fingerprint-wrapped.sql"
{ echo "begin read only;"
  echo "select 'RO|' || current_setting('transaction_read_only');"
  cat "$REPO_ROOT/ops/schema-fingerprint.sql"
  echo "rollback;"
} > "$WRAPPED"
chmod 600 "$WRAPPED"

STG_RAW="${DUMP_DIR}/.fingerprint-staging.raw"
docker run --rm -i -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE \
  -v "${DUMP_DIR}:/work" "$PG_IMAGE" \
  psql -q -tA -v ON_ERROR_STOP=1 -f /work/.fingerprint-wrapped.sql > "$STG_RAW" 2>&1
STG_STATUS=$?
unset PGPASSWORD
say "    [ok] PGPASSWORD unset"
rm -f "$WRAPPED"

if [ "$STG_STATUS" -ne 0 ]; then
  grep -iE 'error|fatal|could not' "$STG_RAW" | head -3 | sed 's/^/      /'
  rm -f "$STG_RAW"; fail "the staging fingerprint failed (exit ${STG_STATUS})."
fi
grep -q '^RO|on$' "$STG_RAW" || { rm -f "$STG_RAW"; fail "staging did not confirm a read-only transaction."; }
say "    [ok] staging confirmed transaction_read_only = on"

# Compare only fingerprint rows, so a stray command tag can never decide the verdict.
KINDS='^(COL|IDX|CON|RLS|POL|ACL|FUN|FACL|SEQ|TYP|TRG|DACL)\|'
STG_FP="${DUMP_DIR}/fingerprint-staging.txt"
grep -E "$KINDS" "$STG_RAW" | sort > "$STG_FP"; chmod 600 "$STG_FP"; rm -f "$STG_RAW"
REF_SORTED="${DUMP_DIR}/.ref-sorted"
grep -E "$KINDS" "$REF_FP" | sort > "$REF_SORTED"
mv "$REF_SORTED" "$REF_FP"; chmod 600 "$REF_FP"
say "    [ok] staging fingerprinted: $(wc -l < "$STG_FP") facts"

# ── Phase 3: compare ───────────────────────────────────────────────────────
say
say "  ── Phase 3: compare ──"
[ -s "$REF_FP" ] || fail "the reference fingerprint is empty — refusing to declare a match against nothing."
[ -s "$STG_FP" ] || fail "the staging fingerprint is empty — refusing to declare a match against nothing."

DIFF_FILE="${DUMP_DIR}/fingerprint-diff.txt"
diff "$REF_FP" "$STG_FP" > "$DIFF_FILE" 2>&1
DIFF_COUNT="$(grep -cE '^[<>]' "$DIFF_FILE")"
chmod 600 "$DIFF_FILE"

say "    reference (from the dump): $(wc -l < "$REF_FP") facts"
say "    staging   (actual)       : $(wc -l < "$STG_FP") facts"
say
printf '    %-8s %8s %8s\n' KIND REFERENCE STAGING
for kind in COL IDX CON RLS POL ACL FUN FACL SEQ TYP TRG DACL; do
  a="$(grep -c "^${kind}|" "$REF_FP")"; b="$(grep -c "^${kind}|" "$STG_FP")"
  if [ "$a" = "$b" ]; then printf '    %-8s %8s %8s   ok\n' "$kind" "$a" "$b"
  else printf '    %-8s %8s %8s   <-- DIFFERS\n' "$kind" "$a" "$b"; fi
done
say
if [ "$DIFF_COUNT" -eq 0 ]; then
  say "  RECONCILED — staging matches the sanitized transferred public-schema artifact."
  say "  This is NOT a claim that staging is structurally identical to production; see the scope"
  say "  exclusions below for what was never in the artifact to begin with."
  rm -f "$DIFF_FILE"
else
  say "  DRIFT — ${DIFF_COUNT} differing fact(s). '<' is expected from the dump, '>' is actual staging."
  say
  grep -E '^[<>]' "$DIFF_FILE" | head -30 | sed 's/^/    /'
  [ "$DIFF_COUNT" -gt 30 ] && say "    ... $((DIFF_COUNT - 30)) more; full list in ${DIFF_FILE}"
  say
  say "  full diff: ${DIFF_FILE}  (mode 0600)"
fi
say
say
say "  SCOPE EXCLUSIONS — outside this reconciliation by construction:"
say "    1. Database-level event triggers, including the one calling public.rls_auto_enable():"
say "       --schema=public never selected them. The FUNCTION was cloned; the TRIGGER was not."
say "    2. The 12 ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin statements: deliberately"
say "       neutralised, so default privileges for that role are NOT compared."
say "    3. auth, storage, vault, realtime and extension-managed schemas; application row data;"
say "       and production role/cluster state: intentionally never cloned."
say "    4. Any other database-level object outside the public-schema dump: out of scope."
say
say "  Nothing was written to staging: every statement was a SELECT inside BEGIN READ ONLY."
say "  reference fingerprint: ${REF_FP}"
say "  staging fingerprint  : ${STG_FP}"
say "  The verified dump has NOT been deleted: ${DUMP_FILE}"
say
[ "$DIFF_COUNT" -eq 0 ] || exit 1
