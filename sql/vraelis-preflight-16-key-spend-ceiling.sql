-- Vraelis Preflight — migration 16: PER-KEY SPEND CEILING + run key provenance.
-- STRICTLY ADDITIVE + idempotent (add column if not exists), same posture as migrations 1/5/14/15. No
-- existing table renamed, dropped, or altered in a breaking way; every column added is nullable with a
-- meaning for NULL that matches today's behavior exactly.
--
-- WHY. Machine callers change the spend threat model. A person clicking Launch in the dashboard makes one
-- decision at a time; an agent in a retry loop can make twenty before anyone notices. The per-OWNER caps
-- already built (daily run cap, concurrency, velocity, the global cost governor) still apply and are
-- unchanged, but they cannot tell a runaway agent apart from a busy human, because at that layer both are
-- just "the owner". A ceiling attached to the KEY can: it bounds what one credential was trusted with, and
-- revoking that key caps the damage without touching the account.
--
-- Two ceilings, independent, both enforced. The key ceiling never RAISES anything: a key can only ever
-- spend less than its owner could, never more.
--
-- ROLLBACK = ignore both columns. A NULL daily_ceiling_cents means "no key ceiling" (today's behavior), and
-- a NULL api_key_id means "launched from a browser session" (every run that exists today).

-- 1. The ceiling itself, chosen when the key is created. NULL = unlimited, which is what every key minted
--    before this migration carries, so nothing that works today starts failing.
alter table v_api_keys
  add column if not exists daily_ceiling_cents integer;

-- A ceiling of 0 would be a key that can authenticate but never spend. That is a legitimate thing to want
-- (a read-only key), but it is expressed by withholding the preflight:run:create scope, not by a 0 ceiling,
-- which would be a confusing second way to say the same thing. Negative is meaningless.
alter table v_api_keys
  drop constraint if exists v_api_keys_daily_ceiling_positive;
alter table v_api_keys
  add constraint v_api_keys_daily_ceiling_positive
  check (daily_ceiling_cents is null or daily_ceiling_cents > 0);

-- 2. Which key launched a run. This is what makes the ceiling enforceable and durable.
--
--    The spend could have been summed from v_events instead, and that would have been a mistake: logEvent
--    deliberately swallows its own failures so analytics can never break a product flow, which means a
--    failed log write would silently UNDER-count spend and the ceiling would fail OPEN. A column on the run
--    row is written in the same transaction as the run itself, so a run that exists is always counted.
--
--    It is also the provenance answer to "which credential launched this", which the audit log wants
--    regardless of ceilings.
alter table v_preflight_runs
  add column if not exists api_key_id uuid;

-- The ceiling query is "what has this key spent since UTC midnight", so it reads by key and by time.
create index if not exists v_preflight_runs_api_key_day
  on v_preflight_runs (api_key_id, created_at desc)
  where api_key_id is not null;

-- No foreign key to v_api_keys on purpose. Revocation HARD-DELETES the key row (that is what makes
-- revocation immediate), and a FK would either block the delete or cascade it into the run history. The
-- runs a revoked key launched must survive it: they were paid for, they carry evidence, and erasing the
-- audit trail when a credential is rotated is exactly backwards.
