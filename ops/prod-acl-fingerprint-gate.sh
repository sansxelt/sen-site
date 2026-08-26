#!/usr/bin/env bash
# Read-only PRODUCTION ACL fingerprint gate.
#
# This is the ONLY script in this repository that deliberately connects to production, and it is
# read-only: every statement is a SELECT inside BEGIN READ ONLY, against catalog metadata only. It reads
# no application rows, performs no DDL or DML, and executes no remediation or migration.
#
# Its job is to answer one question before any eventual production change is even considered:
#   does production's public schema still match the verified dump it was taken from, or has it drifted?
#
# RUN THIS YOURSELF. It prompts for a password; an assistant shell has no tty, and the password must
# never enter a transcript.
#
#   usage:  bash ops/prod-acl-fingerprint-gate.sh /tmp/vraelis-schema-XXXXXXXX/prod-public-schema.sql
set -uo pipefail

REPO_ROOT="${RESTORE_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
if [ ! -f "$REPO_ROOT/ops/schema-fingerprint.sql" ]; then
  echo "  STOP: cannot locate the repository root (looked in '$REPO_ROOT')."; exit 1
fi

# -- Targets. This script INVERTS the usual polarity: production is the intended target, and anything
#    that is not provably production is refused. Staging is refused too - pointing this at staging would
#    silently answer a question nobody asked.
PROD_REF='gvcqzovxfijvtkhetopn'
STAGING_REF='mxxhpfbazbwczrhuxasv'
PROD_HOST="${PROD_POOLER_HOST:-aws-1-us-east-2.pooler.supabase.com}"
PROD_PORT='5432'
PROD_USER="postgres.${PROD_REF}"
PROD_DB='postgres'
PG_IMAGE='postgres:17-alpine'
EXPECT_TLS='TLSv1.3'
REF_CONTAINER="vraelis-prod-acl-ref-$$"

DUMP_FILE="${1:-}"
if [ -n "$DUMP_FILE" ] && [ -f "$DUMP_FILE" ]; then
  DUMP_FILE="$(cd "$(dirname "$DUMP_FILE")" && pwd)/$(basename "$DUMP_FILE")"
fi

