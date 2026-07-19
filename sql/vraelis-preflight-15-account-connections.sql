-- Vraelis Preflight — migration 15: ACCOUNT-LEVEL connections. STRICTLY ADDITIVE + idempotent (create ...
-- if not exists), same posture as migrations 1/5/14. No existing table renamed, dropped, or altered.
-- v_app_connections is UNTOUCHED: test_account + api_credential stay per-app; the just-shipped per-app OAuth
-- rows keep working until the re-pointed callback starts writing account rows + links. Apply BEFORE deploying
-- the account-connection code; the code degrades to today's per-app behavior when these tables are absent.
--
-- MODEL: an OAuth connection has two halves — the TOKEN (account-wide: connect GitHub once) and the SELECTION
-- (per-app: which repo/project this app points at). This migration makes that split physical: the token lives
-- ONCE in v_account_connections; each app that uses it holds one v_app_connection_links row carrying only its
-- own selection. The secret exists in exactly one place.
--
-- ROLLBACK = ignore both tables; connections fall back to today's per-app v_app_connections behavior.

-- 1. Account-level token store: one sealed OAuth token per (user_id, provider). No FK to v_applications, so
--    the token OUTLIVES any single app (deleting an app never reaps it — revocation is explicit).
create table if not exists v_account_connections (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,                  -- account owner (lowercased email), the tenancy key
  provider       text not null,                  -- github | vercel | supabase | sentry | stripe_test
  status         text not null default 'connected',
  encrypted_ref  text,                           -- AES-256-GCM sealed {access_token, refresh_token} (same vault)
  meta           jsonb not null default '{}'::jsonb, -- token_mask, scopes, expires_at, oauth:true, account label
  last_verified_at timestamptz,
  created_at     timestamptz not null default now(),
  unique (user_id, provider)                     -- one grant per provider at the account level
);
create index if not exists v_account_connections_user_idx on v_account_connections (user_id, provider);

-- 2. Per-app LINK: an app USES an account connection + carries ONLY that app's selection (repo/project/etc).
--    Cascades from BOTH sides: delete the app -> its links vanish; revoke the account token -> its links vanish.
--    No token column — the secret lives in exactly one place (v_account_connections).
create table if not exists v_app_connection_links (
  id                     uuid primary key default gen_random_uuid(),
  application_id         uuid not null references v_applications(id) on delete cascade,
  user_id                text not null,          -- denormalized owner (fast filter + cleanup)
  account_connection_id  uuid not null references v_account_connections(id) on delete cascade,
  provider               text not null,          -- denormalized for the run-time (app, provider) lookup
  selection              jsonb not null default '{}'::jsonb, -- github:{repo,branch,commit} vercel:{project,deployment_url} supabase:{project_url}
  created_at             timestamptz not null default now(),
  unique (application_id, provider)              -- one linked connection per (app, provider)
);
create index if not exists v_app_connection_links_app_idx on v_app_connection_links (application_id, provider);
create index if not exists v_app_connection_links_account_idx on v_app_connection_links (account_connection_id);

-- 3. RLS deny-all backstop (anon key reads nothing; BYPASSRLS service role still works) — matches the pattern
--    applied to v_app_connections / v_run_artifacts / v_issues in migration 1. No permissive policies: the
--    service-role client is the only reader, and it enforces owner scoping in application code.
do $$
begin
  execute 'alter table v_account_connections enable row level security';
  execute 'alter table v_app_connection_links enable row level security';
exception when others then null;
end $$;
