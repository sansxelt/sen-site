# Staging migration runbook

**Operator-safe procedure for applying the security-remediation migrations to a STAGING database.**

Branch: `security-remediation-2026-08-24`
Migrations: 9, none applied anywhere.

> ### The one rule
>
> **Do not run any migration command until `npx tsx scripts/rls-preflight.ts` reports `VERDICT: CLEAR`
> against the database you are about to touch.**
>
> Not "mostly clear". Not "clear except the one we know about". `CLEAR`, exit code `0`. Every blocker is
> there because something the migrations assume is not true of that database, and the cheapest moment to
> discover that is before anything has been written.
>
> This runbook is for **staging**. Production is a separate decision, made only after a staging run has
> completed and the preflight has been run against a clone of the real production schema.

---

## 0. Prerequisites

- [ ] **A staging database whose schema is cloned from production.** Not a schema built from `sql/` — see
      §1 for why that is not equivalent.
- [ ] `psql` on PATH, or Docker (the preflight falls back to a containerised psql).
- [ ] Node 20+ and the repo's dependencies installed (`npm ci`).
- [ ] Connection URL for staging, as an environment variable, never pasted into a shared channel.
- [ ] **A backup, and a verified restore path.** Six of the nine migrations are not transactional (§3), so
      "roll it back" can mean "restore".

### Getting the schema clone safely

Only **schema metadata** may leave production. No customer data, no secrets, no tokens.

```bash
# On a machine authorised to reach production, SCHEMA ONLY:
pg_dump --schema-only --no-owner --no-privileges --no-acl \
        --schema=public "$PROD_URL" > prod-schema.sql

# Sanity-check it carries no rows before it goes anywhere:
grep -c "^COPY \|^INSERT INTO " prod-schema.sql     # must print 0
```

The preflight enforces this itself: `--dump` **refuses** a file containing `COPY` or `INSERT` and tells you
to re-export. That is a machine-checked rule, not a convention.

```bash
# Reconcile against the production SCHEMA without touching production:
npx tsx scripts/rls-preflight.ts --dump prod-schema.sql --json preflight-prod-schema.json
```

---

## 1. Why a schema built from `sql/` is not a rehearsal

`sql/vraelis-rls-01-deny-by-default.sql` enables RLS on **95 tables by name**, inside one transaction, with
no `if exists` guard — so **one absent table rolls back the whole migration**.

Those 95 names are defined across **two directories**: `sql/` and `docs/`. Roughly **42 of them exist only
under `docs/*.sql`** — `analytics_events`, `waitlist`, `desktop_sessions`, `github_integrations`, `notes`,
`projects`, and others — and `sql/README.md` never mentions `docs/` as part of the migration path.

Consequences:

- A database built by applying `sql/` alone is **missing ~42 tables**, and the RLS migration will abort on
  the first one. That abort is clean (the migration is transactional), but it is not a rehearsal.
- `referral_events` is worse: **no `CREATE TABLE` for it exists anywhere in the repository.** Its shape
  survives only as a comment in `lib/referral.ts`. The app writes to it and
  `sql/vraelis-referral-idempotency.sql` builds a unique index on it.

This is why the preflight must be run against a clone of the **real** schema.

---

## 2. Environment-variable validation

Run this before migrating. Missing values do not break the migration, but they do make the post-migration
smoke tests meaningless — a route that returns 403 because a secret is unset looks exactly like a route
that returns 403 because it is working.

```bash
npx tsx -e '
const need = {
  AUTH_SECRET:              "sessions cannot be signed without it",
  SUPABASE_URL:             "no database access",
  SUPABASE_SERVICE_ROLE_KEY:"no database access",
  CRON_SECRET:              "every cron route FAILS CLOSED without it (returns 403)",
  TWILIO_INBOUND_SECRET:    "the SMS webhook FAILS CLOSED without it",
  INBOUND_SECRET:           "the inbound-email webhook fails closed",
  VRAELIS_SECRET_KEY:       "preflight vault + stealth tokens",
};
let bad = 0;
for (const [k, why] of Object.entries(need)) {
  const v = (process.env[k] ?? "").trim();
  if (!v) { console.log(`MISSING  ${k.padEnd(28)} ${why}`); bad++; }
  else console.log(`ok       ${k.padEnd(28)} (${v.length} chars)`);
}
// Bounded numeric overrides: an out-of-range value silently falls back, so print what is ACTUALLY in force.
process.exit(bad ? 1 : 0);
'
```

