# Requirement provenance rollout

**This is a production code/schema skew incident, not a routine rollout.** Migration 20 is live while
production still runs the old requirement writer. Freeze traffic, deploy the corrected writer, then correct
history. In that order.

**Production state, measured read-only:**

| Fact | Value |
|---|---|
| Migration 19 | APPLIED |
| Migration 20 | **APPLIED**, verified 2026-07-26: both defaults corrected, 7 constraints present |
| Migration 22 | **APPLIED**, verified 2026-07-26: chk_v_req_approved_matches_review_state present |
| Code deployed | **`a1689c00`** (`hotfix/provenance-prod`), the CORRECTED writer, deployed 2026-07-26 |
| Correction | **COMMITTED 2026-07-26.** 136 corrected, 8 group A attributed, 128 legacy-classified |
| Traffic | **RESTORED**: /v1 returns 401, public site 200 |
| Census | 153 / 136 / 17 / 8 / 128 / 0, exact match, 0 rows under the new defaults |

## Order of operations

| # | Step | Detail |
|---|---|---|
| 1 | Freeze verification traffic | **DONE 2026-07-26.** Both vars removed from Production and Preview, redeployed, probe returns 404 |
| 2 | Capture the checkpoint | backup, deployed SHA, constraint state, census |
| 3 | Deploy the corrected runtime | **DONE.** `a1689c00` built for production and live |
| 4 | Verify the deploy, write nothing | **DONE.** /v1 404, / 200, census unchanged, 0 refused writes |
| 5 | Apply migration 22 | **DONE.** Verified with `ops/verify-schema.sql`: 11 rows, 8 chk_v_req_*, all not valid |
| 6 | Run the correction by hand | **DONE** via `ops/CORRECTION-ONE-PASTE.sql` |
| 7 | Validate constraints, then COMMIT | **DONE.** 7 validated; 2 blocked by out-of-scope rows, documented |
| 8 | Postflight census | **DONE.** 0 text/category/severity/enabled changes vs the backup |
| 9 | Controlled live lane tests | three lanes, traffic still frozen |
| 10 | Re-enable traffic | **DONE.** /v1 401. NOTE: `echo` piped a trailing newline into the flag value, storing `"1
"`, which reads as false. Use `printf '1'`. |

**Do not run a live verification before step 6 commits.** It would change the exact stage 0 population.

## Which commit to deploy

**Production is not running `main`.** It is running `9767feb4` from `feature/design-05-public-v5-hero`,
promoted to production on 2026-07-24. `main` (`28a5db8f`) is an ancestor of it, and it carries ten further
commits including "Guarantees increment 1" and "increment 2", so production already has product surfaces
`main` does not. Any hotfix must be based on what is deployed, not on `main`.

```
Deployment  dpl_8hkpZ6Xs1ipaPyqFkYSHWDhgg2LZ   target production   promoted 2026-07-24T01:48Z
Commit      9767feb45f13f78a0a9f579dafaa2f2f6afd48c1   ref feature/design-05-public-v5-hero
```

That commit carries the OLD writer verbatim: `source: "manual", approved: true`, no `origin`, no
`review_state`, `order_index: 9999`, and an `approveContract` with no review guard. So the skew analysis is
unchanged; only the base commit was wrong.

Its requirement write surface is also unchanged: the same four sites, and none of the three Guarantee routes
writes `v_contract_requirements`. All three are gated on `preflightEnabled()`, so the freeze covers them.

**Option A, `hotfix/provenance-prod` @ `15b521c6` (recommended).** The five provenance commits cherry-picked
onto the deployed commit. **13 runtime files, +678/-136.** Every runtime file applied cleanly; the only
conflicts were test files. `npx tsc --noEmit` is clean once three Phase-0 test files stay at the deployed
versions (they assert `execution_passed`, a decision value that tree does not have).

```
app/api/preflight/apps/[id]/contract/draft/route.ts   lib/preflight/reviewed-plan-db.ts
app/api/preflight/requirements/route.ts               lib/preflight/reviewed-plan.ts
app/api/v1/verifications/[id]/route.ts                lib/preflight/requirements-for-run.ts  (new)
app/api/v1/verifications/route.ts                     lib/preflight/runtime/targets-db.ts
app/rank/app/systems/[id]/contract/labels.ts     lib/preflight/verification-lane.ts
lib/preflight/contract-merge.ts                       lib/v-applications.ts
lib/preflight/discovery-db.ts
```

