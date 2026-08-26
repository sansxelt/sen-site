-- One provider subscription funds ONE workspace.
--
-- app/api/vraelis/paypal/record/route.ts checks isSubscriptionClaimedByAnother() before writing, but that
-- check is a separate round trip from the write and it fails SOFT (returns "not claimed" when the DB is
-- unconfigured, when the query errors, or on any throw). Two concurrent posts of the same subscription id
-- therefore both pass it. This index is the backstop that actually holds: the second write fails at the
-- database regardless of timing or application state.
--
-- Partial, because plan_subscription_id is NULL for every workspace on the free tier and for Stripe rows
-- written before the column existed. A plain UNIQUE would also permit unlimited NULLs, but stating the
-- predicate keeps the index small and the intent explicit.
--
-- BEFORE APPLYING: this will fail if duplicates already exist. Check first, and resolve them by hand —
-- a duplicate means two accounts were funded by one subscription, which is a billing question, not a
-- schema question:
--
--   select plan_subscription_id, count(*), array_agg(owner_email)
--   from vraelis_workspaces
--   where plan_subscription_id is not null
--   group by plan_subscription_id having count(*) > 1;
--
-- CONCURRENTLY so the build does not hold a write lock on vraelis_workspaces. It cannot run inside a
-- transaction block, so this file has no begin/commit — run it on its own. If it ends up INVALID (the
-- concurrent build failed), drop the index and re-run rather than leaving it in place.

create unique index concurrently if not exists vraelis_workspaces_plan_subscription_id_uidx
  on vraelis_workspaces (plan_subscription_id)
  where plan_subscription_id is not null;
