-- v0.2.0 phase H — opt-in continuous AI rename for threads.
--
-- Default behavior (auto_rename = false): AI titles a thread once
-- after the first assistant reply, then never auto-updates again.
-- A user toggling the rail's "let AI keep updating this title"
-- checkbox flips this to true; the chat route then re-runs the
-- title generator after every assistant turn so the title tracks
-- the topic as the conversation evolves.
--
-- Manual renames via PATCH /api/threads/[id] flip this back to
-- false, locking the user's chosen title.

alter table public.chat_threads
  add column if not exists auto_rename boolean not null default false;
