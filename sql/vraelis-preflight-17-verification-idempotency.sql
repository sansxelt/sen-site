-- Vraelis Preflight — migration 17: /v1 VERIFICATION IDEMPOTENCY, decided BEFORE any work.
-- STRICTLY ADDITIVE + idempotent (create if not exists), same posture as 1/5/14/15/16. No existing table
-- touched.
--
-- WHY. The public /v1/verifications endpoint does expensive, side-effecting work per call: it crawls the
-- deployment, calls the synthesis model, creates a contract with requirements and flows, and only then
-- launches a run that takes a credit hold. Idempotency that runs AFTER all that (the current post-hoc
-- reconciliation) prevents a double CHARGE, but still pays for synthesis and leaves an orphan contract on
-- every retry. A double-clicked button should cost nothing, not a second synthesis.
--
-- So the idempotency decision has to happen FIRST, and it has to be atomic: two simultaneous identical
-- requests must not both begin synthesis. The primary key (user_id, idem_key) is the reservation. The first
-- INSERT wins and owns execution; a duplicate INSERT conflicts and reads the winner's row.
--
-- ROLLBACK = drop this table. /v1 degrades to the post-hoc reconciliation already on main: correct for
-- charges, just wasteful on retries. The code checks for the table and falls back when it is absent, so a
-- deploy that lands before this migration keeps working.

create table if not exists v_verification_idempotency (
  user_id     text not null,                    -- the acting principal (lowercased email); the tenancy key
  idem_key    text not null,                    -- the caller's Idempotency-Key, verbatim, scoped to the user
  -- Hash of the CANONICAL request (deployment url + normalized claim). Same request -> same fingerprint;
  -- a changed claim or url -> a different one, which is how a reused key with a different body is refused.
  fingerprint text not null,
  -- pending: reserved, synthesis/launch in flight or abandoned.
  -- launched: a run exists; run_id is set; replays return it.
  -- failed:   synthesis or launch failed before a run existed; the key may be safely re-owned.
  state       text not null default 'pending' check (state in ('pending', 'launched', 'failed')),
  run_id      uuid,                              -- the launched run; null until state = 'launched'
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- THE ATOMIC RESERVATION. One row per (user, key). INSERT ... ON CONFLICT DO NOTHING lets exactly one
  -- concurrent request win and own execution; the rest read the winner.
  primary key (user_id, idem_key)
);

-- Abandoned-pending recovery reads by state + age, so a stale reservation whose owner died mid-synthesis can
-- be reclaimed rather than poisoning the key forever.
create index if not exists v_verification_idem_pending
  on v_verification_idempotency (state, created_at)
  where state = 'pending';

-- No foreign key to v_preflight_runs on run_id: a run is never deleted, but keeping these independent means
-- the reservation table can be dropped for rollback without touching run history, and a run's own lifecycle
-- never blocks on this row.
