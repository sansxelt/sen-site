# Schema-only transfer: production → staging

**Status: PRESENTED FOR APPROVAL. Nothing here has been run. No database has been accessed.**

Goal: give staging the same **shape** as production so the RLS preflight reconciles against something
real — while copying **no application data, no Auth users, no secrets, no storage objects, and no Vault
contents**, and modifying production in no way.

---

## The one-line summary of why this is safe

`pg_dump --schema-only --schema=public` does two things that matter:

- **`--schema-only`** emits DDL only. No `COPY`, no `INSERT`, no row ever leaves.
- **`--schema=public`** restricts it to one schema. `auth`, `storage`, `vault`, `pgsodium`,
  `supabase_functions`, `realtime`, `extensions` and `graphql` are **never read**, so Auth users, storage
  objects and Vault secrets are excluded by *not being selected* — not by a filter that could be
  misconfigured.

`pg_dump` is read-only. It issues `SELECT` against catalogs and takes `ACCESS SHARE` locks, which do not
block reads or writes and change nothing.

---

## Step 0 — prerequisites, checked before anything connects

```bash
# pg_dump must be >= the server's major version, or it refuses to dump.
pg_dump --version
```

Supabase currently runs PostgreSQL 15–17. If your local `pg_dump` is older than the project's server, stop
and install a matching client — an older `pg_dump` against a newer server errors out rather than producing
a partial file, but do not find that out at the end of a long run.

> **Use the DIRECT connection, not the transaction pooler.**
> `pg_dump` does not work through Supabase's transaction-mode pooler (port `6543`). Use the direct host
> `db.<ref>.supabase.co:5432`, or the session-mode pooler on `5432`. This is the single most common way this
> procedure fails.

---

## Step 1 — export the schema from production (READ-ONLY)

```bash
# Credentials via the environment, never on the command line: argv is visible to other processes.
read -rsp 'production DB password: ' PGPASSWORD; echo; export PGPASSWORD
export PGHOST='db.gvcqzovxfijvtkhetopn.supabase.co'
export PGPORT=5432
export PGUSER=postgres
export PGDATABASE=postgres

pg_dump \
  --schema-only \
  --schema=public \
  --no-owner \
  --no-comments \
  --file=prod-public-schema.sql
echo "pg_dump exit: $?"      # read on the NEXT line; a pipe would report the wrong command's status
```

**On the flags, and one deliberate omission:**

| Flag | Why |
|---|---|
| `--schema-only` | **The one that matters.** DDL only; no row data of any kind. |
| `--schema=public` | Excludes `auth`, `storage`, `vault`, `pgsodium`, `realtime`, `supabase_functions`. |
| `--no-owner` | Staging's object owner differs; ownership statements would fail or grant the wrong thing. |
| `--no-comments` | Comments are free-text and occasionally hold notes nobody meant to publish. Cheap to drop. |

**`--no-privileges` is deliberately NOT used.** Stripping `GRANT`s would make the reconciliation lie: the
RLS preflight specifically checks which tables `anon` and `authenticated` can reach, and a clone with no
grants would report a clean bill of health that production does not have. The grants are part of the shape
being reconciled.

`unset PGPASSWORD` when the step is done.

---

## Step 2 — verify the file BEFORE it goes anywhere

This is the gate. Do not skip it because `--schema-only` was passed; verify that it did what it says.

```bash
# 2a. NO ROW DATA. Both must print 0.
grep -c '^COPY ' prod-public-schema.sql
grep -c '^INSERT INTO ' prod-public-schema.sql

# 2b. NO other schema leaked in. Should print nothing.
grep -nE '^(CREATE|ALTER|COPY)[^;]*\b(auth|storage|vault|pgsodium|supabase_functions|realtime)\.' \
  prod-public-schema.sql

# 2c. No Auth users, storage objects, or Vault rows by name. Should print nothing.
grep -niE '\b(auth\.users|auth\.identities|auth\.sessions|storage\.objects|storage\.buckets|vault\.secrets|vault\.decrypted_secrets)\b' \
  prod-public-schema.sql

# 2d. NO SECRET-SHAPED LITERALS. A schema-only dump can still carry a secret in a column DEFAULT,
#     a function body, or a policy expression. Review every hit by hand; do not assume zero.
grep -nEi '(sk_live|pk_live|whsec_|eyJ[A-Za-z0-9_-]{20,}|-----BEGIN|AKIA[0-9A-Z]{16}|xox[baprs]-|service_role)' \
  prod-public-schema.sql

# 2e. What you ARE about to transfer.
grep -c '^CREATE TABLE ' prod-public-schema.sql
grep -c '^CREATE POLICY ' prod-public-schema.sql
grep -c 'ENABLE ROW LEVEL SECURITY' prod-public-schema.sql
```

