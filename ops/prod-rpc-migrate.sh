#!/usr/bin/env bash
# PRODUCTION migration of the two follow-up RPCs.  THIS WRITES TO PRODUCTION.
#
# RUN THIS YOURSELF. One password prompt; an assistant shell has no tty and the password must never enter
# a transcript.
#
#   usage:  bash ops/prod-rpc-migrate.sh <dump.sql> --forward     apply  R1 -> R2
#           bash ops/prod-rpc-migrate.sh <dump.sql> --rollback    revert R2 -> R1
#           bash ops/prod-rpc-migrate.sh <dump.sql> --verify      read-only, writes nothing
#
# It refuses to run unless the mode is stated explicitly. There is no default.
#
# These two add v_hold_credits and v_bind_oauth_identity - RPCs the application already calls and
# production does not have, so those paths return 503 today. The four earlier migrations are ALREADY
# APPLIED; this script does not touch them.
#
# It starts from 3584 facts (production's state after that set) and ends at 3616. Rehearsed on staging on
# top of the same 3584-fact state, with the reverse rollback restoring it exactly.
set -uo pipefail

REPO_ROOT="${RESTORE_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
[ -f "$REPO_ROOT/ops/p4-remediation-forward.sql" ] || { echo "  STOP: cannot locate the repository root."; exit 1; }

PROD_REF='gvcqzovxfijvtkhetopn'
STAGING_REF='mxxhpfbazbwczrhuxasv'
PROD_HOST="${PROD_POOLER_HOST:-aws-1-us-east-2.pooler.supabase.com}"
PROD_PORT='5432'
PROD_USER="postgres.${PROD_REF}"
PROD_DB='postgres'
PG_IMAGE='postgres:17-alpine'
EXPECT_TLS='TLSv1.3'
BASELINE_FACTS=3584   # production AFTER the four already applied
EXPECT_AFTER=3616     # and after these two

ORDER=(
  "R1 credit-hold-atomic|/sqlm/vraelis-credit-hold-atomic.sql|/sqlm/vraelis-credit-hold-atomic-rollback.sql"
  "R2 oauth-identity-binding|/sqlm/vraelis-oauth-identity-binding.sql|/sqlm/vraelis-oauth-identity-binding-rollback.sql"
)

DUMP_FILE="${1:-}"; MODE="${2:-}"
if [ -n "$DUMP_FILE" ] && [ -f "$DUMP_FILE" ]; then
  DUMP_FILE="$(cd "$(dirname "$DUMP_FILE")" && pwd)/$(basename "$DUMP_FILE")"
fi
case "$MODE" in
  --forward|--rollback|--verify) : ;;
  *) echo "  STOP: state the mode explicitly - --forward, --rollback or --verify."; exit 2 ;;
esac

