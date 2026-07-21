-- Verify migration 17 is applied and the /v1 reservation path is active. Paste into the Supabase SQL editor
-- AFTER applying sql/vraelis-preflight-17-verification-idempotency.sql. A successful deploy does not mean the
-- migration ran; this is how you know it did.

-- 1) The table exists with the expected columns and states.
select column_name, data_type, column_default
from information_schema.columns
where table_name = 'v_verification_idempotency'
order by ordinal_position;
-- Expect: user_id text, idem_key text, fingerprint text, state text (default 'pending'),
--         run_id uuid, created_at timestamptz, updated_at timestamptz.

-- 2) The atomic reservation constraint exists: the PRIMARY KEY on (user_id, idem_key). This is what makes
--    two simultaneous identical requests resolve to one, so its absence means the concurrency guarantee is
--    not real.
select tc.constraint_type, kcu.column_name, kcu.ordinal_position
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
where tc.table_name = 'v_verification_idempotency' and tc.constraint_type = 'PRIMARY KEY'
order by kcu.ordinal_position;
-- Expect two rows: user_id (position 1) and idem_key (position 2).

-- 3) The state check constraint is present (pending | launched | failed).
select con.conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
where rel.relname = 'v_verification_idempotency' and con.contype = 'c';
-- Expect a CHECK containing state in ('pending','launched','failed').

-- 4) AFTER the proof run, confirm the RESERVATION PATH was used rather than the fallback. A row here, with
--    state = 'launched' and a run_id, proves /v1 reserved BEFORE synthesis. An empty table after a run with
--    an idempotency key means the fallback path ran (table missing at request time, or the request carried
--    no key).
select user_id, left(idem_key, 24) as idem_key_prefix, state, run_id, created_at, updated_at
from v_verification_idempotency
order by created_at desc
limit 10;
-- Expect: one row per distinct idempotency key used, state 'launched', run_id set. The identical retry
--         reuses the SAME row (no new row); the changed-claim request is refused before insert of a
--         conflicting row, so it never creates a second launched row for that key.
