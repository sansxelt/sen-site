-- Vraelis Preflight — Phase 2 additive migration (discovery + contract/flow provenance & merge + worker
-- run-lifecycle columns). Run AFTER sql/vraelis-preflight.sql. Idempotent; no destructive change.

-- Deterministic site-discovery snapshots (bounded, sanitized; raw HTML is NOT persisted). One row per
-- discovery attempt; the AI synthesis reads the latest completed snapshot.
create table if not exists v_discovery_snapshots (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references v_applications(id) on delete cascade,
  user_id        text not null,
  version        int not null default 1,
  state          text not null default 'pending',   -- pending|running|completed|partial|failed|cancelled
  pages          jsonb not null default '[]'::jsonb, -- sanitized per-page structured snapshot (no raw HTML/secrets)
  failures       jsonb not null default '[]'::jsonb, -- [{url, reason}] for a partial discovery
  content_hash   text,                                -- fingerprint of the sanitized snapshot
  source_url     text,
  pages_count    int not null default 0,
  started_at     timestamptz not null default now(),
  completed_at   timestamptz,
  error          text
);
create index if not exists v_discovery_snapshots_app_idx on v_discovery_snapshots (application_id, version desc);

-- Contract-requirement provenance + merge state (additive columns; older rows default sensibly).
alter table v_contract_requirements add column if not exists origin text not null default 'user';          -- prompt|discovery|user|imported|system
alter table v_contract_requirements add column if not exists review_state text not null default 'approved'; -- suggested|approved|rejected|archived
alter table v_contract_requirements add column if not exists fingerprint text;                              -- stable semantic dedup key
alter table v_contract_requirements add column if not exists source_refs jsonb not null default '[]'::jsonb;-- [{type,url?,reference}]
alter table v_contract_requirements add column if not exists reasoning_summary text;                        -- short user-facing rationale (NOT hidden chain-of-thought)
alter table v_contract_requirements add column if not exists discovery_version_created int;
alter table v_contract_requirements add column if not exists discovery_version_last_suggested int;
alter table v_contract_requirements add column if not exists user_modified boolean not null default false;
alter table v_contract_requirements add column if not exists stale boolean not null default false;
alter table v_contract_requirements add column if not exists approved_by text;
-- Fingerprint is unique per contract so regeneration merges instead of duplicating.
create unique index if not exists v_contract_req_fingerprint_uidx on v_contract_requirements (contract_id, fingerprint) where fingerprint is not null;

-- Test-flow provenance/merge (mirror of the requirement fields).
alter table v_test_flows add column if not exists origin text not null default 'user';
alter table v_test_flows add column if not exists review_state text not null default 'approved';
alter table v_test_flows add column if not exists fingerprint text;
alter table v_test_flows add column if not exists source_refs jsonb not null default '[]'::jsonb;
alter table v_test_flows add column if not exists confidence real;
alter table v_test_flows add column if not exists auth_required boolean not null default false;
alter table v_test_flows add column if not exists mobile_relevant boolean not null default false;
alter table v_test_flows add column if not exists user_modified boolean not null default false;
create unique index if not exists v_test_flows_fingerprint_uidx on v_test_flows (contract_id, fingerprint) where fingerprint is not null;

-- v_preflight_runs job-lifecycle hardening (additive columns for the Railway worker).
alter table v_preflight_runs add column if not exists max_attempts int not null default 3;
alter table v_preflight_runs add column if not exists cancel_requested_at timestamptz;
alter table v_preflight_runs add column if not exists failure_code text;
alter table v_preflight_runs add column if not exists failure_message text;
alter table v_preflight_runs add column if not exists provider text;
alter table v_preflight_runs add column if not exists provider_session_id text;
alter table v_preflight_runs add column if not exists current_flow_id uuid;
alter table v_preflight_runs add column if not exists contract_version int;
alter table v_preflight_runs add column if not exists cost_reservation_id text;

-- Discovery idempotency + one-active-per-app DB backstop. The partial-unique index makes a concurrent
-- double-submit collide at insert (one wins, the other 409s) rather than racing the app-level check.
alter table v_discovery_snapshots add column if not exists idempotency_key text;
create unique index if not exists v_discovery_active_uidx on v_discovery_snapshots(application_id)
  where state in ('pending','running','fetching','extracting','synthesizing','persisting');
