-- READ-ONLY verification for migrations 9 + 10 + 11 (revenue-protection blockers).
-- Paste this whole file into the Supabase SQL editor and run. Every row returned is an
-- ASSERTION with a PASS/FAIL verdict — nothing here writes, alters, or deletes. If any row
-- reads FAIL, the deploy gate is NOT satisfied: do not merge until it is fixed.
--
-- Covers: required tables, columns, indexes, primary keys / unique constraints, the governor
-- single-row default-unpaused invariant, and the "no account accidentally frozen" live check.

-- ── A. Required tables all exist ─────────────────────────────────────────────────────────
select 'TABLE' as kind, t.tbl,
       case when to_regclass('public.'||t.tbl) is not null then 'PASS' else 'FAIL' end as verdict
from (values
  ('user_profiles'),            -- mig 9 (canonical_email column lives here)
  ('v_free_grant_risk'),        -- mig 9
  ('v_free_grant_overrides'),   -- mig 9
  ('v_free_pass_claims'),       -- mig 9
  ('stripe_webhook_events'),    -- mig 10
  ('stripe_notifications_sent'),-- mig 10
  ('v_profiles'),               -- mig 10 (billing_access_state columns live here)
  ('v_billing_disputes'),       -- mig 10
  ('v_cost_ledger'),            -- mig 11
  ('v_runs_governor'),          -- mig 11
  ('v_provider_attempts'),      -- mig 11
  ('v_provider_breaker')        -- mig 11
) as t(tbl)
order by verdict desc, t.tbl;

-- ── B. Required columns exist (added by ALTER on existing tables) ─────────────────────────
select 'COLUMN' as kind, c.tbl||'.'||c.col as col,
       case when exists (
         select 1 from information_schema.columns
         where table_schema='public' and table_name=c.tbl and column_name=c.col
       ) then 'PASS' else 'FAIL' end as verdict
from (values
  ('user_profiles','canonical_email'),        -- mig 9
  ('v_profiles','billing_access_state'),       -- mig 10
  ('v_profiles','previous_plan_v1'),           -- mig 10
  ('v_profiles','billing_frozen_at'),          -- mig 10
  ('v_profiles','billing_frozen_reason'),      -- mig 10
  ('v_runs_governor','reset_grace_until')      -- mig 11 (the re-apply-safety column)
) as c(tbl,col)
order by verdict desc, col;

-- ── C. Required indexes exist ────────────────────────────────────────────────────────────
select 'INDEX' as kind, i.idx,
       case when to_regclass('public.'||i.idx) is not null then 'PASS' else 'FAIL' end as verdict
from (values
  ('user_profiles_canonical_email_idx'),       -- mig 9 (NON-unique cluster read key)
  ('v_free_grant_risk_canonical_idx'),
  ('v_free_grant_risk_ip_idx'),
  ('v_free_grant_risk_user_idx'),
  ('v_free_grant_overrides_user_idx'),
  ('v_billing_disputes_user_idx'),             -- mig 10
  ('v_billing_disputes_charge_idx'),
  ('v_billing_disputes_event_uidx'),           -- mig 10 (partial UNIQUE per event)
  ('v_cost_ledger_created_idx'),               -- mig 11
  ('v_cost_ledger_user_idx'),
  ('v_provider_attempts_user_idx')
) as i(idx)
order by verdict desc, i.idx;

-- ── D. Primary keys / unique constraints that guarantee the atomic guards ─────────────────
-- These are the DB-level guarantees the code relies on (not app checks): the free-pass claim
-- PK (double-spend race), the webhook event PK (dedupe), the notification PK (single-send).
select 'PK/UNIQUE' as kind, x.label,
       case when exists (
         select 1 from pg_index ix
         join pg_class c on c.oid = ix.indrelid
         join pg_class ic on ic.oid = ix.indexrelid
         where c.relname = x.tbl and (ix.indisprimary or ix.indisunique)
           and ic.relname = x.expect_index
       ) then 'PASS' else 'FAIL (expected unique/pk index '||x.expect_index||')' end as verdict
from (values
  ('v_free_pass_claims',       'v_free_pass_claims_pkey',        'free-pass claim PK = at most one claim per canonical inbox'),
  ('stripe_webhook_events',    'stripe_webhook_events_pkey',     'webhook event id PK = DB-level dedupe'),
  ('stripe_notifications_sent','stripe_notifications_sent_pkey', 'notification (event,type,recipient) PK = single-send'),
  ('v_runs_governor',          'v_runs_governor_pkey',           'governor single-row PK'),
  ('v_provider_breaker',       'v_provider_breaker_pkey',        'one breaker row per account')
) as x(tbl, expect_index, label)
order by verdict desc, x.label;

-- ── E. Governor invariant: exactly one 'global' row, and it defaults UNPAUSED ─────────────
-- FAIL here would mean "normal paid launches are globally disabled" on day one.
select 'GOVERNOR' as kind,
       'global row present and NOT paused' as label,
       case when exists (
         select 1 from public.v_runs_governor where id='global' and paused = false
       ) then 'PASS'
       when exists (select 1 from public.v_runs_governor where id='global' and paused = true)
         then 'FAIL — governor is PAUSED (new runs globally disabled); inspect last_reason'
       else 'FAIL — no global governor row (insert-on-conflict did not run)'
       end as verdict;

-- ── F. No account accidentally frozen by the dispute migration/default ────────────────────
-- The column default is 'active'; anything frozen must correspond to a REAL dispute. This
-- surfaces any frozen accounts so an operator can confirm each is legitimate (0 rows = clean).
select 'FROZEN_ACCOUNTS' as kind,
       coalesce(count(*),0)::text as frozen_count,
       case when count(*) = 0 then 'PASS — no frozen accounts'
            else 'REVIEW — '||count(*)||' account(s) frozen; confirm each maps to a real dispute below'
       end as verdict
from public.v_profiles where billing_access_state = 'frozen_dispute';

-- Detail rows for any frozen account (empty on a clean system):
select 'FROZEN_DETAIL' as kind, user_id, billing_access_state, previous_plan_v1,
       billing_frozen_at, billing_frozen_reason
from public.v_profiles where billing_access_state = 'frozen_dispute'
order by billing_frozen_at desc nulls last;
