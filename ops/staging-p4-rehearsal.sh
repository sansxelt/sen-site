#!/usr/bin/env bash
# P4-A/P4-B rehearsal on owner-confirmed STAGING. Forward, verify, roll back, prove restoration.
#
# RUN THIS YOURSELF. It prompts once for the staging password; an assistant shell has no tty, and the
# password must never enter a transcript.
#
#   usage:  bash ops/staging-p4-rehearsal.sh /tmp/vraelis-schema-XXXXXXXX/prod-public-schema.sql
#
# PRODUCTION IS NEVER TOUCHED. The production ref is refused in every connection component, and the
# staging ref is re-identified immediately before EACH of the two writes.
#
# It always attempts the rollback, including after a failed verification, so staging is not left mid-way.
set -uo pipefail

REPO_ROOT="${RESTORE_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
if [ ! -f "$REPO_ROOT/ops/p4-remediation-forward.sql" ]; then
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
BASELINE_FACTS=5187
REF_CONTAINER="vraelis-p4-ref-$$"

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
say "  P4-A/P4-B rehearsal - STAGING ONLY"
say "  host: ${STAGING_HOST}:${STAGING_PORT}   user: ${STAGING_USER}   ref: ${STAGING_REF}"
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
npx tsx scripts/verify-schema-dump.ts "$(host_path "$DUMP_FILE")" >/dev/null 2>&1 \
  || fail "the dump FAILED safety verification."
say "    [ok] dump verified"

# The rollback must be exactly what the dump generates, or restoration is not provable.
npx tsx scripts/gen-p4-rollback.ts "$(host_path "$DUMP_FILE")" --check >/dev/null 2>&1 \
  || fail "ops/p4-remediation-rollback.sql does not match what the dump generates. Regenerate it first."
say "    [ok] rollback file matches the dump (gen-p4-rollback --check)"

# == Phase 1: the frozen baseline, rebuilt offline from the dump ==============
say
say "  -- Phase 1: rebuild the frozen ${BASELINE_FACTS}-fact baseline (offline) --"
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
  -c "alter schema public owner to postgres;" >/dev/null 2>&1 || fail "could not set reference schema ownership."
docker cp "$RESTORE_FILE" "$REF_CONTAINER":/tmp/restore.sql >/dev/null 2>&1
docker cp "$REPO_ROOT/ops/schema-fingerprint.sql" "$REF_CONTAINER":/tmp/fp.sql >/dev/null 2>&1
docker exec -i -e PGPASSWORD=ref "$REF_CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres \
  -v ON_ERROR_STOP=1 --single-transaction -f /tmp/restore.sql >/dev/null 2>&1 \
  || fail "the reference restore failed."
# The reference is a bare restore, so it lacks the platform-managed supabase_admin default privileges
# every real Supabase project carries. Without them the corrected postcondition cannot run here, and the
# expected-forward fingerprint would be built against a shape staging does not have. Applied AS
# supabase_admin, the only role permitted to set them - the same constraint that makes them a platform
# limitation on staging rather than something this migration can remediate.
docker exec -i "$REF_CONTAINER" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -q >/dev/null 2>&1 <<'SQL' || fail "could not apply the reference supabase_admin defaults."
alter default privileges for role supabase_admin in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role supabase_admin in schema public grant all on tables    to postgres, anon, authenticated, service_role;
SQL

BASELINE="${DUMP_DIR}/p4-baseline.txt"
docker exec -i -e PGPASSWORD=ref "$REF_CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres \
  -tA -v ON_ERROR_STOP=1 -f /tmp/fp.sql 2>&1 | sort > "$BASELINE"
chmod 600 "$BASELINE"
[ "$(wc -l < "$BASELINE")" -eq "$BASELINE_FACTS" ] \
  || fail "baseline is $(wc -l < "$BASELINE") facts, expected ${BASELINE_FACTS}. Refusing to rehearse against a shifted baseline."
say "    [ok] baseline rebuilt: $(wc -l < "$BASELINE") facts"

