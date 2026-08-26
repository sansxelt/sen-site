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
and install a matching client — an older `pg_dump` against a newer server aborts with a version mismatch
rather than producing a partial file, but do not find that out at the end of a long run.

**Verified for this project, 2026-08-25:** server **17.6** (reported by `--check-connection`), client
`pg_dump 17.11` from `postgres:17-alpine`. Client is newer than the server, which is the requirement.

> **Port 5432, not 6543.**
> `pg_dump` cannot work through Supabase's **transaction**-mode pooler (`6543`). It works through the
> **session**-mode pooler (`5432`) and through the direct host `db.<ref>.supabase.co:5432`. This project's
> dashboard reports the shared pooler, so the commands below use
> `aws-1-us-east-2.pooler.supabase.com:5432` with the ref in the username. If your database password
> contains special characters and you ever build a URL by hand, percent-encode them — the scripts here
> avoid that entirely by passing the password through the environment instead of a URL.

---

## Step 1 — export the schema from production (READ-ONLY)

```bash
# Credentials via the environment, never on the command line: argv is visible to other processes.
read -rsp 'production DB password: ' PGPASSWORD; echo; export PGPASSWORD
export PGHOST='aws-1-us-east-2.pooler.supabase.com'      # session-mode pooler
export PGPORT=5432                                       # 5432 = session mode; 6543 would NOT work
export PGUSER='postgres.gvcqzovxfijvtkhetopn'            # the ref rides in the USERNAME here
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

**Executed 2026-08-25. Result: EMPTY, verified.**

```bash
bash ops/check-staging-empty.sh
```

Use the **session pooler**, not the direct host: `db.<ref>.supabase.co` publishes only an AAAA record
and Docker's default bridge has `EnableIPv6: false`, so a container gets "Network unreachable". The ref
rides in the *username* (`postgres.<ref>`) for pooler connections.

TLS is read from `\conninfo`, which reports the **client** link. `pg_stat_ssl` describes the pooler's
*backend* link (Supavisor→Postgres) and misleadingly reports `ssl = off`.

> This check is load-bearing. Restoring into a non-empty `public` whose object names simply do not
> collide returns **exit 0** and silently merges alongside whatever was there. `ON_ERROR_STOP` and
> `--single-transaction` protect against *name collisions*, not against a dirty target.

---

## Step 4 — restore into staging

**Executed 2026-08-25. Result: committed, `psql exit 0`.**

```bash
bash ops/restore-staging-schema.sh /tmp/vraelis-schema-XXXXXXXX/prod-public-schema.sql
# add --preflight-only as a second argument for a dry run that writes nothing
```

### The dump does NOT apply as-is. Two statements collide, and each one aborts the whole restore.

The earlier version of this document said to run `psql -f prod-public-schema.sql` and to "expect some
benign noise about extensions or roles that already exist". That was wrong. Under `--single-transaction`
there is no benign noise — there are two hard failures, and each discards everything:

| | Statement | Error | Where |
|---|---|---|---|
| **A** | `CREATE SCHEMA public;` (line 26, no `IF NOT EXISTS`) | `schema "public" already exists` | the **first** statement |
| **B** | `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin ...` (12 lines) | `permission denied to change default privileges` | **line 6900**, after all 107 tables |

**B** is the dangerous one. `ALTER DEFAULT PRIVILEGES FOR ROLE <r>` requires membership in `<r>`, and
Supabase's `postgres` is neither a superuser nor a member of `supabase_admin`. Fixing only the obvious
`CREATE SCHEMA` line yields a restore that runs for thousands of statements and *then* throws it away.

Both are resolved before connecting, with no `DROP`, no `--clean` and no `--if-exists`: the script
derives a restore copy in which exactly those 13 lines are commented out in place, each with a marker
saying why. The original dump is never modified; the copy is re-derived on every run with the diff
asserted to be exactly 1 class-A + 12 class-B + 0 unexpected, so a stale artifact cannot be used. Class B
is validated at run time — if `postgres` turned out to *be* a member of `supabase_admin`, the script
stops rather than silently make staging differ from production.

`--single-transaction` means it all applies or none of it does. Verified: an induced failure at line 5858,
after all 107 tables had been created, left 0 tables and 0 functions behind.

---

## Step 4b — reconcile structurally

`ops/restore-staging-schema.sh` reconciles by **counts and table names**. That is too coarse to trust on
its own: a column whose type differs still counts as one column.

```bash
bash ops/reconcile-staging-schema.sh /tmp/vraelis-schema-XXXXXXXX/prod-public-schema.sql
```

This restores the same derived file into a throwaway PostgreSQL shaped like a Supabase project,
fingerprints it and staging with the identical query (`ops/schema-fingerprint.sql`), and diffs — about
5,200 facts covering every column type, nullability and default, every index and constraint definition,
every RLS flag and policy, every table and function grant, sequences, enum types, triggers and default
privileges. It writes nothing to staging: every statement is a `SELECT` inside `BEGIN READ ONLY`.

It refuses to report a match when either fingerprint is empty, so an unreachable or empty target cannot
pass vacuously.

---

## Step 5 — the RLS preflight

```bash
npx tsx scripts/db-target-identify.ts          # must print STAGING and exit 0
npx tsx scripts/rls-preflight.ts --url "$STAGING_URL" --json preflight-staging.json
```

Read-only: catalog metadata only, `default_transaction_read_only` verified server-side, every statement
asserted to be a `SELECT`.

---

## Two known differences from production, by design

1. **The 12 `supabase_admin` default-privilege grants are not applied.** They govern privileges on
   *future* objects created by `supabase_admin`, not the 107 restored tables, and a Supabase project
   already carries the platform's own defaults.

2. **The event trigger behind production's RLS state is not in the dump.** Production has a
   `public.rls_auto_enable()` event-trigger function that force-enables RLS on every new table in
   `public` — which is why 107 tables are RLS-enabled with 0 policies. `pg_dump --schema=public`
   exported the **function** but not the **event trigger**, because event triggers are database-level
   objects and were never selected. All 107 tables carry explicit `ENABLE ROW LEVEL SECURITY`, so the
   present RLS state transfers faithfully — but staging will **not** auto-enable RLS on tables created
   in future the way production does.

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

Verified offline (`--identify-only`, no connection), in the shape actually used — the session pooler,
with the ref in the username:

```
  1. Database host        aws-0-us-west-2.pooler.supabase.com:5432
  2. Database name        postgres
  3. Database user        postgres.mxxhpfbazbwczrhuxasv
  4. Supabase project ref mxxhpfbazbwczrhuxasv
  5. Environment          STAGING          exit 0
```

**Independently confirmed by the owner** against the Supabase dashboard's Copy button on 2026-08-25.
What this tooling checks mechanically is separate and narrower: 20 lowercase alphanumeric characters,
and distinct from production. Both hold.

---

## Status

| Step | State |
|---|---|
| 1 — production schema dump (read-only) | **done** 2026-08-25, `pg_dump exit 0`, verified 11/11 |
| 2 — verify the file | **done** — 0 `COPY`, 0 `INSERT`, 0 secret-shaped literals, no non-public DDL |
| 3 — confirm staging empty | **done** — all object counts 0, TLSv1.3 |
| 4 — restore into staging | **done** 2026-08-25, `psql exit 0`, committed in one transaction |
| 4b — structural reconciliation | tooling ready and tested offline; not yet run against staging |
| 5 — RLS preflight | **not started** — needs separate approval |

The RLS and security migrations have **not** been run against staging or production. The verified dump
has not been deleted. Nothing has been pushed, merged, deployed, or applied to production.
