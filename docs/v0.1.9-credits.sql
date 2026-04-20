-- v0.1.9 monetization: flexible credits ledger.
--
-- DO NOT RUN this file blindly — it documents the tables the
-- credits flow writes to. Apply against production Supabase via the
-- SQL editor (or your migration tool of choice) AFTER reviewing.
--
-- Replaces the per-feature one-time SKUs from v0.1.8 with a single
-- "buy credits" surface. 1 USD = 100 credits. Features burn credits
-- by kind: chat (1), image (5), voice_minute (2), copilot (1).
--
-- Tables:
--   user_credits          — running balance per email.
--   credit_transactions   — append-only journal (purchase / consume /
--                           refund). `id` is the idempotency key:
--                             "purchase:<stripe_payment_intent_id>"
--                             "consume:<email>:<feature>:<nonce>"
--                             "refund:<original_id>:<reason>"
--                           so retried writes from the webhook or
--                           the gating layer can't double-spend.

create table if not exists public.user_credits (
  email      text primary key,
  balance    integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.credit_transactions (
  id         text primary key,
  email      text not null,
  delta      integer not null,
  source     text not null check (source in ('purchase', 'consume', 'refund')),
  ref_id     text,
  created_at timestamptz not null default now()
);

create index if not exists credit_transactions_email_idx
  on public.credit_transactions (email, created_at desc);

create index if not exists credit_transactions_ref_idx
  on public.credit_transactions (ref_id);