# The expectation staging is measured against: the SAME forward migration applied to this reference,
# fingerprinted the same way. A proven expected state, not a broad zero-count assertion.
docker cp "$REPO_ROOT/ops/p4-remediation-forward.sql" "$REF_CONTAINER":/tmp/fwd.sql >/dev/null 2>&1
if ! docker exec -i -e PGPASSWORD=ref "$REF_CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 -f /tmp/fwd.sql > /tmp/.ref-fwd.$$ 2>&1; then
  grep -iE 'error' /tmp/.ref-fwd.$$ | head -3 | sed 's/^/      /'
  rm -f /tmp/.ref-fwd.$$
  fail "the forward migration does not apply cleanly to the reference. Fix it before touching staging."
fi
grep -E 'NOTICE' /tmp/.ref-fwd.$$ | sed 's/^/      reference: /'
rm -f /tmp/.ref-fwd.$$
EXPECTED_FWD="${DUMP_DIR}/p4-expected-forward.txt"
docker exec -i -e PGPASSWORD=ref "$REF_CONTAINER" psql -h 127.0.0.1 -U postgres -d postgres -tA -v ON_ERROR_STOP=1 -f /tmp/fp.sql 2>&1 | sort > "$EXPECTED_FWD"
chmod 600 "$EXPECTED_FWD"
[ "$(wc -l < "$EXPECTED_FWD")" -gt 3000 ] || fail "the expected-forward fingerprint has only $(wc -l < "$EXPECTED_FWD") facts."
say "    [ok] expected POST-FORWARD fingerprint proven offline: $(wc -l < "$EXPECTED_FWD") facts"

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
         -v "${REPO_ROOT}/ops:/sql:ro" -v "${DUMP_DIR}:/work" "$PG_IMAGE" psql "$@"; }

sa_defaults() {  # $1 = label -> supabase_admin's platform defaults IN SCHEMA PUBLIC, in full detail.
  # Scoped to public deliberately: that is this migration's blast radius. The platform also holds
  # defaults in storage, auth, realtime and others - 180 facts in total on staging - which this
  # migration neither touches nor may police.
  local out="${DUMP_DIR}/p4-sa-$1.txt"
  pg -q -tA -v ON_ERROR_STOP=1 -c 'begin read only;' -c "select 'SA|'||coalesce(n.nspname,'GLOBAL')||'|'||da.defaclobjtype::text||'|'||coalesce(r.rolname,'PUBLIC')||'|'||a.privilege_type from pg_default_acl da left join pg_namespace n on n.oid=da.defaclnamespace join pg_roles cr on cr.oid=da.defaclrole cross join lateral aclexplode(da.defaclacl) a left join pg_roles r on r.oid=a.grantee where cr.rolname='supabase_admin' and n.nspname='public' order by 1;" -c 'rollback;' 2>&1 | grep '^SA|' | sort > "$out"
  chmod 600 "$out"
  wc -l < "$out"
}

fingerprint() {  # $1 = label -> writes ${DUMP_DIR}/p4-$1.txt, echoes the fact count
  local out="${DUMP_DIR}/p4-$1.txt"
  pg -q -tA -v ON_ERROR_STOP=1 -c 'begin read only;' -f /sql/schema-fingerprint.sql -c 'rollback;' 2>&1 \
    | grep -E '^(COL|IDX|CON|RLS|POL|ACL|FUN|FACL|SEQ|TYP|TRG|DACL)\|' | sort > "$out"
  chmod 600 "$out"
  wc -l < "$out"
}

# == Phase 3: confirm staging is AT the frozen baseline before any write ======
say
say "  -- Phase 3: confirm staging matches the frozen baseline (read-only) --"
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
[ "$TLS" = "$EXPECT_TLS" ] || { unset PGPASSWORD; fail "TLS is '${TLS:-none}', expected ${EXPECT_TLS}."; }
[ "$(k K_RO)"   = "on" ]       || { unset PGPASSWORD; fail "the preflight transaction is not read-only."; }
[ "$(k K_DB)"   = "postgres" ] || { unset PGPASSWORD; fail "database is '$(k K_DB)'."; }
[ "$(k K_USER)" = "postgres" ] || { unset PGPASSWORD; fail "current_user is '$(k K_USER)'."; }
say "    [ok] TLS ${TLS}; read-only confirmed server-side; database $(k K_DB), user $(k K_USER); server $(k K_SRV)"

