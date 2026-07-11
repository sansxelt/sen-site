# Vraelis Preflight: operations queries

Read-only SQL for the Supabase SQL editor (or psql). The internal observability surface until a hosted ops
page exists. No customer PII beyond owner emails you already control; never share output externally.

## Queue health

```sql
-- Queue depth + oldest queued run (alert if oldest > 10 minutes with a worker online)
select count(*) as queued, min(created_at) as oldest_queued
from v_preflight_runs where state = 'queued';

-- Active runs and their lease freshness (a lease older than now() means the reaper will recover it)
select id, lease_owner, heartbeat_at, lease_expires_at < now() as lease_expired, attempts
from v_preflight_runs where state = 'running' order by heartbeat_at asc;

-- Worker heartbeat: most recent activity across the fleet
select max(heartbeat_at) as last_heartbeat from v_preflight_runs where heartbeat_at is not null;
```

## Failures and recovery

```sql
-- Failed runs by coarse code, last 7 days (provider_capacity spikes = provider outage)
select failure_code, count(*) from v_preflight_runs
where state = 'failed' and created_at > now() - interval '7 days'
group by failure_code order by count(*) desc;

-- Runs that burned retries (attempts >= max_attempts)
select id, failure_code, attempts, max_attempts, created_at
from v_preflight_runs where attempts >= max_attempts order by created_at desc limit 20;
```

## Product signal

```sql
-- Decisions, last 30 days (READY conversion over time is the canary metric)
select decision, count(*) from v_preflight_runs
where state = 'completed' and created_at > now() - interval '30 days'
group by decision;

-- Flow failure categories (which blockers Vraelis actually catches)
select category, count(*) from v_issues
where created_at > now() - interval '30 days' group by category order by count(*) desc;

-- Repair verification: resolved issues per week
select date_trunc('week', created_at) as week, count(*) filter (where status = 'resolved') as resolved
from v_issues group by 1 order by 1 desc limit 8;
```

## Billing sanity

```sql
-- Runs holding credits that never reached a terminal state (should be empty or actively running)
select id, state, credits_held, created_at from v_preflight_runs
where credits_held > 0 and state not in ('completed','failed','cancelled')
and created_at < now() - interval '1 hour';
```

## Artifacts

```sql
-- Artifact volume per day (cost watch) and runs with zero artifacts despite executed flows
select date_trunc('day', created_at) as day, count(*) from v_run_artifacts group by 1 order by 1 desc limit 7;
```

## Alert thresholds (manual until hosted monitoring exists)

- Oldest queued run over 10 minutes while a worker is deployed: worker offline or claim failure.
- Any provider_auth_failed: rotate/check BROWSERBASE_API_KEY.
- provider_capacity or provider_quota clusters: provider outage or allowance exhausted.
- Billing sanity query non-empty: reconcile before anything else.
- Kill switch: set VRAELIS_RUNS_DISABLED=1 in Vercel to pause new runs (history stays visible).
