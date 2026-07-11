-- Vraelis Preflight (production layer for AI-built software) — ADDITIVE schema.
-- Safe to run repeatedly (create ... if not exists). No existing table is renamed, dropped, or altered
-- destructively. All access is server-only via the service-role key, scoped in app code by
-- user_id = lowercased email (matching the rest of the schema). Tables that hold artifacts or encrypted
-- credentials get an RLS deny-all backstop (BYPASSRLS service role still works; anon key reads nothing),
-- exactly like v_check_attachments / v_check_idempotency.
--
-- NOT YET APPLIED to any database — run in Supabase SQL editor when starting Phase 1 activation.

-- ── Connected applications ──────────────────────────────────────────────────────────────────────────
create table if not exists v_applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,                 -- owner (lowercased email)
  workspace_id  uuid,                           -- optional: reuse v_workspaces sharing/roles
  name          text not null,
  app_url       text not null,                  -- public/preview URL under test
  framework     text,                           -- nextjs | other (discovered)
  builder       text,                           -- claude_code | cursor | lovable | bolt | replit | v0 | other
  repo          text,                           -- owner/name (optional, Phase 5)
  deployment_provider text,                     -- vercel | other (optional)
  ownership_confirmed boolean not null default false, -- "I own/authorized this app"
  status        text not null default 'connected',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists v_applications_user_idx on v_applications (user_id, created_at desc);

