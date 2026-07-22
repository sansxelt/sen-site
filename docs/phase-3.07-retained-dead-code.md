# Phase 3.07 — retained dead code (deferred to the v-db / v-workspace extraction pass)

Phase 3.07 **fully retired the human-evaluation ("Vraelis Rank") product**: every public
route, authenticated route, API, webhook behavior, feature flag, navigation entry, and
background job that reached human evaluation is gone (proven by `npm run human-eval-retired:test`).

It **did not** delete every historical line of evaluation code. Removing the last cluster
requires surgery on two *shared, current-product* modules (`lib/v-db.ts`, `lib/v-workspace.ts`),
which was **deliberately deferred** — see [the follow-up pass](#follow-up-pass) below. This file
documents exactly what remains, why, and the proof that it is unreachable at runtime.

Historical DB rows and `sql/*` migrations are intentionally preserved — this was a **code**
retirement, not a data deletion.

## Retained libraries (7) — dead, kept only because the two shared modules' retired halves import them

| Library | Kept because it is imported by | It imports |
|---|---|---|
| `lib/v-stats.ts` | `v-intelligence` | (leaf math) |
| `lib/v-ai.ts` | `v-db` (retired half — `ReportAnalysis` type) | — |
| `lib/v-themes.ts` | `v-db` (retired half — `ReportTheme` type) | `v-content-policy` |
| `lib/v-intelligence.ts` | `v-analytics`, `v-workspace` (retired half) | `v-stats` |
| `lib/v-analytics.ts` | `v-workspace` (retired half) | `v-sources`, `v-intelligence` |
| `lib/v-content-policy.ts` | `v-themes` | — |
| `lib/v-sources.ts` | `v-analytics` | — |

These seven form a **closed cluster**: they reference only each other and the two retained
modules' retired halves. No file under `app/api/preflight/**`, `app/api/v1/verifications/**`,
`lib/preflight/**`, or `worker/preflight/**` imports any of them.

## Retained functions inside the two shared modules

`lib/v-db.ts` and `lib/v-workspace.ts` are **kept** — their *current* halves are load-bearing for
the live product — but each carries a dead "retired half" that will be excised in the follow-up.

### `lib/v-db.ts` — retired half (dead)
`getTestWithOptions` (L106), `recordJudgment` (L195), `completeTest` (L231), `launchTest` (L339),
`recordVote` (L392), `getReport` (L437). These are the Rank test / vote / report path; they import
`v-ai` and `v-themes`. In Phase 3.07 the reputation-weighting was stripped from `completeTest` and
its `test.completed` webhook trigger removed (Sections A + B), leaving them inert.

**Current half — KEPT and depended on (do NOT touch in the follow-up):** `getPlan`,
`setSubscription`, `getSubscription`, `recordInvoiceGrant`, `listRecentLedger`, `ensureProfile`
(billing / subscription / ledger — used by `app/api/preflight/apps`, `app/api/v/usage`,
`lib/preflight/entitlements-v1`, `lib/v-subscriptions`, `lib/v-api-usage`).

### `lib/v-workspace.ts` — retired half (dead)
`resolveWorkspaceSelection` (L415), `workspaceProjectSummaries` (L438), `sharedProjectView` (L633).
The eval-project sharing path; the only current→`v-intelligence`/`v-analytics` edges. Their callers
(the `page.tsx` humanEval block + the retired `projects`/`data`/`shared` routes) were removed in 3.07.

**Current half — KEPT and depended on:** `hasAtLeastRole`, `membershipFor`,
`getOrCreatePersonalWorkspace` and the teams/roles machinery (used across preflight + `v1/verifications`).

## Proof it is runtime-unreachable

1. The cluster's only entry points from outside were the retired **routes / APIs / flag** (vote,
   test, check, screening, project, sandbox, data surfaces + the `humanEval` gate). **All deleted
   in Section C.**
2. Every caller chain into the dead `v-db`/`v-workspace` functions is severed: `completeTest` ←
   `recordVote` ← the vote routes (gone); `getReport`/`getTestWithOptions` ← report/tests routes
   (gone); the workspace-eval functions ← the `page.tsx` humanEval block (removed).
3. `scripts/preflight-human-eval-retired-verify.ts` **point 7** asserts, on every commit, that the
   current verification stack (`app/api/preflight`, `app/api/v1/verifications`, `lib/preflight`,
   `worker/preflight`) imports **none** of the seven dead libs and calls **none** of the dead
   report/vote functions. It is wired as `npm run human-eval-retired:test`.

## Follow-up pass

**Name:** "v-db / v-workspace extraction — delete the retained evaluation cluster."
**Precondition:** its own green baseline + a dedicated review (this touches the 46KB shared `v-db`
billing module and the shared `v-workspace` teams module — the highest-risk edit in the cleanup).
**Steps:**
1. Split `lib/v-db.ts`: remove the retired half (the six functions above + the `v-ai`/`v-themes`
   imports), keeping the billing/subscription/ledger half exactly.
2. Excise `lib/v-workspace.ts`'s three retired functions + the `v-intelligence`/`v-analytics` imports.
3. The seven libs (`v-stats`, `v-ai`, `v-themes`, `v-intelligence`, `v-analytics`, `v-content-policy`,
   `v-sources`) then reach zero importers — delete them (empirical loop, same as 3.07 Section C).
4. Re-run the full kept suite + `human-eval-retired:test` + a production build + a fresh-checkout proof.

This is naturally adjacent to Phase 3.08 ("remove remaining dead API namespaces") but is a distinct,
separately-reviewed unit — **not** part of 3.07.
