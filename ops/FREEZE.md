# Verification traffic freeze

Run this **before** anything else. One verification request reaching old `main` writes a lane row that does
not carry the false triple, the census stops matching, and the correction's stage 0 aborts.

## The lever that does NOT work

`VRAELIS_RUNS_DISABLED=1` is the natural first guess and it is **not sufficient**.

It pauses the run and rerun routes, which return 503 `runs_paused`. But `prepareVerification` writes the
contract and its requirement rows **before** any run is launched. Under old `main`, `POST /v1/verifications`
synthesizes, writes the rows, and only then delegates to the runs route. With runs disabled the launch fails
and the rows are still there.

The same is true of the corrected code, which writes a reviewable draft and never launches at all.

Set it anyway as a second layer, but do not mistake it for the freeze.

## The lever that works

Every requirement-writing entry point is gated, directly or through `gatePreflightApp`, on
`preflightEnabled()` in [lib/v-preflight-flags.ts](../lib/v-preflight-flags.ts):

```ts
export function preflightEnabled(): boolean {
  return on(process.env.VRAELIS_PREFLIGHT_ENABLED) || on(process.env.VRAELIS_PREFLIGHT_INTERNAL_ONLY);
}
```

It is an OR, so **both** variables must be off. Unsetting one changes nothing.

| Entry point | Writes requirement rows | Gate |
|---|---|---|
| `POST /api/v1/verifications` (direct synthesis) | yes, via `prepareVerification` | `preflightEnabled()` |
| `POST /api/v1/verifications` (reviewed-plan execution) | yes, via `prepareVerification` | `preflightEnabled()` |
| `POST /api/preflight/requirements` (dashboard add) | yes | `preflightEnabled()` |
| `POST /api/preflight/apps/[id]/contract/draft` (revision copy) | yes | `gatePreflightApp` -> `preflightEnabled()` |
| `POST /api/preflight/apps/[id]/discover` (merge inserts) | yes | `gatePreflightApp` -> `preflightEnabled()` |
| `POST /api/preflight/apps/[id]/runs` | no | `preflightEnabled()` + `runsDisabled()` |
| `POST /api/preflight/runs/[runId]/rerun` | no (reuses flow identities) | `preflightEnabled()` + `runsDisabled()` |
| `POST /api/preflight/apps/[id]/guarantees` | no | `preflightEnabled()` |
| `POST /api/preflight/apps/[id]/guarantees/[gid]/prepare` | no (mints a reviewed plan) | `preflightEnabled()` |
| `POST /api/preflight/apps/[id]/guarantees/[gid]/approve` | no | `preflightEnabled()` |

The three Guarantee routes exist in the **deployed** commit (`9767feb4`) and not on `main`. None writes
`v_contract_requirements`, and all three are gated on the same flag, so the freeze covers them. They are
listed because an entry point absent from the table is an entry point nobody checked.

