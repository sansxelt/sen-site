-- v0.1.8 monetization: boost_credits ledger.
--
-- DO NOT RUN this file blindly — it documents the table the
-- payment_intent.succeeded webhook handler writes to. Apply against
-- production Supabase via the SQL editor (or your migration tool of
-- choice) AFTER reviewing.
--
-- Each row represents one purchased one-time boost (session_boost,
-- weekly_boost, voice_minute_pack, image_credit_pack, copilot_time_pack).
-- The webhook inserts a row with consumed=false on
-- payment_intent.succeeded; the gating layer in lib/plan-limits.ts
-- flips consumed=true when the boost is redeemed against a
-- chat / voice / image / copilot request.
--
-- Idempotency: stripe_payment_intent is unique so retried webhooks
-- can't double-credit a single charge.

create table if not exists public.boost_credits (
  id                    uuid primary key default gen_random_uuid(),
  email                 text not null,
  addon_key             text not null,
  stripe_payment_intent text unique,
  created_at            timestamptz not null default now(),
  consumed              boolean not null default false,
  consumed_at           timestamptz
);

create index if not exists boost_credits_email_idx
  on public.boost_credits (email);

-- Hot path: "give me one unconsumed credit for this email + addon_key".
create index if not exists boost_credits_redeem_idx
  on public.boost_credits (email, addon_key, consumed)
  where consumed = false;
