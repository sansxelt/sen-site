#!/usr/bin/env bash
# Step 4 — restore the verified production public-schema dump into the owner-confirmed STAGING project.
#
# RUN THIS YOURSELF, IN YOUR OWN TERMINAL (WSL — the dump lives on WSL's filesystem).
# It cannot be run by the assistant: it prompts for a password, an assistant shell has no tty, and the
# password must never enter the assistant's transcript.
#
#   usage:  bash ops/restore-staging-schema.sh /tmp/vraelis-schema-XXXXXXXX/prod-public-schema.sql
#           bash ops/restore-staging-schema.sh <dump> --preflight-only   # read-only; writes NOTHING
#
# WHAT IT WRITES: exactly one thing, once, into staging's public schema — the DDL in the dump.
# WHAT IT NEVER DOES: touch production, DROP anything, use --clean/--if-exists, restore row data,
# Auth users, Storage objects or Vault contents, or delete the verified dump.
set -uo pipefail

REPO_ROOT="${RESTORE_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
# Sanity-check it: if this script is run from a copy elsewhere, REPO_ROOT resolves somewhere
# arbitrary (from /tmp it resolves to "/"), and then every path on the machine looks "inside the
# repository" while the gate and verifier below resolve nowhere.
if [ ! -f "$REPO_ROOT/scripts/db-target-identify.ts" ] || [ ! -f "$REPO_ROOT/scripts/verify-schema-dump.ts" ]; then
  echo "  STOP: cannot locate the repository root (looked in '$REPO_ROOT')."
  echo "        Run this from a checkout, or set RESTORE_REPO_ROOT to the repository root."
  exit 1
fi

# ── Targets ────────────────────────────────────────────────────────────────
STAGING_REF='mxxhpfbazbwczrhuxasv'          # owner-confirmed, independently checked via the Copy button
PROD_REF='gvcqzovxfijvtkhetopn'             # PERMANENTLY DENIED. Never a target of this script.
STAGING_HOST="${STAGING_POOLER_HOST:-aws-0-us-west-2.pooler.supabase.com}"
STAGING_PORT='5432'                         # SESSION mode. 6543 (transaction mode) is refused below.
STAGING_USER="postgres.${STAGING_REF}"
STAGING_DB='postgres'
PG_IMAGE='postgres:17-alpine'

# ── Expectations carried forward from the VERIFIED Step 3 state ────────────
# Any drift from these stops the run before a single byte is written.
EXPECT_DB='postgres'
EXPECT_UPSTREAM_USER='postgres'   # Supavisor authenticates upstream as 'postgres', not postgres.<ref>
EXPECT_TLS='TLSv1.3'              # observed by \conninfo in Step 3
EXPECT_SERVER_MAJOR='17'
# The dump's own census — the reconciliation target.
EXPECT_TABLES=107; EXPECT_RLS=107; EXPECT_POLICIES=0; EXPECT_FUNCTIONS=8
EXPECT_VIEWS=0; EXPECT_SEQUENCES=0; EXPECT_TRIGGERS=0; EXPECT_TYPES=0

DUMP_FILE="${1:-}"
# Canonicalise NOW: phase 0c cds to the repo root, after which a relative path would resolve elsewhere.
if [ -n "$DUMP_FILE" ] && [ -f "$DUMP_FILE" ]; then
  DUMP_FILE="$(cd "$(dirname "$DUMP_FILE")" && pwd)/$(basename "$DUMP_FILE")"
fi
PREFLIGHT_ONLY=0
case "${2:-}" in --preflight-only) PREFLIGHT_ONLY=1 ;; esac

