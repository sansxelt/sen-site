#!/usr/bin/env bash
# THE full ordered migration rehearsal on owner-confirmed STAGING. Final pre-production gate.
#
# RUN THIS YOURSELF. One password prompt; an assistant shell has no tty and the password must never enter
# a transcript.
#
#   usage:  bash ops/staging-full-rehearsal.sh /tmp/vraelis-schema-XXXXXXXX/prod-public-schema.sql
#
# FORWARD ORDER   P4 -> P3-C -> P3-D -> H3
# ROLLBACK ORDER  H3 -> P3-D -> P3-C -> P4     (exact reverse)
#
# P4 runs FIRST because it asserts exactly 107 tables and 8 functions, and the later migrations add 2
# tables and 3 functions. It also means every object they create inherits P4's proven secure defaults.
# P4 EXCLUSIVELY owns privilege restoration: its rollback is generated from the verified dump and runs
# LAST. H3 is reversible only within this ordered set.
#
# PRODUCTION IS NEVER TOUCHED. The production ref is refused in every connection component and staging is
# re-identified immediately before every write. Fails closed on any mismatch.
set -uo pipefail

REPO_ROOT="${RESTORE_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
[ -f "$REPO_ROOT/ops/p4-remediation-forward.sql" ] || { echo "  STOP: cannot locate the repository root ('$REPO_ROOT')."; exit 1; }

STAGING_REF='mxxhpfbazbwczrhuxasv'
PROD_REF='gvcqzovxfijvtkhetopn'
STAGING_HOST="${STAGING_POOLER_HOST:-aws-0-us-west-2.pooler.supabase.com}"
STAGING_PORT='5432'
STAGING_USER="postgres.${STAGING_REF}"
STAGING_DB='postgres'
PG_IMAGE='postgres:17-alpine'
EXPECT_TLS='TLSv1.3'
BASELINE_FACTS=5187
REF_CONTAINER="vraelis-full-ref-$$"

# The ordered set. Each entry: label|forward|rollback
FORWARD_ORDER=(
  "P4   privileges|/sql/p4-remediation-forward.sql|/sql/p4-remediation-rollback.sql"
  "P3-C expire-monthly|/sqlm/vraelis-expire-monthly-atomic.sql|/sqlm/vraelis-expire-monthly-atomic-rollback.sql"
  "P3-D payment-cap|/sqlm/vraelis-agent-payment-cap.sql|/sqlm/vraelis-agent-payment-cap-rollback.sql"
  "H3   rls-deny-by-default|/sqlm/vraelis-rls-01-deny-by-default.sql|/sqlm/vraelis-rls-01-rollback.sql"
)

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
fail()  { echo; echo "  STOP: $*"; clean; exit 1; }
trap clean EXIT INT TERM

say
say "  FULL ORDERED MIGRATION REHEARSAL - STAGING ONLY"
say "  host: ${STAGING_HOST}:${STAGING_PORT}   user: ${STAGING_USER}   ref: ${STAGING_REF}"
say "  forward:  P4 -> P3-C -> P3-D -> H3"
say "  rollback: H3 -> P3-D -> P3-C -> P4"
say

# == Phase 0: offline guards =================================================
say "  -- Phase 0: offline guards --"
for component in "$STAGING_HOST" "$STAGING_USER" "$STAGING_DB"; do
  case "$component" in *"$PROD_REF"*) fail "PRODUCTION ref '${PROD_REF}' appears in '${component}'. Permanently denied." ;; esac
done
case "$STAGING_USER" in *"$STAGING_REF"*) : ;; *) fail "user does not carry the staging ref." ;; esac
[ "$STAGING_PORT" = "5432" ] || fail "port ${STAGING_PORT} is not the session pooler port 5432."
say "    [ok] production ref absent; staging ref present; port 5432"

cd "$REPO_ROOT" || fail "cannot cd to the repository root"
GATE_URL="postgresql://${STAGING_USER}@${STAGING_HOST}:${STAGING_PORT}/${STAGING_DB}"
identify() { npx tsx scripts/db-target-identify.ts --url "$GATE_URL" --identify-only >/dev/null 2>&1; }
identify || fail "the target-identification gate refused this target."
say "    [ok] policy gate: classified STAGING"

