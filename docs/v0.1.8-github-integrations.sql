-- v0.1.8 — GitHub OAuth integration storage.
--
-- Persists the per-user GitHub access token so downstream features
-- (PR review, commit context, repo browsing) can call the GitHub API
-- on the user's behalf. Keyed by email to match the rest of the
-- account-scoped tables in this codebase.
--
-- The token is stored in the clear because it's already gated behind
-- the Supabase service role key. If we later add at-rest encryption
-- for sensitive integration secrets, this column becomes the first
-- candidate.

create table if not exists public.github_integrations (
  email         text primary key,
  access_token  text not null,
  scope         text not null default '',
  github_login  text,
  github_id     bigint,
  connected_at  timestamptz not null default timezone('utc', now())
);

create index if not exists github_integrations_login_idx
  on public.github_integrations(github_login);
