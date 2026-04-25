-- ─────────────────────────────────────────────────────────────────────
-- RESET ALL ACCOUNTS — keeps ONLY sansxeltech@gmail.com (admin)
-- ─────────────────────────────────────────────────────────────────────
-- IRREVERSIBLE. Run in Supabase SQL editor.
--
-- Strategy: delete from every owner-scoped table where the email
-- (or user_id resolved via auth.users) doesn't match the keeper.
-- auth.users gets deleted LAST so other tables can still resolve
-- their user_id during the cleanup if any of them join on it.
--
-- Verify the keeper exists FIRST, then run the rest. If your schema
-- uses different column names (e.g. `user_email` instead of `email`),
-- adjust the per-table DELETEs before running.

-- 0. Sanity check the keeper exists. Should print exactly one row.
SELECT id, email FROM auth.users WHERE email = 'sansxeltech@gmail.com';

-- ─────────────────────────────────────────────────────────────────────
-- BEGIN destructive section. Wrap in a transaction so a typo bails out.
-- ─────────────────────────────────────────────────────────────────────
BEGIN;

-- 1. Per-feature data tables. Order matters when there are FKs.
DELETE FROM credit_ledger        WHERE email <> 'sansxeltech@gmail.com';
DELETE FROM boost_credits        WHERE email <> 'sansxeltech@gmail.com';
DELETE FROM api_keys             WHERE owner_email <> 'sansxeltech@gmail.com';
DELETE FROM github_integrations  WHERE email <> 'sansxeltech@gmail.com';

-- chat_messages first (FK → chat_threads), then chat_threads
DELETE FROM chat_messages
  WHERE thread_id IN (
    SELECT id FROM chat_threads WHERE email <> 'sansxeltech@gmail.com'
  );
DELETE FROM chat_threads         WHERE email <> 'sansxeltech@gmail.com';
DELETE FROM chat_sources         WHERE email <> 'sansxeltech@gmail.com';

DELETE FROM usage_events         WHERE email <> 'sansxeltech@gmail.com';
DELETE FROM usage_summary        WHERE email <> 'sansxeltech@gmail.com';

DELETE FROM subscriptions        WHERE email <> 'sansxeltech@gmail.com';
DELETE FROM user_profiles        WHERE email <> 'sansxeltech@gmail.com';

-- 2. Auth users LAST. Modern Supabase cascades to auth.identities,
--    auth.sessions, auth.refresh_tokens, etc. via FK ON DELETE CASCADE,
--    so this single DELETE drops the sign-in surface for every other
--    account.
DELETE FROM auth.users           WHERE email <> 'sansxeltech@gmail.com';

-- 3. Verification. Should print 1 row (your admin) for both.
SELECT count(*) AS remaining_users      FROM auth.users;
SELECT count(*) AS remaining_profiles   FROM user_profiles;
SELECT count(*) AS remaining_threads    FROM chat_threads;

COMMIT;

-- If anything looked wrong above, run `ROLLBACK;` instead of `COMMIT;`
-- and nothing changes.
