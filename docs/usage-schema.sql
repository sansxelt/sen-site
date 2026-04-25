-- Per-event usage log. Every AI request appends one row here so we
-- can roll up requests + tokens per user, per kind, per period for
-- the dashboard + plan-limit enforcement later.
--
-- One row per request keeps the schema dumb-simple. If volume gets
-- crazy, we add a daily-rollup table later — for now SUM() across an
-- index is fine.

create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  email text not null references public.user_profiles(email) on delete cascade,
  kind text not null,
  model text,
  surface text,                         -- 'web' | 'desktop' | NULL
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  audio_seconds numeric(10, 2),         -- TTS only
  duration_ms integer,
  created_at timestamptz not null default timezone('utc', now()),
  constraint usage_events_kind_check
    check (kind in ('chat', 'copilot', 'voice_transcribe', 'voice_speak'))
);

create index if not exists usage_events_email_created_idx
  on public.usage_events(email, created_at desc);

create index if not exists usage_events_email_kind_idx
  on public.usage_events(email, kind);

-- Rollup helper for the dashboard. Returns a single row of totals
-- since `since` for one user. Cheaper than fetching every event.
create or replace function public.usage_summary(
  p_email text,
  p_since timestamptz
)
returns table (
  total_requests bigint,
  total_input_tokens bigint,
  total_output_tokens bigint,
  total_tokens bigint,
  chat_requests bigint,
  copilot_requests bigint,
  voice_transcribe_requests bigint,
  voice_speak_requests bigint
)
language sql
stable
as $$
  select
    count(*)                                                  as total_requests,
    coalesce(sum(input_tokens), 0)                            as total_input_tokens,
    coalesce(sum(output_tokens), 0)                           as total_output_tokens,
    coalesce(sum(total_tokens), 0)                            as total_tokens,
    count(*) filter (where kind = 'chat')                     as chat_requests,
    count(*) filter (where kind = 'copilot')                  as copilot_requests,
    count(*) filter (where kind = 'voice_transcribe')         as voice_transcribe_requests,
    count(*) filter (where kind = 'voice_speak')              as voice_speak_requests
  from public.usage_events
  where email = p_email
    and created_at >= p_since;
$$;
