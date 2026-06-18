-- Vraelis backend schema.
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query → paste → Run).
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

-- One workspace per signed-in user (keyed by their account email). Holds
-- the secret intake key that website forms / webhooks post with.
create table if not exists vraelis_workspaces (
  owner_email          text primary key,
  intake_key           text not null unique,
  business_name        text,
  business_description  text,
  plan                 text,           -- 'solo' | 'growth' (null = free Starter)
  plan_cycle           text,           -- 'monthly' | 'yearly' | 'lifetime'
  plan_status          text,           -- 'active' | 'canceled'
  plan_provider        text,           -- 'stripe' | 'paypal'
  plan_updated_at      timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Services + prices the owner offers (freeform text, one per line e.g.
-- "Interior detail — $90"). The AI quotes ONLY from this list (never invents
-- a price) and can collect the matching amount on-platform.
alter table vraelis_workspaces add column if not exists business_services text;

-- Offer-first onboarding: what Vraelis should ask to qualify buyers, and
-- where the owner's leads come from. Both freeform text, fail-soft in code
-- (no-op until migrated). Used to brief the AI; no Stripe/pricing impact.
alter table vraelis_workspaces add column if not exists qualifying_questions text;
alter table vraelis_workspaces add column if not exists lead_sources text;

-- Agent identity (fail-soft in code, no-op until migrated): the persona that
-- personalizes onboarding examples, the named agent + its tone (fed to the
-- AI prompt), and the onboarding-complete gate flag.
alter table vraelis_workspaces add column if not exists persona text;
alter table vraelis_workspaces add column if not exists agent_name text;
alter table vraelis_workspaces add column if not exists agent_tone text;
alter table vraelis_workspaces add column if not exists onboarding_complete boolean;

-- Identity split: business_name is the BUSINESS BRAND (e.g. "Apex Trading"),
-- used for the greeting and customer-facing brand surfaces. offer_name is the
-- OFFER the agent sells (e.g. "12-Week Coaching"), shown as the Stripe product.
-- Fail-soft in code (no-op until migrated). The backfill below preserves
-- existing data: early onboarding put the OFFER into business_name, so copy it
-- into offer_name once, only where offer_name isn't already set. Owners can
-- then correct business_name to their real brand.
alter table vraelis_workspaces add column if not exists offer_name text;
alter table vraelis_workspaces add column if not exists offer_description text;
update vraelis_workspaces
  set offer_name = business_name
  where offer_name is null and business_name is not null;
update vraelis_workspaces
  set offer_description = business_description
  where offer_description is null and business_description is not null;

-- If the table already existed before plan columns were added, run these
-- (safe / idempotent):
alter table vraelis_workspaces add column if not exists plan text;
alter table vraelis_workspaces add column if not exists plan_cycle text;
alter table vraelis_workspaces add column if not exists plan_status text;
alter table vraelis_workspaces add column if not exists plan_provider text;
alter table vraelis_workspaces add column if not exists plan_updated_at timestamptz;

-- Lapse handling (grace + self-heal). plan_status now carries THREE values:
--   'active'   — paid + current
--   'past_due' — a renewal charge failed; SHORT grace (see PAST_DUE_GRACE_DAYS
--                in lib/vraelis-plans), then treated as lapsed. plan_updated_at
--                marks when it went past_due (the grace clock).
--   'canceled' — subscription ended / fully lapsed.
-- We persist the provider's subscription id + current period end so the daily
-- reconcile cron can re-poll live status and self-heal a missed webhook.
alter table vraelis_workspaces add column if not exists plan_subscription_id text;
alter table vraelis_workspaces add column if not exists plan_current_period_end timestamptz;

-- Inbound leads belonging to a workspace.
create table if not exists vraelis_leads (
  id            uuid primary key default gen_random_uuid(),
  owner_email   text not null references vraelis_workspaces(owner_email) on delete cascade,
  name          text,
  contact_email text,
  contact_phone text,
  source        text not null default 'form',
  status        text not null default 'new',  -- new | contacted | qualified | booked | won | lost
  value         numeric,
  snippet       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists vraelis_leads_owner_idx on vraelis_leads (owner_email, created_at desc);

-- Revenue cut: once a won lead's value has been included on an invoice,
-- mark it billed so it isn't charged again. Run if the table predates this:
alter table vraelis_leads add column if not exists fee_billed boolean not null default false;

-- Auto follow-up: how many nudge messages we've sent on a quiet lead (capped).
alter table vraelis_leads add column if not exists followups_sent integer not null default 0;

-- Conversation outcome labels (VIE training foundation). Coarser than the
-- pipeline status: open | booked | paid | lost | spam, plus a lost reason.
alter table vraelis_leads add column if not exists outcome text not null default 'open';
alter table vraelis_leads add column if not exists lost_reason text;

-- Conversation messages for a lead (the lead's messages + the agent's replies).
create table if not exists vraelis_messages (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references vraelis_leads(id) on delete cascade,
  role       text not null check (role in ('lead', 'agent')),
  body       text not null,
  channel    text,                 -- e.g. 'form', 'email'
  delivered  boolean not null default false,  -- agent messages: was it actually emailed out?
  created_at timestamptz not null default now()
);
create index if not exists vraelis_messages_lead_idx on vraelis_messages (lead_id, created_at);

-- Stripe Connect: the workspace's connected payout account + deposit config.
-- Payments flow through Vraelis (destination charges); the cut is taken as a
-- Stripe application fee at payment time, so it can't be under-reported or
-- bypassed. connect_status mirrors Stripe's charges_enabled.
alter table vraelis_workspaces add column if not exists connect_account_id text;
alter table vraelis_workspaces add column if not exists connect_status text;          -- 'pending' | 'active'
alter table vraelis_workspaces add column if not exists deposit_enabled boolean not null default false;
alter table vraelis_workspaces add column if not exists deposit_amount_cents integer;  -- fixed deposit to confirm a booking

-- On-platform payments. Each row is a Stripe Checkout (destination charge):
-- the lead pays, Stripe splits it — owner gets amount−fee, Vraelis keeps fee.
-- This table is the real revenue ledger (replaces self-reported deal values).
create table if not exists vraelis_payments (
  id                    uuid primary key default gen_random_uuid(),
  owner_email           text not null references vraelis_workspaces(owner_email) on delete cascade,
  lead_id               uuid references vraelis_leads(id) on delete set null,
  kind                  text not null default 'full',   -- 'deposit' | 'full'
  description           text,
  currency              text not null default 'usd',
  amount_cents          integer not null,
  fee_cents             integer not null default 0,
  status                text not null default 'pending', -- pending | paid | canceled
  stripe_session_id     text unique,
  stripe_payment_intent text,
  -- deposit bookings: stash the slot/contact so the booking is created on pay.
  booking_slot          timestamptz,
  booking_name          text,
  booking_phone         text,
  created_at            timestamptz not null default now(),
  paid_at               timestamptz
);
create index if not exists vraelis_payments_owner_idx on vraelis_payments (owner_email, created_at desc);

-- Bookings made through the self-serve booking page.
create table if not exists vraelis_bookings (
  id            uuid primary key default gen_random_uuid(),
  owner_email   text not null,
  lead_id       uuid references vraelis_leads(id) on delete set null,
  slot          timestamptz not null,
  name          text,
  contact_email text,
  contact_phone text,
  note          text,
  status        text not null default 'confirmed',  -- confirmed | canceled
  created_at    timestamptz not null default now()
);
create index if not exists vraelis_bookings_owner_idx on vraelis_bookings (owner_email, slot);

-- Sales / contact-form submissions (from the /contact page).
create table if not exists vraelis_contacts (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text,
  company    text,
  message    text,
  topic      text,            -- e.g. 'sales', 'general'
  created_at timestamptz not null default now()
);
create index if not exists vraelis_contacts_created_idx on vraelis_contacts (created_at desc);

-- ── SMS / Twilio (Phase 1) ─────────────────────────────────────────────
-- owner_phone: where new-lead alerts + reminders text the owner.
-- twilio_number: the business's Twilio number; inbound SMS/calls to it are
-- routed to this workspace.
alter table vraelis_workspaces add column if not exists owner_phone text;
alter table vraelis_workspaces add column if not exists twilio_number text;
-- one reminder text per booking (avoids re-texting on each cron run)
alter table vraelis_bookings add column if not exists reminded boolean not null default false;

-- ── Rate limiting (Phase 1) ────────────────────────────────────────────
-- Fixed-window counter shared across serverless instances. The function is
-- atomic (single upsert) and returns true while under the limit.
create table if not exists vraelis_rate_limits (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);
create or replace function vraelis_rate_check(p_key text, p_limit int, p_window_secs int)
returns boolean language plpgsql as $$
declare c int;
begin
  insert into vraelis_rate_limits (key, count, window_start)
    values (p_key, 1, now())
    on conflict (key) do update set
      count = case
        when now() - vraelis_rate_limits.window_start > make_interval(secs => p_window_secs)
          then 1 else vraelis_rate_limits.count + 1 end,
      window_start = case
        when now() - vraelis_rate_limits.window_start > make_interval(secs => p_window_secs)
          then now() else vraelis_rate_limits.window_start end
    returning count into c;
  return c <= p_limit;
end $$;

-- ── Abandoned-payment recovery (Part 1.3) ──────────────────────────────
alter table vraelis_payments add column if not exists checkout_url text;
alter table vraelis_payments add column if not exists reminders_sent integer not null default 0;
alter table vraelis_payments add column if not exists last_reminder_at timestamptz;

-- ── Google Calendar (Part 2) ───────────────────────────────────────────
alter table vraelis_workspaces add column if not exists gcal_refresh_token text;
alter table vraelis_workspaces add column if not exists gcal_connected boolean not null default false;
alter table vraelis_workspaces add column if not exists gcal_calendar_id text;
alter table vraelis_bookings add column if not exists gcal_event_id text;

-- Access is server-only via the Supabase service-role key (lib/supabase-admin),
-- which bypasses RLS; every query is scoped by owner_email in application code.
