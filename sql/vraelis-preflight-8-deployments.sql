-- Vraelis Preflight — Phase 8 additive migration (deployment identity, V1.1 S4).
-- Run AFTER vraelis-preflight-7-context-snapshots.sql. Idempotent; no destructive change.
--
-- v_deployments: the exact deployment a Production Pass tested. Every READY decision ties to ONE row
-- here; when a newer deployment is detected (webhook later, manual now) the application shows
-- "New deployment unverified" instead of silently carrying READY forward. `source` records how the
-- deployment became known: manual (owner-entered / run target) | github_webhook | vercel_webhook.
create table if not exists v_deployments (
  id                     uuid primary key default gen_random_uuid(),
  application_id         uuid not null references v_applications(id) on delete cascade,
  user_id                text not null,
  url                    text not null,
  environment            text,                          -- preview | staging | production
  provider               text,                          -- vercel | railway | netlify | custom | unknown
  project                text,                          -- provider project name (safe metadata)
  repo                   text,                          -- owner/name
  branch                 text,
  commit_sha             text,
  provider_deployment_id text,                          -- restricted to Technical details in UI
  source                 text not null default 'manual',
  deployed_at            timestamptz,                   -- provider timestamp when known
  detected_at            timestamptz not null default now()
);
create index if not exists v_deployments_app_idx on v_deployments (application_id, detected_at desc);
create index if not exists v_deployments_user_idx on v_deployments (user_id);

-- Pin the deployment onto runs. Nullable: pre-phase-8 runs identified deployments only by URL; new runs
-- always pin. A run's decision NEVER migrates to a different deployment row.
alter table v_preflight_runs add column if not exists deployment_id uuid references v_deployments(id) on delete set null;
