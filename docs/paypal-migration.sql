-- Creates (or retrofits) the account_subscriptions table with full support
-- for Stripe + PayPal subscriptions.  Safe to re-run — idempotent.
--
-- Run this ONCE in the Supabase SQL editor.

-- 1. Create the table if it doesn't exist yet (covers fresh installs)
CREATE TABLE IF NOT EXISTS public.account_subscriptions (
  email                        text      PRIMARY KEY,
  plan_key                     text      NOT NULL DEFAULT 'free',
  billing_cycle                text      NOT NULL DEFAULT 'monthly',
  status                       text      NOT NULL DEFAULT 'free',
  seat_count                   integer   NOT NULL DEFAULT 1,
  enterprise_verified_business boolean   NOT NULL DEFAULT false,
  current_period_end           timestamptz,
  provider                     text      NOT NULL DEFAULT 'stripe',
  provider_subscription_id     text,
  created_at                   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at                   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT account_subscriptions_plan_key_check
    CHECK (plan_key IN ('free', 'apprentice', 'studio', 'pro', 'teams', 'enterprise')),
  CONSTRAINT account_subscriptions_billing_cycle_check
    CHECK (billing_cycle IN ('monthly', 'yearly', 'custom')),
  CONSTRAINT account_subscriptions_status_check
    CHECK (status IN ('free', 'selection_pending', 'active', 'contact_required', 'canceled')),
  CONSTRAINT account_subscriptions_seat_count_check
    CHECK (seat_count >= 1)
);

-- 2. If the table already existed (retrofit case), add the two new columns
ALTER TABLE public.account_subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'stripe';

ALTER TABLE public.account_subscriptions
  ADD COLUMN IF NOT EXISTS provider_subscription_id text;

-- 3. Lookup index for the webhook to resolve by provider-side id
CREATE INDEX IF NOT EXISTS account_subscriptions_provider_sub_id_idx
  ON public.account_subscriptions (provider, provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- 4. Row level security — Supabase standard, same as other tables
ALTER TABLE public.account_subscriptions ENABLE ROW LEVEL SECURITY;