host_path() {
  local p="$1" npx_bin; npx_bin="$(command -v npx 2>/dev/null || true)"
  case "$npx_bin" in /mnt/*) if command -v wslpath >/dev/null 2>&1; then wslpath -w "$p" 2>/dev/null && return 0; fi ;; esac
  printf '%s' "$p"
}
say()   { echo "$@"; }
clean() { docker rm -f "$REF_CONTAINER" >/dev/null 2>&1; }
fail()  { echo; echo "  STOP: $*"; echo "  Production was NOT modified. No remediation was executed."; clean; exit 1; }
trap clean EXIT INT TERM

say
say "  Production ACL fingerprint gate - READ-ONLY"
say "  host: ${PROD_HOST}:${PROD_PORT}   user: ${PROD_USER}   ref: ${PROD_REF}  (PRODUCTION, deliberately)"
say

# == Phase 0: identity guards ================================================
say "  -- Phase 0: identity guards --"
case "$PROD_USER" in
  *"$STAGING_REF"*) fail "the STAGING ref '${STAGING_REF}' appears in the username. This gate reads PRODUCTION only." ;;
esac
case "$PROD_HOST" in
  *"$STAGING_REF"*) fail "the STAGING ref appears in the host. Refusing." ;;
esac
case "$PROD_USER" in
  *"$PROD_REF"*) : ;;
  *) fail "user '${PROD_USER}' does not carry the production ref '${PROD_REF}'. This gate refuses any target it cannot prove is production." ;;
esac
if [ "$PROD_PORT" != "5432" ]; then fail "port ${PROD_PORT} is not the session pooler port 5432."; fi
say "    [ok] production ref present; staging ref absent; port 5432"

# The shared identify script classifies this target as PRODUCTION and exits nonzero by design - that
# refusal is what we want to SEE here, as positive confirmation of which project this is.
cd "$REPO_ROOT" || fail "cannot cd to the repository root"
GATE_URL="postgresql://${PROD_USER}@${PROD_HOST}:${PROD_PORT}/${PROD_DB}"
IDENT="$(npx tsx scripts/db-target-identify.ts --url "$GATE_URL" --identify-only 2>&1)"
IDENT_STATUS=$?
printf '%s\n' "$IDENT" | sed -n '/TARGET IDENTIFICATION/,/^$/p' | sed 's/^/    /'
if ! printf '%s\n' "$IDENT" | grep -q 'PRODUCTION'; then
  fail "the identify gate did not classify this target as PRODUCTION (exit ${IDENT_STATUS}). Refusing."
fi
say "    [ok] independently classified PRODUCTION (the identify script refuses it, exit ${IDENT_STATUS} - expected here)"

# == Phase 1: the expected fingerprint, built offline from the verified dump ==
say
say "  -- Phase 1: expected fingerprint, from the verified dump (offline) --"
[ -n "$DUMP_FILE" ] || fail "no dump path given."
[ -f "$DUMP_FILE" ] || fail "dump not found: ${DUMP_FILE}"
DUMP_DIR="$(cd "$(dirname "$DUMP_FILE")" && pwd)"
case "${DUMP_DIR%/}/" in "${REPO_ROOT%/}/"*) fail "the dump is INSIDE the repository."; esac
npx tsx scripts/verify-schema-dump.ts "$(host_path "$DUMP_FILE")" >/dev/null 2>&1 \
  || fail "the dump FAILED safety verification. Refusing to compare against it."
say "    [ok] dump verified"

umask 077
RESTORE_FILE="${DUMP_DIR}/prod-public-schema.restore.sql"
sed -e 's|^CREATE SCHEMA public;$|-- [NEUTRALISED A] &|' \
    -e 's|^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin |-- [NEUTRALISED B] &|' \
    "$DUMP_FILE" > "$RESTORE_FILE" || fail "could not derive the restore file"
chmod 600 "$RESTORE_FILE"
[ "$(diff "$DUMP_FILE" "$RESTORE_FILE" | grep -c '^> ')" -eq 13 ] || fail "expected exactly 13 neutralised lines."

command -v docker >/dev/null 2>&1 || fail "docker not found; needed to build the reference."
docker run -d --name "$REF_CONTAINER" -e POSTGRES_PASSWORD=ref -e POSTGRES_USER=supabase_admin "$PG_IMAGE" >/dev/null 2>&1 \
  || fail "could not start the reference container."
ok=0
for _ in $(seq 1 90); do
  if docker exec "$REF_CONTAINER" psql -U supabase_admin -tAc "select 1" >/dev/null 2>&1; then
    ok=$((ok+1)); [ "$ok" -ge 3 ] && break
  else ok=0; fi
  sleep 1
done
[ "$ok" -ge 3 ] || fail "the reference container never became ready."
docker exec -i "$REF_CONTAINER" psql -U supabase_admin -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<'SQL' || fail "could not create reference roles."
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role postgres login createrole createdb password 'ref';
grant anon, authenticated, service_role to postgres with admin option;
SQL
docker exec -i "$REF_CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q \
  -c "alter schema public owner to postgres;" >/dev/null 2>&1 || fail "could not set reference schema ownership."
docker cp "$RESTORE_FILE" "$REF_CONTAINER":/tmp/restore.sql >/dev/null 2>&1
docker cp "$REPO_ROOT/ops/schema-fingerprint.sql" "$REF_CONTAINER":/tmp/fp.sql >/dev/null 2>&1
docker exec -i -e PGPASSWORD=ref "$REF_CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 --single-transaction -f /tmp/restore.sql >/dev/null 2>&1 \
  || fail "the reference restore failed - the dump does not apply cleanly even locally."
EXPECTED="${DUMP_DIR}/prod-acl-expected.txt"
docker exec -i -e PGPASSWORD=ref "$REF_CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres \
  -tA -v ON_ERROR_STOP=1 -f /tmp/fp.sql 2>&1 | sort > "$EXPECTED"
chmod 600 "$EXPECTED"
grep -q '^ERROR' "$EXPECTED" && { head -3 "$EXPECTED" | sed 's/^/      /'; fail "the expected fingerprint contains errors."; }
[ "$(wc -l < "$EXPECTED")" -gt 3000 ] || fail "the expected fingerprint has only $(wc -l < "$EXPECTED") facts - refusing to compare against an empty baseline."
say "    [ok] expected fingerprint built: $(wc -l < "$EXPECTED") facts"

# == Phase 2: the live read, against production ==============================
say
say "  -- Phase 2: read production (BEGIN READ ONLY; every statement a SELECT) --"
read -rsp '  PRODUCTION DB password (input hidden): ' PGPASSWORD
echo
[ -n "$PGPASSWORD" ] || fail "empty password - refusing to continue."
export PGPASSWORD
export PGHOST="$PROD_HOST" PGPORT="$PROD_PORT" PGUSER="$PROD_USER" PGDATABASE="$PROD_DB"
export PGSSLMODE=require
say "    [ok] password accepted (presence only; never printed, measured or persisted)"
say "    [ok] PGSSLMODE=require"

WRAPPED="${DUMP_DIR}/.prod-fp-wrapped.sql"
{ echo "begin read only;"
  echo "select 'RO|' || current_setting('transaction_read_only');"
  echo "select 'SRV|' || split_part(version(), ' ', 2);"
  cat "$REPO_ROOT/ops/schema-fingerprint.sql"
  echo "rollback;"
} > "$WRAPPED"
chmod 600 "$WRAPPED"

RAW="${DUMP_DIR}/.prod-fp.raw"
docker run --rm -i -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE \
  -v "${DUMP_DIR}:/work" "$PG_IMAGE" \
  psql -q -tA -v ON_ERROR_STOP=1 -c '\conninfo' -f /work/.prod-fp-wrapped.sql > "$RAW" 2>&1
STATUS=$?
unset PGPASSWORD
say "    [ok] PGPASSWORD unset"
rm -f "$WRAPPED"

if [ "$STATUS" -ne 0 ]; then
  grep -iE 'error|fatal|could not' "$RAW" | head -3 | sed 's/^/      /'
  rm -f "$RAW"; fail "the read-only production query failed (exit ${STATUS})."
fi

TLS="$(sed -n 's/.*protocol: \([A-Za-z0-9.]*\).*/\1/p' "$RAW" | tail -1)"
[ -n "$TLS" ] || { rm -f "$RAW"; fail "no SSL protocol reported - the link may not be encrypted."; }
[ "$TLS" = "$EXPECT_TLS" ] || { rm -f "$RAW"; fail "TLS is ${TLS}, expected ${EXPECT_TLS}."; }
say "    [ok] TLS ${TLS} (client link, from conninfo)"
grep -q '^RO|on$' "$RAW" || { rm -f "$RAW"; fail "production did not confirm transaction_read_only = on. Refusing."; }
say "    [ok] server-side read-only confirmed: transaction_read_only = on"
say "    [ok] server PostgreSQL $(sed -n 's/^SRV|//p' "$RAW" | tail -1)"

KINDS='^(COL|IDX|CON|RLS|POL|ACL|FUN|FACL|SEQ|TYP|TRG|DACL)\|'
ACTUAL="${DUMP_DIR}/prod-acl-actual.txt"
grep -E "$KINDS" "$RAW" | sort > "$ACTUAL"; chmod 600 "$ACTUAL"; rm -f "$RAW"
[ "$(wc -l < "$ACTUAL")" -gt 3000 ] || fail "production returned only $(wc -l < "$ACTUAL") facts - refusing to compare against an empty read."
say "    [ok] production fingerprinted: $(wc -l < "$ACTUAL") facts"

# == Phase 3: compare. Refuse on ANY drift. ==================================
say
say "  -- Phase 3: compare against the dump-derived expectation --"
DIFF_FILE="${DUMP_DIR}/prod-acl-drift.txt"
diff "$EXPECTED" "$ACTUAL" > "$DIFF_FILE" 2>&1
DRIFT="$(grep -cE '^[<>]' "$DIFF_FILE")"
chmod 600 "$DIFF_FILE"

printf '    %-8s %10s %10s\n' KIND EXPECTED ACTUAL
for kind in COL IDX CON RLS POL ACL FUN FACL SEQ TYP TRG DACL; do
  a="$(grep -c "^${kind}|" "$EXPECTED")"; b="$(grep -c "^${kind}|" "$ACTUAL")"
  if [ "$a" = "$b" ]; then printf '    %-8s %10s %10s   ok\n' "$kind" "$a" "$b"
  else printf '    %-8s %10s %10s   <-- DIFFERS\n' "$kind" "$a" "$b"; fi
done
say

if [ "$DRIFT" -eq 0 ]; then
  rm -f "$DIFF_FILE"
  say "  MATCH - production still matches the verified dump, fact for fact ($(wc -l < "$EXPECTED") facts)."
  say "  The expected-state precondition for the P4-A/P4-B migration is SATISFIED."
else
  # Identifiers and privilege names only. No credentials, no ACL values beyond privilege type.
  say "  DRIFT - ${DRIFT} differing fact(s). Production has changed since the dump was taken."
  say "  The P4-A/P4-B migration MUST NOT be run against production in this state:"
  say "  its rollback is generated from the dump, so it would restore a state production no longer has."
  say
  grep -E '^[<>]' "$DIFF_FILE" | head -20 | cut -c1-110 | sed 's/^/    /'
  [ "$DRIFT" -gt 20 ] && say "    ... $((DRIFT - 20)) more; full list in ${DIFF_FILE} (mode 0600)"
fi

say
say "  Production was READ ONLY: every statement a SELECT inside BEGIN READ ONLY, catalog metadata only."
say "  No DDL, no DML, no application rows read, no remediation and no migration executed."
say "  expected: ${EXPECTED}"
say "  actual  : ${ACTUAL}"
say
[ "$DRIFT" -eq 0 ] || exit 1
