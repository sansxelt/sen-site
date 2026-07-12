-- Vraelis Preflight — Phase 7 additive migration (versioned application context graph, V1.1 S3).
-- Run AFTER vraelis-preflight-6-pass-pricing.sql. Idempotent; no destructive change.
--
-- v_context_snapshots: an IMMUTABLE, versioned copy of an application's full context at a moment in
-- time. Rows are only ever INSERTED (never updated/deleted by code): a change to context produces a new
-- version, so contracts and runs can pin the exact context they were derived from and historical
-- evidence is never silently mutated. `graph` holds the normalized context (identity, summary, prompt,
-- sources, roles, workflows, expectations, risks, connections summary WITHOUT secrets, boundaries);
-- `provenance` maps each field to its source (prompt | summary | prd | readme | connection:<kind> |
-- manual | inference) with timestamps. `hash` = sha256 of the canonical graph JSON for cheap
-- change detection (stale-context = newest snapshot hash differs from the one a contract pinned).
create table if not exists v_context_snapshots (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references v_applications(id) on delete cascade,
  user_id        text not null,
  version        int not null,
  hash           text not null,
  graph          jsonb not null,
  provenance     jsonb not null default '{}'::jsonb,
  author         text not null default 'owner',        -- owner | system (connection import)
  created_at     timestamptz not null default now(),
  unique (application_id, version)
);
create index if not exists v_context_snapshots_app_idx on v_context_snapshots (application_id, version desc);
create index if not exists v_context_snapshots_user_idx on v_context_snapshots (user_id);

-- Pin the context version onto contracts and runs (nullable: rows created before this phase simply have
-- no pin; code treats absent as "version at time of creation unknown", never an error).
alter table v_production_contracts add column if not exists context_snapshot_id uuid references v_context_snapshots(id) on delete set null;
alter table v_preflight_runs add column if not exists context_snapshot_id uuid references v_context_snapshots(id) on delete set null;