-- Provider connections (GitHub/Vercel/Supabase/Stripe). Credentials are ENCRYPTED (never plaintext) and
-- never returned to the client — only a status + last_verified_at.
create table if not exists v_app_connections (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references v_applications(id) on delete cascade,
  user_id        text not null,
  provider       text not null,                 -- github | vercel | supabase | stripe | test_account
  status         text not null default 'pending', -- pending | connected | error
  encrypted_ref  text,                           -- AES-256-GCM blob (lib/v-secrets.ts); never plaintext
  meta           jsonb not null default '{}'::jsonb, -- safe, non-secret metadata only
  last_verified_at timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists v_app_connections_app_idx on v_app_connections (application_id);

-- ── Production Contract (what the product promises) ─────────────────────────────────────────────────
create table if not exists v_production_contracts (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references v_applications(id) on delete cascade,
  user_id        text not null,
  version        int not null default 1,
  status         text not null default 'draft', -- draft | approved
  source_prompt  text,                           -- the original build prompt
  approved_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists v_production_contracts_app_idx on v_production_contracts (application_id, version desc);

create table if not exists v_contract_requirements (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references v_production_contracts(id) on delete cascade,
  user_id      text not null,
  category     text not null,                    -- auth | state_integrity | billing | responsive | ...
  requirement  text not null,                    -- plain-language
  severity     text not null default 'important',-- critical | important | informational
  enabled      boolean not null default true,
  source       text,                             -- build_prompt | discovery | user | requirements_file
  confidence   real,                             -- 0..1 (AI suggestion confidence)
  role         text,                             -- related user role, when known
  area         text,                             -- related route/feature, when known
  approved     boolean not null default false,   -- user-approved (protected from AI overwrite)
  order_index  int not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists v_contract_requirements_contract_idx on v_contract_requirements (contract_id, order_index);

-- ── Test flows (concrete browser journeys generated from the approved contract) ─────────────────────
create table if not exists v_test_flows (
  id           uuid primary key default gen_random_uuid(),
  contract_id  uuid not null references v_production_contracts(id) on delete cascade,
  user_id      text not null,
  name         text not null,
  goal         text,
  role         text,                             -- required user role
  start_path   text,                             -- starting route
  steps        jsonb not null default '[]'::jsonb,    -- ordered [{action,target,value?,expect?}]
  expected     jsonb not null default '{}'::jsonb,    -- final expected state / pass condition
  destructive_allowed boolean not null default false,
  max_ms       int not null default 120000,      -- per-flow wall-clock cap
  priority     text not null default 'important',-- critical | important | informational
  enabled      boolean not null default true,
  order_index  int not null default 0,
  requirement_ids uuid[] default '{}',           -- related contract requirements
  created_at   timestamptz not null default now()
);
create index if not exists v_test_flows_contract_idx on v_test_flows (contract_id, order_index);

-- ── Preflight runs = the JOB QUEUE (claimed by the worker; not run in a request route) ──────────────
create table if not exists v_preflight_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  application_id uuid not null references v_applications(id) on delete cascade,
  contract_id    uuid references v_production_contracts(id) on delete set null,
  submission_id  text,                            -- client idempotency key (one run per submission)
  deployment_url text,
  commit_sha     text,
  state          text not null default 'draft',   -- draft|queued|discovering|running|analyzing|completed|failed|cancelled
  decision       text,                            -- ready | needs_review | blocked
  summary        jsonb not null default '{}'::jsonb, -- {critical_total, critical_passed, blockers, ...}
  -- worker lease / crash recovery
  lease_owner    text,
  lease_expires_at timestamptz,
  heartbeat_at   timestamptz,
  attempts       int not null default 0,
  error_category text,
  credits_held   int not null default 0,          -- escrowed at enqueue (reuse v_credit_ledger hold/refund)
  created_at     timestamptz not null default now(),
  started_at     timestamptz,
  completed_at   timestamptz,
  unique (user_id, submission_id)
);
create index if not exists v_preflight_runs_app_idx on v_preflight_runs (application_id, created_at desc);
-- Claimable queue: queued runs with an expired/absent lease, oldest first.
create index if not exists v_preflight_runs_claim_idx on v_preflight_runs (state, lease_expires_at) where state = 'queued';

create table if not exists v_flow_runs (
  id              uuid primary key default gen_random_uuid(),
  preflight_run_id uuid not null references v_preflight_runs(id) on delete cascade,
  test_flow_id    uuid references v_test_flows(id) on delete set null,
  user_id         text not null,
  name            text not null,
  state           text not null default 'pending', -- pending|running|passed|failed|blocked|skipped
  observed        jsonb not null default '{}'::jsonb, -- DETERMINISTIC observations only
  severity        text,
  created_at      timestamptz not null default now()
);
create index if not exists v_flow_runs_run_idx on v_flow_runs (preflight_run_id);

create table if not exists v_run_steps (
  id           uuid primary key default gen_random_uuid(),
  flow_run_id  uuid not null references v_flow_runs(id) on delete cascade,
  idx          int not null,
  action       text,
  target       text,
  expected     text,
  observed     text,                              -- deterministic
  status       text,                              -- ok | fail
  screenshot_id uuid,
  ms           int,
  created_at   timestamptz not null default now()
);
create index if not exists v_run_steps_flow_idx on v_run_steps (flow_run_id, idx);

-- ── Issues (deterministic evidence + separated AI interpretation) ───────────────────────────────────
create table if not exists v_issues (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,
  application_id uuid not null references v_applications(id) on delete cascade,
  run_id         uuid references v_preflight_runs(id) on delete set null,
  flow_id        uuid references v_test_flows(id) on delete set null,
  severity       text not null,                   -- critical | high | medium | low
  category       text,                            -- fake_success|session_failure|persistence_failure|cross_account|stale_ui|duplicate_action|...
  title          text not null,
  expected       text,
  observed       text,
  repro          jsonb not null default '[]'::jsonb,     -- ordered steps
  evidence       jsonb not null default '{}'::jsonb,     -- DETERMINISTIC: screenshots, console/network summary, statuses
  likely_cause   text,                            -- AI INTERPRETATION (labeled)
  confidence     real,
  suggested_areas text,
  repair_prompt  text,                            -- builder-specific
  status         text not null default 'open',    -- open | resolved
  first_seen_run uuid,
  last_seen_run  uuid,
  resolved_run   uuid,
  created_at     timestamptz not null default now()
);
create index if not exists v_issues_app_idx on v_issues (application_id, status, created_at desc);

-- Private evidence artifacts (bytes live in a private Storage bucket; only the path is stored).
create table if not exists v_run_artifacts (
  id             uuid primary key default gen_random_uuid(),
  preflight_run_id uuid not null references v_preflight_runs(id) on delete cascade,
  user_id        text not null,
  kind           text not null,                   -- screenshot | trace | console | network | video
  storage_path   text not null,                   -- private bucket; never exposed, signed URLs only
  flow_run_id    uuid,
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index if not exists v_run_artifacts_run_idx on v_run_artifacts (preflight_run_id);

-- Repairs (V1 = generated fix prompts only; no auto code modification).
create table if not exists v_repairs (
  id              uuid primary key default gen_random_uuid(),
  issue_id        uuid not null references v_issues(id) on delete cascade,
  user_id         text not null,
  status          text not null default 'suggested', -- suggested | applied_by_user | verified | failed
  suggested_files text,
  fix_prompt      text,
  patch           text,
  verification_run_id uuid,
  created_at      timestamptz not null default now()
);
create index if not exists v_repairs_issue_idx on v_repairs (issue_id);

-- ── RLS deny-all backstop (anon key reads nothing; service role BYPASSRLS still works) ──────────────
-- Applied to tables holding artifacts / encrypted credentials, matching the existing check-table pattern.
do $$
begin
  execute 'alter table v_app_connections enable row level security';
  execute 'alter table v_run_artifacts enable row level security';
  execute 'alter table v_issues enable row level security';
exception when others then null;
end $$;

-- ── Atomic job claim RPC (advisory-locked, mirrors v_spend_credit) ──────────────────────────────────
-- The worker calls this to claim exactly one queued run and take a time-boxed lease. Returns the claimed
-- row id (or null). Crash recovery: a reaper cron requeues runs whose lease_expires_at has passed.
create or replace function v_preflight_claim(p_worker text, p_lease_secs int)
returns uuid
language plpgsql
security definer
as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('v_preflight_claim'));
  select id into v_id from v_preflight_runs
    where state = 'queued' and (lease_expires_at is null or lease_expires_at < now())
    order by created_at asc limit 1 for update skip locked;
  if v_id is null then return null; end if;
  update v_preflight_runs
    set state = 'running', lease_owner = p_worker, lease_expires_at = now() + make_interval(secs => p_lease_secs),
        heartbeat_at = now(), attempts = attempts + 1, started_at = coalesce(started_at, now())
    where id = v_id;
  return v_id;
end $$;
