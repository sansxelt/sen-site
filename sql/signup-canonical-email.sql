-- Signup canonical email — stop free-credit farming via Gmail +tag / dot aliases.
--
-- The hole: email/password signup dedups only on the exact address, so you+1@gmail.com,
-- you+2@gmail.com, and y.o.u@gmail.com are three distinct accounts that all deliver to one
-- inbox and each mint SIGNUP_FREE_CREDITS. OAuth (Google/GitHub) is unaffected — it returns
-- the canonical address.
--
-- The fix: store a CANONICAL form of each credential email and enforce one account per
-- canonical. Login stays keyed on the real `email` column, so EXISTING accounts (including
-- any already created with an alias) keep working — this only blocks NEW alias accounts.
--
-- Canonicalization rule (industry standard): lowercase, strip the +tag from the local part
-- for every domain, and for gmail.com / googlemail.com strip dots from the local part AND
-- fold googlemail.com onto gmail.com (both are the same Google inbox). Dots are significant
-- on other providers, so we leave them alone.
--
-- RUN ORDER: apply this migration FIRST, resolve any collisions it surfaces, THEN the code
-- that reads canonical_email ships. Do not deploy the code before the column exists.
--
-- Already ran an earlier version of this file (without the googlemail fold)? Re-run the
-- UPDATE below with `where split_part(lower(email),'@',2) = 'googlemail.com'` in place of the
-- `canonical_email is null` filter to re-fold those rows before creating the unique index.

alter table user_credentials add column if not exists canonical_email text;

-- Backfill existing rows with the canonical form.
update user_credentials
set canonical_email =
  case
    when split_part(lower(email), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(regexp_replace(lower(email), '\+[^@]*', ''), '@', 1), '.', '')
           || '@gmail.com'
    else split_part(regexp_replace(lower(email), '\+[^@]*', ''), '@', 1)
         || '@' || split_part(lower(email), '@', 2)
  end
where canonical_email is null;

-- BEFORE creating the unique index, list any existing accounts that are already aliases of
-- each other (the farm may have been used). Reconcile these by hand — merge or remove the
-- extras and claw back their signup grants — or the CREATE UNIQUE INDEX below will fail.
--   select canonical_email, count(*) n, array_agg(email order by created_at) emails
--   from user_credentials group by canonical_email having count(*) > 1;

-- Enforce one credentials account per canonical inbox going forward.
create unique index if not exists user_credentials_canonical_email_uidx
  on user_credentials (canonical_email);
