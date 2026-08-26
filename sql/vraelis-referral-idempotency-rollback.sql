-- ROLLBACK for sql/vraelis-referral-idempotency.sql
-- Removes the constraint; recordReferralSignup falls back to its application-level check, which races.
drop index concurrently if exists referral_events_signup_uidx;