N="$(fingerprint before)"
say "    [ok] staging fingerprint: ${N} facts"
[ "$N" -eq "$BASELINE_FACTS" ] || { unset PGPASSWORD; fail "staging has ${N} facts, expected the frozen ${BASELINE_FACTS}."; }
D="$(diff "$BASELINE" "${DUMP_DIR}/p4-before.txt" | grep -cE '^[<>]')"
[ "$D" -eq 0 ] || {
  diff "$BASELINE" "${DUMP_DIR}/p4-before.txt" | grep -E '^[<>]' | head -10 | sed 's/^/      /'
  unset PGPASSWORD; fail "staging differs from the frozen baseline by ${D} fact(s). Refusing to rehearse."; }
say "    [ok] staging IS at the frozen baseline: 0 differing facts"
SA_BEFORE="$(sa_defaults before)"
say "    [ok] platform-managed supabase_admin defaults recorded: ${SA_BEFORE} facts (this migration does not touch them)"

# == Phase 4: forward ========================================================
say
say "  -- Phase 4: apply the forward migration --"
identify || { unset PGPASSWORD; fail "the gate refused this target on the pre-write re-check."; }
say "    [ok] staging re-identified immediately before the write"
FWD_LOG="${DUMP_DIR}/p4-forward-$(date -u +%Y%m%dT%H%M%SZ).log"
: > "$FWD_LOG"; chmod 600 "$FWD_LOG"
pg --echo-all -v ON_ERROR_STOP=1 -f /sql/p4-remediation-forward.sql >> "$FWD_LOG" 2>&1
FWD_STATUS=$?
grep -E '^(BEGIN|COMMIT|ROLLBACK|NOTICE|ERROR)|NOTICE:|ERROR:' "$FWD_LOG" | sed 's/^/      /'
if [ "$FWD_STATUS" -ne 0 ]; then
  unset PGPASSWORD
  fail "the forward migration failed (exit ${FWD_STATUS}). It ran in ONE transaction, so staging is unchanged."
fi
say "    [ok] forward applied and committed (log: ${FWD_LOG})"

AFTER_FWD="$(fingerprint after-forward)"
say "    [ok] post-forward fingerprint: ${AFTER_FWD} facts"
say
say "    expected changes vs baseline:"
diff "$BASELINE" "${DUMP_DIR}/p4-after-forward.txt" > "${DUMP_DIR}/p4-forward.diff" 2>&1 || true
chmod 600 "${DUMP_DIR}/p4-forward.diff"
printf '      %-8s %10s %10s\n' KIND BASELINE 'AFTER FWD'
for kind in COL IDX CON RLS POL ACL FUN FACL SEQ TYP TRG DACL; do
  a="$(grep -c "^${kind}|" "$BASELINE")"; b="$(grep -c "^${kind}|" "${DUMP_DIR}/p4-after-forward.txt")"
  if [ "$a" = "$b" ]; then printf '      %-8s %10s %10s\n' "$kind" "$a" "$b"
  else printf '      %-8s %10s %10s   <-- changed by %s\n' "$kind" "$a" "$b" "$((b-a))"; fi
done
say "      removed: $(grep -c '^< ' "${DUMP_DIR}/p4-forward.diff")   added: $(grep -c '^> ' "${DUMP_DIR}/p4-forward.diff")"

# The authoritative check: staging's post-forward state must equal the expectation proven offline,
# fact for fact. A broad zero-count assertion is what failed the first staging attempt - it demanded
# something the migration is not permitted to do, on a shape the fixture did not have.
FWD_DRIFT="$(diff "$EXPECTED_FWD" "${DUMP_DIR}/p4-after-forward.txt" | grep -cE '^[<>]')"
if [ "$FWD_DRIFT" -eq 0 ]; then
  say "    [ok] post-forward state matches the proven expectation exactly: 0 differing facts"
else
  diff "$EXPECTED_FWD" "${DUMP_DIR}/p4-after-forward.txt" | grep -E '^[<>]' | head -12 | sed 's/^/      /'
  say "    [FAIL] post-forward state differs from the proven expectation by ${FWD_DRIFT} fact(s)"
fi

# supabase_admin is an ACCEPTED PLATFORM LIMITATION, not something this migration remediates - so the
# requirement is that it is EXACTLY unchanged, not that it is zero.
SA_AFTER="$(sa_defaults after)"
SA_DRIFT="$(diff "${DUMP_DIR}/p4-sa-before.txt" "${DUMP_DIR}/p4-sa-after.txt" | grep -cE '^[<>]')"
if [ "$SA_DRIFT" -eq 0 ] && [ "$SA_BEFORE" = "$SA_AFTER" ]; then
  say "    [ok] supabase_admin defaults unchanged at ${SA_AFTER} facts - accepted platform limitation, NOT remediated"