[ -n "$DUMP_FILE" ] || fail "no dump path given."
[ -f "$DUMP_FILE" ] || fail "dump not found: ${DUMP_FILE}"
DUMP_DIR="$(cd "$(dirname "$DUMP_FILE")" && pwd)"
case "${DUMP_DIR%/}/" in "${REPO_ROOT%/}/"*) fail "the dump is INSIDE the repository."; esac
npx tsx scripts/verify-schema-dump.ts "$(host_path "$DUMP_FILE")" >/dev/null 2>&1 || fail "the dump FAILED safety verification."
npx tsx scripts/gen-p4-rollback.ts "$(host_path "$DUMP_FILE")" --check >/dev/null 2>&1 \
  || fail "ops/p4-remediation-rollback.sql does not match what the dump generates. Regenerate it first."
say "    [ok] dump verified; P4 rollback matches the dump"

# H3's rollback must NOT restore privileges - P4 owns that exclusively. Assert it, so a reverted edit
# cannot silently reintroduce the blanket grant that re-exposes the six hardened tables.
if grep -qiE '^\s*(grant|alter default privileges)' sql/vraelis-rls-01-rollback.sql; then
  fail "sql/vraelis-rls-01-rollback.sql contains privilege statements. P4 owns privilege restoration exclusively."
fi
grep -q 'proconfig is null' sql/vraelis-rls-01-deny-by-default.sql \
  || fail "H3 would overwrite existing search_path pins, which its rollback cannot undo."
say "    [ok] H3 rollback carries no privilege statements; H3 forward will not clobber existing pins"

# == Phase 1: baseline + proven expectations, offline ========================
say
say "  -- Phase 1: rebuild the frozen ${BASELINE_FACTS}-fact baseline and prove the expected end state --"
umask 077
RESTORE_FILE="${DUMP_DIR}/prod-public-schema.restore.sql"
sed -e 's|^CREATE SCHEMA public;$|-- [NEUTRALISED A] &|' \
    -e 's|^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin |-- [NEUTRALISED B] &|' \
    "$DUMP_FILE" > "$RESTORE_FILE" || fail "could not derive the restore file"
chmod 600 "$RESTORE_FILE"
[ "$(diff "$DUMP_FILE" "$RESTORE_FILE" | grep -c '^> ')" -eq 13 ] || fail "expected exactly 13 neutralised lines."

command -v docker >/dev/null 2>&1 || fail "docker not found."
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
  -c "alter schema public owner to postgres;" >/dev/null 2>&1 || fail "could not set reference ownership."
docker cp "$RESTORE_FILE" "$REF_CONTAINER":/tmp/restore.sql >/dev/null 2>&1
docker cp "$REPO_ROOT/ops/schema-fingerprint.sql" "$REF_CONTAINER":/tmp/fp.sql >/dev/null 2>&1
docker exec "$REF_CONTAINER" mkdir -p /sql /sqlm >/dev/null 2>&1
for f in p4-remediation-forward.sql p4-remediation-rollback.sql; do
  docker cp "$REPO_ROOT/ops/$f" "$REF_CONTAINER":/sql/"$f" >/dev/null 2>&1
done
for f in vraelis-expire-monthly-atomic.sql vraelis-expire-monthly-atomic-rollback.sql \
         vraelis-agent-payment-cap.sql vraelis-agent-payment-cap-rollback.sql \
         vraelis-rls-01-deny-by-default.sql vraelis-rls-01-rollback.sql; do
  docker cp "$REPO_ROOT/sql/$f" "$REF_CONTAINER":/sqlm/"$f" >/dev/null 2>&1
done
docker exec -i -e PGPASSWORD=ref "$REF_CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 --single-transaction -f /tmp/restore.sql >/dev/null 2>&1 || fail "the reference restore failed."
# The platform-managed supabase_admin defaults a real Supabase project carries, applied AS supabase_admin -
# the only role permitted to set them. Without them the P4 postcondition cannot run here.
docker exec -i "$REF_CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<'SQL' || fail "could not apply reference platform defaults."
alter default privileges for role supabase_admin in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on tables    to postgres, anon, authenticated, service_role;
SQL

