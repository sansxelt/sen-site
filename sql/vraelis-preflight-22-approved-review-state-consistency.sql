-- Migration 22: `approved` must mean exactly what `review_state` says.
--
-- WHY THIS EXISTS AS A SEPARATE MIGRATION: migration 20 is already applied to production. A live migration
-- is a historical fact; it is not edited afterwards, because a database that ran a different file from the
-- one in the repository cannot be reasoned about. So the missing invariant arrives as its own numbered file.
--
-- ── THE HOLE ───────────────────────────────────────────────────────────────────────────────────────────
--
-- The old requirement writer hardcoded `approved: true` and passed neither `origin` nor `review_state`.
-- After migration 20 changed the defaults, that writer began producing:
--
--     approved     = true          (hardcoded by the old code)
--     review_state = 'suggested'   (the new, honest default)
--
-- Migration 20 accepts that row. Every one of its constraints is satisfied: the row is not `approved` in
-- review_state, so chk_v_req_approved_has_basis does not apply, and it carries no reviewer, so
-- chk_v_req_unapproved_clean is satisfied. Nothing was violated, and yet the row says two different things
-- about the same fact.
--
-- `approved` is a vestigial boolean from before `review_state` existed. Nothing branches on it today, which
-- is exactly why it drifted: a column no code reads is a column no code keeps honest. Anything that DOES
-- read it later would conclude a person approved a requirement nobody has looked at, which is the original
-- defect wearing a different column.
--
-- ── THE INVARIANT ──────────────────────────────────────────────────────────────────────────────────────
--
--     approved = true   if and only if   review_state = 'approved'
--
-- `is not distinct from` rather than `=` so a NULL `approved` is compared rather than yielding NULL and
-- silently passing the check. The column is `boolean not null default false` today, so NULL should be
-- impossible; the constraint does not depend on that remaining true.
--
-- NOT VALID, like migration 20's constraints: it binds every insert and update from now on, and does not
-- reject rows written under the old rules. The manual correction validates it, along with every migration-20
-- constraint, before it commits.

alter table v_contract_requirements
  drop constraint if exists chk_v_req_approved_matches_review_state;

alter table v_contract_requirements
  add constraint chk_v_req_approved_matches_review_state
  check (approved is not distinct from (review_state = 'approved'))
  not valid;

comment on constraint chk_v_req_approved_matches_review_state on v_contract_requirements is
  'approved is true exactly when review_state is approved. Closes the gap where the pre-correction writer produced approved=true alongside review_state=suggested, which migration 20 accepted.';
