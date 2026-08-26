#!/usr/bin/env bash
# Step 1 — read-only production public-schema dump.
#
# RUN THIS YOURSELF, IN YOUR OWN TERMINAL. It cannot be run by the assistant:
#   - it prompts for a password, and an assistant shell has no tty, so the prompt would read EOF and
#     silently produce an empty password;
#   - and the password must never enter the assistant's transcript, which would be worse than argv.
#
# WHAT IT DOES, and nothing else:
#   umask 077, make a fresh temp dir OUTSIDE the repository, prompt for the production password, run
#   pg_dump --schema-only --schema=public, unset PGPASSWORD immediately, stop on any nonzero exit.
#
# IT DOES NOT restore anything, touch staging, or write inside the repository.
#
# The password: read with `read -rs` so it is never echoed, never a command (so never in shell history),
# never in argv (pg_dump reads PGPASSWORD from the environment), and never written to a file. It is never
# printed, measured, or hashed - presence only, if that.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROD_HOST='db.gvcqzovxfijvtkhetopn.supabase.co'   # owner-confirmed PRODUCTION
PG_IMAGE='postgres:17-alpine'                      # client >= server; Supabase runs 15-17

echo
echo "  Step 1 — production public-schema dump (READ-ONLY)"
echo "  host: ${PROD_HOST}"
echo

# ── Restrictive permissions BEFORE anything is created ─────────────────────
umask 077
echo "  umask set to 077 (files created 0600, dirs 0700)"

# ── A fresh temp dir, outside the repository ───────────────────────────────
DUMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/vraelis-schema-XXXXXXXX")" || { echo "  FAILED to create a temp dir"; exit 1; }
case "$DUMP_DIR" in
  "$REPO_ROOT"*) echo "  REFUSING: temp dir landed inside the repository ($DUMP_DIR)"; exit 1 ;;
esac
DUMP_FILE="$DUMP_DIR/prod-public-schema.sql"
echo "  dump dir : $DUMP_DIR   (outside the repo, confirmed)"

# ── Client: native if present, else dockerised ─────────────────────────────
if command -v pg_dump >/dev/null 2>&1; then
  MODE=native
  echo "  client   : native $(pg_dump --version | head -1)"
else
  command -v docker >/dev/null 2>&1 || { echo "  FAILED: no pg_dump and no docker. Install the PostgreSQL client."; exit 1; }
  MODE=docker
  echo "  client   : dockerised ${PG_IMAGE} (no local pg_dump found)"
fi

# ── The password. Read silently; never echoed, never in argv, never stored ──
read -rsp '  production DB password (input hidden): ' PGPASSWORD
echo
[ -n "$PGPASSWORD" ] || { echo "  FAILED: empty password — refusing to continue."; rmdir "$DUMP_DIR" 2>/dev/null; exit 1; }
export PGPASSWORD

export PGHOST="$PROD_HOST" PGPORT=5432 PGUSER=postgres PGDATABASE=postgres

echo "  running pg_dump ..."
if [ "$MODE" = native ]; then
  pg_dump --schema-only --schema=public --no-owner --no-comments --file="$DUMP_FILE"
  DUMP_STATUS=$?
else
  # -e PGPASSWORD (no =value) copies it from THIS shell's environment; the value never appears in argv.
  # MSYS_NO_PATHCONV stops Git Bash rewriting the container path on Windows.
  MSYS_NO_PATHCONV=1 docker run --rm \
    -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE \
    -v "$DUMP_DIR:/out" \
    "$PG_IMAGE" \
    pg_dump --schema-only --schema=public --no-owner --no-comments --file=/out/prod-public-schema.sql
  DUMP_STATUS=$?
fi

# ── Unset IMMEDIATELY, before anything else runs ───────────────────────────
unset PGPASSWORD
echo "  PGPASSWORD unset"

if [ "$DUMP_STATUS" -ne 0 ]; then
  echo
  echo "  pg_dump exit: $DUMP_STATUS  — STOPPING. Nothing further will run."
  echo "  (a partial file, if any, is at $DUMP_FILE — delete it)"
  exit "$DUMP_STATUS"
fi

echo
echo "  pg_dump exit: 0"
echo "  dump file   : $DUMP_FILE"
[ -s "$DUMP_FILE" ] && echo "  file present and non-empty" || { echo "  FAILED: dump file is missing or empty"; exit 1; }

echo
echo "  Next: hand this path to the assistant to run the safety verification."
echo "  It needs no password."
echo
echo "      npx tsx scripts/verify-schema-dump.ts '$DUMP_FILE'"
echo
echo "  Do NOT restore to staging yet."