refq() { docker exec -i -e PGPASSWORD=ref "$REF_CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres "$@"; }
reffp() { refq -tA -v ON_ERROR_STOP=1 -f /tmp/fp.sql 2>&1 | grep -E '^(COL|IDX|CON|RLS|POL|ACL|FUN|FACL|SEQ|TYP|TRG|DACL)\|' | sort; }

BASELINE="${DUMP_DIR}/full-baseline.txt"
reffp > "$BASELINE"; chmod 600 "$BASELINE"
[ "$(wc -l < "$BASELINE")" -eq "$BASELINE_FACTS" ] \
  || fail "baseline is $(wc -l < "$BASELINE") facts, expected ${BASELINE_FACTS}. Refusing to rehearse against a shifted baseline."
say "    [ok] baseline: $(wc -l < "$BASELINE") facts"

# Apply the whole ordered set to the reference to prove the expected end state offline.
for entry in "${FORWARD_ORDER[@]}"; do
  label="${entry%%|*}"; rest="${entry#*|}"; fwd="${rest%%|*}"
  if ! refq -v ON_ERROR_STOP=1 -f "$fwd" > /tmp/.rf.$$ 2>&1; then
    grep -iE 'error' /tmp/.rf.$$ | head -3 | sed 's/^/      /'; rm -f /tmp/.rf.$$
    fail "${label} does not apply cleanly to the reference. Fix it before touching staging."
  fi
  rm -f /tmp/.rf.$$
  say "    [ok] reference: ${label} applied"
done
EXPECTED_FWD="${DUMP_DIR}/full-expected-forward.txt"
reffp > "$EXPECTED_FWD"; chmod 600 "$EXPECTED_FWD"
[ "$(wc -l < "$EXPECTED_FWD")" -gt 3000 ] || fail "the expected end-state fingerprint has only $(wc -l < "$EXPECTED_FWD") facts."
say "    [ok] expected END STATE proven offline: $(wc -l < "$EXPECTED_FWD") facts"

# And prove the reverse order restores the baseline, offline, before staging is touched at all.
for i in 3 2 1 0; do
  entry="${FORWARD_ORDER[$i]}"; label="${entry%%|*}"; back="${entry##*|}"
  if ! refq -v ON_ERROR_STOP=1 -f "$back" > /tmp/.rb.$$ 2>&1; then
    grep -iE 'error' /tmp/.rb.$$ | head -3 | sed 's/^/      /'; rm -f /tmp/.rb.$$
    fail "${label} rollback does not apply cleanly to the reference."
  fi
  rm -f /tmp/.rb.$$
  say "    [ok] reference: ${label} rolled back"
done
REF_RESTORED="${DUMP_DIR}/full-ref-restored.txt"
reffp > "$REF_RESTORED"; chmod 600 "$REF_RESTORED"
REF_DRIFT="$(diff "$BASELINE" "$REF_RESTORED" | grep -cE '^[<>]')"
if [ "$REF_DRIFT" -ne 0 ]; then
  diff "$BASELINE" "$REF_RESTORED" | grep -E '^[<>]' | head -12 | sed 's/^/      /'
  fail "the ordered set does not round-trip on the reference: ${REF_DRIFT} differing fact(s). Staging was never touched."
fi
say "    [ok] offline round-trip proven: forward then reverse returns to ${BASELINE_FACTS} facts, 0 differing"

# == Phase 2: credentials ====================================================
say
say "  -- Phase 2: credentials --"
read -rsp '  staging DB password (input hidden): ' PGPASSWORD
echo
[ -n "$PGPASSWORD" ] || fail "empty password - refusing to continue."
export PGPASSWORD
export PGHOST="$STAGING_HOST" PGPORT="$STAGING_PORT" PGUSER="$STAGING_USER" PGDATABASE="$STAGING_DB"
export PGSSLMODE=require
say "    [ok] password accepted (presence only); PGSSLMODE=require"

pg() { docker run --rm -i -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE \
         -v "${REPO_ROOT}/ops:/sql:ro" -v "${REPO_ROOT}/sql:/sqlm:ro" "$PG_IMAGE" psql "$@"; }
fingerprint() {
  local out="${DUMP_DIR}/full-$1.txt"
  pg -q -tA -v ON_ERROR_STOP=1 -c 'begin read only;' -f /sql/schema-fingerprint.sql -c 'rollback;' 2>&1 \
    | grep -E '^(COL|IDX|CON|RLS|POL|ACL|FUN|FACL|SEQ|TYP|TRG|DACL)\|' | sort > "$out"
  chmod 600 "$out"; wc -l < "$out"
}

# == Phase 3: staging must be at the frozen baseline =========================
say
say "  -- Phase 3: confirm staging is at the frozen baseline (read-only) --"
PRE="$(pg -tA -v ON_ERROR_STOP=1 <<'SQL' 2>&1
\conninfo
begin read only;
select 'K_RO='   || current_setting('transaction_read_only');
select 'K_DB='   || current_database();
select 'K_USER=' || current_user;
select 'K_SRV='  || split_part(version(), ' ', 2);
rollback;
SQL
)"
[ $? -eq 0 ] || { printf '%s\n' "$PRE" | grep -iE 'error|fatal' | head -3 | sed 's/^/      /'; unset PGPASSWORD; fail "the read-only preflight failed."; }
k() { printf '%s\n' "$PRE" | sed -n "s/^[[:space:]]*${1}=//p" | tail -1; }
TLS="$(printf '%s\n' "$PRE" | sed -n 's/.*protocol: \([A-Za-z0-9.]*\).*/\1/p' | tail -1)"
[ "$TLS" = "$EXPECT_TLS" ]    || { unset PGPASSWORD; fail "TLS is '${TLS:-none}', expected ${EXPECT_TLS}."; }
[ "$(k K_RO)"   = "on" ]       || { unset PGPASSWORD; fail "the preflight transaction is not read-only."; }
[ "$(k K_DB)"   = "postgres" ] || { unset PGPASSWORD; fail "database is '$(k K_DB)'."; }
[ "$(k K_USER)" = "postgres" ] || { unset PGPASSWORD; fail "current_user is '$(k K_USER)'."; }
say "    [ok] TLS ${TLS}; read-only confirmed server-side; server $(k K_SRV)"