# WSL runs Windows node through PATH interop (npx resolves to /mnt/c/Program Files/nodejs/npx), and
# Windows node cannot resolve a Linux path: it reads /tmp/x as C:\tmp\x and reports "no such file".
# docker, by contrast, is the LINUX cli here and mounts /tmp natively — so only the node arguments need
# translating. This is the same WSL/Windows boundary that cost two re-runs in Step 3.
host_path() {
  local p="$1" npx_bin
  npx_bin="$(command -v npx 2>/dev/null || true)"
  case "$npx_bin" in
    /mnt/*)
      if command -v wslpath >/dev/null 2>&1; then wslpath -w "$p" 2>/dev/null && return 0; fi
      ;;
  esac
  printf '%s' "$p"
}

say()  { echo "$@"; }
fail() { echo; echo "  STOP: $*"; echo "  Nothing was written to staging."; exit 1; }

say
say "  Step 4 — restore production schema into STAGING"
say "  host: ${STAGING_HOST}:${STAGING_PORT}   (session pooler, SSL required)"
say "  user: ${STAGING_USER}"
say "  ref : ${STAGING_REF}  (STAGING)"
[ "$PREFLIGHT_ONLY" -eq 1 ] && say "  MODE: --preflight-only — read-only, writes nothing"
say

# ════════════════════════════════════════════════════════════════════════════
say "  ── Phase 0: offline guards (no network) ──"

# 0a. Production may never be reached from here, in any connection component.
for component in "$STAGING_HOST" "$STAGING_USER" "$STAGING_DB"; do
  case "$component" in
    *"$PROD_REF"*) fail "PRODUCTION ref '${PROD_REF}' appears in '${component}'. Permanently denied." ;;
  esac
done
case "$STAGING_USER" in
  *"$STAGING_REF"*) : ;;
  *) fail "user '${STAGING_USER}' does not carry the staging ref '${STAGING_REF}'." ;;
esac
say "    [ok] production ref absent; staging ref present in the username"

# 0b. Session mode only.
[ "$STAGING_PORT" = "6543" ] && fail "port 6543 is the TRANSACTION-mode pooler. Use 5432 (session mode)."
[ "$STAGING_PORT" = "5432" ] || fail "port ${STAGING_PORT} is not the session pooler port 5432."
say "    [ok] port 5432 (session mode)"

# 0c. The policy gate — allowlist/denylist, offline, before any password is typed.
#     The gate URL is deliberately password-less; it exists only to classify the target.
GATE_URL="postgresql://${STAGING_USER}@${STAGING_HOST}:${STAGING_PORT}/${STAGING_DB}"
cd "$REPO_ROOT" || fail "cannot cd to the repository root"
if ! npx tsx scripts/db-target-identify.ts --url "$GATE_URL" --identify-only; then
  fail "the target-identification gate refused this target."
fi
say "    [ok] policy gate: classified STAGING, exit 0"

# 0d. The dump: present, outside the repo, 0600, non-empty.
[ -n "$DUMP_FILE" ] || fail "no dump path given. usage: bash ops/restore-staging-schema.sh <dump.sql>"
[ -f "$DUMP_FILE" ] || fail "dump not found: ${DUMP_FILE}"
DUMP_DIR="$(cd "$(dirname "$DUMP_FILE")" && pwd)"
# Compare with a trailing slash on both sides so a sibling directory whose name merely starts with
# the repo name (vraelis-backup) is not mistaken for a path inside the repo.
case "${DUMP_DIR%/}/" in "${REPO_ROOT%/}/"*) fail "the dump is INSIDE the repository (${DUMP_DIR}). It must stay outside." ;; esac
[ -s "$DUMP_FILE" ] || fail "the dump is empty."
DUMP_MODE="$(stat -c '%a' "$DUMP_FILE" 2>/dev/null || echo '?')"
[ "$DUMP_MODE" = "600" ] || fail "dump mode is ${DUMP_MODE}, not 600. chmod 600 it before restoring."
say "    [ok] dump outside the repo, mode 0600, non-empty ($(wc -l < "$DUMP_FILE") lines)"

# 0e. Re-run the safety verifier on the ORIGINAL dump, now, immediately before restoring.
say "    running scripts/verify-schema-dump.ts on the original dump ..."
if ! npx tsx scripts/verify-schema-dump.ts "$(host_path "$DUMP_FILE")" > /tmp/.v-orig.$$ 2>&1; then
  cat /tmp/.v-orig.$$; rm -f /tmp/.v-orig.$$
  fail "the dump FAILED safety verification. Refusing to restore it."
fi
grep -E 'passed|PASS' /tmp/.v-orig.$$ | tail -2 | sed 's/^/      /'; rm -f /tmp/.v-orig.$$
say "    [ok] original dump: verification passed"

# 0f. No destructive statement may exist anywhere in the file.
for pat in '^DROP ' '^TRUNCATE ' '^DELETE ' '^UPDATE ' '^COPY ' '^INSERT '; do
  n="$(grep -cE "$pat" "$DUMP_FILE")"
  [ "$n" -eq 0 ] || fail "the dump contains ${n} statement(s) matching ${pat}. Refusing."
done
say "    [ok] zero DROP / TRUNCATE / DELETE / UPDATE / COPY / INSERT statements"

# ════════════════════════════════════════════════════════════════════════════
say
say "  ── Phase 1: resolve the known collisions, deterministically, BEFORE connecting ──"
#
# Two statement classes in this dump cannot execute against a Supabase staging project. Both were found by
# restoring the real dump into a Supabase-shaped fixture offline, NOT by discovering them mid-restore:
#
#   [A] line 26  CREATE SCHEMA public;
#       No IF NOT EXISTS. Staging's public schema already exists (Step 3 confirmed it exists and is empty),
#       so this raises 'schema "public" already exists' and — under --single-transaction — rolls back
#       the entire restore at the very first statement.
#
#   [B] 12x      ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ...
#       ALTER DEFAULT PRIVILEGES FOR ROLE <r> requires membership in <r>. On Supabase, the role we connect
#       as (postgres) is NOT a superuser and is NOT a member of supabase_admin, so these raise
#       'permission denied to change default privileges' and roll the whole restore back at line 6900.
#       These are platform-managed defaults that a Supabase project already has; they govern privileges on
#       FUTURE objects created by supabase_admin, not the 107 tables being restored. Phase 3 asserts the
#       membership is genuinely absent, so this neutralisation is never applied speculatively.
#
# The original dump is NEVER modified. The restore file is re-derived from it on every run and the diff is
# asserted to be exactly the expected lines — a stale or hand-edited artifact cannot be used.
RESTORE_FILE="${DUMP_DIR}/prod-public-schema.restore.sql"
umask 077
sed -e 's|^CREATE SCHEMA public;$|-- [NEUTRALISED A: target schema already exists] &|' \
    -e 's|^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin |-- [NEUTRALISED B: requires supabase_admin membership] &|' \
    "$DUMP_FILE" > "$RESTORE_FILE" || fail "could not derive the restore file"
chmod 600 "$RESTORE_FILE"

# The diff must be EXACTLY the expected transformation: 13 lines, all of them neutralisations.
CHANGED="$(diff "$DUMP_FILE" "$RESTORE_FILE" | grep -c '^> ')"
NEUT_A="$(grep -c '^-- \[NEUTRALISED A' "$RESTORE_FILE")"
NEUT_B="$(grep -c '^-- \[NEUTRALISED B' "$RESTORE_FILE")"
UNEXPECTED="$(diff "$DUMP_FILE" "$RESTORE_FILE" | grep '^> ' | grep -vc '^> -- \[NEUTRALISED')"
[ "$CHANGED" -eq 13 ] || fail "expected exactly 13 changed lines, got ${CHANGED}. Refusing."
[ "$NEUT_A" -eq 1 ]   || fail "expected exactly 1 class-A neutralisation, got ${NEUT_A}."
[ "$NEUT_B" -eq 12 ]  || fail "expected exactly 12 class-B neutralisations, got ${NEUT_B}."
[ "$UNEXPECTED" -eq 0 ] || fail "${UNEXPECTED} changed line(s) are not neutralisations. Refusing."
# Nothing was removed, only commented: line counts must match.
[ "$(wc -l < "$DUMP_FILE")" -eq "$(wc -l < "$RESTORE_FILE")" ] || fail "line counts differ; a line was added or removed."
say "    [ok] restore file derived: 13 lines neutralised (1 class A + 12 class B), 0 unexpected changes"
say "    [ok] no line added or removed; original dump untouched"

# 1b. The derived file must itself pass the same safety verification.
if ! npx tsx scripts/verify-schema-dump.ts "$(host_path "$RESTORE_FILE")" > /tmp/.v-prep.$$ 2>&1; then
  cat /tmp/.v-prep.$$; rm -f /tmp/.v-prep.$$
  fail "the derived restore file FAILED safety verification."
fi
rm -f /tmp/.v-prep.$$
say "    [ok] derived restore file: verification passed"
say "    file: ${RESTORE_FILE}"

# ════════════════════════════════════════════════════════════════════════════
say
say "  ── Phase 2: credentials ──"
# read -rs: never echoed, never a command (so never in shell history), never in argv (psql reads
# PGPASSWORD from the environment), never written to a file. Never printed, measured, hashed or compared.
read -rsp '  staging DB password (input hidden): ' PGPASSWORD
echo
[ -n "$PGPASSWORD" ] || fail "empty password — refusing to continue."
export PGPASSWORD
export PGHOST="$STAGING_HOST" PGPORT="$STAGING_PORT" PGUSER="$STAGING_USER" PGDATABASE="$STAGING_DB"
export PGSSLMODE=require
say "    [ok] password accepted (presence only; never printed, measured or persisted)"
say "    [ok] PGSSLMODE=require"

command -v docker >/dev/null 2>&1 || fail "docker not found; needed to run ${PG_IMAGE}."
pg() { docker run --rm -i -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE -e PGSSLMODE \
         -v "${DUMP_DIR}:/work" "$PG_IMAGE" psql "$@"; }

# ════════════════════════════════════════════════════════════════════════════
say
say "  ── Phase 3: read-only preflight against staging (writes nothing) ──"
#
# Every assertion below must match the state verified in Step 3. Any drift stops the run BEFORE the
# restore transaction opens. This is the only thing standing between us and a silent merge into a dirty
# schema: proven offline, restoring into a non-empty public schema whose object names simply don't collide
# returns exit 0 and quietly merges. --single-transaction does NOT protect against that.
PRE_OUT="$(pg -v ON_ERROR_STOP=1 <<'SQL' 2>&1
\conninfo
begin read only;
select 'K_RO='       || current_setting('transaction_read_only');
select 'K_DB='       || current_database();
select 'K_USER='     || current_user;
select 'K_SRVMAJ='   || split_part(split_part(version(), ' ', 2), '.', 1);
select 'K_SRVFULL='  || split_part(version(), ' ', 2);
select 'K_PUBEXISTS='|| (select count(*) from pg_namespace where nspname = 'public');
select 'K_TABLES='   || (select count(*) from pg_tables      where schemaname = 'public');
select 'K_VIEWS='    || (select count(*) from pg_views       where schemaname = 'public');
select 'K_MATVIEWS=' || (select count(*) from pg_matviews    where schemaname = 'public');
select 'K_SEQS='     || (select count(*) from pg_sequences   where schemaname = 'public');
select 'K_POLICIES=' || (select count(*) from pg_policies    where schemaname = 'public');
select 'K_FUNCS='    || (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public');
select 'K_TYPES='    || (select count(*) from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' and t.typtype in ('e','c','d') and not exists (select 1 from pg_class c where c.oid = t.typrelid and c.relkind <> 'c'));
select 'K_TRIGGERS=' || (select count(*) from pg_trigger g join pg_class c on c.oid = g.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and not g.tgisinternal);
-- pg_has_role errors if the role is absent, so resolve it through pg_roles rather than naming it directly.
select 'K_SBADMIN=' || coalesce((select pg_has_role(current_user, 'supabase_admin', 'member')::text from pg_roles where rolname = 'supabase_admin'), 'no-such-role');
rollback;
SQL
)"
PRE_STATUS=$?
k() { printf '%s\n' "$PRE_OUT" | sed -n "s/^${1}=//p" | tail -1; }

if [ "$PRE_STATUS" -ne 0 ]; then
  printf '%s\n' "$PRE_OUT" | grep -iE 'error|fatal|could not' | head -3 | sed 's/^/      /'
  unset PGPASSWORD; fail "the read-only preflight failed (exit ${PRE_STATUS})."
fi

# 3a. TLS — read from \conninfo, which reports the CLIENT's link. pg_stat_ssl would report the pooler's
#     backend link instead and misleadingly say ssl=off; that trap cost a re-run in Step 3.
TLS="$(printf '%s\n' "$PRE_OUT" | sed -n 's/.*protocol: \([A-Za-z0-9.]*\).*/\1/p' | tail -1)"
[ -n "$TLS" ] || { unset PGPASSWORD; fail "no SSL protocol reported by \conninfo — the link may not be encrypted."; }
[ "$TLS" = "$EXPECT_TLS" ] || { unset PGPASSWORD; fail "TLS is ${TLS}, but Step 3 verified ${EXPECT_TLS}. Drift — re-approve before proceeding."; }
say "    [ok] TLS ${TLS} (from \conninfo, the client link)"

# 3b. Identity must match the verified Step 3 target.
[ "$(k K_RO)"   = "on" ]                    || { unset PGPASSWORD; fail "the preflight transaction is not read-only."; }
[ "$(k K_DB)"   = "$EXPECT_DB" ]            || { unset PGPASSWORD; fail "database is '$(k K_DB)', expected '${EXPECT_DB}'."; }
[ "$(k K_USER)" = "$EXPECT_UPSTREAM_USER" ] || { unset PGPASSWORD; fail "current_user is '$(k K_USER)', expected '${EXPECT_UPSTREAM_USER}'."; }
say "    [ok] identity: database $(k K_DB), user $(k K_USER)"

# 3c. Server version.
[ "$(k K_SRVMAJ)" = "$EXPECT_SERVER_MAJOR" ] || { unset PGPASSWORD; fail "server major is $(k K_SRVMAJ), expected ${EXPECT_SERVER_MAJOR}. The dump was produced by pg_dump 17."; }
say "    [ok] server PostgreSQL $(k K_SRVFULL)"

# 3d. public exists and is EMPTY — the load-bearing gate.
[ "$(k K_PUBEXISTS)" = "1" ] || { unset PGPASSWORD; fail "the public schema does not exist on staging."; }
EMPTY_FAIL=""
for pair in "TABLES:tables" "VIEWS:views" "MATVIEWS:materialised views" "SEQS:sequences" \
            "POLICIES:policies" "FUNCS:functions" "TYPES:types" "TRIGGERS:triggers"; do
  key="${pair%%:*}"; label="${pair#*:}"; val="$(k "K_${key}")"
  [ "$val" = "0" ] || EMPTY_FAIL="${EMPTY_FAIL}\n      ${label}: ${val} (expected 0)"
done
if [ -n "$EMPTY_FAIL" ]; then
  printf '%b\n' "    staging's public schema is NOT empty:${EMPTY_FAIL}"
  unset PGPASSWORD
  fail "user-created objects exist in staging's public schema. This script does not DROP anything — decide deliberately."
fi
say "    [ok] public schema exists and is EMPTY (tables/views/matviews/sequences/policies/functions/types/triggers all 0)"

# 3e. Validate neutralisation class B rather than assuming it.
SBA="$(k K_SBADMIN)"
case "$SBA" in
  false)         say "    [ok] current_user is NOT a member of supabase_admin — the 12 class-B neutralisations are correct" ;;
  true)          unset PGPASSWORD; fail "current_user IS a member of supabase_admin, so the 12 ALTER DEFAULT PRIVILEGES statements would have SUCCEEDED. Neutralising them would silently make staging differ from production. Re-prepare without class B and re-approve." ;;
  no-such-role)  unset PGPASSWORD; fail "role supabase_admin does not exist on this target. That is not the shape of a Supabase project — stopping." ;;
  *)             unset PGPASSWORD; fail "could not determine supabase_admin membership (got '${SBA}')." ;;
