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

-- 2) Plan. Only needed when VRAELIS_PASS_PRICING=1, where the free tier is ONE lifetime pass capped at
--    three flows (lib/preflight/entitlements-v1.ts -> gatePassLaunch). One run may well be enough for a
--    reviewer; grant a paid tier only if you want them to be able to run repeatedly.
--    Leave this commented unless you have checked that flag.
-- insert into v_subscriptions (user_id, plan, status, updated_at)
-- values ('demo@vraelis.com', 'builder_v1', 'active', now())
-- on conflict (user_id) do update
--   set plan = excluded.plan, status = excluded.status, updated_at = now();

-- Confirm the balance.
select user_id, sum(delta) as balance
from v_credit_ledger
where user_id = 'demo@vraelis.com'
group by user_id;

-- REVOKE after the batch:
-- delete from v_credit_ledger where ext_ref = 'yc-demo-grant-fall-2026';
-- delete from v_subscriptions where user_id = 'demo@vraelis.com';