host_path() {
  local p="$1" npx_bin; npx_bin="$(command -v npx 2>/dev/null || true)"
  case "$npx_bin" in /mnt/*) if command -v wslpath >/dev/null 2>&1; then wslpath -w "$p" 2>/dev/null && return 0; fi ;; esac
  printf '%s' "$p"
}
say()  { echo "$@"; }
fail() { echo; echo "  STOP: $*"; exit 1; }

say
say "  ############################################################"
say "  #  PRODUCTION  -  mode: ${MODE}"
say "  ############################################################"
say "  host: ${PROD_HOST}:${PROD_PORT}   user: ${PROD_USER}   ref: ${PROD_REF}"
[ "$MODE" = "--forward" ]  && say "  order: R1 -> R2   (the four earlier migrations are already applied and are NOT touched)"
[ "$MODE" = "--rollback" ] && say "  order: R2 -> R1   (drops the two functions and the identity table)"
say

# == Phase 0: identity. This script REQUIRES production and refuses staging. ==
say "  -- Phase 0: identity --"
case "$PROD_USER" in *"$STAGING_REF"*) fail "the STAGING ref appears in the username. This script is for PRODUCTION." ;; esac
case "$PROD_HOST" in *"$STAGING_REF"*) fail "the STAGING ref appears in the host." ;; esac
case "$PROD_USER" in *"$PROD_REF"*) : ;; *) fail "user '${PROD_USER}' does not carry the production ref."; esac
[ "$PROD_PORT" = "5432" ] || fail "port ${PROD_PORT} is not the session pooler port 5432."
cd "$REPO_ROOT" || fail "cannot cd to the repository root"
GATE_URL="postgresql://${PROD_USER}@${PROD_HOST}:${PROD_PORT}/${PROD_DB}"
IDENT="$(npx tsx scripts/db-target-identify.ts --url "$GATE_URL" --identify-only 2>&1)"
printf '%s\n' "$IDENT" | grep -q 'PRODUCTION' || { printf '%s\n' "$IDENT" | tail -8 | sed 's/^/      /'; fail "the target was not classified PRODUCTION."; }
say "    [ok] classified PRODUCTION (the identify script refuses it by design - that refusal is the confirmation)"

[ -n "$DUMP_FILE" ] || fail "no dump path given."
[ -f "$DUMP_FILE" ] || fail "dump not found: ${DUMP_FILE}"
DUMP_DIR="$(cd "$(dirname "$DUMP_FILE")" && pwd)"
npx tsx scripts/verify-schema-dump.ts "$(host_path "$DUMP_FILE")" >/dev/null 2>&1 || fail "the dump FAILED verification."
npx tsx scripts/gen-p4-rollback.ts "$(host_path "$DUMP_FILE")" --check >/dev/null 2>&1 \
  || fail "the P4 rollback does not match the dump. Regenerate before touching production."
grep -qiE '^\s*(grant|alter default privileges)' sql/vraelis-rls-01-rollback.sql \
  && fail "H3's rollback contains privilege statements. P4 owns privilege restoration exclusively."
say "    [ok] dump verified; P4 rollback matches it; H3 rollback carries no privilege statements"

# == Phase 1: credentials ====================================================
say
say "  -- Phase 1: credentials --"
read -rsp '  PRODUCTION DB password (input hidden): ' PGPASSWORD
echo
[ -n "$PGPASSWORD" ] || fail "empty password - refusing to continue."
export PGPASSWORD
export PGHOST="$PROD_HOST" PGPORT="$PROD_PORT" PGUSER="$PROD_USER" PGDATABASE="$PROD_DB"
export PGSSLMODE=require
say "    [ok] password accepted (presence only); PGSSLMODE=require"

pg() { docker run --rm -i -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE \
         -v "${REPO_ROOT}/ops:/sql:ro" -v "${REPO_ROOT}/sql:/sqlm:ro" "$PG_IMAGE" psql "$@"; }
fingerprint() {
  local out="${DUMP_DIR}/prodrpc-$1.txt"
  pg -q -tA -v ON_ERROR_STOP=1 -c 'begin read only;' -f /sql/schema-fingerprint.sql -c 'rollback;' 2>&1 \
    | grep -E '^(COL|IDX|CON|RLS|POL|ACL|FUN|FACL|SEQ|TYP|TRG|DACL)\|' | sort > "$out"
  chmod 600 "$out"; wc -l < "$out"
}

# == Phase 2: link and read-only sanity ======================================
say
say "  -- Phase 2: link --"
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
[ $? -eq 0 ] || { printf '%s\n' "$PRE" | grep -iE 'error|fatal' | head -3 | sed 's/^/      /'; unset PGPASSWORD; fail "could not read production."; }
k() { printf '%s\n' "$PRE" | sed -n "s/^[[:space:]]*${1}=//p" | tail -1; }
TLS="$(printf '%s\n' "$PRE" | sed -n 's/.*protocol: \([A-Za-z0-9.]*\).*/\1/p' | tail -1)"
[ "$TLS" = "$EXPECT_TLS" ]    || { unset PGPASSWORD; fail "TLS is '${TLS:-none}', expected ${EXPECT_TLS}."; }
[ "$(k K_DB)"   = "postgres" ] || { unset PGPASSWORD; fail "database is '$(k K_DB)'."; }
[ "$(k K_USER)" = "postgres" ] || { unset PGPASSWORD; fail "current_user is '$(k K_USER)'."; }
say "    [ok] TLS ${TLS}; database $(k K_DB); user $(k K_USER); server $(k K_SRV)"

# == --verify: read-only, writes nothing =====================================
if [ "$MODE" = "--verify" ]; then
  say
  say "  -- Verification (read-only) --"
  VLOG="${DUMP_DIR}/prodrpc-verify-$(date -u +%Y%m%dT%H%M%SZ).log"
  pg -v ON_ERROR_STOP=1 -f /sql/prod-rpc-verify.sql > "$VLOG" 2>&1
  chmod 600 "$VLOG"
  grep -oE 'V\|(PASS|FAIL)\|.*' "$VLOG" | sed 's/^V|PASS|/      [PASS] /; s/^V|FAIL|/      [FAIL] /'
  F="$(grep -c 'V|FAIL|' "$VLOG")"; P="$(grep -c 'V|PASS|' "$VLOG")"
  N="$(fingerprint verify-fingerprint)"
  unset PGPASSWORD
  say
  say "      ${P} passed, ${F} failed   |   fingerprint: ${N} facts"
  say "      log: ${VLOG}"
  say
  [ "$F" -eq 0 ] || fail "verification found ${F} failure(s)."
  say "  VERIFICATION PASSED. Nothing was written."
  say
  exit 0
fi

# == Phase 3: pre-write state ================================================
say
say "  -- Phase 3: record the pre-write state --"
BEFORE="$(fingerprint before-${MODE#--})"
say "    [ok] fingerprint before: ${BEFORE} facts"
if [ "$MODE" = "--forward" ] && [ "$BEFORE" -ne "$BASELINE_FACTS" ]; then
  unset PGPASSWORD
  fail "production is at ${BEFORE} facts, not the verified ${BASELINE_FACTS}. It has drifted since the dump. Re-run ops/prod-acl-fingerprint-gate.sh and re-plan; do NOT migrate a target whose starting state is unknown."
fi

# == Phase 4: apply ==========================================================
say
say "  -- Phase 4: ${MODE#--} --"
if [ "$MODE" = "--forward" ]; then IDX="0 1"; else IDX="1 0"; fi
for i in $IDX; do
  entry="${ORDER[$i]}"; label="${entry%%|*}"; rest="${entry#*|}"
  if [ "$MODE" = "--forward" ]; then file="${rest%%|*}"; else file="${entry##*|}"; fi
  # Captured, then matched - NOT piped. The identify script exits 3 on production BY DESIGN, and under
  # `set -o pipefail` a pipeline inherits that 3 even when grep succeeds, so the piped form reported
  # 'the target stopped classifying as PRODUCTION' about a target that had classified perfectly.
  # Phase 0 already captured-then-matched; this is the same shape.
  IDENT_LOOP="$(npx tsx scripts/db-target-identify.ts --url "$GATE_URL" --identify-only 2>&1)"
  if ! printf "%s
" "$IDENT_LOOP" | grep -q "PRODUCTION"; then
    printf "%s
" "$IDENT_LOOP" | tail -6 | sed "s/^/      /"
    unset PGPASSWORD
    fail "the target stopped classifying as PRODUCTION immediately before ${label}."
  fi
  LOG="${DUMP_DIR}/prodrpc-${MODE#--}-$(echo "$label" | tr -c 'A-Za-z0-9' '-')-$(date -u +%H%M%S).log"
  : > "$LOG"; chmod 600 "$LOG"
  pg -v ON_ERROR_STOP=1 -f "$file" >> "$LOG" 2>&1
  st=$?
  if [ "$st" -ne 0 ]; then
    grep -iE 'error' "$LOG" | head -5 | sed 's/^/      /'
    unset PGPASSWORD
    say
    say "    [FAIL] ${label} failed (exit ${st}). Each migration is its own transaction, so ${label} itself"
    say "           applied nothing - but anything BEFORE it in this run is committed."
    say
    say "    ROLL BACK NOW:  bash ops/prod-rpc-migrate.sh ${DUMP_FILE} --rollback"
    exit "$st"
  fi
  say "    [ok] ${label}"
done

AFTER="$(fingerprint after-${MODE#--})"
say "    [ok] fingerprint after: ${AFTER} facts"

# == Phase 5: verify =========================================================
say
say "  -- Phase 5: verification --"
VLOG="${DUMP_DIR}/prodrpc-${MODE#--}-verify-$(date -u +%Y%m%dT%H%M%SZ).log"
if [ "$MODE" = "--forward" ]; then
  pg -v ON_ERROR_STOP=1 -f /sql/prod-rpc-verify.sql > "$VLOG" 2>&1
  chmod 600 "$VLOG"
  grep -oE 'V\|(PASS|FAIL)\|.*' "$VLOG" | sed 's/^V|PASS|/      [PASS] /; s/^V|FAIL|/      [FAIL] /'
  F="$(grep -c 'V|FAIL|' "$VLOG")"; P="$(grep -c 'V|PASS|' "$VLOG")"
  unset PGPASSWORD
  say "      ${P} passed, ${F} failed"
  say
  if [ "$F" -ne 0 ]; then
    say "  MIGRATION APPLIED BUT VERIFICATION FAILED."
    say "  ROLL BACK NOW:  bash ops/prod-rpc-migrate.sh ${DUMP_FILE} --rollback"
    exit 1
  fi
  say "  FORWARD COMPLETE - ${BEFORE} -> ${AFTER} facts (expected ${EXPECT_AFTER}), ${P} checks passed."
  say "  Deploy the application only after this point, and keep the rollback command to hand:"
  say "      bash ops/prod-rpc-migrate.sh ${DUMP_FILE} --rollback"
else
  D=0
  if [ -f "${DUMP_DIR}/prodrpc-acl-expected.txt" ]; then
    D="$(diff "${DUMP_DIR}/prodrpc-acl-expected.txt" "${DUMP_DIR}/prodrpc-after-rollback.txt" | grep -cE '^[<>]')"
  fi
  unset PGPASSWORD
  say "      restored to ${AFTER} facts; ${D} differing from the dump-derived expectation"
  say
  if [ "$AFTER" -ne "$BASELINE_FACTS" ] || [ "$D" -ne 0 ]; then
    say "  ROLLBACK DID NOT FULLY RESTORE. Investigate before anything else touches this database."
    exit 1
  fi
  say "  ROLLBACK COMPLETE - production is back at the verified ${BASELINE_FACTS}-fact state."
fi
say
