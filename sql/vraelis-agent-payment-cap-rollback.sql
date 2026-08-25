-- ROLLBACK for sql/vraelis-agent-payment-cap.sql
--
-- lib/vraelis-payment-authz.ts detects an absent RPC (42883 / PGRST202) and falls back to its
-- application-level aggregation, so the product keeps working after this runs. What it loses is exactly
-- what the migration added: exact aggregation at any row count, per-currency scoping, and the
-- transactional reservation that stops two concurrent authorizations from both passing one cap.
--
-- ORDER. Functions first, table last: dropping the table out from under a live function would leave
-- callers erroring instead of falling back cleanly.
--
-- DATA. v_agent_payment_reservations holds owner email, an amount, a currency and timestamps. It is an
-- internal budget counter, not a financial record — vraelis_payments remains the revenue ledger and is
-- untouched here. Nothing else references this table.

drop function if exists v_settle_agent_payment(uuid, boolean);
drop function if exists v_reserve_agent_payment(text, int, int, int, int, int, text, text);
drop table if exists v_agent_payment_reservations;