**Option B, `65d751db`.** Contains `a060b9ad`, and the diff between them touches no runtime file. But it is
the whole feature branch relative to `main`, and it does **not** contain the Guarantees increments that are
live in production today, so deploying it would REMOVE shipped surfaces. Verify that before choosing it.

```
git merge-base --is-ancestor a060b9ad 65d751db     # exit 0
git diff --name-status a060b9ad..65d751db          # ops/, scripts/, package.json only
git merge-base --is-ancestor 9767feb4 65d751db     # check: does the branch contain production?
```

Option A does not carry Phase 0 containment (`41aabd57`, `ec7487ef`, `d0c81f89`), so production keeps its
current decision vocabulary. That is a separate decision, deliberately not bundled into an incident fix.

Either way, production must not be able to redeploy the old writer afterwards. Land the hotfix on the branch
production deploys from, or pin production to the promoted deployment and disable automatic deploys.

## The ordering hazard, stated plainly

Migration 20 changes `origin` default to `unspecified` and `review_state` default to `suggested`, and adds six
`NOT VALID` constraints. It is safe only once every writer supplies those columns explicitly, which is true in
commit `a060b9ad` and false in `main`.

`main` is what production runs today. With migration 20 applied and `main` deployed:

- Inserts still SUCCEED. `main`'s insert sets `approved: true` and omits `origin`/`review_state`, so rows land
  `origin=unspecified`, `review_state=suggested`, `approved=true`. Every constraint passes: the row is not
  `approved` in `review_state`, so `chk_v_req_approved_has_basis` does not apply, and its reviewer columns are
  all null, so `chk_v_req_unapproved_clean` is satisfied.
- Approvals still SUCCEED. `main`'s `approveContract` predates the review guard and only counts enabled rows.
- **So the lane is not broken.** It was worth checking before assuming otherwise.

But two things are now true that were not intended:

1. A contract can be approved while its own rows say `suggested`. Harmless to read, incoherent as a record.
2. **Any verification that runs before the correction breaks the census.** A new lane row is a lane row that
   does not carry the false triple, so `lane_rows` grows past 136 while `false_triple` stays 136, and stage 0
   aborts. That is the fail-safe working, but it means the correction window is open now and closes the moment
   someone runs a verification.

At the time of measurement, `lane rows written under the NEW defaults: 0`. Nothing has run yet.

**Recommendation: deploy `a060b9ad` before any further verification traffic, then run the correction.**

---

## Stage 1. Deploy the code

**Deploy:** merge `feature/verification-contract-v1` at `a060b9ad`, or deploy that commit directly.

Migration 19 is already applied, which is the correct order: 19 is additive and inert, and the code needs
its columns.

**Verify after deploy:**

```
npx tsx scripts/provenance-census.ts          # expect: migration 19 APPLIED, census MATCH
```

Then exercise one of each lane against production or a preview, per Stage 4 below.

**Rollback:** redeploy `28a5db8f`. No schema change to undo. The new columns are additive and the old code
neither reads nor writes them.

---

## Stage 2. Confirm migration 20 actually landed

It was reported applied but cannot be verified over PostgREST, because column defaults live in `pg_attrdef`
and constraints in `pg_constraint`, neither of which is exposed. Run this in the SQL editor. **Read-only.**

```sql
select column_name, column_default
  from information_schema.columns
 where table_name = 'v_contract_requirements'
   and column_name in ('origin','review_state');
-- expect  origin -> 'unspecified'::text   review_state -> 'suggested'::text

select conname, convalidated
  from pg_constraint
 where conrelid = 'v_contract_requirements'::regclass
   and conname like 'chk_v_req_%'
 order by conname;
-- expect 7 rows, all convalidated = false:
--   chk_v_req_approved_has_basis, chk_v_req_basis_complete, chk_v_req_legacy_class_value,
--   chk_v_req_origin, chk_v_req_review_basis_value, chk_v_req_review_state, chk_v_req_unapproved_clean

select conname, convalidated
  from pg_constraint
 where conrelid = 'v_production_contracts'::regclass
   and conname = 'chk_v_contract_legacy_class_value';
-- expect 1 row
```

If any of it is missing, apply `sql/vraelis-preflight-20-provenance-defaults.sql` **after** Stage 1, not
before.