esac

if [ "$PREFLIGHT_ONLY" -eq 1 ]; then
  unset PGPASSWORD
  say; say "  --preflight-only: every gate passed. NOTHING was written."
  say "  Re-run without --preflight-only to perform the restore."
  exit 0
fi

# ════════════════════════════════════════════════════════════════════════════
say
say "  ── Phase 4: restore ──"
RESTORE_LOG="${DUMP_DIR}/restore-$(date -u +%Y%m%dT%H%M%SZ).log"
: > "$RESTORE_LOG"; chmod 600 "$RESTORE_LOG"
say "    log: ${RESTORE_LOG}  (mode 0600, sanitized — psql never echoes credentials)"
say "    command: psql -v ON_ERROR_STOP=1 --single-transaction -f prod-public-schema.restore.sql"
say "    no --clean, no --if-exists, no DROP. One transaction: it all applies, or none of it does."
say
say "    restoring ..."

pg -v ON_ERROR_STOP=1 --single-transaction -f /work/prod-public-schema.restore.sql >> "$RESTORE_LOG" 2>&1
RESTORE_STATUS=$?
unset PGPASSWORD_UNUSED 2>/dev/null || true

# Sanitize check: the log must contain nothing secret-shaped before it is shown or kept.
if grep -qEi '(sk_live|pk_live|whsec_|eyJ[A-Za-z0-9_-]{20,}|-----BEGIN|AKIA[0-9A-Z]{16}|xox[baprs]-|password *=)' "$RESTORE_LOG"; then
  say "    WARNING: the log matched a secret-shaped pattern. Review it by hand before sharing."
