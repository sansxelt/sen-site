-- ROLLBACK for sql/vraelis-session-revocation.sql
--
-- Dropping the table returns sessions to "never revoked": lib/v-session-revocation.ts fails OPEN on a
-- missing table (it keeps the cached or default version rather than logging everyone out), so the
-- application keeps working and simply loses the ability to end sessions early.
--
-- Any user whose sessions were revoked while the table existed STAYS revoked — their old tokens were
-- already refused and are gone. Dropping this does not resurrect them.

drop table if exists v_session_revocation;
