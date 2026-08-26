-- ROLLBACK for sql/vraelis-credit-hold-atomic.sql
--
-- Dropping the function returns hold() to its TypeScript path, which is read-then-write and races under
-- concurrency. lib/v-credits.ts falls back to that path automatically when the RPC is missing, so this is
-- safe to run and the application keeps working — it simply loses the atomicity guarantee.
--
-- No data is touched. The ledger rows written while the function existed are ordinary hold rows,
-- indistinguishable from ones the TypeScript path would have written, so nothing needs unwinding.

drop function if exists v_hold_credits(text, uuid, int, text);
