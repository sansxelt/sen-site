-- ═══════════════════════════════════════════════════════════════════════════
-- RESET ALL ACCOUNTS AND PLANS
--
-- ⚠️  DESTRUCTIVE.  Run once, on purpose.  Wipes every user record in
--    Supabase so the site starts empty (no users, no subscriptions,
--    no API keys, no pending invites).
--
-- Run in the Supabase SQL editor.  Wrapped in a transaction so either
-- everything clears or nothing does.
--
-- This does NOT touch Stripe or PayPal — those have their own data
-- that must be cleaned up separately (see the README at the bottom).
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

TRUNCATE
  public.password_reset_tokens,
  public.api_keys,
  public.account_subscriptions,
  public.user_credentials,
  public.user_profiles,
  public.early_access_signups
  CASCADE;

COMMIT;

-- Verify counts are zero:
-- SELECT
--   (SELECT COUNT(*) FROM password_reset_tokens)      AS tokens,
--   (SELECT COUNT(*) FROM api_keys)                    AS keys,
--   (SELECT COUNT(*) FROM account_subscriptions)       AS subscriptions,
--   (SELECT COUNT(*) FROM user_credentials)            AS credentials,
--   (SELECT COUNT(*) FROM user_profiles)               AS profiles,
--   (SELECT COUNT(*) FROM early_access_signups)        AS signups;

-- ═══════════════════════════════════════════════════════════════════════════
-- STRIPE CLEANUP (do this in the Stripe Dashboard, not here)
--
-- 1. https://dashboard.stripe.com/customers — delete any test customers
--    you no longer want.  Deleting a customer cancels their subscriptions
--    automatically.
-- 2. https://dashboard.stripe.com/subscriptions — double-check no active
--    subscriptions remain orphaned.
-- 3. If you want a totally fresh Stripe slate, switch to Test mode for
--    development and keep Live mode clean for real users.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- PAYPAL CLEANUP
--
-- Active PayPal subscriptions show in the PayPal Business dashboard
-- under Tools → Subscriptions.  Cancel any test ones there.  They
-- won't be able to charge anyone because the user records are gone,
-- but cleaner to cancel.
-- ═══════════════════════════════════════════════════════════════════════════
