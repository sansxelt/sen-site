-- ROLLBACK for sql/vraelis-oauth-identity-binding.sql
--
-- lib/oauth-identity.ts treats an absent function as "unavailable" and lets sign-in proceed, so removing
-- this does not lock anyone out. What is lost is the second layer only: the verified-email requirement in
-- lib/github-identity.ts is independent of this table and keeps working.
--
-- The table is dropped last so no caller can hit a function whose storage has vanished.
--
-- DATA: provider, subject, email and two timestamps per OAuth account. Dropping it forgets which provider
-- account each address arrived from; re-applying starts binding again from the next sign-in. Nothing else
-- references it.

drop function if exists v_bind_oauth_identity(text, text, text);
drop table if exists v_oauth_identities;
