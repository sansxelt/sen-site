-- Stop using a FOLDED email as the account identity key.
--
-- THE OWNER'S DECISION. +tag / gmail-dot folding stays, but only as an ANTI-ABUSE and RISK control. It must
-- not decide who an account is, and it must not decide whether two accounts may both exist. Identity is
-- the exact address (and, for OAuth, the provider's subject id — see sql/vraelis-oauth-identity-binding.sql).
--
-- WHAT WAS ENFORCING THE OPPOSITE. sql/signup-canonical-email.sql created
--
--     create unique index user_credentials_canonical_email_uidx on user_credentials (canonical_email)
--
-- which is folded-email identity enforced by the database: with it in place, someone@gmail.com and
-- some.one+work@gmail.com could not both hold an account, because both fold to the same value. The
-- registration and verification routes were the friendly front-end of that same rule.
--
-- WHY THIS IS SAFE TO REMOVE — the abuse it was guarding is already handled elsewhere, at the right layer.
-- lib/preflight/free-grant-cluster.ts says so in its own header: "The ONLY hard-denial key for the free
-- pass is the canonical email (one lifetime free pass per real inbox)". resolveCanonicalCluster() looks
-- user_profiles up BY canonical_email and returns every account in the cluster, so two aliases that are now
-- two separate accounts still share ONE lifetime free pass. The credit-farming this index was blocking is
-- blocked by the grant gate, which is where a risk control belongs — not by refusing to let a person hold
-- two accounts.
--
-- The COLUMN stays, and stays populated. It is the join key for that clustering and for the per-mailbox
-- rate-limit buckets. Only its UNIQUENESS goes, because uniqueness is what made it an identity key.
--
-- The replacement index is NON-unique and exists to keep those risk lookups fast — the same shape
-- user_profiles already uses (user_profiles_canonical_email_idx, deliberately non-unique).

drop index if exists user_credentials_canonical_email_uidx;

create index if not exists user_credentials_canonical_email_idx
  on user_credentials (canonical_email);
