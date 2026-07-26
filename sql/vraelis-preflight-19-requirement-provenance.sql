-- Migration 19: columns for explicit requirement provenance and human-review semantics.
--
-- ADDITIVE AND INERT. No default is changed here, no row is written, no existing read changes meaning. Safe
-- to apply BEFORE the code that writes these columns ships, which is the point: migration 20 hardens the
-- defaults and may only run once every writer is explicit, and this file is what lets the two be separated.
--
-- ── WHAT THIS IS FIXING ────────────────────────────────────────────────────────────────────────────────
--
-- sql/vraelis-preflight-2-discovery.sql added:
--
--   alter table v_contract_requirements add column ... origin       text not null default 'user';
--   alter table v_contract_requirements add column ... review_state text not null default 'approved';
--
-- and the single requirement-insert helper passed neither column, while hardcoding source 'manual'. Every
-- requirement a model synthesized therefore recorded, in the database, that a PERSON wrote it and a PERSON
-- approved it. 136 production rows carry that claim. Nobody wrote the claim; two defaults did.
--
-- ── THE MODEL ──────────────────────────────────────────────────────────────────────────────────────────
--
-- Authorship and review are separate facts and live in separate columns:
--
--   source, origin        WHO AUTHORED IT.   A model may author a requirement.
--   review_state          THE DECISION.      suggested | approved | rejected | archived. Unchanged set:
--                                            "approved" now means a person accepted it, and nothing else.
--   review_basis          HOW IT WAS APPROVED. human_direct | reviewed_plan. Null when unapproved.
--   approved_by           WHICH PERSON reviewed it.
--   approved_at           WHEN they reviewed it.
--   review_identity       WHAT they were agreeing to, captured at approval, so a later revision can prove
--                         the content is unchanged before carrying the approval forward.
--   reviewed_plan_id      The approved immutable plan whose approval covered this exact row.
--   legacy_review_class   Set ONLY by the migration-21 backfill, so a row WRITTEN honestly stays
--                         distinguishable from one CORRECTED into honesty.
--
-- There is deliberately no "auto_approved" review state. Auto-approval was the defect, not a legitimate
-- outcome, and giving it a first-class name in the live state machine would preserve it as one.

alter table v_contract_requirements add column if not exists approved_at         timestamptz;
alter table v_contract_requirements add column if not exists review_basis        text;
alter table v_contract_requirements add column if not exists review_identity     text;
alter table v_contract_requirements add column if not exists reviewed_plan_id    text;
alter table v_contract_requirements add column if not exists legacy_review_class text;

comment on column v_contract_requirements.approved_by is
  'The PERSON who reviewed this requirement. Non-null only when review_state = approved.';
comment on column v_contract_requirements.approved_at is
  'When that person reviewed it. Non-null only when review_state = approved.';
comment on column v_contract_requirements.review_basis is
  'HOW the approval happened: human_direct (a person accepted this row) or reviewed_plan (a person approved the exact immutable plan containing it). Null when unapproved. Never inferred.';
comment on column v_contract_requirements.review_identity is
  'Canonical identity of the content that was approved (text, category, severity, enabled, source refs). A draft revision carries the approval forward only on an exact match; a missing value means the review cannot be proven to apply and is cleared.';
comment on column v_contract_requirements.reviewed_plan_id is
  'v_reviewed_plans.id whose approval covered this exact row.';
comment on column v_contract_requirements.legacy_review_class is
  'Set ONLY by the migration-21 backfill. legacy_auto_approved marks a row that had claimed human review it never received. Separate field from review_state, so the correction is auditable and reversible.';

-- Contract-level legacy classification. SEPARATE FIELD from `status`, which stays 'approved' on every
-- historical contract and is never rewritten, and separate from any run decision, which this work does not
-- read or touch. A record may carry a legacy decision status and a legacy contract review status
-- independently: both, either, or neither.
alter table v_production_contracts add column if not exists legacy_approval_class text;

comment on column v_production_contracts.legacy_approval_class is
  'Set ONLY by the migration-21 backfill. legacy_auto_approved marks a contract whose approval was manufactured by the pre-correction lane rather than performed by a person. status is unchanged and historical decisions stand.';

-- Reviewing a contract means reading its rows by review state; this keeps that read cheap once the states
-- stop being uniformly 'approved'.
create index if not exists v_contract_req_review_idx
  on v_contract_requirements (contract_id, review_state);
