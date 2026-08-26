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

# ── Target: PRODUCTION, via the SESSION-mode pooler ────────────────────────
#
# These are the connection parameters Supabase's dashboard reports for this project. Note the port:
#
#   5432 on the pooler host = SESSION mode   -> pg_dump WORKS
#   6543 on the pooler host = TRANSACTION mode -> pg_dump does NOT work
#
# The ref rides in the USERNAME here (postgres.<ref>), not the host — which is why the identify gate has
# to read both. The direct host db.<ref>.supabase.co:5432 is the alternative if it resolves for you;
# newer Supabase projects often expose only the pooler.
PROD_REF='gvcqzovxfijvtkhetopn'
PROD_HOST='aws-1-us-east-2.pooler.supabase.com'
PROD_PORT='5432'
PROD_USER="postgres.${PROD_REF}"
PG_IMAGE='postgres:17-alpine'                      # client >= server; Supabase runs 15-17

echo
echo "  Step 1 — production public-schema dump (READ-ONLY)"
echo "  host: ${PROD_HOST}:${PROD_PORT}"
echo "  user: ${PROD_USER}"
echo "  ref : ${PROD_REF}  (PRODUCTION — this step reads production deliberately)"
echo

# ── Guard: this must be PRODUCTION, and nothing else ───────────────────────
# Step 1 exists to read production. If someone repoints this at another project, the dump would be of the
# wrong schema and the whole reconciliation downstream would be measuring the wrong thing - quietly.
case "$PROD_USER" in
  *"$PROD_REF"*) : ;;
  *) echo "  REFUSING: user '${PROD_USER}' does not carry the production ref '${PROD_REF}'."; exit 1 ;;
esac
if [ "$PROD_PORT" = "6543" ]; then
  echo "  REFUSING: port 6543 is the TRANSACTION-mode pooler; pg_dump cannot work through it."
  echo "            Use 5432 (session mode) or the direct host."
  exit 1
fi

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

# ── --check-connection: prove the credentials WITHOUT producing a dump ─────
#
# Iterating on a password by running a full dump is slow and leaves files behind. This mode authenticates,
# reads two catalog values, and exits. It writes nothing.
CHECK_ONLY=0
case "${1:-}" in --check-connection) CHECK_ONLY=1 ;; esac

# ── The password. Read silently; never echoed, never in argv, never stored ──
read -rsp '  production DB password (input hidden): ' PGPASSWORD
echo
[ -n "$PGPASSWORD" ] || { echo "  FAILED: empty password — refusing to continue."; rmdir "$DUMP_DIR" 2>/dev/null; exit 1; }
export PGPASSWORD

export PGHOST="$PROD_HOST" PGPORT="$PROD_PORT" PGUSER="$PROD_USER" PGDATABASE=postgres

if [ "$CHECK_ONLY" -eq 1 ]; then
  echo "  --check-connection: authenticating only, writing nothing ..."
  MSYS_NO_PATHCONV=1 docker run --rm \
    -e PGPASSWORD -e PGHOST -e PGPORT -e PGUSER -e PGDATABASE \
    "$PG_IMAGE" \
    psql -tAc "select 'connected as ' || current_user || ' to ' || current_database() || ' | server ' || split_part(version(), ' ', 2);"
  CHECK_STATUS=$?
  unset PGPASSWORD
  rmdir -- "$DUMP_DIR" 2>/dev/null
  echo "  PGPASSWORD unset"
  if [ "$CHECK_STATUS" -eq 0 ]; then
    echo "  credentials OK. Re-run without --check-connection to produce the dump."
  else
    echo "  credentials FAILED (exit $CHECK_STATUS). Nothing was written."
    echo "  If this says 'password authentication failed', the password is wrong for this project —"
    echo "  connectivity and routing already worked. Check you are using the DATABASE password"
    echo "  (Project Settings -> Database), not the anon key, the service_role key, or an access token."
  fi
  exit "$CHECK_STATUS"
fi

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

  # Clean up after ourselves rather than telling the operator to. A failed run leaves an empty or partial
  # file; leaving fragments of a production schema lying around in temp is not something to delegate.
  rm -f -- "$DUMP_FILE" 2>/dev/null
  rmdir -- "$DUMP_DIR" 2>/dev/null
  echo "  cleaned up: removed the partial file and its temp dir"

  echo
  echo "  ── what the two known failure modes look like ──"
  echo
  echo "  'Network unreachable' on an IPv6 address (2600:...):"
  echo "      The DIRECT host db.<ref>.supabase.co publishes ONLY an AAAA record — Supabase direct"
  echo "      connections are IPv6-only. The default Docker bridge has EnableIPv6=false, so the container"
  echo "      has no route. This is NOT a credential problem. Use the pooler host (already the default"
  echo "      here), which resolves to IPv4."
  echo
  echo "  'password authentication failed for user \"postgres\"':"
  echo "      Connectivity and tenant routing WORKED — you reached the server. Supavisor parses the ref"
  echo "      out of postgres.<ref> and then authenticates upstream as 'postgres', which is why the error"
  echo "      names 'postgres' rather than the full username. It does NOT mean PGUSER failed to arrive."
  echo "      It means the password is wrong for this project."
  echo
  echo "      Most common cause: using an API key instead of the DATABASE password. The anon key, the"
  echo "      service_role key and a personal access token are all different things and none of them will"
  echo "      authenticate here. The database password is under"
  echo "          Project Settings -> Database -> Database password"
  echo
  echo "  To test credentials WITHOUT producing a dump:  bash $0 --check-connection"
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
