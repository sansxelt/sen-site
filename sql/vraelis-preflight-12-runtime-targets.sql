-- Preflight migration 12 — multi-runtime foundation (Multi-Platform Program, Phase A).
-- STRICTLY ADDITIVE. Apply BEFORE deploying any code that reads these; the code degrades to today's
-- single-web-target behavior when these tables/columns are absent (backward-compatibility rule).
--
-- What this enables (per the approved adversarial redline):
--   * An application declares one or more RUNTIME TARGETS (web today; api/android/ios/electron/desktop
--     later). Every existing application becomes exactly ONE web target via the read-only backfill below.
--   * A BUILD SPINE identifies the exact artifact/deployment tested, with per-kind detail (web = url/commit;
--     api = base url/version; binary kinds later). Never replaces the existing v_deployments (web keeps it).
--   * DECISIONS bind to (application, runtime_target, build, environment, contract_version, matrix) — NEVER
--     to the application alone — so a web READY can never imply mobile/api coverage.
--   * ISSUE LINEAGE is scoped by (requirement, runtime_target) so a web bug's lineage never bleeds into a
--     mobile/api issue.
--
-- ROLLBACK = ignore these tables/columns entirely; the existing web path never reads them. Nothing here
-- renames, drops, or rewrites an existing production column or row.

-- ── 1. Runtime targets: one platform surface of a product ─────────────────────────────────────────────
-- kind defaults to 'web' so a backfilled row is a web target. label/environment are owner-facing metadata.
create table if not exists public.v_runtime_targets (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null,                     -- owner (lowercased email), same tenancy key as v_applications
  application_id uuid not null,                     -- references v_applications(id) logically (soft ref; no cascade change to the live table)
  kind           text not null default 'web',       -- web | api | android | ios | electron | windows | macos
  label          text not null default 'Web',
  environment    text,                              -- production | preview | staging | ...
  created_at     timestamptz not null default timezone('utc', now())
);
create index if not exists v_runtime_targets_app_idx on public.v_runtime_targets (user_id, application_id);
create index if not exists v_runtime_targets_kind_idx on public.v_runtime_targets (application_id, kind);
-- At most one target per (application, kind, environment) — prevents duplicate web targets on backfill.
create unique index if not exists v_runtime_targets_unique
  on public.v_runtime_targets (application_id, kind, coalesce(environment, ''));

-- ── 2. Build spine + per-kind detail (never replaces v_deployments; web continues to use it) ─────────
-- The shared spine identifies ANY build with a content hash + version + commit. Per-kind specifics live in
-- a constrained JSON `detail` so a web build can't be saved with an APK hash and vice-versa (checked by kind
-- in the app layer; the column stays flat + auditable). uploaded builds carry artifact_hash.
create table if not exists public.v_builds (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  runtime_target_id uuid not null references public.v_runtime_targets(id) on delete cascade,
  kind              text not null default 'web',     -- mirrors the target's kind
  -- web: base is the deployment URL; api: base is the API base URL; binary: base is null and artifact_hash is set.
  base_url          text,
  version           text,                            -- app version / api version / version name
  commit_sha        text,
  build_ref         text,                            -- provider build id / distribution channel ref
  artifact_hash     text,                            -- sha256 of an UPLOADED build (binary kinds); null for web/api
  detail            jsonb not null default '{}'::jsonb,  -- per-kind extras (bundle id, package name, signing status...), sanitized
  created_at        timestamptz not null default timezone('utc', now())
);
create index if not exists v_builds_target_idx on public.v_builds (runtime_target_id, created_at);

-- ── 3. Per-target decisions (the correct decision grain) ─────────────────────────────────────────────
-- A decision binds to the exact build + environment + contract version + matrix. Product state is DERIVED
-- from these per target — never a single scalar on the application.
create table if not exists public.v_platform_decisions (
  id                uuid primary key default gen_random_uuid(),
  user_id           text not null,
  application_id    uuid not null,
  runtime_target_id uuid not null references public.v_runtime_targets(id) on delete cascade,
  runtime_kind      text not null default 'web',
  build_id          uuid references public.v_builds(id) on delete set null,
  run_id            uuid,                            -- the run that produced it (soft ref to v_preflight_runs)
  environment       text,
  contract_version  integer,
  matrix_hash       text,                            -- hash of the device/browser matrix this decision covers
  adapter_version   text,                            -- pins the capability set for reproducibility
  decision          text not null,                   -- ready|needs_review|blocked|repair_verified|infra_failure|not_verified
  failure_class     text,                            -- infra|product|indeterminate (when applicable)
  summary           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default timezone('utc', now())
);
create index if not exists v_platform_decisions_target_idx on public.v_platform_decisions (runtime_target_id, created_at);
create index if not exists v_platform_decisions_app_idx on public.v_platform_decisions (user_id, application_id, created_at);

-- ── 4. Per-target issue lineage (scope lineage by requirement + runtime target) ──────────────────────
-- Additive column on the existing issues table: which runtime target an issue belongs to. Defaults to the
-- web target so historical web issues keep working; lineage queries scope by (requirement, runtime_target).
alter table public.v_issues add column if not exists runtime_target_id uuid;
create index if not exists v_issues_runtime_target_idx on public.v_issues (runtime_target_id);

-- Additive columns on the existing runs table so a run records which runtime target + adapter produced it.
-- Both default to the web semantics; a null runtime_target_id reads as "the app's web target".
alter table public.v_preflight_runs add column if not exists runtime_target_id uuid;
alter table public.v_preflight_runs add column if not exists adapter_version text;

-- ── 5. Read-only backfill: every existing application becomes ONE web target ─────────────────────────
-- Pure INSERT of a web target per existing application; reads v_applications, writes only the new table.
-- Idempotent via the unique index (on conflict do nothing). Touches no existing column or row.
insert into public.v_runtime_targets (user_id, application_id, kind, label, environment)
select a.user_id, a.id, 'web', 'Web', null
from public.v_applications a
on conflict (application_id, kind, coalesce(environment, '')) do nothing;

-- Optional follow-up (safe, run any time): attach existing web runs/issues to their app's web target so the
-- new per-target views show historical data. Read-only correlation; nulls remain valid ("web target").
update public.v_preflight_runs r
set runtime_target_id = t.id
from public.v_runtime_targets t
where r.runtime_target_id is null and t.kind = 'web' and t.application_id = r.application_id and t.user_id = r.user_id;

update public.v_issues i
set runtime_target_id = t.id
from public.v_runtime_targets t
where i.runtime_target_id is null and t.kind = 'web' and t.application_id = i.application_id and t.user_id = i.user_id;
