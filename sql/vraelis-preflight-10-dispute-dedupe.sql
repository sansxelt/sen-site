-- Preflight migration 10 — Stripe dispute/chargeback handling + webhook event dedupe
-- (revenue-protection blocker 2). Additive. Apply BEFORE deploying the code that reads these.
--
-- Two holes from docs/revenue-protection-audit.md:
--   BLOCKER 2: no charge.dispute.* / charge.refunded handling. A Rank subscriber can pay, consume the
--     full allowance, dispute the charge, and KEEP plan_v1 (a dispute never emits subscription.deleted).
--   HARDENING #4: no Stripe event-id dedupe table. Stripe explicitly warns events can arrive more than
--     once AND out of order; an out-of-order updated(active) after deleted can resurrect a canceled plan.
--
-- POLICY (founder ruling): on a dispute, FREEZE execution access immediately but do NOT destructively
-- clear plan_v1 or customer data. Preserve the prior plan for audited MANUAL restoration after a WON
-- dispute. Freeze the five spend surfaces (new passes, reruns, PAYG, subscription allowance, new free
-- entitlements); preserve applications, reports, evidence, billing records, plan metadata.

-- ── 1. Webhook event dedupe (DB UNIQUE on the Stripe event id — not an in-memory check) ──────────────
-- The handler inserts the event id ONCE at the top; a duplicate delivery hits the unique constraint and
-- the handler returns 200 without reprocessing. `result` records the terminal disposition for audit.
create table if not exists public.stripe_webhook_events (
  stripe_event_id text primary key,            -- Stripe's evt_… id; UNIQUE is the dedupe guarantee
  event_type      text not null,
  object_id       text,                        -- the primary object (sub_…, ch_…, dp_…, in_…) for tracing
  result          text,                        -- 'processed' | 'skipped_duplicate' | 'error' | 'ignored'
  processed_at    timestamptz not null default timezone('utc', now())
);

-- ── 1b. Durable notification dedupe (retry-safe emails) ──────────────────────────────────────────────
-- The webhook now returns non-2xx (500) for critical events so Stripe RETRIES until durable billing
-- state persists (a state write must never silently fail just to avoid a duplicate email). But some
-- billing emails (activation, renewal) are NOT idempotent, so a retry that re-runs the handler would
-- re-send them. This table makes each notification single-send: a marker keyed by
-- (stripe_event_id, notification_type, recipient) is inserted atomically BEFORE the send; the unique
-- constraint means a retry's second insert loses and the email is skipped, while unfinished billing
-- STATE still re-runs. State writes are authoritative; emails are secondary. (Longer term: a
-- transactional outbox — commit state + an email job in one tx, send async — is the clean architecture;
-- this marker is the correct immediate fix.)
create table if not exists public.stripe_notifications_sent (
  stripe_event_id text not null,
  notification_type text not null,             -- 'subscription_activated' | 'renewal_succeeded' | …
  recipient text not null,                     -- the email address the notice went to
  sent_at timestamptz not null default timezone('utc', now()),
  primary key (stripe_event_id, notification_type, recipient)
);

-- ── 2. Billing access state on the Rank profile (the NON-destructive freeze) ─────────────────────────
-- billing_access_state: 'active' (normal) | 'frozen_dispute' (a dispute/chargeback froze execution).
-- previous_plan_v1 preserves the plan at freeze time so an operator can restore it verbatim after a won
-- dispute. plan_v1 itself is LEFT INTACT (non-destructive) — the gate reads the frozen state to block
-- spend, so we do not have to null the plan to stop access, and restoration is a metadata flip.
alter table public.v_profiles add column if not exists billing_access_state text not null default 'active';
alter table public.v_profiles add column if not exists previous_plan_v1 text;
alter table public.v_profiles add column if not exists billing_frozen_at timestamptz;
alter table public.v_profiles add column if not exists billing_frozen_reason text;

-- ── 3. Dispute / chargeback / refund audit log ───────────────────────────────────────────────────────
-- Every dispute-lifecycle event, recorded for the operator. The freeze acts off charge.dispute.created;
-- charge.dispute.closed (won/lost) and charge.refunded are recorded for the audit trail and to inform a
-- manual restore decision. Never auto-restores (founder ruling: manual restore after a won dispute only).
create table if not exists public.v_billing_disputes (
  id uuid primary key default gen_random_uuid(),
  user_id text,                                -- resolved owner (lowercased email), when attributable
  stripe_dispute_id text,                      -- dp_…
  stripe_charge_id text,                        -- ch_…
  stripe_event_id text,                         -- evt_… that produced this row
  kind text not null,                           -- 'dispute_created' | 'dispute_closed' | 'refunded'
  status text,                                  -- Stripe dispute status: needs_response|under_review|won|lost|…
  amount_cents integer,
  froze_access boolean not null default false,  -- did THIS event freeze the owner's execution?
  created_at timestamptz not null default timezone('utc', now())
);
create index if not exists v_billing_disputes_user_idx on public.v_billing_disputes (user_id, created_at);
create index if not exists v_billing_disputes_charge_idx on public.v_billing_disputes (stripe_charge_id);
-- One audit row per Stripe event: a webhook retry (500 -> Stripe redelivers the same evt_… while the
-- freeze is still being retried) must not pile duplicate audit rows. recordDisputeEvent swallows the
-- resulting 23505 on replay. Partial (where stripe_event_id is not null) so unattributed manual rows,
-- if ever inserted without an event id, are unaffected.
create unique index if not exists v_billing_disputes_event_uidx
  on public.v_billing_disputes (stripe_event_id) where stripe_event_id is not null;
