# Migrations

Numbered files in this directory are SCHEMA. They are additive and safe to re-run. Historical DATA
corrections are not migrations and do not live here; see `ops/`.

## How to apply — read this before pasting anything into a SQL editor

Most files here can be applied by hand in the Supabase SQL editor. **Some cannot**, and the difference is
not cosmetic: pasting one of them into a web editor either fails outright or, worse, appears to succeed
while leaving an index that enforces nothing.

### These MUST run through `psql`, each on its own, NEVER inside a transaction

| File | Statement |
|---|---|
| `vraelis-referral-idempotency.sql` | `create unique index concurrently ... referral_events_signup_uidx` |
| `vraelis-referral-idempotency-rollback.sql` | `drop index concurrently ... referral_events_signup_uidx` |
| `vraelis-subscription-id-unique.sql` | `create unique index concurrently ... vraelis_workspaces_plan_subscription_id_uidx` |
| `vraelis-subscription-id-unique-rollback.sql` | `drop index concurrently ...` |

`CREATE INDEX CONCURRENTLY` and `DROP INDEX CONCURRENTLY` are **refused by PostgreSQL inside a transaction
block**. The Supabase SQL editor is not guaranteed to submit statements outside one, so do not rely on it
for these. None of the four contains `begin;`/`commit;`, and none may be given one.

```bash
# Correct: one file, its own connection, no wrapper.
psql "$URL" -v ON_ERROR_STOP=1 -f sql/vraelis-subscription-id-unique.sql
echo "exit=$?"          # read on the NEXT line — see "Reading exit codes" below
```

**Before running either forward CONCURRENTLY migration**, check for the duplicates that would make the
build fail:

```sql
-- for vraelis-subscription-id-unique.sql
select plan_subscription_id, count(*), array_agg(owner_email)
  from vraelis_workspaces
 where plan_subscription_id is not null
 group by plan_subscription_id having count(*) > 1;

-- for vraelis-referral-idempotency.sql
select referred_email, count(*) from referral_events
 where kind = 'signup' group by referred_email having count(*) > 1;
```

Any rows returned mean the index build **will** fail. Resolve the duplicates first. For referrals a
duplicate means credits were awarded more than once for one signup — reconcile the credit ledger by hand
before building the index.

**When a CONCURRENTLY build fails** it leaves an **INVALID** index behind. Because `if not exists` matches
on *name*, re-running then skips it and the invalid index remains, enforcing nothing, silently and
indefinitely. Always verify:

```sql
select c.relname, i.indisvalid
  from pg_class c join pg_index i on i.indexrelid = c.oid
 where c.relname in ('referral_events_signup_uidx', 'vraelis_workspaces_plan_subscription_id_uidx');
```

`indisvalid = false` → run the matching `-rollback.sql` to drop it, then re-run the forward migration.
`scripts/rls-preflight.ts` also reports any invalid index in the schema and treats it as a blocker.

### These cannot go in a web SQL editor either

Every `*-verify.sql` and `*-tests.sql` file uses psql meta-commands (`\echo`, `\set`, `\connect`), which are
a **psql client feature, not SQL**. A web editor will reject them. Run them with `psql -f`.

```bash
psql "$URL" -f sql/vraelis-credit-hold-atomic-verify.sql
```

### One file is transactional and must stay that way

`vraelis-rls-01-deny-by-default.sql` wraps itself in `begin;` / `commit;` and enables RLS on 95 tables with
no `if exists` guard. That is deliberate: one absent table aborts the whole thing and changes nothing.
Do not split it up, and do not remove the wrapper.

### Reading exit codes

Read `$?` on the line immediately after the command. `psql -f x.sql | tee log` reports **tee's** status, and
`echo "$(basename $f) $?"` reports **basename's** — both print `0` for a failed migration. This has produced
false "green" reports in this repository before; `scripts/gates.ts` exists because of it.

### The full procedure

`ops/STAGING-RUNBOOK.md` is the operator procedure: prerequisites, order, preflight, verification, stop
conditions and rollback boundaries. **No migration runs until `scripts/rls-preflight.ts` reports `CLEAR`.**

## There are two migration 19s

```
vraelis-preflight-19-guarantees.sql              Guarantees increment 1
vraelis-preflight-19-requirement-provenance.sql  requirement provenance
```

Both are applied to production. Neither is wrong, and there is no data problem: they touch different tables,
both are `if not exists` throughout, and re-running either is a no-op.

They collided because the two lines of work were developed on branches that could not see each other. The
provenance work was cut from `main`, which did not yet have the Guarantees increments; the Guarantees work
shipped to production without ever landing on `main`. Each picked the next free number in the tree it could
see, and both saw 19.

**Do not renumber them.** The names are recorded in `ops/ROLLOUT.md`, in the correction scripts, and in the
verification queries used during the provenance incident. A file that has been applied under one name and
then renamed makes those records wrong, which is a worse problem than an ambiguous ordinal.

## The real applied order

Numbers are not the order. This is:

| Applied | File | What |
|---|---|---|
| earlier | `19-guarantees.sql` | Guarantees durable object, status derivation, release rollup |
| 2026-07-25 | `19-requirement-provenance.sql` | provenance columns, additive and inert |
| 2026-07-25 | `20-provenance-defaults.sql` | honest defaults, 7 constraints, all NOT VALID |
| 2026-07-26 | `22-approved-review-state-consistency.sql` | approved matches review_state, NOT VALID |

There is no 21. It was the historical correction, which was moved out of the numbered path to
`ops/provenance-correction-MANUAL.sql` precisely so no runner could pick it up, and the number was retired
rather than reused. `scripts/preflight-provenance-integrity-verify.ts` fails the build if a 21 reappears.

## Next number

**Use 23.** Check this file and `ls sql/` first, and if you are working on a branch that does not contain
everything production runs, check the deployed tree too. That is the mistake that produced two 19s.

## Verifying what is actually applied

Numbers in filenames are intent. `ops/verify-schema.sql` reads what the database actually holds: column
defaults and constraint state, neither of which is visible over PostgREST.
