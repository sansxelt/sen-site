-- Preflight migration 9 — free-pass abuse controls (revenue-protection blocker 1).
--
-- THE HOLE (from docs/revenue-protection-audit.md, blocker 1): the ONE lifetime free Production Pass is
-- keyed on the exact lowercased email (v_preflight_runs.user_id). Credentials signup already dedups
-- aliases of one inbox via user_credentials.canonical_email (migration signup-canonical-email.sql), but
-- OAUTH signup (auth.ts -> syncUserProfileIdentity) never records a canonical form anywhere, so
-- you+a@gmail via Google, you+b@gmail via Google, and a Google + a GitHub account on the same inbox are
-- DISTINCT free-pass owners. Each mints its own lifetime free pass -> uncapped provider burn.
--
-- THE FIX (this migration + the code that reads it):
--   1. Carry canonical_email on user_profiles. user_profiles is written on EVERY signup path
--      (upsertUserProfile / syncUserProfileIdentity), and its `email` PK IS the free-pass owner key
--      (= v_preflight_runs.user_id). Populating it here closes the OAuth gap that user_credentials
--      could not (OAuth never touches user_credentials).
--   2. The free-pass gate resolves the owner's CANONICAL CLUSTER (every user_profiles.email whose
--      canonical_email matches) and treats the pass as used if ANY alias in the cluster consumed it.
--
-- IMPORTANT DIFFERENCE FROM THE CREDENTIALS MIGRATION: this index is NON-UNIQUE. Multiple alias
-- profiles legitimately co-exist (an existing Google + GitHub user is two real profiles we must not
-- break). canonical_email here is a READ KEY for cluster resolution, NOT a signup block. Canonical email
-- is the ONLY hard-denial key for the free pass; IP/device/ASN (see v_free_grant_risk below) are
-- SIGNALS ONLY and never deny on their own.
--
-- Canonicalization rule mirrors canonicalizeEmail() and signup-canonical-email.sql EXACTLY: lowercase,
-- strip the +tag from the local part (all domains), and for gmail.com/googlemail.com strip dots from the
-- local part and fold googlemail.com onto gmail.com.
--
-- RUN ORDER: apply this migration FIRST (adds the column + backfills + indexes), THEN deploy the code
-- that reads canonical_email. The reader degrades safely (fail-closed to PAYG) if the column is missing,
-- so a code-ahead-of-migration window is revenue-safe, never free-leaking.

-- ── 1. Canonical identity on user_profiles (the cluster key) ─────────────────────────────────────────
alter table public.user_profiles add column if not exists canonical_email text;

-- Backfill existing profiles with the canonical form (same rule as the credentials backfill).
update public.user_profiles
set canonical_email =
  case
    when split_part(lower(email), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(regexp_replace(lower(email), '\+[^@]*', ''), '@', 1), '.', '')
           || '@gmail.com'
    else split_part(regexp_replace(lower(email), '\+[^@]*', ''), '@', 1)
         || '@' || split_part(lower(email), '@', 2)
  end
where canonical_email is null;

-- NON-UNIQUE index: this is a lookup key for cluster resolution, not a constraint. Existing aliases must
-- keep working; we only need to FIND them, never forbid them.
create index if not exists user_profiles_canonical_email_idx
  on public.user_profiles (canonical_email);

-- Visibility: which canonical inboxes already have more than one profile (a cluster that may have farmed
-- free passes). Operator query, run manually after applying — not enforced:
--   select canonical_email, count(*) n, array_agg(email order by created_at) emails
--   from public.user_profiles group by canonical_email having count(*) > 1 order by n desc;

-- ── 2. Free-grant risk signals (SIGNAL ONLY — never a hard denial) ───────────────────────────────────
-- Layered risk + velocity signals captured at the moment a free run is launched. IP / device / ASN are
-- recorded here purely to RAISE A REVIEW FLAG and power velocity heuristics; the free-pass decision never
-- denies on these alone (per founder ruling). An operator reviews flagged clusters out of band.
create table if not exists public.v_free_grant_risk (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                       -- lowercased email = free-pass owner key
  canonical_email text,                        -- resolved cluster key at capture time
  run_id uuid,                                 -- the free run this signal is attached to (nullable)
  ip_hash text,                                -- salted hash of signup/launch IP (never the raw IP)
  asn text,                                    -- autonomous system, when resolvable
  device_hash text,                            -- salted device/UA fingerprint hash
  signal text not null default 'free_launch',  -- what produced this row
  risk_flags jsonb not null default '[]'::jsonb, -- e.g. ["ip_velocity","disposable_domain"] — advisory
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists v_free_grant_risk_canonical_idx on public.v_free_grant_risk (canonical_email);
create index if not exists v_free_grant_risk_ip_idx on public.v_free_grant_risk (ip_hash, created_at);
create index if not exists v_free_grant_risk_user_idx on public.v_free_grant_risk (user_id, created_at);

-- ── 3. Operator comp / manual-review overrides (the safety valve for fail-closed) ────────────────────
-- The free-pass gate FAILS CLOSED: on any eligibility-check error it routes to PAYG rather than leak a
-- free run. That can inconvenience a legitimate brand-new user on a transient DB error. This table is the
-- operator's manual override: an explicit, audited grant of a free pass (or a comp) to a specific owner,
-- so a wrongly-charged real user is never permanently denied. Consulted by the gate BEFORE routing to
-- PAYG; an active, unconsumed comp lets the free run proceed.
create table if not exists public.v_free_grant_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                       -- lowercased email the comp applies to
  canonical_email text,                        -- cluster it belongs to (for audit)
  reason text not null,                        -- operator's justification (support ticket, etc.)
  granted_by text not null,                    -- operator email
  consumed_at timestamptz,                     -- set when the comped free run is taken (single use)
  expires_at timestamptz,                      -- optional expiry; null = until consumed
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists v_free_grant_overrides_user_idx on public.v_free_grant_overrides (user_id);

-- ── 4. Atomic free-pass claim (closes the concurrent-launch double-spend race) ───────────────────────
-- The hole this closes (adversarial review, CRITICAL): freePassUsed() is check-then-write — it decides
-- "pass available" by READING existing runs, but the run that later reads as "consumed" is only written
-- afterward by createRun. Two free launches from one cluster fired in the same window both read
-- "available" and both get a free run. No amount of application-level checking closes this; it needs a
-- DB-level guard.
--
-- This table is that guard. Exactly ONE claim row can exist per canonical inbox (unique index). The free
-- launch path INSERTs a claim BEFORE queueing the run: the insert either wins (this launch owns the
-- cluster's one free pass) or fails on the unique violation (already claimed -> this launch is not free
-- -> re-priced to PAYG). Concurrent inserts serialize on the unique index, so at most one wins. A claim
-- is released (row deleted) only if the run insert then fails, so a legitimate user is never locked out
-- of their free pass by a transient queue error.
create table if not exists public.v_free_pass_claims (
  canonical_email text primary key,            -- the cluster key; PK = at most one claim per inbox
  user_id text not null,                       -- the exact account that claimed it (audit)
  run_id uuid,                                  -- the run that owns the claim (set after createRun)
  claimed_at timestamptz not null default timezone('utc', now())
);

-- Orphan recovery: claimFreePass self-heals a stale unattached claim (run_id null, > 1h old) on the next
-- launch attempt, so no cron is REQUIRED. This query is the optional operator/cron sweep as defense in
-- depth — safe to run any time; it only clears claims whose run was never created:
--   delete from public.v_free_pass_claims where run_id is null and claimed_at < now() - interval '1 hour';

