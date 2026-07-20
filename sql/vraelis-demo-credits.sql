-- Demo account entitlements: let a YC reviewer actually RUN something.
--
-- Companion to vraelis-demo-account.sql. That one creates the login; this one makes the account able to
-- launch runs, so a reviewer can point Vraelis at an app of their own choosing instead of only reading a
-- report someone else produced.
--
-- WHAT THIS DELIBERATELY DOES NOT DO: seed an application, a run, issues, or evidence. A run inserted by
-- SQL never happened. There would be no browser session behind it, the screenshots it references would not
-- exist in storage, and the steps and the failure would be invented. Showing that to an investor as "a
-- completed verification run" is fabricated evidence, and it is the exact failure this product exists to
-- catch. The demo run has to be a real one, launched from the UI. This file only removes the reason a
-- reviewer could not launch it.

-- 1) Credits. v_credit_ledger is APPEND-ONLY: balance is the sum of deltas, so this ADDS rather than sets.
--    Idempotency uses "where not exists" rather than ON CONFLICT on purpose. The unique index here is
--    composite (v_ledger_extref_uidx over user_id, reason, ext_ref), so ON CONFLICT (ext_ref) has no
--    matching constraint and fails with 42P10. Guarding with a subquery works whatever the index shape is,
--    which matters for a file that gets run by hand against production.
insert into v_credit_ledger (user_id, delta, reason, bucket, ext_ref, expires_at)
select 'demo@vraelis.com', 200, 'yc_reviewer_demo_grant', 'purchased', 'yc-demo-grant-fall-2026', null
where not exists (
  select 1 from v_credit_ledger
  where user_id = 'demo@vraelis.com' and ext_ref = 'yc-demo-grant-fall-2026'
);

-- 2) CENTS. Required when VRAELIS_PASS_PRICING=1, which is the live configuration.
--
--    The credit grant above is NOT enough on its own, and this is easy to get wrong. Balance is computed
--    PER UNIT (lib/v-credits.ts -> liveRows filters on unit), and the ledger's unit column defaults to
--    'credit'. A pass is priced in CENTS, so credit rows are invisible to it: the account can show a
--    healthy credit balance and still be told to add funds.
--
--    Why a pass is charged at all: the free tier is ONE lifetime pass capped at three flows
--    (lib/preflight/entitlements-v1.ts -> gatePassLaunch). A four-flow contract exceeds it and routes to
--    pay-as-you-go, which is $15 for four flows.
--
--    5000 cents = $50, roughly three four-flow passes: one for the demo run, and headroom for a reviewer
--    to run one of their own.
insert into v_credit_ledger (user_id, delta, reason, bucket, ext_ref, expires_at, unit)
select 'demo@vraelis.com', 5000, 'yc_reviewer_demo_grant', 'purchased', 'yc-demo-cents-fall-2026', null, 'cent'
where not exists (
  select 1 from v_credit_ledger
  where user_id = 'demo@vraelis.com' and ext_ref = 'yc-demo-cents-fall-2026'
);

-- Confirm both balances, PER UNIT. A single summed number hides exactly the bug above.
select coalesce(unit, 'credit') as unit, sum(delta) as balance
from v_credit_ledger
where user_id = 'demo@vraelis.com'
group by coalesce(unit, 'credit');

-- REVOKE after the batch:
-- delete from v_credit_ledger where ext_ref in ('yc-demo-grant-fall-2026', 'yc-demo-cents-fall-2026');