`gatePreflightApp` enforces the flag at [team-access.ts:128](../lib/preflight/team-access.ts#L128), so the
draft and discover routes are covered even though neither calls `preflightEnabled()` itself.

## Procedure

In the production environment, in this order:

```
1.  VRAELIS_RUNS_DISABLED=1              # layer 2: no new runs queue
2.  VRAELIS_API_RUNTIME_DISABLED=1       # layer 2: API runtime surface returns a uniform 404
3.  unset VRAELIS_PREFLIGHT_ENABLED      # THE FREEZE
4.  unset VRAELIS_PREFLIGHT_INTERNAL_ONLY # both, or preflightEnabled() stays true
5.  redeploy / restart so the process reads the new environment
```

Steps 3 and 4 are the freeze. Steps 1 and 2 are belt and braces so that a code path added later, which
somehow bypasses the flag, still cannot queue work.

**Setting the variables to an empty string is equivalent to unsetting them.** The reader is
`v === "1" || v === "true"`, so `""` and `undefined` both yield false. That part is not the trap.

**Step 5 is the trap.** On Vercel, an environment variable change does not reach a deployment that is already
running. The running build keeps the values it was built and started with until a new deployment is created
or the existing one is redeployed. Changing the variables in the dashboard and stopping there leaves the
freeze inert while looking done.

## Prove the freeze is actually live

An unauthenticated GET distinguishes the two states, creates nothing, and needs no credentials:

```
curl -s -o /dev/null -w "%{http_code}\n" \
  https://vraelis.com/v1/verifications/vrf_00000000000000000000000000000000
```

```
404   preflightEnabled() is FALSE   the freeze is live
401   preflightEnabled() is TRUE    the freeze is NOT live, redeploy
```

The route checks the flag before it resolves the caller:

```ts
if (!preflightEnabled()) return apiError("not_found", "Not found.", 404, rid);
const p = await resolvePrincipal(req, PREFLIGHT_SCOPES.runRead);   // 401 lives here
```

So a `401` is positive proof that the request got past the flag.

Measured 2026-07-26: **401**, and the cause was simpler than a missed redeploy. The variables had not been
changed anywhere that runs code:

```
.env.local            VRAELIS_PREFLIGHT_ENABLED="1"   VRAELIS_PREFLIGHT_INTERNAL_ONLY="1"   (local dev only)
vercel env ls production
                      VRAELIS_PREFLIGHT_ENABLED        Production, Preview   15d ago
                      VRAELIS_PREFLIGHT_INTERNAL_ONLY  Production, Preview   15d ago
```

Both still present in the Production scope, untouched for fifteen days.

**`.env.local` is not the production environment.** It is gitignored, it is read only by `next dev` on the
machine it sits on, and Vercel never sees it. Editing it freezes local development and nothing else. The
production values live in the Vercel Production scope and are changed there.

## The two steps, both required

**PowerShell, one line each.** This is a Windows shop: `\` line continuations do not work, `<...>` is parsed
as a redirection operator, and `curl` is an alias for `Invoke-WebRequest`, not curl. Use `curl.exe`.

```powershell
# 1. change the value in the PRODUCTION scope. -y skips the confirmation prompt.
npx vercel env rm VRAELIS_PREFLIGHT_ENABLED production -y
npx vercel env rm VRAELIS_PREFLIGHT_INTERNAL_ONLY production -y

# 2. redeploy, because an env change does not reach a deployment that is already running.
#    redeploy rebuilds the SAME source with the current environment, which is what is wanted here.
#    Do NOT use `vercel deploy --prod`: that would deploy the local working tree, which is a different
#    commit from what is in production, turning an env change into an unreviewed code deploy.
npx vercel redeploy sen-site-oko77wllk-sansxelts-projects.vercel.app --target production

# 3. prove it
curl.exe -s -o NUL -w "%{http_code}" "https://vraelis.com/v1/verifications/vrf_00000000000000000000000000000000"
#    404 = frozen.  401 = still open.
```

**The one decision:** that entry is scoped to **Production and Preview together**, and the CLI prompt says so.
Removing it clears both. Preview loses Preflight until it is restored, which is harmless for the design
previews but worth knowing. If Preview must keep it, use the dashboard and set the Production value to empty
per scope instead; empty and absent behave identically to `preflightEnabled()`.

## Lifting the freeze

`env rm` discards the value, so unfreezing re-adds it rather than toggling it back:

```powershell
"1" | npx vercel env add VRAELIS_PREFLIGHT_ENABLED production
"1" | npx vercel env add VRAELIS_PREFLIGHT_INTERNAL_ONLY production
npx vercel redeploy sen-site-oko77wllk-sansxelts-projects.vercel.app --target production
curl.exe -s -o NUL -w "%{http_code}" "https://vraelis.com/v1/verifications/vrf_00000000000000000000000000000000"
#    401 = open again.
```

Both were `"1"` before the freeze. Record that here rather than relying on memory, because the value is gone
once it is removed.

## What the freeze costs

`preflightEnabled() === false` returns 404 from every Preflight route, including **read** routes. Existing
reports become unreachable for as long as the freeze lasts. There is no finer-grained lever today that stops
requirement writes while leaving history readable, because the writes happen inside the same
flag-gated routes as the reads.

That is an acceptable trade for a short window. A maintenance response is better than a new contradictory row.

If a longer freeze is needed, the narrower fix is a new `VRAELIS_CONTRACT_WRITES_DISABLED` kill switch checked
inside `addAuthoredRequirement`, `addGeneratedRequirement`, `applyMergePlan` and the draft-copy route. That is
a code change and therefore a deploy, so it is not the first move in an incident.

## Verify the freeze held

```
npx tsx scripts/provenance-census.ts
```

Must still report, unchanged:

```
total 153   lane 136   non-lane 17   group A 8   group B 128   group C 0
lane rows still carrying the false triple: 136
lane rows written under the NEW defaults:    0
```

`lane rows written under the NEW defaults` is the tripwire. It counts rows whose `origin` is `unspecified`,
or whose `review_state` is `suggested` while `source` is still `manual`. Any value above zero means a write
got through after migration 20 landed, and the population must be reclassified before the correction runs.
Do not force the old census through.

## Lifting the freeze

Only after the correction is committed, the constraints are validated, and the controlled lane tests in
[ROLLOUT.md](ROLLOUT.md) have passed. Restore the two Preflight variables to their previous values, then
clear `VRAELIS_RUNS_DISABLED` and `VRAELIS_API_RUNTIME_DISABLED`.
