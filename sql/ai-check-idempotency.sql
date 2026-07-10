-- Server-side submission idempotency for AI checks (Pass 2A Phase 5). One row per (owner, submission_id);
-- the composite PRIMARY KEY makes reservation atomic -- concurrent identical submissions race on the
-- insert and exactly one wins, so there is exactly one model call, one charge, and one completed check.
-- Stores ONLY owner identity, the client submission id, status, the resulting check id, timestamps, and a
-- redacted error category. No request content, filenames, or attachment data.

create table if not exists v_check_idempotency (
  user_id        text not null,                 -- owner (lowercased email; tenant scope)
  submission_id  text not null,                 -- client-supplied idempotency key
  status         text not null default 'reserved'
                  check (status in ('reserved', 'evaluating', 'persisting', 'completed', 'failed')),
  check_id       uuid,                           -- set once a check row exists
  error_category text,                           -- redacted failure category, when status = 'failed'
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (user_id, submission_id)
);
create index if not exists v_check_idempotency_check_idx on v_check_idempotency (check_id);

-- Defense in depth: same as the attachments table -- the service role (which the app uses) bypasses RLS;
-- enabling RLS with no policies denies the anon/public key entirely. Ownership stays enforced in code.
alter table v_check_idempotency enable row level security;
