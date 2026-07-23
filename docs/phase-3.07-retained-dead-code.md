# Phase 3.07 retained dead code — EXTRACTION COMPLETE

The v-db / v-workspace extraction this file used to defer has been **executed** (three
commits: the v-workspace excision, the v-db excision + `v-intelligence`/`v-analytics`
deletion, and this final lib sweep). The retired human-evaluation cluster is gone:

- `lib/v-db.ts` now contains **only** the current billing/subscription/ledger half
  (`ensureProfile`, `getPlan`, `recordPackPurchase`, `setSubscription`,
  `getSubscription`, `recordInvoiceGrant`, `listRecentLedger`, `VSubscription`).
- `lib/v-workspace.ts` lost the dead `sharedProjectView` cluster (`SharedEval`,
  `projectSharedEvals`, `SharedProjectView`, `sharedProjectView`) and its
  `getReport`/`v-intelligence`/`v-analytics` imports. All teams/orgs/membership/
  invites/roles/transfer machinery is untouched.
- All seven cluster libraries are deleted: `v-stats`, `v-ai`, `v-themes`,
  `v-intelligence`, `v-analytics`, `v-content-policy`, `v-sources`.

Historical DB rows and `sql/*` migrations remain intentionally preserved — this was a
**code** retirement, not a data deletion. `npm run human-eval-retired:test` remains the
standing unreachability gate.

## Corrections found by the pre-extraction verification (why the old map was not followed verbatim)

1. **`recordPackPurchase` is LIVE** and was missing from the old map's current-half
   list — the Stripe webhook loads it via *dynamic* import
   (`app/api/stripe/webhook/route.ts`), so deleting it would have passed type-check and
   failed only at runtime. It is kept.
2. **The old map's v-workspace "retired half" was wrong on 2 of 3 entries**:
   `resolveWorkspaceSelection` (team page, billing page, `GET /api/v/workspace/available`)
   and `workspaceProjectSummaries` (team page non-owner branch) are LIVE and kept.
   Only `sharedProjectView` was dead.
3. The v-db retired half was **~26 exports, not 6** — the extra twenty
   (`createTest`…`dataInsights`, `OPTION_LETTERS`, the `VTest`/`VOption`/`VReport`
   types) were only internally consistent removed as one unit.

## Known remaining oddities (documented, deliberately NOT removed in this pass)

- `lib/v-workspace.ts` still carries zero-caller orphans kept to stay surgical:
  `reportAccessRole`, the project-member management set (`listProjectMembers`,
  `inviteProjectMember`, `resendProjectInvite`, `changeProjectMemberRole`,
  `revokeProjectMember`, `managedProjectMeta` and related role helpers/constants).
  Candidates for a later sweep, none imports retired code.
- `workspaceProjectSummaries` is a Rank-data remnant on a **live** surface: it reads
  `v_tests.votes_valid` and renders eval rollups on `/rank/app/team`. Retiring it means
  editing the live team page — a separate reviewed change (Phase 4+ UI work).
- Pre-existing dead links: the live team UI and accepted project invites still point at
  `/shared/projects/{id}`, deleted in 3.07 (404s today). A team-page fix belongs to the
  UI reframe, not this extraction.
- `lib/v-db.ts`'s header still says "Vraelis Rank" — terminology sweep is Phase 4.
