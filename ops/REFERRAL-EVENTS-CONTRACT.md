# `referral_events` — proposed contract, and the evidence for it

**Status: UNRESOLVED.** This is a hypothesis derived from code, not a description of a database.

`referral_events` has **no `CREATE TABLE` anywhere** — not in `sql/`, not in `docs/`, not in the git
history. The application has been reading and writing it for a long time, so it very likely exists in
production. Nobody can say what shape it has.

The candidate migration is [`sql/CANDIDATE-referral-events.sql`](../sql/CANDIDATE-referral-events.sql).
It **refuses to run**: it opens with a guard that raises unless someone deliberately records that
reconciliation happened, and it uses a bare `CREATE TABLE` — **not** `IF NOT EXISTS` — so if the table
already exists it fails loudly instead of silently succeeding against a different shape.

## Are there generated database types? No.

Checked, because generated types would be authoritative and make all of the below unnecessary:

| Looked for | Result |
|---|---|
| Supabase generated types (`Database`, `Tables: { Row: {...} }`) | **None.** The only `Tables: {` in the repo is inside `scripts/rls-preflight.ts` — my own code. |
| `supabase/migrations`, `prisma/`, `drizzle/` | **None.** |
| Committed `pg_dump` or schema snapshot | **None.** |
| How the client is typed | `lib/supabase-admin.ts:3` — `type SupabaseSchemaMap = Record<string, never>` |

Because the schema map is `Record<string, never>`, **every** `.from(...)` call site casts `as never`. Not
one column name in this codebase is type-checked. The compiler would not notice if every column were
renamed tomorrow.

## The proposed shape

| Column | Type | Null | Confidence | Evidence |
|---|---|---|---|---|
| `id` | `uuid` PK default `gen_random_uuid()` | NOT NULL | **medium** | Spec comment `lib/referral.ts:14` only. Projected in three head-counts (`:129`, `:187`, `:235`) but its **value is never read**; both inserts omit it, so it must have a default. |
| `referrer_email` | `text` | NOT NULL | **high** | Written non-null at `:137`/`:195` from `referral_codes.email`; read back at `:179` and destructured as a non-optional `string`; filtered at `:236`/`:241`. |
| `referred_email` | `text` | NOT NULL | **high** | Always written `.toLowerCase()` (`:138`, `:196`), always filtered lowercased (`:130`, `:170`, `:188`). It is the column of the partial unique index, which requires it to exist. |
| `code` | `text` | NOT NULL | **high** | Written `:139`/`:197`, read `:179`. `deriveCode` (`:44`) emits 8 uppercase base-36 chars. **No length constraint proposed** — the code only ever writes 8, but a `CHECK` would reject historical rows that may not conform. |
| `kind` | `text` | NOT NULL | **high** | Exactly two literals ever written: `'signup'` (`:140`), `'conversion'` (`:198`). **Not an enum, no CHECK** — if production holds a third kind, a CHECK would fail on data we do not know about. |
| `credits_awarded` | `integer` default `0` | NOT NULL | **medium** | Spec says `int not null default 0`. Written as `100`/`500`; read at `:246` annotated `{ credits_awarded: number }`, summed at `:249` with `?? 0`. **That `?? 0` is the only runtime null-tolerance in the whole file** — weak evidence *for* nullability, or just defensive coding. The two sources disagree in spirit; called out rather than silently resolved. |
| `created_at` | `timestamptz` default `now()` | NOT NULL | **low** | Spec comment only. **Never read, never written, never ordered on.** Nothing in the codebase would notice if this column did not exist. |

**No foreign keys are proposed.** `referrer_email` and `referred_email` look like they should reference
`user_profiles(email)` or `referral_codes(email)`, but nothing in the code enforces or assumes it, and
adding an FK to a table with historical rows is how a migration fails at 3am.

### Indexes

The candidate creates two read-pattern indexes: `(referred_email, kind)` and `(referrer_email, kind)`,
matching the filters at `:130`/`:170`/`:188` and `:236`/`:241`.

It does **not** create the signup-uniqueness index. That lives in
`sql/vraelis-referral-idempotency.sql` and must be built `CONCURRENTLY`, outside a transaction.

## Two findings the tracing turned up

### 1. Conversions have no database backstop

`sql/vraelis-referral-idempotency.sql:22-24` builds a **partial** index, single-column, `where kind =
'signup'`. The conversion path's check-then-insert (`lib/referral.ts:185-200`) therefore races with nothing
stopping it — and **conversions award the larger amount** (500 credits vs 100). The exact defect that
migration fixes for signups is still open for conversions.

A second partial index on `(referred_email) where kind = 'conversion'` would close it. **Not added**,
because adding an index to a table whose existence is unconfirmed is the wrong order of operations.

Mitigating: `awardReferralConversion` has **zero callers** repo-wide — only its own definition and a log
line. Nothing currently writes `kind='conversion'` at all.

### 2. The signup path fails **open**, toward minting credits

`lib/referral.ts:127-133`:

```ts
const { count: existing } = await supabase        // the error is DISCARDED
  .from("referral_events" as never)
  .select("id", { count: "exact", head: true })
  .eq("referred_email", newEmail.toLowerCase())
  .eq("kind", "signup");
if ((existing ?? 0) > 0) return;                  // null -> 0 -> guard passes
```

If the table is absent, or RLS denies, `count` is `null`, `?? 0` makes it `0`, the "already recorded" guard
passes, and `addCredits` runs anyway. The header at `:23-24` calls this behaviour "safe defaults" — on this
path the default is not safe.

Whether that matters in production depends entirely on whether the table exists, **which is the open
question this document exists to close.** The conversion path is the opposite: it checks its error at
`:174-177` and fails closed.

## How the preflight enforces this

`scripts/rls-preflight.ts` blocks on all three failure modes:

| Situation | Blocker |
|---|---|
| Table **missing** | `MISSING_DEPENDENCY_TABLE` — `vraelis-referral-idempotency.sql` builds an index on it |
| Table **unexpected** | listed in `acknowledgedExtraTables` with its reason, so it is accounted for rather than silently ignored |
| Table **structurally different** | `SCHEMA_MISMATCH` — column-by-column against the contract in `sql/rls-preflight-manifest.json` |

`SCHEMA_MISMATCH` catches a missing column, an extra column, a different type, and a different nullability.
Proven by fixtures 9 and 10 in `scripts/rls-preflight-verify.ts`: a table with `id serial` instead of
`uuid`, a nullable `referrer_email`, and an extra `campaign_id` produces three distinct diffs and blocks;
a contract-matching table comes out CLEAR.

## What resolves this

Read-only reconciliation against a staging database cloned from the production schema. It answers:

1. Does the table exist?
2. If so, do its columns, types, and nullability match the contract above?
3. If not — is the contract wrong, or is production wrong?

Only after that should anyone edit the candidate, rename it into the migration path, and run it.
