-- Referral award idempotency, enforced by the database rather than by application logic.
--
-- recordReferralSignup checked for an existing signup event and then inserted one — a check-then-insert
-- with nothing serialising it, so two concurrent claims could both pass the check and both award credits.
-- The route that reaches it also used to be unauthenticated and to take the beneficiary from the request
-- body; that is fixed in app/api/referral/route.ts, and this is the backstop that holds regardless.
--
-- Partial, on the signup kind only: a referred address has at most ONE signup event, but may legitimately
-- have other event kinds later.
--
-- BEFORE APPLYING, check for existing duplicates — the index build fails if any exist:
--
--   select referred_email, count(*) from referral_events
--   where kind = 'signup' group by referred_email having count(*) > 1;
--
-- A duplicate means credits were awarded more than once for one signup. Decide which event is canonical,
-- delete the others, and reconcile the credit ledger by hand before creating the index.
--
-- CONCURRENTLY so the build takes no write lock; it cannot run inside a transaction, so run this file
-- on its own.

create unique index concurrently if not exists referral_events_signup_uidx
  on referral_events (referred_email)
  where kind = 'signup';
