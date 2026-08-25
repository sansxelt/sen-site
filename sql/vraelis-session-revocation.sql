-- Session revocation for the JWT session strategy.
--
-- auth.ts issues stateless JWT sessions, so sign-out only clears the browser's cookie and a token copied
-- elsewhere stays valid until expiry. Password reset had the same gap: changing the password did not end
-- the sessions the old password created. This table holds a per-user counter that is stamped into each
-- token; a token whose stamp is behind the stored counter is refused, so bumping the counter invalidates
-- every token issued before it.
--
-- Deliberately minimal: one row per user, written only when a revocation actually happens. A user who has
-- never signed out has no row and reads as version 0.

create table if not exists v_session_revocation (
  user_id       text primary key,
  token_version int not null default 0,
  last_reason   text,
  updated_at    timestamptz not null default now()
);

-- Deny-by-default, consistent with the rest of the schema: the service role bypasses RLS, and no policy
-- means anon and authenticated reach zero rows.
alter table v_session_revocation enable row level security;

revoke all privileges on v_session_revocation from public, anon, authenticated;
grant all privileges on v_session_revocation to service_role;