Then confirm the payment ceilings actually in force (an out-of-range override falls back silently, so read
the effective value rather than the variable):

```bash
npx tsx -e '
import("./lib/vraelis-payment-authz.ts").then((m) => {
  console.log("AUTO_PAY_MAX_CENTS   ", m.AUTO_MAX_CENTS(),  "(launch default 50000 = $500)");
  console.log("AUTO_PAY_FLOOR_CENTS ", m.AUTO_FLOOR_CENTS());
  console.log("AUTO_PAY_DAILY_CENTS ", m.DAILY_CENTS());
  console.log("AUTO_PAY_CYCLE_CENTS ", m.CYCLE_CENTS());
  console.log("TTL_SECONDS          ", m.RESERVATION_TTL_SECONDS());
});
'
```

**Stop if `AUTO_MAX_CENTS` is not what you intended.** It is the single number that bounds one successful
manipulation.

`AUTH_COOKIE_DOMAIN` is **inert** — nothing reads it. Setting it does nothing. See `.env.example`.

---

## 3. Transaction behaviour — read before choosing an order

| Migration | Transactional? | Notes |
|---|---|---|
| `vraelis-credit-hold-atomic.sql` | No | 4 statements; a mid-file failure half-applies |
| `vraelis-session-revocation.sql` | No | 4 statements |
| `vraelis-expire-monthly-atomic.sql` | No | depends on an index it does not create — see §5 |
| `vraelis-agent-payment-cap.sql` | No | creates its own table + 2 functions |
| `vraelis-oauth-identity-binding.sql` | No | creates its own table + 1 function |
| `vraelis-canonical-not-identity.sql` | No | 2 statements (drop index, create index) |
| `vraelis-subscription-id-unique.sql` | **Must not be** | `CREATE INDEX CONCURRENTLY` |
| `vraelis-referral-idempotency.sql` | **Must not be** | `CREATE INDEX CONCURRENTLY` |
| `vraelis-rls-01-deny-by-default.sql` | **Yes** (`begin;` :34 → `commit;` :244) | all-or-nothing |

**Six of nine are bare statement sequences.** If one fails midway, part of it is applied. Each is written to
be idempotent, so re-running is the normal recovery — but check what landed before you re-run.

> **`sql/README.md` is wrong for two of these.** It says files are "applied by hand in the Supabase SQL
> editor". The two `CONCURRENTLY` migrations **cannot run inside a transaction**, and a SQL editor that
> wraps submissions in one will fail them. Run those two through `psql`, each on its own, or verify your
> editor does not wrap. Do not assume.

---

## 4. Order

Dependencies first, `CONCURRENTLY` on their own, RLS **last** — it revokes broadly, so anything created
after it relies on the catch-all rather than the reviewable list.

```
1.  vraelis-credit-hold-atomic.sql
2.  vraelis-session-revocation.sql
3.  vraelis-expire-monthly-atomic.sql          (see §5 first — silent dependency)
4.  vraelis-agent-payment-cap.sql
5.  vraelis-oauth-identity-binding.sql
6.  vraelis-canonical-not-identity.sql
7.  vraelis-subscription-id-unique.sql         CONCURRENTLY — alone, no transaction
8.  vraelis-referral-idempotency.sql           CONCURRENTLY — alone, no transaction
9.  vraelis-rls-01-deny-by-default.sql         LAST
```

---

## 5. The silent dependency — check this one by hand

`v_expire_monthly`'s entire replay protection is an `exception when unique_violation` handler. That handler
can only fire if a unique constraint exists on the insert. The migration adds the `ext_ref` **column** but
never the **index** — only `sql/vraelis-rank.sql:135` creates `v_ledger_extref_uidx`.

