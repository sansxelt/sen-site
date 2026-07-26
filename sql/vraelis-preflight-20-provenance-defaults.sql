-- Migration 20: stop the database asserting authorship and review on behalf of a writer, and make the
-- assertion unrepresentable rather than merely discouraged.
--
-- APPLY ONLY AFTER the explicit-writer code is live. Every production writer then supplies source, origin,
-- review_state, review_basis, approved_by and approved_at at the call site, so these defaults are
-- unreachable in practice; they exist so a FUTURE writer that forgets produces a row claiming NOTHING,
-- instead of a row claiming a person wrote and approved it.
--
-- Applying this BEFORE the code would break the lane: old inserts would land 'suggested' and approveContract
-- would refuse them. That ordering constraint is the whole reason 19 and 20 are separate files.
--
-- Existing rows are NOT rewritten here. Changing a default has no effect on stored rows; migration 21 is the
-- only file that touches historical data.

alter table v_contract_requirements alter column origin       set default 'unspecified';
alter table v_contract_requirements alter column review_state set default 'suggested';

-- ── CONSTRAINTS ────────────────────────────────────────────────────────────────────────────────────────
--
-- Every constraint is NOT VALID: it binds every INSERT and every UPDATE from this point on, and does not
-- retroactively reject rows written under the old rules. That is deliberate. Migration 21 corrects the 136
-- lane rows; the 17 non-lane rows are explicitly out of scope for correction, and validating eagerly would
-- fail the migration on data nobody has agreed to change yet.
--
-- VALIDATE CONSTRAINT can be run later, per constraint, once those rows are dealt with. Until then the
-- ratchet holds forward without rewriting history.

-- Closed vocabulary. 'unspecified' is the honest default; it is a legal value precisely because it claims
-- nothing. 'inference' remains legal: discovery writes it for connection-signal suggestions.
alter table v_contract_requirements drop constraint if exists chk_v_req_origin;
alter table v_contract_requirements add constraint chk_v_req_origin
  check (origin in ('user', 'prompt', 'discovery', 'inference', 'imported', 'system', 'unspecified')) not valid;

-- The review lifecycle. No auto_approved: a machine decision is not a review outcome.
alter table v_contract_requirements drop constraint if exists chk_v_req_review_state;
alter table v_contract_requirements add constraint chk_v_req_review_state
  check (review_state in ('suggested', 'approved', 'rejected', 'archived')) not valid;

alter table v_contract_requirements drop constraint if exists chk_v_req_review_basis_value;
alter table v_contract_requirements add constraint chk_v_req_review_basis_value
  check (review_basis is null or review_basis in ('human_direct', 'reviewed_plan')) not valid;

alter table v_contract_requirements drop constraint if exists chk_v_req_legacy_class_value;
alter table v_contract_requirements add constraint chk_v_req_legacy_class_value
  check (legacy_review_class is null or legacy_review_class in ('legacy_auto_approved')) not valid;

-- A CLAIMED APPROVAL MUST BE COMPLETE. If a row says how it was approved, it must also say who approved it,
-- when, and that it is in fact approved. A basis without a reviewer is the same empty assertion the defaults
-- used to make.
alter table v_contract_requirements drop constraint if exists chk_v_req_basis_complete;
alter table v_contract_requirements add constraint chk_v_req_basis_complete
  check (
    review_basis is null
    or (approved_by is not null and approved_at is not null and review_state = 'approved')
  ) not valid;

-- AN UNAPPROVED ROW MAY NOT CARRY APPROVAL PROVENANCE. A suggested or rejected row holding a reviewer or a
-- timestamp is a row that looks reviewed to anything reading those columns directly.
alter table v_contract_requirements drop constraint if exists chk_v_req_unapproved_clean;
alter table v_contract_requirements add constraint chk_v_req_unapproved_clean
  check (
    review_state = 'approved'
    or (approved_by is null and approved_at is null and review_basis is null and review_identity is null)
  ) not valid;

-- A NEW APPROVED ROW MUST NAME ITS BASIS. Grandfathers pre-19 approved rows (which have no basis column
-- value to carry) while binding everything written from now on.
alter table v_contract_requirements drop constraint if exists chk_v_req_approved_has_basis;
alter table v_contract_requirements add constraint chk_v_req_approved_has_basis
  check (review_state <> 'approved' or review_basis is not null) not valid;

alter table v_production_contracts drop constraint if exists chk_v_contract_legacy_class_value;
alter table v_production_contracts add constraint chk_v_contract_legacy_class_value
  check (legacy_approval_class is null or legacy_approval_class in ('legacy_auto_approved')) not valid;
