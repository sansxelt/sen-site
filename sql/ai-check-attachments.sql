-- v_check_attachments: files attached to an AI Output Check, in one of two STRICT roles:
--   candidate_output  -> part of a specific version, and judged as that candidate
--   supporting_context -> reference/requirements the output should follow; informs judgment, never scored
--
-- Files are uploaded BEFORE the check runs and BEFORE any credit is charged; the check references
-- them by id. Uploading never charges. Rows with check_id IS NULL are drafts (attached to a client
-- draft_key); they are swept after expires_at if never bound to a check. When a check is deleted,
-- its attachments cascade. Bytes live in a PRIVATE Storage bucket (storage_path is never exposed
-- publicly; the app hands out short-lived signed URLs).

create table if not exists v_check_attachments (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null,                                   -- owner (lowercased email; tenant scope)
  draft_key     text,                                            -- client draft id, so a refresh can re-list uploads
  check_id      uuid references v_checks(id) on delete cascade,  -- set when the check is created; null while drafting
  role          text not null check (role in ('candidate_output', 'supporting_context')),
  version_key   text,                                            -- which version card (client id) for candidate_output
  order_index   int  not null default 0,                         -- order within a version / the context set
  filename      text not null,                                   -- sanitized original name
  mime          text not null,                                   -- server-DETECTED mime (not the client's claim)
  size_bytes    bigint not null,
  storage_path  text not null,                                   -- private bucket path; never returned in public API
  page_count    int,                                             -- pages/slides where known (PDF now; docs in pass 2)
  status        text not null default 'ready'                    -- ready | processing | failed
                 check (status in ('uploading', 'processing', 'ready', 'failed')),
  capabilities  jsonb,                                           -- { text: bool, vision: bool } (filled in pass 2)
  warnings      jsonb,                                           -- extraction/processing warnings (pass 2)
  created_at    timestamptz not null default now(),
  expires_at    timestamptz                                      -- orphan-sweep deadline while check_id is null
);

create index if not exists v_check_attachments_user_idx  on v_check_attachments (user_id, created_at desc);
create index if not exists v_check_attachments_draft_idx on v_check_attachments (user_id, draft_key);
create index if not exists v_check_attachments_check_idx on v_check_attachments (check_id);
-- Orphan sweep: draft uploads never bound to a check, past their expiry.
create index if not exists v_check_attachments_orphan_idx on v_check_attachments (expires_at) where check_id is null;
