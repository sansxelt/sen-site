-- ══════════════════════════════════════════════════════════════════════════════════════════════════════
--  CANDIDATE — BLOCKED. THIS FILE REFUSES TO RUN.
-- ══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- It is named CANDIDATE- rather than vraelis-*.sql so no runner, glob, or runbook loop picks it up, and it
-- opens with a guard that raises an exception unless someone has deliberately unblocked it.
--
-- WHY IT IS BLOCKED. Nobody knows whether referral_events exists in production, or what shape it has if it
-- does. The application has been reading and writing it for a long time, so it probably exists — but no
-- CREATE TABLE for it exists anywhere in this repository or its git history. Running a CREATE TABLE
-- against a database that already has this table under a DIFFERENT shape is how you turn an unknown into
-- an outage.
--
-- WHAT UNBLOCKS IT. Read-only reconciliation against a staging database cloned from the real production
-- schema (scripts/rls-preflight.ts). That answers three questions this file cannot:
--
--   1. Does the table exist?
--   2. If so, do its columns, types, and nullability match the contract below?
--   3. If not, which of the two is wrong — this file, or production?
--
-- Only after those are answered should anyone edit this file, rename it into the migration path, and run
-- it. Until then it is a written-down hypothesis, not a migration.
--
-- ── NO `IF NOT EXISTS`, DELIBERATELY ──────────────────────────────────────────────────────────────────
--
-- `create table if not exists` would silently succeed against a table with entirely different columns and
-- leave you believing the schema matched. That is precisely the drift this file must not hide. It uses a
-- bare CREATE TABLE, so if the table already exists this FAILS — loudly, before anything is changed, which
-- is the correct outcome for a hypothesis that has just been disproved.
--
-- ══════════════════════════════════════════════════════════════════════════════════════════════════════
--  EVIDENCE FOR EVERY COLUMN
-- ══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- There are NO generated database types in this repository to check against: lib/supabase-admin.ts:3
-- types the client as `Record<string, never>` and every call site casts `as never`, so not one column name
-- is type-checked anywhere. There is no supabase/migrations, prisma, or drizzle directory. The evidence
-- below is therefore all there is.
--
-- SOURCE A — the spec comment at lib/referral.ts:13-21. The only place the shape is written down. It is a
--            comment, so it is intent, not proof: nothing enforces that production matches it.
-- SOURCE B — seven Supabase calls in lib/referral.ts, the only file that touches the table.
-- SOURCE C — sql/vraelis-referral-idempotency.sql:22-24, the partial unique index.
--
--   id               uuid, PK
--                    A: "uuid primary key default gen_random_uuid()".
--                    B: projected in three head-counts (:129, :187, :235) but its VALUE is never read, and
--                       both inserts (:136, :194) omit it — so it must have a default.
--                    CONFIDENCE: medium. The type is A-only; no code observes it.
--
--   referrer_email   text NOT NULL
--                    B: written non-null at :137 and :195 from referral_codes.email; read back at :179 and
--                       destructured as a non-optional `string`; used as an .eq() filter at :236 and :241.
--                    CONFIDENCE: high for text and NOT NULL.
--
--   referred_email   text NOT NULL
--                    B: always written .toLowerCase() (:138, :196); always filtered .toLowerCase()
--                       (:130, :170, :188).
--                    C: it is the single column of the unique index, which requires it to exist.
--                    CONFIDENCE: high.
--
--   code             text NOT NULL
--                    B: written at :139 and :197, read at :179. deriveCode (lib/referral.ts:44) produces
--                       8 uppercase base-36 characters.
--                    NOTE: NOT constrained to char(8) here. The code only ever writes 8, but a CHECK would
--                    make this migration reject historical rows that may not conform.
--                    CONFIDENCE: high for text; the length is left unconstrained on purpose.
--
--   kind             text NOT NULL
--                    B: exactly two literals ever written — 'signup' (:140) and 'conversion' (:198) — and
--                       exactly those two ever filtered on.
--                    NOTE: NOT an enum and NOT a CHECK constraint. A CHECK would be defensible, but if
--                    production holds a third kind this migration would fail on data it does not know
--                    about. Left open; the reconciliation is what should decide.
--                    CONFIDENCE: high for text.
--
--   credits_awarded  integer NOT NULL DEFAULT 0
--                    A: "int not null default 0".
--                    B: written as the literals 100 and 500 (REFERRAL_* constants); read at :246 annotated
--                       `{ credits_awarded: number }` and summed at :249 with `?? 0`.
--                    THE `?? 0` IS THE ONLY RUNTIME NULL-TOLERANCE ANYWHERE IN THIS TABLE'S USAGE. It is
--                    weak evidence FOR nullability, or merely defensive coding. A says NOT NULL. This is
--                    the single column where A and B disagree in spirit, and it is called out rather than
--                    silently resolved.
--                    CONFIDENCE: medium.
--
--   created_at       timestamptz NOT NULL DEFAULT now()
--                    A only. Never read, never written, never ordered on anywhere in the codebase.
--                    Both inserts omit it, so it must have a default if it exists and is NOT NULL.
--                    CONFIDENCE: low. Nothing in the code would notice if this column were absent.
--
-- NO FOREIGN KEYS ARE PROPOSED. referrer_email and referred_email look like they should reference
-- user_profiles(email) or referral_codes(email), but nothing in the code enforces or assumes that, and
-- adding an FK to a table with historical rows is how a migration fails at 3am. If production has them,
-- reconciliation will show it.
--
-- ══════════════════════════════════════════════════════════════════════════════════════════════════════
--  TWO THINGS THE RECONCILIATION SHOULD ALSO SETTLE
-- ══════════════════════════════════════════════════════════════════════════════════════════════════════
--
-- 1. CONVERSIONS HAVE NO DATABASE BACKSTOP. sql/vraelis-referral-idempotency.sql builds a PARTIAL index
--    `where kind = 'signup'`, so the conversion path's check-then-insert (lib/referral.ts:185-200) races
--    with nothing stopping it — and conversions award the LARGER amount (500 vs 100 credits). The same
--    defect that migration fixes for signups is still open for conversions. A second partial index on
--    (referred_email) where kind = 'conversion' would close it. NOT added here, because adding an index to
--    a table whose existence is unconfirmed is putting the cart in front of the horse.
--
-- 2. THE SIGNUP PATH FAILS OPEN TOWARD MINTING CREDITS. lib/referral.ts:127-133 destructures only `count`
--    and discards the error; if the table is absent (or RLS denies), count is null, `?? 0` makes it 0, the
--    "already recorded" guard passes, and addCredits runs anyway. The header comment at :23-24 calls this
--    "safe defaults" — on this path the default is not safe. Whether that matters in production depends
--    entirely on whether the table exists, which is the open question.
--
-- ══════════════════════════════════════════════════════════════════════════════════════════════════════

