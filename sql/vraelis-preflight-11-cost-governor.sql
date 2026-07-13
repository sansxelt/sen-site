-- Preflight migration 11 — cost governor + velocity cap + circuit breaker (revenue-protection blocker 3).
-- Additive. Apply BEFORE deploying the code that reads these.
--
-- Holes from docs/revenue-protection-audit.md (#5, #6): nothing tracks provider spend, there is no
-- budget/auto-pause (only the manual env kill switch VRAELIS_RUNS_DISABLED which needs a redeploy), and
-- there is no per-account session-velocity cap or provider circuit breaker — so a refund/infra loop can
-- burn ~60 sessions/day/account, all refunded, uncapped.
--
-- DESIGN (founder rulings): track PROVIDER COST (Browserbase seconds, AI tokens, artifact bytes — never
-- customer price/revenue). Global ceilings: $2/rolling-hour + $8/UTC-day (env-configurable). Escalate
-- warn 50% -> founder alert 80% -> AUTO-PAUSE 100%. Auto-pause is DB-DURABLE (survives redeploys), pauses
-- NEW runs only (in-flight finishes but is NOT auto-retried), and is reset ONLY by an audited operator
-- action. Per-account velocity: 8 provider sessions/rolling-hour. Circuit breaker: 3 provider/infra
-- failures within 15 min -> OPEN -> 60-min cooldown. A SEPARATE emergency action can halt in-flight, but
-- that is never the automatic trip behavior.

-- ── 1. Provider cost ledger (PROVIDER cost, not price/revenue) ───────────────────────────────────────
-- One row per run (or settlement) with the estimated provider cost broken out. Rolling 1h/24h sums drive
-- the governor. estimated_cents is the total the governor sums; the component columns are for attribution.
create table if not exists public.v_cost_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id text,                                 -- owner (lowercased email), for per-account attribution
  run_id uuid,                                  -- the run this cost belongs to
  browserbase_seconds integer not null default 0,
  ai_tokens integer not null default 0,
  artifact_bytes bigint not null default 0,
  estimated_cents integer not null default 0,   -- total estimated PROVIDER cost (governor sums this)
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists v_cost_ledger_created_idx on public.v_cost_ledger (created_at);
create index if not exists v_cost_ledger_user_idx on public.v_cost_ledger (user_id, created_at);

-- ── 2. Runs governor: the DB-durable auto-pause (survives redeploys) ─────────────────────────────────
-- A single-row control table (id='global'). paused=true means the cost ceiling tripped OR an operator
-- paused manually; the launch routes refuse NEW runs before billing while paused (alongside the env
-- kill switch). Reset is an AUDITED operator action only (never automatic) — the code never sets
-- paused=false on its own. last_reason/last_threshold/last_usage_cents power the admin surface.
create table if not exists public.v_runs_governor (
  id text primary key default 'global',
  paused boolean not null default false,
  paused_at timestamptz,
  paused_by text,                               -- 'cost_governor:hourly' | 'cost_governor:daily' | operator email
  last_reason text,                             -- human-readable trip reason for the admin surface
  last_threshold_cents integer,                 -- the ceiling that tripped
  last_usage_cents integer,                     -- the usage at trip time
  reset_grace_until timestamptz,                -- an operator reset sets this; the auto-trip is suppressed
                                                -- until it passes so already-counted in-window spend does
                                                -- not instantly re-pause a just-reset governor
  updated_at timestamptz not null default timezone('utc', now())
);
-- Re-apply safety: if a prior version of this migration created v_runs_governor without the grace column
-- (create table if not exists would silently skip the new definition), add it explicitly.
alter table public.v_runs_governor add column if not exists reset_grace_until timestamptz;

insert into public.v_runs_governor (id, paused) values ('global', false)
  on conflict (id) do nothing;

-- ── 3. Per-account provider attempts (velocity cap + circuit breaker) ────────────────────────────────
-- One row per provider session attempt. The launch gate counts rows in the rolling hour (velocity cap =
-- 8/hr) and counts provider/infra FAILURES in the last 15 min (breaker: 3 -> OPEN). outcome distinguishes
-- a normal session from a provider/infra failure so the breaker only trips on infra churn, not on real
-- app-defect FAILED flows.
create table if not exists public.v_provider_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                        -- account (lowercased email)
  run_id uuid,
  outcome text not null default 'session',      -- 'session' | 'infra_failure'
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists v_provider_attempts_user_idx on public.v_provider_attempts (user_id, created_at);

-- Circuit-breaker state per account: set OPEN when 3 infra failures land within 15 min; the launch gate
-- refuses that account until breaker_until passes (60-min cooldown). Separate from the attempts log so the
-- gate reads one row, not an aggregate, on the hot path.
create table if not exists public.v_provider_breaker (
  user_id text primary key,                     -- account (lowercased email)
  breaker_open boolean not null default false,
  breaker_until timestamptz,                    -- cooldown expiry; gate refuses until this passes
  opened_reason text,
  updated_at timestamptz not null default timezone('utc', now())
);