**If the index is absent, the migration applies cleanly, the function runs, and a replayed webhook simply
inserts a second clawback. Nothing errors.** The atomicity work would look deployed and be silently
half-effective, which is worse than not deploying it.

```sql
-- Must return one row. If it returns none, STOP and create the index first.
select indexname, indexdef from pg_indexes
 where schemaname = 'public' and indexname = 'v_ledger_extref_uidx';
```

The preflight checks this by name and BLOCKS if it is missing.

---

## 6. The two CONCURRENTLY migrations

Both **fail if duplicates already exist**, and a failed concurrent build leaves an **INVALID** index behind.
Because `if not exists` matches on *name*, a re-run then skips it — so the index stays invalid and enforces
nothing, silently, forever.

**Before #7** (`vraelis-subscription-id-unique.sql`):

```sql
select plan_subscription_id, count(*)
  from vraelis_workspaces
 where plan_subscription_id is not null
 group by plan_subscription_id having count(*) > 1;
```

**Before #8** (`vraelis-referral-idempotency.sql`):

```sql
select referred_email, count(*)
  from referral_events
 where kind = 'signup'
 group by referred_email having count(*) > 1;
```

Any rows returned mean the index build **will** fail. For referrals, a duplicate means credits were awarded
more than once for one signup: decide which event is canonical, delete the others, and reconcile the credit
ledger **by hand** before building the index.

**After each**, confirm the index is valid, not merely present:

```sql
select c.relname, i.indisvalid
  from pg_class c join pg_index i on i.indexrelid = c.oid
 where c.relname in ('vraelis_workspaces_plan_subscription_id_uidx', 'referral_events_signup_uidx');
-- indisvalid must be TRUE. If false: drop the index and rebuild; do not re-run the migration.
```

---

## 7. Procedure

### Step 1 — preflight (mandatory)

```bash
export STAGING_URL='postgres://...'          # never inline in a shared command
npx tsx scripts/rls-preflight.ts --url "$STAGING_URL" --json preflight-staging.json
echo "preflight exit: $?"                     # must be 0
```

**Exit 0 = CLEAR → proceed. Exit 1 = BLOCKED → stop. Exit 2 = ERROR → stop; it could not determine.**

For every blocker, resolve the underlying fact — do not edit the manifest to silence it unless you have
actually reviewed the object and are recording that review.

### Step 2 — backup

```bash
pg_dump --format=custom "$STAGING_URL" > staging-before-migration.dump
```

Confirm the file is non-trivial and that you know how to restore it.

### Step 3 — apply, one at a time, checking each

```bash
for f in \
  sql/vraelis-credit-hold-atomic.sql \
  sql/vraelis-session-revocation.sql \
  sql/vraelis-expire-monthly-atomic.sql \
  sql/vraelis-agent-payment-cap.sql \
  sql/vraelis-oauth-identity-binding.sql \
  sql/vraelis-canonical-not-identity.sql
do
  echo "── $f"
  psql "$STAGING_URL" -v ON_ERROR_STOP=1 -f "$f"
  code=$?                                    # read IMMEDIATELY — see the note below
  echo "   exit=$code"
  [ "$code" -ne 0 ] && { echo "STOP: $f failed"; break; }
done
```

> **Read `$?` on the very next line.** `psql -f x.sql | tee log` reports `tee`'s status, and
> `echo "$(basename $f) $?"` prints `basename`'s. Both print 0 for a failed migration. This cost this
> project two false "green" reports; `scripts/gates.ts` exists because of it.

Then the two `CONCURRENTLY` files, each **alone and unwrapped**:

```bash
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -f sql/vraelis-subscription-id-unique.sql;  echo "exit=$?"
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -f sql/vraelis-referral-idempotency.sql;    echo "exit=$?"
```

Finally, RLS:

```bash
psql "$STAGING_URL" -v ON_ERROR_STOP=1 -f sql/vraelis-rls-01-deny-by-default.sql;  echo "exit=$?"
```

