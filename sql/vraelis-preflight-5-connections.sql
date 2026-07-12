-- Vraelis Preflight — Phase 5 additive migration (production-context onboarding). Run AFTER
-- vraelis-preflight-4-selected-flows.sql. Idempotent; no destructive change.
--
-- v_app_connections (created in migration 1, previously unused by code) now carries the connection graph:
--   provider   github | vercel | custom_deploy | supabase | custom_auth | stripe_test | sentry | openapi |
--              webhook | test_account
--   meta       SAFE, NON-SECRET metadata only (repo, branch, commit, hostnames, labels, masks, scopes)
--   encrypted_ref  AES-256-GCM blob from lib/preflight/secret-vault.ts (test_account only); NEVER plaintext,
--                  NEVER selected by list reads, NEVER returned to a client.
-- Cascade delete from v_applications already guarantees connection + secret cleanup on app deletion.
--
-- New application columns (all optional; conservative when absent):
--   environment      preview | staging | production (which deployment tier the connected URL is)
--   context          product-definition sources: [{ kind: prompt|prd|requirements|readme|risks|roles,
--                    name, chars, added_at, content }] — bounded server-side, no secrets
--   test_boundaries  { allowed_domains: [], permit_account_creation: false, permit_db_writes: false,
--                      permit_email: false, permit_test_purchases: false, permit_file_upload: false }
--                    Absent = everything denied (the worker treats missing boundaries as most conservative).
alter table v_applications add column if not exists environment text;
alter table v_applications add column if not exists context jsonb;
alter table v_applications add column if not exists test_boundaries jsonb;
create index if not exists v_app_connections_user_idx on v_app_connections (user_id, application_id);