else
  say "    [ok] log scanned: no secret-shaped content"
fi

if [ "$RESTORE_STATUS" -ne 0 ]; then
  say
  say "    psql exit: ${RESTORE_STATUS}  — the transaction ROLLED BACK. Staging is unchanged."
  grep -iE 'error|fatal' "$RESTORE_LOG" | head -5 | sed 's/^/      /'
  unset PGPASSWORD
  say
  say "  The verified dump has NOT been deleted: ${DUMP_FILE}"
  exit "$RESTORE_STATUS"
fi
say "    psql exit: 0 — committed"

# ════════════════════════════════════════════════════════════════════════════
say
say "  ── Phase 5: read-only reconciliation ──"
REC_OUT="$(pg -tA <<'SQL' 2>&1
begin read only;
select 'R_TABLES='   || (select count(*) from pg_tables    where schemaname = 'public');
select 'R_RLS='      || (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relrowsecurity);
select 'R_POLICIES=' || (select count(*) from pg_policies  where schemaname = 'public');
select 'R_FUNCS='    || (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public');
select 'R_VIEWS='    || (select count(*) from pg_views     where schemaname = 'public');
select 'R_SEQS='     || (select count(*) from pg_sequences where schemaname = 'public');
select 'R_INDEXES='  || (select count(*) from pg_indexes   where schemaname = 'public');
select 'R_COLUMNS='  || (select count(*) from information_schema.columns where table_schema = 'public');
select 'R_FKEYS='    || (select count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public' and c.contype = 'f');
-- The whole point of the exercise: no row may exist anywhere in public.
select 'R_ROWS='     || (select coalesce(sum(n_live_tup), 0) from pg_stat_user_tables where schemaname = 'public');
select 'R_TABLENAMES=' || (select coalesce(string_agg(tablename, ',' order by tablename), '') from pg_tables where schemaname = 'public');
rollback;
SQL
)"
unset PGPASSWORD
say "    [ok] PGPASSWORD unset"
r() { printf '%s\n' "$REC_OUT" | sed -n "s/^${1}=//p" | tail -1; }

DRIFT=0
chk() { # label actual expected
  if [ "$2" = "$3" ]; then printf '    [ok]   %-22s %s\n' "$1" "$2"
  else printf '    [DRIFT] %-21s %s   (expected %s)\n' "$1" "$2" "$3"; DRIFT=1; fi
}
chk tables      "$(r R_TABLES)"   "$EXPECT_TABLES"
chk rls_enabled "$(r R_RLS)"      "$EXPECT_RLS"
chk policies    "$(r R_POLICIES)" "$EXPECT_POLICIES"
chk functions   "$(r R_FUNCS)"    "$EXPECT_FUNCTIONS"
chk views       "$(r R_VIEWS)"    "$EXPECT_VIEWS"
chk sequences   "$(r R_SEQS)"     "$EXPECT_SEQUENCES"
chk rows        "$(r R_ROWS)"     "0"
printf '    [info] %-21s %s\n' indexes  "$(r R_INDEXES)"
printf '    [info] %-21s %s\n' columns  "$(r R_COLUMNS)"
printf '    [info] %-21s %s\n' fkeys    "$(r R_FKEYS)"

# Structural: every table named in the dump must exist in staging, and nothing else may.
printf '%s\n' "$(r R_TABLENAMES)" | tr ',' '\n' | grep -v '^$' | sort > /tmp/.staging-tables.$$
grep -oE '^CREATE TABLE public\.[A-Za-z0-9_]+' "$DUMP_FILE" | sed 's/.*public\.//' | sort -u > /tmp/.dump-tables.$$
MISSING="$(comm -23 /tmp/.dump-tables.$$ /tmp/.staging-tables.$$ | head -5)"
EXTRA="$(comm -13 /tmp/.dump-tables.$$ /tmp/.staging-tables.$$ | head -5)"
rm -f /tmp/.dump-tables.$$ /tmp/.staging-tables.$$
if [ -z "$MISSING" ] && [ -z "$EXTRA" ]; then
  say "    [ok]   table names        identical to the dump, set-for-set"
else
  [ -n "$MISSING" ] && { say "    [DRIFT] in the dump but NOT in staging: $(echo $MISSING)"; DRIFT=1; }
  [ -n "$EXTRA" ]   && { say "    [DRIFT] in staging but NOT in the dump: $(echo $EXTRA)";   DRIFT=1; }
fi

# ════════════════════════════════════════════════════════════════════════════
say
if [ "$DRIFT" -eq 0 ]; then
  say "  RESTORE COMPLETE — staging matches the production schema, with no rows."
else
  say "  RESTORE COMMITTED, but the reconciliation found DRIFT above. Investigate before the preflight."
fi
say
say "  Known, deliberate differences from production (neutralised, not silently dropped):"
say "    - the 12 supabase_admin default-privilege grants were not applied (staging's role lacks membership);"
say "      they govern FUTURE objects created by supabase_admin, not the 107 restored tables."
say "    - the event trigger that calls public.rls_auto_enable() is NOT in the dump: event triggers are"
say "      database-level, so --schema=public never selected it. The function itself WAS restored, and all"
say "      107 tables carry explicit ENABLE ROW LEVEL SECURITY, so present RLS state is faithful — but"
say "      staging will NOT auto-enable RLS on tables created in future the way production does."
say
say "  The verified dump has NOT been deleted: ${DUMP_FILE}"
say "  RLS / security migrations have NOT been run. That is a separate, separately-approved step."
say
