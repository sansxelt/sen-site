-- ROLLBACK for sql/vraelis-canonical-not-identity.sql
--
-- Restores folded-email identity: two aliases of one inbox can no longer both hold an account.
--
-- THIS CAN FAIL, AND THAT IS THE POINT. If any aliases were registered while the unique index was absent,
-- the CREATE UNIQUE INDEX below will refuse to build. That is correct — it is telling you that real
-- accounts now exist which the old rule forbids. Find them first:
--
--   select canonical_email, count(*), array_agg(email)
--     from user_credentials
--    group by canonical_email having count(*) > 1;
--
-- Each row is a person holding two accounts. Decide, per cluster, which account is canonical and what
-- happens to the other one (merge, delete, or leave and abandon this rollback). Do NOT delete an account
-- with credits, payments, or applications attached without reconciling them first.

drop index if exists user_credentials_canonical_email_idx;

create unique index if not exists user_credentials_canonical_email_uidx
  on user_credentials (canonical_email);
