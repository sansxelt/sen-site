-- Migration 18: reviewed plans. Binds "Vraelis proved this plan is sufficient" to "this exact plan ran".
--
-- A reviewed plan is minted (immutable) by a dry run, APPROVED as a separate durable event, and CONSUMED once
-- by a paid execution that runs the stored requirements and flows verbatim. Approval and execution are
-- deliberately two rows-worth of state on the same record, never one act: possessing the id is not approval.
--
-- Additive and inert until the code opts in: no existing table is touched, and nothing reads this table unless
-- a caller mints a reviewed plan (dry run) or submits a reviewed_plan_id (execution).

create table if not exists v_reviewed_plans (
  id              text primary key,                        -- rvp_<uuid>, self-describing in logs/CI
  user_id         text not null,                           -- tenant (owner email, normalized lowercase)

  -- What the plan was approved FOR. Fingerprints are what execution compares against; the raw values are kept
  -- for display and audit. deployment_fp/claim_fp are sha256(canonical)[:32].
  deployment_url  text not null,
  deployment_fp   text not null,
  claim           text not null,
  claim_fp        text not null,

  -- The plan itself: the exact requirements + flows a run will execute, and their immutable content hash.
  plan            jsonb not null,                          -- { requirements: [...], flows: [...] }
  plan_hash       text not null,                           -- sha256 of the canonical plan projection
  role_refs       text[] not null default '{}',            -- test-account roles the flows sign in as
  discovery_hash  text,                                    -- crawl snapshot the plan was built from (bound, informational)
  coverage        jsonb not null,                          -- { claim_after, execution_after, ready }

  -- Approval: a distinct, auditable business event. NULL approver until it happens.
  approval_state  text not null default 'pending',         -- 'pending' | 'approved'
  approved_by     text,                                    -- approving principal (key prefix or email)
  approved_at     timestamptz,

  -- Execution: reserved and consumed atomically, exactly once.
  execution_state text not null default 'unconsumed',      -- 'unconsumed' | 'consuming' | 'consumed'
  run_id          text,                                    -- the run this plan launched, once consumed
  consumed_at     timestamptz,

  expires_at      timestamptz not null,                    -- approval and execution both refuse past this
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Owner's plans, newest first (the console lists these).
create index if not exists idx_v_reviewed_plans_user on v_reviewed_plans (user_id, created_at desc);

-- Mint idempotency / dedupe: at most ONE live (unconsumed) reviewed plan per identical
-- (tenant, deployment, claim, plan) so a repeated dry run returns the same handle instead of piling up rows.
-- Partial: consumed plans are historical and never collide with a fresh mint.
create unique index if not exists uq_v_reviewed_plans_live
  on v_reviewed_plans (user_id, deployment_fp, claim_fp, plan_hash)
  where execution_state <> 'consumed';