-- ── THE BLOCK ─────────────────────────────────────────────────────────────────────────────────────────
-- Raises unless the operator has explicitly recorded that reconciliation happened. There is no way to run
-- this file by accident, by glob, or by pasting it into a SQL editor.
do $blocked$
begin
  if current_setting('vraelis.referral_events_reconciled', true) is distinct from 'yes' then
    raise exception
      'BLOCKED: sql/CANDIDATE-referral-events.sql has not been reconciled against a real schema. %',
      'Run scripts/rls-preflight.ts against a staging clone of production first. If it confirms the table '
      'is ABSENT and this contract is right, unblock with:  set vraelis.referral_events_reconciled = ''yes'';  '
      'If it reports the table EXISTS or differs structurally, do NOT run this file - fix the contract.';
  end if;
end
$blocked$;

-- ── THE CANDIDATE ─────────────────────────────────────────────────────────────────────────────────────
-- Bare CREATE TABLE. If it already exists, this FAILS, and that failure is the useful outcome.
create table public.referral_events (
  id               uuid        primary key default gen_random_uuid(),
  referrer_email   text        not null,
  referred_email   text        not null,
  code             text        not null,
  kind             text        not null,
  credits_awarded  integer     not null default 0,
  created_at       timestamptz not null default now()
);

-- Read patterns observed in lib/referral.ts, so the counts do not seq-scan.
-- (:130/:170/:188 filter on referred_email + kind; :236/:241 filter on referrer_email + kind.)
create index referral_events_referred_kind_idx on public.referral_events (referred_email, kind);
create index referral_events_referrer_kind_idx on public.referral_events (referrer_email, kind);

-- Deny-by-default, matching every other table in this schema. The app connects as service_role.
alter table public.referral_events enable row level security;
revoke all privileges on public.referral_events from public;
revoke all privileges on public.referral_events from anon, authenticated;
grant all privileges on public.referral_events to service_role;

-- NOTE: the signup uniqueness index is NOT created here. It lives in
-- sql/vraelis-referral-idempotency.sql and must be built CONCURRENTLY, outside a transaction.
