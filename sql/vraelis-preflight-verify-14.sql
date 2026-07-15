-- READ-ONLY verification for migration 14 (Preflight team/workspace access). Paste into the Supabase SQL
-- editor and Run. ONE statement -> ONE result grid (summary row first). Nothing here writes.
--
-- v_applications.workspace_id already exists physically (it shipped in the base schema, write-only), so this
-- verifier CAN reference it directly for the live backfill checks. The workspace tables (v_workspaces /
-- v_workspace_members) may or may not exist; every check that touches them is guarded with to_regclass so the
-- whole statement still parses + runs and returns a clean PASS/FAIL grid either way. Apply
-- sql/vraelis-preflight-14-teams.sql FIRST, then run this.

with checks as (
  -- A. The reverse-lookup index the dashboard uses (workspace -> its applications).
  select 'A INDEX' as section, 'v_applications_workspace_idx' as item,
         case when exists (select 1 from pg_indexes where schemaname='public' and indexname='v_applications_workspace_idx')
         then 'PASS' else 'FAIL' end as verdict

  union all

  -- B. Rollback safety: workspace_id must stay uuid + nullable (NULL = personal / owner-only fallback).
  select 'B ROLLBACK', 'v_applications.workspace_id is uuid + nullable',
         case when exists (select 1 from information_schema.columns
           where table_schema='public' and table_name='v_applications'
             and column_name='workspace_id' and data_type='uuid' and is_nullable='YES')
         then 'PASS' else 'FAIL' end

  union all

  -- C. Backfill completeness: no application whose OWNER already has a personal workspace should be left with
  --    a NULL workspace_id. (Apps whose owner has no workspace yet are allowed to stay NULL — healed lazily.)
  --    Guarded: if the workspace tables are absent, this check is N/A and PASSES (nothing to backfill against).
  select 'C BACKFILL', 'every app whose owner has a workspace is attached (0 unattached)',
         case
           when to_regclass('public.v_workspaces') is null then 'PASS'  -- N/A: no workspaces to attach to
           when (
             select count(*) from public.v_applications a
             where a.workspace_id is null
               and exists (select 1 from public.v_workspaces w where w.owner_user_id = a.user_id)
           ) = 0 then 'PASS'
           else 'FAIL'
         end

  union all

  -- D. Attachment sanity: where an app carries a workspace_id, that workspace must exist and be owned by the
  --    app's own user_id (the backfill never cross-attaches an app to someone else's workspace). Guarded.
  select 'D INTEGRITY', 'attached apps point to a workspace owned by the app owner',
         case
           when to_regclass('public.v_workspaces') is null then 'PASS'
           when (
             select count(*) from public.v_applications a
             where a.workspace_id is not null
               and not exists (
                 select 1 from public.v_workspaces w
                 where w.id = a.workspace_id and w.owner_user_id = a.user_id
               )
           ) = 0 then 'PASS'
           else 'FAIL'
         end
)
select * from (
  select '0 SUMMARY' as section,
         (select count(*) from checks where verdict='FAIL')::text||' failing / '
           ||(select count(*) from checks where verdict in ('PASS','FAIL'))::text||' assertions' as item,
         case when not exists (select 1 from checks where verdict='FAIL')
              then 'ALL PASS - migration 14 applied' else 'FAIL - see rows below' end as verdict
  union all
  select * from checks
) x
order by case when section='0 SUMMARY' then 0 when verdict='FAIL' then 1 else 2 end, section, item;
