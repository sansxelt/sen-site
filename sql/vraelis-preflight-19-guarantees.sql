-- Migration 19: guarantees. The durable, per-system object a business depends on: a named requirement, its
-- approved proof plan, and whether it is currently proven, tracked across separate deployments.
--
-- A guarantee is a STANDING claim on a system. Verifying it is an ordinary verification run whose row is
-- tagged with this guarantee's id (v_preflight_runs.guarantee_id); the guarantee's live status is DERIVED
-- from its latest tagged run via the same public-decision translator every other surface uses, never stored
-- as a second copy of the verdict. The only durable state written here is the approved plan content, the
-- approval identity, and plan_state (the "workflow changed since approval" axis, separate from any outcome).
--
-- Additive and inert until the code opts in: no existing table is rewritten, and nothing reads v_guarantees
-- unless a caller defines a guarantee. The guarantee_id column on v_preflight_runs is nullable, so every
-- existing run and every plain (non-guarantee) verification is unaffected. Mirrors the migration-8 rule:
-- the app degrades cleanly (warn naming this file, no throw) until this is applied.

create table if not exists v_guarantees (
  id                  text primary key,                      -- grt_<uuid>, self-describing in logs/CI
  user_id             text not null,                         -- tenant (owner email, normalized lowercase)
  application_id      uuid not null references v_applications(id) on delete cascade,

  title               text not null,                         -- the business requirement, one sentence
  scope               text,                                  -- what it proves and does not (optional)
  criticality         text not null default 'critical',      -- 'critical' for milestone 1

  -- The approved proof plan, copied off the reviewed plan at approval so it is DURABLE (no TTL, no single-use
  -- consume) and can be re-instantiated against any future deployment. plan_state is the "workflow changed
  -- since approval" axis and is the only status-shaped value stored here; the pass/fail verdict is derived.
  approved_claim      text,
  approved_plan       jsonb,                                 -- { requirements: [...], flows: [...] }
  approved_plan_hash  text,                                  -- planHash() of approved_plan; drift = a new hash
  approved_role_refs  text[] not null default '{}',
  plan_version        int not null default 0,                -- bumped on each (re)approval
  plan_approved_by    text,
  plan_approved_at    timestamptz,
  plan_state          text not null default 'draft',         -- 'draft' | 'ok' | 'review_required'

  last_evaluated_at   timestamptz,                           -- when a reverify last ran/decided (app-written)
  status              text not null default 'active',        -- 'active' | 'archived'
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- A system's guarantees, newest first (the Guarantees map lists these).
create index if not exists idx_v_guarantees_app on v_guarantees (user_id, application_id, created_at desc);

-- The soft link from a verification run to the guarantee it proves. Nullable (a run may be a plain
-- verification with no guarantee); NO foreign key so archiving/deleting a guarantee never rewrites historical
-- run rows. The guarantee's history and live status are read from the runs carrying its id, newest first.
alter table v_preflight_runs add column if not exists guarantee_id text;
create index if not exists idx_v_preflight_runs_guarantee on v_preflight_runs (user_id, guarantee_id, created_at desc);