**Stop conditions for this step**

- `2a` prints anything but `0` → the dump carries data. Delete it and re-export.
- `2b` or `2c` prints anything → a non-public schema leaked in. Stop and investigate before proceeding.
- `2d` prints a hit that is a real credential → **stop**. Remove the secret from production's schema first;
  a hardcoded key in a function body is a finding in its own right, and copying it to staging duplicates it.
- `2e` prints `0` tables → the dump is empty; something is wrong with the connection or schema name.

`2d` is not theatre: this repository has a known history of a hardcoded literal in `lib/stealth.ts`, so the
possibility of a literal living in a database function is real rather than hypothetical.

The preflight enforces `2a` mechanically too — `rls-preflight.ts --dump` **refuses** a file containing
`COPY` or `INSERT` — but check it here, before the file is copied anywhere.

---

## Step 3 — confirm staging's `public` schema is empty

Restoring onto existing objects produces partial failures that are tedious to unpick.

```bash
read -rsp 'staging DB password: ' PGPASSWORD; echo; export PGPASSWORD
export PGHOST='db.mxxhpfbazbwczrhuxasv.supabase.co'   # owner-confirmed staging
export PGPORT=5432
export PGUSER=postgres
export PGDATABASE=postgres

psql -v ON_ERROR_STOP=1 -c \
  "select count(*) as public_tables from pg_tables where schemaname='public';"
echo "exit: $?"
```

Expect `0`. If it is not 0, stop and decide deliberately — this procedure does **not** use `--clean` or
`--if-exists`, because a transfer script that drops objects is a transfer script that can drop the wrong
ones.

---

## Step 4 — restore into staging

```bash
# Still pointed at staging from Step 3.
psql -v ON_ERROR_STOP=1 -f prod-public-schema.sql
echo "psql exit: $?"
```

`ON_ERROR_STOP=1` so it halts on the first problem rather than half-applying and reporting success.

Expect some benign noise about extensions or roles that already exist. Read them; do not wave them
through.

---

## Step 5 — verify the clone, then run the preflight

```bash
export STAGING_URL="postgresql://postgres:$PGPASSWORD@$PGHOST:5432/postgres"
unset PGPASSWORD

# 5a. Identify the target. Must print STAGING and exit 0.
npx tsx scripts/db-target-identify.ts
echo "exit: $?"

# 5b. The read-only reconciliation.
npx tsx scripts/rls-preflight.ts --url "$STAGING_URL" --json preflight-staging.json
echo "exit: $?"
```

`5a` refuses production outright and refuses anything not positively identifiable as staging. `5b` is
read-only: catalog metadata only, `default_transaction_read_only` verified by the server, every statement
asserted to be a `SELECT`.

---

## What this procedure never touches

| Asset | Why it cannot be copied |
|---|---|
| Application rows | `--schema-only`; verified by Step 2a |
| Auth users (`auth.users`, identities, sessions) | `auth` schema never selected; verified by 2b/2c |
| Storage objects and buckets | `storage` schema never selected |
| Vault secrets | `vault` schema never selected |
| API keys, JWT secret, service-role key | Project-level config, not in any schema; never read |
| Production itself | `pg_dump` is read-only — `SELECT` and `ACCESS SHARE` locks only |

Nothing in this procedure writes to production. The only write is Step 4, into staging.

---

## Target refs, both confirmed

| | Ref | Status |
|---|---|---|
| Production | `gvcqzovxfijvtkhetopn` | **permanently denied** — refused in every connection shape |
| Staging | `mxxhpfbazbwczrhuxasv` | owner-confirmed, allowlisted |

The staging ref was corrected on 2026-08-25 after a dropped `x`; the earlier 19-character value
`mxhpfbazbwczrhuxasv` is removed from the allowlist and now classifies as UNKNOWN and is refused. It is
recorded under `_removedEntries` so that if it resurfaces in a URL it is recognisable as the known-bad
value rather than a new mystery.

Verified offline (`--identify-only`, no connection):

```
  1. Database host        db.mxxhpfbazbwczrhuxasv.supabase.co:5432
  2. Database name        postgres
  3. Database user        postgres
  4. Supabase project ref mxxhpfbazbwczrhuxasv
  5. Environment          STAGING          exit 0
```

**Not independently verified by this tooling.** `confirmed: true` records the OWNER's confirmation. Checking
the ref against the Supabase dashboard's Copy button needs a browser and dashboard access, which this
tooling does not have and which is out of scope. What was checked mechanically: 20 lowercase alphanumeric
characters, exactly the earlier string with an `x` re-inserted at position 3, and distinct from production.

---

## Awaiting approval

Nothing above has been executed. No database has been accessed. I will not run Step 1 or any later step
until you approve, and I will re-present the exact commands with the corrected ref filled in first.