### Step 4 — verify

Each migration ships a read-only verifier. Run all of them; every line must read `OK`.

```bash
for v in \
  sql/vraelis-credit-hold-atomic-verify.sql \
  sql/vraelis-session-revocation-verify.sql \
  sql/vraelis-expire-monthly-atomic-verify.sql \
  sql/vraelis-agent-payment-cap-verify.sql \
  sql/vraelis-oauth-identity-binding-verify.sql \
  sql/vraelis-canonical-not-identity-verify.sql \
  sql/vraelis-rls-verify.sql
do
  echo "── $v"; psql "$STAGING_URL" -f "$v"; echo "   exit=$?"
done
```

Then re-run the preflight. It should now report the post-migration state consistently.

---

## 8. Stop conditions

Stop, and do not continue to the next migration, if **any** of these is true:

1. The preflight reports anything other than `CLEAR` (exit 0).
2. Any migration exits non-zero.
3. A verifier prints `FAIL` (or `REVIEW` on the `ext_ref` index — treat that as FAIL).
4. Either duplicate-detection query in §6 returns rows.
5. Any index reports `indisvalid = false`.
6. `service_role` cannot call a function after the RLS migration (§9) — the application connects as
   `service_role`, so that is a full outage.
7. `anon` **can** read a table after the RLS migration.
8. You are on production and have not completed a staging run.

---

## 9. Post-migration smoke tests

Run against staging, in this order. Each has an explicit pass condition.

### 9.1 Database roles — do this first

```sql
-- service_role must still be able to work. It is how the app connects.
set role service_role;
select v_reserve_agent_payment('smoke@test.invalid', 100, 500000, 2000000) ->> 'ok';   -- expect: true
select v_bind_oauth_identity('github', 'smoke-1', 'smoke@test.invalid') ->> 'status';  -- expect: bound
select v_expire_monthly('smoke@test.invalid') ->> 'ok';                                -- expect: true
reset role;

-- anon must be able to read NOTHING.
set role anon;
select count(*) from v_credit_ledger;        -- expect: permission denied
select count(*) from v_oauth_identities;     -- expect: permission denied
reset role;
```

**FAIL if** `service_role` gets `permission denied` (outage) or `anon` gets a row count (the migration did
not take).

Clean up the smoke rows afterwards:
```sql
delete from v_agent_payment_reservations where owner_email = 'smoke@test.invalid';
delete from v_oauth_identities where email = 'smoke@test.invalid';
```

### 9.2 RLS coverage

```sql
select count(*) filter (where rowsecurity) as with_rls,
       count(*)                            as total,
       coalesce(string_agg(tablename, ', ') filter (where not rowsecurity), '(none)') as missing
  from pg_tables where schemaname = 'public';
```
**PASS**: `with_rls = total`, `missing = (none)`.

```sql
-- No browser-facing grants may survive.
select grantee, count(*) from information_schema.role_table_grants
 where table_schema = 'public' and grantee in ('anon','authenticated') group by grantee;
```
**PASS**: zero rows.

### 9.3 Auth — password sign-in

- Sign in with a known staging account at `/signin`. **PASS**: reaches `/account`.
- Sign in with a wrong password 11 times from one IP. **PASS**: refusals are indistinguishable from a wrong
  password (never a distinct "locked" message), and the *correct* password still works afterwards — the
  per-mailbox bucket is consumed only on failure, so a stranger cannot lock out the real owner.

### 9.4 Session revocation

- Sign in on two browsers. Change the password in one via `/account`.
  **PASS**: the other browser is signed out on its next request.
- Repeat with a desktop client signed in. **PASS**: the desktop session is also revoked (password reset is
  the account-wide sweep; ordinary web sign-out is deliberately **not**).

### 9.5 SSO

- Complete an SSO sign-in. **PASS**: a session is issued **and** a subsequent password reset for that user
  revokes it. Before this remediation an SSO session survived every revocation, so this is the regression to
  watch.