else
  say "    [FAIL] supabase_admin defaults changed: ${SA_BEFORE} -> ${SA_AFTER}, ${SA_DRIFT} differing fact(s)"
fi

# == Phase 5: functional verification ========================================
say
say "  -- Phase 5: functional verification (all synthetic data rolled back) --"
VER_LOG="${DUMP_DIR}/p4-verify.log"
pg -v ON_ERROR_STOP=1 -f /sql/staging-p4-verify.sql > "$VER_LOG" 2>&1
VER_STATUS=$?
chmod 600 "$VER_LOG"
grep -oE 'V\|(PASS|FAIL)\|.*' "$VER_LOG" | sed 's/^V|/      /' | sed 's/^      PASS|/      [PASS] /; s/^      FAIL|/      [FAIL] /'
VER_FAILS="$(grep -c 'V|FAIL|' "$VER_LOG")"
VER_PASSES="$(grep -c 'V|PASS|' "$VER_LOG")"
say "      -> ${VER_PASSES} passed, ${VER_FAILS} failed (psql exit ${VER_STATUS})"

# Concurrency needs two sessions, so its rows must commit. Tagged, then removed and verified.
say
say "    concurrency (two sessions, committed rows, removed afterwards):"
pg -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
insert into public.v_applications (id,user_id,name,app_url)
values ('00000000-dead-beef-0000-0000000000c1','p4-rehearsal-synthetic','p4 concurrency','https://rehearsal.invalid');
insert into public.v_preflight_runs (id,user_id,application_id,state,created_at)
values ('00000000-dead-beef-0000-0000000000c2','p4-rehearsal-synthetic','00000000-dead-beef-0000-0000000000c1','queued',now());
SQL
CONC_A="$(pg -tA -v ON_ERROR_STOP=1 -c "set role service_role" -c "select coalesce(public.v_preflight_claim('conc-1',90)::text,'NULL');" 2>&1 | tail -1)" &
CONC_B="$(pg -tA -v ON_ERROR_STOP=1 -c "set role service_role" -c "select coalesce(public.v_preflight_claim('conc-2',90)::text,'NULL');" 2>&1 | tail -1)" &
wait
CONC="$(pg -tA -v ON_ERROR_STOP=1 -c "select count(*) filter (where state='running') || '|' || count(distinct lease_owner) || '|' || coalesce(max(attempts),0) from public.v_preflight_runs where id='00000000-dead-beef-0000-0000000000c2';" 2>&1 | tail -1)"
CONC_RUNNING="${CONC%%|*}"; CONC_REST="${CONC#*|}"; CONC_OWNERS="${CONC_REST%%|*}"; CONC_ATTEMPTS="${CONC_REST#*|}"
if [ "$CONC_RUNNING" = "1" ] && [ "$CONC_OWNERS" = "1" ] && [ "$CONC_ATTEMPTS" = "1" ]; then
  say "      [PASS] exactly one of two concurrent workers claimed the row (attempts=1, owners=1)"
  CONC_OK=1
else
  say "      [FAIL] running=${CONC_RUNNING} distinct_owners=${CONC_OWNERS} attempts=${CONC_ATTEMPTS} (expected 1/1/1)"
  CONC_OK=0
fi
pg -q -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
delete from public.v_preflight_runs where user_id = 'p4-rehearsal-synthetic';
delete from public.v_applications  where user_id = 'p4-rehearsal-synthetic';
SQL
RESIDUE="$(pg -tA -v ON_ERROR_STOP=1 -c "select (select count(*) from public.v_preflight_runs where user_id='p4-rehearsal-synthetic') + (select count(*) from public.v_applications where user_id='p4-rehearsal-synthetic');" 2>&1 | tail -1)"
if [ "$RESIDUE" = "0" ]; then say "      [PASS] synthetic rows removed: 0 remain"
else say "      [FAIL] ${RESIDUE} synthetic row(s) remain - clean up manually"; fi

