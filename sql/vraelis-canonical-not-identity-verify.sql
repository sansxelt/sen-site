-- Verification for sql/vraelis-canonical-not-identity.sql. Read-only.

\echo '== 1. The folded-email UNIQUE index is gone (folding is no longer identity) =='
select case when count(*) = 0 then 'OK: no unique index on canonical_email'
            else 'FAIL: a unique index still enforces folded-email identity' end as result
from pg_indexes
where schemaname = 'public' and tablename = 'user_credentials'
  and indexdef ilike '%unique%' and indexdef ilike '%canonical_email%';

\echo '== 2. A non-unique index remains, so the risk lookups stay fast =='
select case when count(*) > 0 then 'OK' else 'FAIL: no index on canonical_email at all' end as result
from pg_indexes
where schemaname = 'public' and tablename = 'user_credentials' and indexdef ilike '%canonical_email%';

\echo '== 3. The COLUMN is still there — it is the risk/clustering key, only its uniqueness went =='
select case when count(*) = 1 then 'OK' else 'FAIL: canonical_email column is missing' end as result
from information_schema.columns
where table_schema = 'public' and table_name = 'user_credentials' and column_name = 'canonical_email';

\echo '== 4. Exact email is still UNIQUE — identity must stay enforced somewhere =='
select case when count(*) > 0 then 'OK: exact email is unique'
            else 'REVIEW: no unique constraint on user_credentials.email — identity is unenforced' end as result
from pg_indexes
where schemaname = 'public' and tablename = 'user_credentials'
  and indexdef ilike '%unique%' and indexdef ~* '\(email\)';

\echo '== 5. The free-pass cluster key is present and NON-unique (one pass per real inbox) =='
select case when count(*) > 0 then 'OK' else 'REVIEW: user_profiles.canonical_email index missing' end as result
from pg_indexes where schemaname = 'public' and tablename = 'user_profiles' and indexdef ilike '%canonical_email%';
