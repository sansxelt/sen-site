-- Migration 23: bind a verification run to the guarantee MEANING it proves, at a point in time.
--
-- WHY 23: sql/ already carries TWO files numbered 19 (guarantees, requirement-provenance), plus 20 and 22.
-- There is no 21. A live migration is a historical fact and is never edited afterwards, so the missing
-- binding arrives as its own numbered file.
--
-- WHAT IS MISSING TODAY. v_preflight_runs.guarantee_id (migration 19) names WHICH guarantee a run proves and
-- nothing more, and no caller has ever written it. Worse, v_guarantees is a LIVE row: approveGuaranteePlan
-- overwrites approved_claim, approved_plan, approved_plan_hash and approved_role_refs and bumps plan_version
-- IN PLACE (lib/preflight/guarantees-db.ts), with no version history anywhere. A run tagged only with
-- guarantee_id therefore resolves, at READ time, to whatever plan version is current, so a single
-- re-approval silently restates every historical verdict.
--
-- WHY NOT (guarantee_id + reviewed_plan_id). A reviewed plan is SINGLE USE and TTL bound: consumeReviewedPlan
-- reserves it atomically and stamps exactly one run_id. A guarantee is reverified on every deployment,
-- forever. A run required to carry a live reviewed_plan_id could never be reverified a second time. So the
-- reviewed plan id here is APPROVAL PROVENANCE copied off the guarantee, never an execution token.
--
-- ADDITIVE AND INERT. Every column is nullable or carries a value-preserving default, there is NO foreign key
-- (mirroring migration 19, so archiving or deleting a guarantee never rewrites historical run rows and never
-- cascades away evidence), no existing row is rewritten, and nothing reads these until a caller opts in. The
-- app warns naming this file and degrades cleanly while it is unapplied, exactly as for migrations 7, 8, 16
-- and 19.
--
-- NOTHING IS BACKFILLED. Historical rows keep guarantee_id = null and are legacy unlinked verifications. No
-- text, hash, URL or timestamp matching is used to invent a relationship that was never recorded.

-- ── 1. The run's pin: WHICH guarantee, WHICH approval generation, WHICH exact plan content ────────────────
alter table v_preflight_runs add column if not exists guarantee_plan_version int;
alter table v_preflight_runs add column if not exists guarantee_plan_hash text;
alter table v_preflight_runs add column if not exists guarantee_reviewed_plan_id text;

comment on column v_preflight_runs.guarantee_plan_hash is
  'planHash() of the guarantee approved plan this run executed, copied at insert. Compared against
   v_guarantees.approved_plan_hash to answer "does this evidence still prove the live definition". Unequal
   means the guarantee was re-approved after this run: the run stays in the history and never counts toward
   the live verdict.';
comment on column v_preflight_runs.guarantee_reviewed_plan_id is
  'APPROVAL PROVENANCE ONLY: the immutable v_reviewed_plans row a human approved, copied from
   v_guarantees.approved_reviewed_plan_id. Never an execution token. A reviewed plan is single use and TTL
   bound; a guarantee is reverified forever.';

-- ── 2. The guarantee: approval provenance + the materialized plan it actually runs ────────────────────────
-- approved_plan_hash has had ZERO runtime consumers since migration 19: nothing related a guarantee's
-- approved plan to what a run executes, which is the flow_ids of a v_production_contracts row. Approval now
-- materializes the approved plan into a FROZEN contract on the guarantee's own application, so reverification
-- is pure execution of a fixed artifact: no synthesis, no per-run contract, and the flows cannot drift
-- because an approved contract refuses addFlow/updateFlow/deleteFlow.
alter table v_guarantees add column if not exists approved_reviewed_plan_id text;
alter table v_guarantees add column if not exists plan_contract_id uuid;
alter table v_guarantees add column if not exists plan_contract_version int;

comment on column v_guarantees.plan_contract_id is
  'The FROZEN contract that approval materialized approved_plan into, on this guarantee''s own application.
   Without it "this run proves that guarantee" is asserted by the caller and checked against nothing.';

-- ── 3. The reviewed plan knows which guarantee it was minted for ──────────────────────────────────────────
-- Today the guarantee-to-plan link exists only in the client's hands: findLivePendingPlanForClaim matches on
-- (user_id, deployment_fp, claim_fp), so a plain verification's plan and a guarantee's plan are
-- interchangeable whenever the claim text and URL coincide. This is the persisted fact that replaces that
-- coincidence. NULL means a plain verification, which stays a permanently supported case.
alter table v_reviewed_plans add column if not exists guarantee_id text;

-- ── 4. Contract lineage: a guarantee's frozen plan contract is NOT the system's Production Contract ───────
-- getApprovedContract returns the highest-version APPROVED contract for an application. Without this
-- discriminator, approving a guarantee's plan contract would silently replace the customer's hand-curated
-- Production Contract for the contract page, the context page, pass preview, api-flows, and every later
-- browser-launched run. The default preserves every existing row exactly as it is.
alter table v_production_contracts add column if not exists kind text not null default 'production';

-- ── 5. Indexes ────────────────────────────────────────────────────────────────────────────────────────────
create index if not exists idx_v_preflight_runs_guarantee_plan
  on v_preflight_runs (user_id, guarantee_id, guarantee_plan_version, created_at desc);
create index if not exists idx_v_reviewed_plans_guarantee
  on v_reviewed_plans (user_id, guarantee_id, created_at desc);
create index if not exists idx_v_production_contracts_kind
  on v_production_contracts (user_id, application_id, kind, version desc);

-- ── ROLLBACK ──────────────────────────────────────────────────────────────────────────────────────────────
-- Safe because nothing here is read unless the code opts in, and no existing row was rewritten. Dropping
-- v_production_contracts.kind returns getApprovedContract to its previous behaviour; any guarantee plan
-- contracts created in the meantime would then become eligible as Production Contracts, so drop that column
-- LAST and only if no guarantee has been approved since this was applied.
--
--   drop index if exists idx_v_production_contracts_kind;
--   drop index if exists idx_v_reviewed_plans_guarantee;
--   drop index if exists idx_v_preflight_runs_guarantee_plan;
--   alter table v_reviewed_plans      drop column if exists guarantee_id;
--   alter table v_guarantees          drop column if exists plan_contract_version;
--   alter table v_guarantees          drop column if exists plan_contract_id;
--   alter table v_guarantees          drop column if exists approved_reviewed_plan_id;
--   alter table v_preflight_runs      drop column if exists guarantee_reviewed_plan_id;
--   alter table v_preflight_runs      drop column if exists guarantee_plan_hash;
--   alter table v_preflight_runs      drop column if exists guarantee_plan_version;
--   alter table v_production_contracts drop column if exists kind;