# The tests must not have altered the schema. Re-fingerprint and compare to post-forward.
AFTER_TESTS="$(fingerprint after-tests)"
TEST_DRIFT="$(diff "${DUMP_DIR}/p4-after-forward.txt" "${DUMP_DIR}/p4-after-tests.txt" | grep -cE '^[<>]')"
if [ "$TEST_DRIFT" -eq 0 ]; then say "      [PASS] verification left the schema unchanged (${AFTER_TESTS} facts, 0 drift)"
else say "      [FAIL] verification changed ${TEST_DRIFT} schema fact(s)"; fi

# == Phase 6: rollback =======================================================
say
say "  -- Phase 6: apply the exact rollback --"
identify || { unset PGPASSWORD; fail "the gate refused this target on the pre-write re-check."; }
say "    [ok] staging re-identified immediately before the write"
BACK_LOG="${DUMP_DIR}/p4-rollback-$(date -u +%Y%m%dT%H%M%SZ).log"
: > "$BACK_LOG"; chmod 600 "$BACK_LOG"
pg -v ON_ERROR_STOP=1 -f /sql/p4-remediation-rollback.sql >> "$BACK_LOG" 2>&1
BACK_STATUS=$?
grep -E 'NOTICE:|ERROR:' "$BACK_LOG" | sed 's/^/      /'
[ "$BACK_STATUS" -eq 0 ] || { unset PGPASSWORD; fail "the ROLLBACK failed (exit ${BACK_STATUS}). Staging is still in the post-forward state - investigate before doing anything else."; }
say "    [ok] rollback applied and committed (log: ${BACK_LOG})"

AFTER_BACK="$(fingerprint after-rollback)"
unset PGPASSWORD
say "    [ok] PGPASSWORD unset"
say "    post-rollback fingerprint: ${AFTER_BACK} facts"

RESTORE_DRIFT="$(diff "$BASELINE" "${DUMP_DIR}/p4-after-rollback.txt" | grep -cE '^[<>]')"

# == Phase 7: verdict ========================================================
say
say "  ================ REHEARSAL RESULT ================"
printf '    %-42s %s\n' "baseline (frozen)"          "${BASELINE_FACTS} facts"
printf '    %-42s %s\n' "staging before"             "${N} facts, 0 differing"
printf '    %-42s %s\n' "after forward"              "${AFTER_FWD} facts"
printf '    %-42s %s\n' "after verification"         "${AFTER_TESTS} facts, ${TEST_DRIFT} drift"
printf '    %-42s %s\n' "after rollback"             "${AFTER_BACK} facts, ${RESTORE_DRIFT} differing"
printf '    %-42s %s\n' "post-forward vs proven expectation" "${FWD_DRIFT:-?} differing"
printf '    %-42s %s\n' "supabase_admin (platform limitation)" "${SA_AFTER:-?} facts, ${SA_DRIFT:-?} differing - accepted"
printf '    %-42s %s\n' "functional checks"          "${VER_PASSES} passed / ${VER_FAILS} failed, concurrency $([ "${CONC_OK:-0}" = "1" ] && echo PASS || echo FAIL)"
printf '    %-42s %s\n' "synthetic residue"          "${RESIDUE}"
say
if [ "$RESTORE_DRIFT" -ne 0 ]; then
  diff "$BASELINE" "${DUMP_DIR}/p4-after-rollback.txt" | grep -E '^[<>]' | head -15 | sed 's/^/      /'
  fail "staging did NOT return to the frozen baseline: ${RESTORE_DRIFT} differing fact(s)."
fi
if [ "$VER_FAILS" -ne 0 ] || [ "${CONC_OK:-0}" != "1" ] || [ "$RESIDUE" != "0" ] || [ "$TEST_DRIFT" -ne 0 ] || [ "${FWD_DRIFT:-1}" -ne 0 ] || [ "${SA_DRIFT:-1}" -ne 0 ]; then
  fail "the rollback restored the baseline, but the verification did not fully pass. Do not proceed."
fi
say "    REHEARSAL PASSED - forward applied, every check passed, rollback restored the frozen"
say "    ${BASELINE_FACTS}-fact baseline exactly, and no synthetic data remains."
say
say "  NEXT: re-run the frozen staging reconciliation as an independent confirmation."
say "      bash ops/reconcile-staging-schema.sh ${DUMP_FILE}"
say
say "  The RLS preflight and all other migrations have NOT been run. Production was not accessed."
say
