-- Run ONCE in Supabase SQL editor.
--
-- Adds the pending_signups table so credentials-based registration can
-- stash the password hash until the user clicks the verification link
-- in their email.  Only after clicking does the row get promoted into
-- user_credentials + user_profiles.

CREATE TABLE IF NOT EXISTS public.pending_signups (
  email         text PRIMARY KEY,
  password_hash text NOT NULL,
  display_name  text,
  token         text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS pending_signups_token_idx
  ON public.pending_signups (token);

CREATE INDEX IF NOT EXISTS pending_signups_expires_at_idx
  ON public.pending_signups (expires_at);

ALTER TABLE public.pending_signups ENABLE ROW LEVEL SECURITY;
