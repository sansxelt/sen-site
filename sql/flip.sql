-- Flip Engine schema. Run once in the Supabase SQL editor (Dashboard → SQL).
-- Idempotent: safe to re-run. Prefixed `flip_` so it never collides with
-- vraelis_* or the legacy sansxel tables.

create extension if not exists "pgcrypto";

-- One row per signed-in user (keyed by account email). Tracks plan + free usage.
create table if not exists flip_accounts (
  user_id            text primary key,
  plan               text not null default 'free',     -- 'free' | 'pro'
  plan_status        text not null default 'active',    -- 'active' | 'canceled' | 'past_due'
  free_used          int  not null default 0,
  stripe_customer_id text,
  created_at         timestamptz not null default now()
);

-- One row per generated listing. user_id (signed in) OR anon_id (pre-login cookie).
create table if not exists flip_items (
  id              uuid primary key default gen_random_uuid(),
  user_id         text,
  anon_id         text,
  created_at      timestamptz not null default now(),
  detected        jsonb,   -- identification: item_type/brand/model/size/condition/flaws/...
  generated       jsonb,   -- titles/description/keywords/hashtags
  suggested_price jsonb    -- { fast, market, high, confidence }
);
create index if not exists flip_items_user_idx on flip_items (user_id, created_at desc);
create index if not exists flip_items_anon_idx on flip_items (anon_id, created_at desc);

-- THE MOAT TABLE. Created now; filled later by the sold-tracker. Do not skip it:
-- listed_price + sold_price + days_to_sell across platforms is the real-resale-data
-- asset that no competitor can buy.
create table if not exists flip_listings (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid references flip_items(id) on delete cascade,
  platform      text,
  listed_price  numeric,
  listed_at     timestamptz,
  status        text,        -- 'active' | 'sold' | 'ended'
  sold_price    numeric,
  sold_at       timestamptz,
  days_to_sell  int
);
create index if not exists flip_listings_item_idx on flip_listings (item_id);

-- Per-user marketplace connections. status 'early_access' = enrolled for the
-- integration; 'connected' = live (store/handle stored once OAuth/token is set).
create table if not exists flip_connections (
  user_id    text not null,
  platform   text not null,   -- 'ebay' | 'shopify' | 'poshmark' | 'depop' | 'mercari'
  status     text not null default 'early_access',
  handle     text,            -- store domain / username when actually connected
  created_at timestamptz not null default now(),
  primary key (user_id, platform)
);

-- Direct-USDC crypto invoices. A unique on-chain amount (base price + sub-cent
-- random offset) ties an anonymous USDC transfer back to one invoice/user.
create table if not exists flip_crypto_invoices (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  plan         text not null,
  cycle        text not null,
  amount_units bigint not null,        -- USDC smallest units (6 decimals)
  chain        text not null default 'base',
  to_address   text not null,          -- merchant receiving wallet
  start_block  bigint not null default 0,
  status       text not null default 'pending',  -- 'pending' | 'paid' | 'expired'
  tx_hash      text,
  created_at   timestamptz not null default now()
);
create index if not exists flip_crypto_invoices_user_idx on flip_crypto_invoices (user_id, created_at desc);

-- Access is server-only via the Supabase service-role key (lib/supabase-admin),
-- which bypasses RLS; every query is scoped by user_id / anon_id in app code.