### 9.6 Credits

```sql
-- Concurrency is proven in scripts/phase2-credit-concurrency-verify.ts; this is the deployed-shape check.
select v_hold_credits('smoke@test.invalid', gen_random_uuid(), 1, 'credit');
```
**PASS**: returns a JSON verdict (an `ok:false` for insufficient balance is a *pass* — it executed).
**FAIL**: `function does not exist`, or a permission error.

### 9.7 Payment caps

```sql
select v_reserve_agent_payment('capsmoke@test.invalid', 100, 200, 999999) ->> 'ok';  -- true
select v_reserve_agent_payment('capsmoke@test.invalid', 100, 200, 999999) ->> 'ok';  -- true (200 = cap)
select v_reserve_agent_payment('capsmoke@test.invalid', 1,   200, 999999) ->> 'reason';
-- expect: daily_cap_reached      (landing exactly ON the cap is allowed; one cent past is not)
delete from v_agent_payment_reservations where owner_email = 'capsmoke@test.invalid';
```

### 9.8 OAuth

- **Google**: sign in. **PASS**: succeeds.
- **GitHub, verified address**: sign in. **PASS**: succeeds.
- **GitHub, unverified address**: an account whose only address is unverified.
  **PASS**: sign-in **FAILS**. This is the fix — previously it succeeded.
- **Binding**: sign in with GitHub, then check `select * from v_oauth_identities where provider='github'`.
  **PASS**: one row, subject recorded.

### 9.9 Cron

Every cron route authenticates with **`CRON_SECRET`** via an `Authorization: Bearer` header, constant-time
compared, and **fails closed when the secret is unset**.

Routes: `/api/cron/lifecycle`, `/api/cron/reverify-domains`, `/api/cron/webhook-retries`,
`/api/vraelis/cron/{bill-fees, followups, provision-numbers, reconcile, recovery, reminders, subscriptions}`.

```bash
# No header -> 403
curl -s -o /dev/null -w "%{http_code}\n" "$STAGING/api/cron/lifecycle"
# Wrong secret -> 403
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer wrong" "$STAGING/api/cron/lifecycle"
# Correct secret -> 200
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $CRON_SECRET" "$STAGING/api/cron/lifecycle"
```
**PASS**: `403`, `403`, `200`.

---

## 10. Rollback boundaries

**What rolls back cleanly** — every migration ships a `-rollback.sql`:

| Migration | Rollback is a true inverse? |
|---|---|
| RLS | Yes. It reads the `_rls_migration_01_applied` ledger, so it only un-protects tables *this* migration protected. |
| credit-hold / expire-monthly / agent-payment-cap / oauth-identity-binding / session-revocation | Yes — drops the functions and tables it created. The app detects the absent RPC and falls back. |
| subscription-id-unique / referral-idempotency | Yes — drops the index. |
| canonical-not-identity | **Can legitimately FAIL.** See below. |

**What does not roll back:**

- **`vraelis-canonical-not-identity.sql`.** Restoring the unique index fails if any aliases registered while
  it was absent — which is the feature working. Each collision is a real person holding two accounts. The
  rollback file carries the detection query. Do not delete an account with credits, payments, or
  applications attached without reconciling them.
- **Data written after the migration.** Reservations, identity bindings, and clawbacks are real rows.
- **A failed non-transactional migration.** Six of nine can half-apply; recovery is re-run (they are
  idempotent) or restore.

**The boundary:** rollback undoes *schema*. It does not undo *time*. If a session was revoked, a user is
signed out; rolling back does not sign them back in.

---

## 11. Before production — a separate decision

Do not treat a successful staging run as production authorisation. Required first:

1. Staging completed, every verifier `OK`, every smoke test passed.
2. The preflight run against a **sanitised clone of the production schema** (§0), reporting `CLEAR`.
3. Every blocker resolved by fixing the fact, not by editing the manifest.
4. A production backup with a **tested** restore.
5. A maintenance window, because §10 means some steps are one-way.
6. Explicit owner sign-off on the exact commands.