**Rollback for migration 20:**

```sql
alter table v_contract_requirements alter column origin       set default 'user';
alter table v_contract_requirements alter column review_state set default 'approved';
alter table v_contract_requirements drop constraint if exists chk_v_req_origin;
alter table v_contract_requirements drop constraint if exists chk_v_req_review_state;
alter table v_contract_requirements drop constraint if exists chk_v_req_review_basis_value;
alter table v_contract_requirements drop constraint if exists chk_v_req_legacy_class_value;
alter table v_contract_requirements drop constraint if exists chk_v_req_basis_complete;
alter table v_contract_requirements drop constraint if exists chk_v_req_unapproved_clean;
alter table v_contract_requirements drop constraint if exists chk_v_req_approved_has_basis;
alter table v_production_contracts  drop constraint if exists chk_v_contract_legacy_class_value;
```

Restoring the old defaults restores the defect, so this is a break-glass step, not a routine one.

---

## Stage 3. Preflight the correction

```
npx tsx scripts/provenance-census.ts
```

Read-only. Must report **MATCH** on all six numbers:

```
total 153   lane 136   non-lane 17   group A 8   group B 128   group C 0
```

**If it reports DRIFT, stop.** The correction's own stage 0 will abort anyway, but knowing why beforehand is
cheaper than reading an aborted transaction.

Expect also:

```
lane rows still carrying the false triple: 136
lane rows already corrected:                0
contracts with a tied order_index:         21
DRAFT rows proposed for normalization:      5
APPROVED rows left alone:                 147
```

Note the ordering split: **5 draft rows** are renumbered and **147 approved rows are left alone**. Approved
order is never invented.

---

## Stage 4. Prove the three lanes before correcting anything

The correction rewrites history. Do it only once the code writing NEW history is proven correct.

**Direct synthesis lane** — `POST /v1/verifications` with a claim and no `reviewed_plan_id`:

- response `state: "review_required"`, `human_reviewed: false`, carries `reviewed_plan_id`
- no `verification_id`, no run dispatched
- no credit hold taken, nothing charged
- contract row is `status = draft`
- its requirement rows are `source=inference`, `origin=prompt`, `review_state=suggested`
- `approved_by`, `approved_at`, `review_basis` all null

**Approved reviewed-plan lane** — approve the minted plan, resubmit with `reviewed_plan_id`:

- the stored plan is loaded and executed with no resynthesis
- requirement rows stay `source=inference`, `origin=prompt`
- `review_state=approved`, `review_basis=reviewed_plan`
- `approved_by` and `approved_at` equal the real approval on `v_reviewed_plans`
- `order_index` is 1..n in the plan's own order
- contract reaches `status = approved`
- `GET /v1/verifications/{id}` returns `human_reviewed: true`

**Human dashboard lane** — add a requirement in the UI, then approve it:

- on creation: `source=manual`, `origin=user`, `review_state=suggested`, no reviewer
- creation alone does not approve
- after the explicit approve: `review_state=approved`, `review_basis=human_direct`, `approved_by` is the
  person who clicked, `approved_at` set

**Rollback:** none needed; these are reads plus one dashboard row you can delete.

---

## Stage 5. Run the correction, by hand

**File:** `ops/provenance-correction-MANUAL.sql`. Not a migration. Not numbered. Not in `sql/`.

Run it stage by stage in the SQL editor, reading the output between each:

| Stage | Does | Expect |
|---|---|---|
| 0 | census + ordering split | 153 / 136 / 17 / 8 / 128, and the two ordering lists |
| 1 | snapshot to two backup tables | rows captured |
| 2 | group A: authorship AND review together | 8 |
| 3 | group B: authorship AND review together | 128 |
| 4 | contract legacy classification | group B's approved contracts |
| 5 | ordering, DRAFT contracts only | 5 |
| 6 | postflight, six counts | every one `0` |

Stages 2 and 3 each correct authorship and review in a **single statement per group**. They cannot be split:
the constraints are `NOT VALID`, so they bind every UPDATE, and an authorship-only UPDATE would re-check
`chk_v_req_approved_has_basis` on rows whose review columns had not been fixed yet, aborting the whole
transaction. This was found by rehearsal.

The script opens a transaction and **does not commit**. Read the six postflight counts, then type `commit;`
or `rollback;` deliberately.

**Rollback before commit:** `rollback;`