N="$(fingerprint before)"
[ "$N" -eq "$BASELINE_FACTS" ] || { unset PGPASSWORD; fail "staging has ${N} facts, expected the frozen ${BASELINE_FACTS}."; }
D="$(diff "$BASELINE" "${DUMP_DIR}/full-before.txt" | grep -cE '^[<>]')"
[ "$D" -eq 0 ] || { diff "$BASELINE" "${DUMP_DIR}/full-before.txt" | grep -E '^[<>]' | head -10 | sed 's/^/      /'
                    unset PGPASSWORD; fail "staging differs from the frozen baseline by ${D} fact(s)."; }
say "    [ok] staging IS at the frozen baseline: ${N} facts, 0 differing"

# == Phase 4: forward, in order ==============================================
say
say "  -- Phase 4: forward, in order --"
FAILED_AT=""
for entry in "${FORWARD_ORDER[@]}"; do
  label="${entry%%|*}"; rest="${entry#*|}"; fwd="${rest%%|*}"
  identify || { unset PGPASSWORD; fail "the gate refused this target immediately before writing ${label}."; }
  LOG="${DUMP_DIR}/full-fwd-$(echo "$label" | tr -c 'A-Za-z0-9' '-')-$(date -u +%H%M%S).log"
  : > "$LOG"; chmod 600 "$LOG"
  pg -v ON_ERROR_STOP=1 -f "$fwd" >> "$LOG" 2>&1
  st=$?
  if [ "$st" -ne 0 ]; then
    grep -iE 'error' "$LOG" | head -4 | sed 's/^/      /'
    FAILED_AT="$label"
    say "    [FAIL] ${label} failed (exit ${st})"
    break
  fi
  say "    [ok] ${label} applied  ($(grep -c 'NOTICE' "$LOG") notices, log $(basename "$LOG"))"
done

if [ -n "$FAILED_AT" ]; then
  say
  say "  Forward stopped at ${FAILED_AT}. Rolling back everything already applied, in reverse."
fi

AFTER_FWD="$(fingerprint after-forward)"
say "    post-forward fingerprint: ${AFTER_FWD} facts"
FWD_DRIFT=1
if [ -z "$FAILED_AT" ]; then
  FWD_DRIFT="$(diff "$EXPECTED_FWD" "${DUMP_DIR}/full-after-forward.txt" | grep -cE '^[<>]')"
  if [ "$FWD_DRIFT" -eq 0 ]; then
    say "    [ok] end state matches the offline-proven expectation exactly: 0 differing facts"
  else
    diff "$EXPECTED_FWD" "${DUMP_DIR}/full-after-forward.txt" | grep -E '^[<>]' | head -12 | sed 's/^/      /'
    say "    [FAIL] end state differs from the proven expectation by ${FWD_DRIFT} fact(s)"
  fi
fi

