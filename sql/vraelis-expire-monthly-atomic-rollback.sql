-- ROLLBACK for sql/vraelis-expire-monthly-atomic.sql
--
-- Dropping the function returns expireMonthly() to its TypeScript path, which is read-then-write and races.
-- lib/v-credits.ts falls back automatically when the RPC is missing, so the application keeps working and
-- simply loses the atomicity guarantee.
--
-- No data is touched: rows written while the function existed are ordinary monthly_reset rows,
-- indistinguishable from ones the TypeScript path would have written.
--
-- The two `add column if not exists` statements are deliberately NOT reversed — other code depends on both
-- columns, and dropping them would be destructive.

drop function if exists v_expire_monthly(text, text, text, text);