**Rollback after commit:** `ops/provenance-correction-ROLLBACK.sql`. It restores every column from the stage 1
snapshots, refuses to run against an empty snapshot, and drops and re-adds `chk_v_req_approved_has_basis`
around the restore, because the state being restored is exactly what that constraint forbids.

---

## Stage 6. Postflight

```
npx tsx scripts/provenance-census.ts
```

After a committed correction, expect:

```
lane rows still carrying the false triple:   0
lane rows already corrected to inference/prompt: 136
lane contracts classified legacy_auto_approved:  the group B contracts
DRAFT rows proposed for normalization:       0
APPROVED rows left alone:                  147
```

The census will report **DRIFT** against the pre-correction expectations, and that is correct: the population
has been corrected. The six in-transaction postflight counts are the authoritative proof.

Then the code battery:

```
npm run integrity:test              # 73 suites
npm run preflight:containment:test  # 73/73
npx tsc --noEmit
npm run build
npx eslint .                        # compare to the 234/167/67 baseline
```

---

## What is never touched, at any stage

- `v_preflight_runs.decision` — historical decisions stand
- `v_production_contracts.status` — an approval that happened still reads as having happened
- `v_contract_requirements.requirement` — no requirement text is edited
- `v_reviewed_plans` — no plan, hash, or approval is altered
- the 17 non-lane rows — explicitly out of scope
- approved contract ordering — never reconstructed from `created_at` and a UUID

The integrity suite asserts each of these against the correction file.

---

## Appendix. What the rehearsal proved, and what it did not

`npm run provenance:rehearse` runs the entire procedure against a real, throwaway PostgreSQL 18.4 that the
repo starts itself. No Docker, no sudo, no staging project. **40 assertions, 0 failures.** Transcript in
`ops/rehearsal/TRANSCRIPT.txt`.

It found two genuine defects that reading the SQL had not:

1. **The correction would have aborted its own transaction.** Migration 20's constraints are `NOT VALID`,
   which grandfathers existing rows but binds every UPDATE. The original stage 2 corrected authorship for all
   136 rows while their review columns were still `approved` with a null basis, which
   `chk_v_req_approved_has_basis` rejects. Fixed by correcting each group in a single statement, so no row is
   ever mid-flight in an invalid state.
2. **Stage 0 would have failed on the group A join.** `v_preflight_runs.id` is `uuid` and
   `v_reviewed_plans.run_id` is `text`. Postgres has no implicit `text = uuid` operator, so the join raised
   42883 before printing a single count. Fixed with an explicit `::text` cast.

Both would have been discovered by an operator staring at an aborted transaction on production.

### Covered by the rehearsal

- migration 19 is genuinely inert: byte-identical rows before and after
- migration 20 sets both defaults and adds all seven constraints, every one `NOT VALID`, rewriting no row
- every defect shape is **rejected** by the database: approved with no basis, a basis with no reviewer, a
  suggested row carrying approval provenance, an unknown origin, `review_state = 'auto_approved'`, an unknown
  legacy class
- every legitimate lane shape is **accepted**: `inference/prompt/suggested` (direct),
  `manual/user/suggested` (dashboard), a complete `human_direct` approval, a complete `reviewed_plan` approval
- the correction produces 136 authorship corrections, 8 reviewed-plan approvals, 128 legacy rows
- postflight: 17 excluded rows untouched, zero run-decision changes, zero contract-status changes, zero
  requirement-text changes, zero reviewed-plan changes, 0 draft ties left, all 147 approved ties preserved
- the rollback restores all 136 rows and re-adds the constraint it had to drop

### NOT covered, and why

The rehearsal proves the **database** half. It does not run the Next.js routes, because the application talks
to PostgREST rather than to Postgres directly, and standing that up needs Docker (unavailable here) or a
staging Supabase project.

The lane behaviour is therefore proven in two halves that meet in the middle:

- **what the code writes** is asserted by `npm run provenance:integrity:test` (86 assertions), which walks the
  TypeScript AST and runs the pure decision functions
- **what the database accepts** is asserted by this rehearsal

Chained, they say: the code writes shape X, and shape X is exactly what the constraints permit while every
defect shape is refused. That is strong, and it is still not a live request.

**Stage 4 above remains a manual gate.** Run one verification through each of the three lanes against a
preview deployment after Stage 1, and confirm the row shapes listed there before running the correction.