# == Phase 5: security + application smoke ===================================
VER_FAILS=1; VER_PASSES=0; RESIDUE="?"
if [ -z "$FAILED_AT" ]; then
  say
  say "  -- Phase 5: security and application smoke (synthetic data rolled back) --"
  VER_LOG="${DUMP_DIR}/full-verify.log"
  pg -v ON_ERROR_STOP=1 -f /sql/staging-full-verify.sql > "$VER_LOG" 2>&1
  chmod 600 "$VER_LOG"
  grep -oE 'V\|(PASS|FAIL)\|.*' "$VER_LOG" | sed 's/^V|PASS|/      [PASS] /; s/^V|FAIL|/      [FAIL] /'
  VER_FAILS="$(grep -c 'V|FAIL|' "$VER_LOG")"
  VER_PASSES="$(grep -c 'V|PASS|' "$VER_LOG")"
  say "      -> ${VER_PASSES} passed, ${VER_FAILS} failed"
  RESIDUE="$(pg -tA -v ON_ERROR_STOP=1 -c "select (select count(*) from public.v_preflight_runs where user_id like 'p4-rehearsal%') + (select count(*) from public.v_applications where user_id like 'p4-rehearsal%');" 2>&1 | tail -1)"
  say "      synthetic residue: ${RESIDUE}"
fi

# == Phase 6: rollback, exact reverse ========================================
say
say "  -- Phase 6: rollback, exact reverse order --"
for i in 3 2 1 0; do
  entry="${FORWARD_ORDER[$i]}"; label="${entry%%|*}"; back="${entry##*|}"
  identify || { unset PGPASSWORD; fail "the gate refused this target immediately before rolling back ${label}."; }
  LOG="${DUMP_DIR}/full-back-$(echo "$label" | tr -c 'A-Za-z0-9' '-')-$(date -u +%H%M%S).log"
  : > "$LOG"; chmod 600 "$LOG"
  pg -v ON_ERROR_STOP=1 -f "$back" >> "$LOG" 2>&1
  st=$?
  if [ "$st" -ne 0 ]; then
    grep -iE 'error' "$LOG" | head -4 | sed 's/^/      /'
    unset PGPASSWORD
    fail "${label} ROLLBACK failed (exit ${st}). Staging is part-way - investigate before anything else."
  fi
  say "    [ok] ${label} rolled back"
done

AFTER_BACK="$(fingerprint after-rollback)"
unset PGPASSWORD
say "    [ok] PGPASSWORD unset"
RESTORE_DRIFT="$(diff "$BASELINE" "${DUMP_DIR}/full-after-rollback.txt" | grep -cE '^[<>]')"

# == Phase 7: verdict ========================================================
say
say "  ============== FULL REHEARSAL RESULT =============="
printf '    %-40s %s\n' "baseline (frozen)"        "${BASELINE_FACTS} facts"
printf '    %-40s %s\n' "staging before"           "${N} facts, 0 differing"
printf '    %-40s %s\n' "forward"                  "$([ -z "$FAILED_AT" ] && echo 'all 4 applied' || echo "STOPPED at ${FAILED_AT}")"
printf '    %-40s %s\n' "end state"                "${AFTER_FWD} facts, ${FWD_DRIFT} differing from proven expectation"
printf '    %-40s %s\n' "security + app smoke"     "${VER_PASSES} passed / ${VER_FAILS} failed"
printf '    %-40s %s\n' "synthetic residue"        "${RESIDUE}"
printf '    %-40s %s\n' "after rollback"           "${AFTER_BACK} facts, ${RESTORE_DRIFT} differing"
say
if [ -n "$FAILED_AT" ]; then
  fail "forward stopped at ${FAILED_AT}; staging was rolled back. Nothing is left applied."
fi
if [ "$RESTORE_DRIFT" -ne 0 ]; then
  diff "$BASELINE" "${DUMP_DIR}/full-after-rollback.txt" | grep -E '^[<>]' | head -15 | sed 's/^/      /'
  fail "staging did NOT return to the frozen baseline: ${RESTORE_DRIFT} differing fact(s)."
fi
if [ "$VER_FAILS" -ne 0 ] || [ "$FWD_DRIFT" -ne 0 ] || [ "$RESIDUE" != "0" ]; then
  fail "the rollback restored the baseline, but forward verification did not fully pass. Do not proceed."
fi
say "    FULL REHEARSAL PASSED"
say "      P4 -> P3-C -> P3-D -> H3 applied in order, every security and smoke check passed,"
say "      the reverse rollback restored the frozen ${BASELINE_FACTS}-fact baseline exactly, and no"
say "      synthetic data remains. P4 owns privilege restoration; H3 is reversible only in this set."
say
say "  Production has NOT been touched. Nothing pushed, merged or deployed."
say
