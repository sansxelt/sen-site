-- Run this ONCE in the Supabase SQL editor (or via psql) to prepare the
-- account_subscriptions table for tracking both Stripe and PayPal subs.
--
-- Safe to re-run — every statement is idempotent (`if not exists`).

ALTER TABLE account_subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe';

ALTER TABLE account_subscriptions
  ADD COLUMN IF NOT EXISTS provider_subscription_id text;

-- Optional: a partial index so we can look up a subscription by its
-- provider-side id quickly (e.g. when a PayPal webhook comes in).
CREATE INDEX IF NOT EXISTS account_subscriptions_provider_sub_id_idx
  ON account_subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;
