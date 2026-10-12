# v8 production runbook (vraelis.com and docs.vraelis.com)

Prepared 2026-10-11 and executed the same day: v8 is live on vraelis.com and docs.vraelis.com (see PROMOTED below).
The sections that follow describe the state just before the promotion and are kept as the record.

## What exists today (production `5dc06187`)

Production is deployment `sen-site-lt64iii0o-sansxel.vercel.app` (`dpl_FXR1udx3R9L8e5xE5NU9Rmd8YagT`), commit
`5dc06187` on `main`, live since 2026-10-11 21:45 UTC. It carries, on top of the v6 site:

- b68c5540, the contact fix (API routes are never closed pages, so the contact form and data-rights requests arrive);
- 52b80277, the first cleanup (legacy PayPal subscription start closed, the daily lifecycle cron removed, `/install`
  and `/install.ps1` answer 410);
- c7afa436 and bd3759e0, the redesigned emails (the contact confirmation carries no sender-written text);
- cccc73ff, the second cleanup: `/api/waitlist` and `/api/paypal/setup-plans` answer 503, `/invite/<token>`
  redirects to /beta, `/cli/vraelis.mjs` answers 410 (no-store, noindex). Account recovery, data-rights requests,
  payment webhooks and balances untouched;
- e5752a6e (merged as 04d51d05), the email footer: white with black ink by default, the site's black where the mail
  client honours dark mode, a sign-off and a fuller footer. Colours are not guaranteed to match across mail clients;
- c0a97ad4 and 5dc06187, tests: the retired CLI download and installers are expected to answer 410, and the
  app-closure check covers invite links and the retired waitlist and plan setup.

Verified live 2026-10-11 after the deploy: `/cli/vraelis.mjs`, `/install`, `/install.ps1` 410; `/invite/x` 307 to
/beta; `/api/waitlist`, `/api/paypal/setup-plans`, `/api/paypal/create-subscription` 503; reset-password, data
requests, account deletion, the three payment webhooks, the credit balance and the contact form reach their handlers
exactly as before; www 308, app.vraelis.com 307 to /beta, data.vraelis.com 200, docs.vraelis.com 404. One labelled
test inquiry ("[TEST] Email footer and cleanup-2 5dc06187") delivered both emails (Resend: delivered).

Also done on 2026-10-11, outside the code: www.vraelis.com moved to `sen-site` as a 308 redirect to vraelis.com, and
the unused Grok webhook endpoint was removed from Stripe.

| Host | Served by | What it shows today |
| --- | --- | --- |
| vraelis.com | Vercel project `sen-site`, branch `main`, through Cloudflare (proxied) | The v6 site (`NEXT_PUBLIC_VRAELIS_V6_PUBLIC=1`) at `5dc06187` |
| www.vraelis.com | `sen-site` (domain redirect) | 308 to vraelis.com, path and query kept |
| docs.vraelis.com | Cloudflare record already points at Vercel, but no Vercel project claims the domain | `DEPLOYMENT_NOT_FOUND` (404) |
| app.vraelis.com | `sen-site` | Redirects to vraelis.com/beta (product access closed) |
| data.vraelis.com | Vercel project `vraelis` (older), unchanged on purpose | Sign-in page from the same `main` build, with no environment variables (see below) |
| chat.vraelis.ai, platform.vraelis.ai | `sen-site` (aliases of the production deployment) | Same deployment as vraelis.com |
| vraelis.ai, www.vraelis.ai, platform.vraelis.com, chat.vraelis.com | Vercel project `sen-site-main` (older) | Earlier products |
| Review copy | Vercel project `vraelis-v8-review` | https://vraelis-v8-review.vercel.app and https://vraelis-v8-review-docs.vercel.app, built from `site-v8` with production's flags, noindex, robots disallow |

Production environment on `sen-site` today: `NEXT_PUBLIC_VRAELIS_V6_PUBLIC=1`, `NEXT_PUBLIC_VRAELIS_PREFLIGHT=1`,
`VRAELIS_BASE_URL=https://vraelis.com`, no `STEALTH_MODE`.

### Staged, not deployed

| Branch | What it does | Preview |
| --- | --- | --- |
| `site-v8` (this branch) | The v8 site and docs, inert until the flag is set | the review project |

`site-v8` merges cleanly into `main` at `5dc06187` (checked 2026-10-11 with `git merge-tree`); the merged tree keeps
the cleanup-2 closures and the email footer.

## Rollback targets (two separate cases)

- **Rolling back the cleanup-2 and email-footer deploy** (if something it closed turns out to be needed, or the
  footer misbehaves): instant rollback to `sen-site-relfvvghm-sansxel.vercel.app` (bd3759e0). That reopens the four
  cleanup-2 paths and brings back the previous email layout; everything else is identical. For one of the two only,
  revert its commit on `main` instead (cccc73ff for the cleanup, the merge 04d51d05 with `-m 1` for the footer).
- **Rolling back a future v8 promotion:** the target is now `sen-site-lt64iii0o-sansxel.vercel.app` (5dc06187), the v6
  production with both cleanups and the email footer. It replaces relfvvghm for this purpose: rolling back to
  relfvvghm would also reopen the cleanup-2 paths and bring back the earlier email layout. If anything else ships to
  `main` before v8 is promoted, the production deployment just before the promotion becomes the target; record it here.

## data.vraelis.com and the older `vraelis` project (read-only check, 2026-10-11, nothing changed)

- The project is linked to GitHub `sansxelt/sen-site`, production branch `main`, with Git deployments enabled
  (`gitProviderOptions.createDeployments: enabled`), no ignored build step, no deploy hooks, and custom domains
  assigned automatically. So every push to ANY branch builds a preview there as well as on `sen-site` (the
  `ops/retired-cleanup-2` push built `vraelis-n422oww58`), and every push to `main` replaces its production deployment
  (`vraelis-1wp3rbsnr` at bd3759e0; the 5dc06187 push replaced it with `vraelis-3f5phqse8` automatically, as
  predicted, with no setting or domain changed, so data.vraelis.com now also answers 410 at `/cli/vraelis.mjs`).
- It has no environment variables at all (production, preview or development). That is why data.vraelis.com shows a
  sign-in page that cannot sign anyone in: no database, no auth secret, `APP_ACCESS_OPEN` false.
- Its three crons (`/api/cron/reverify-domains`, `/api/cron/webhook-retries`, `/api/vraelis/cron/subscriptions`)
  are enabled and fire daily against its production deployment. Each route requires `CRON_SECRET` and fails closed
  when it is unset (`lib/cron-auth.ts`), so with no environment they answer 401 and do nothing. This is safe only while
  the project stays empty: copying `sen-site`'s environment into it would make the subscription job run twice a day.
- Removing data.vraelis.com from the project would NOT stop any of this. The settings that would, when the founder
  decides: Settings > Git > disconnect the repository, or Settings > Git > Ignored Build Step `exit 0`, or
  `gitProviderOptions.createDeployments: disabled` via the API; and Settings > Cron Jobs > disable. Not done: the
  instruction is to keep data.vraelis.com unchanged for now.

## Target

- vraelis.com serves v8 at clean paths. Previous addresses redirect (308) to their v8 successors; unknown paths get the
  v8 404. app.vraelis.com and console paths stay closed.
- docs.vraelis.com serves the docs at its root. vraelis.com/docs/* redirects (308) there, path for path.
- llms.txt, llms-full.txt and sitemap.xml come from the v8 registries; robots allows crawling (not a review build).

## Deployment record (kept current)

| | Deployment | Commit | How it was built |
| --- | --- | --- | --- |
| **Live now** | `sen-site-b12lghl33-sansxel.vercel.app` (`dpl_G7jiWsYgJvqYbd23EvA7b5gSAAux`), 2026-10-12 03:39 UTC | `86f4d8a7` (colour by meaning) | CLI upload from a clean checkout of `origin/main` at `86f4d8a7` (working tree clean). Vercel stores no Git SHA for CLI uploads, so this row is the record of its commit. |
| **Previous v8 production** (rollback within v8) | `sen-site-q363xez5n-sansxel.vercel.app` (`dpl_EiTVFxyCHUddyDebvdQAsVfiWCK7`), 03:21 UTC | `917c9c33` | Git push to `main`. Rolling back here undoes only the colour change. |
| **Before v8** (rollback out of v8) | `sen-site-lt64iii0o-sansxel.vercel.app` (`dpl_FXR1udx3R9L8e5xE5NU9Rmd8YagT`), 2026-10-11 21:45 UTC | `5dc06187` | Git push to `main`. Leaving v8 also needs `NEXT_PUBLIC_VRAELIS_V8_PUBLIC` removed and docs.vraelis.com detached (see Rollback). |

### The push to `main` that built nothing (2026-10-12, investigated, no config error)

- `86f4d8a7` was pushed to `site-v8` at 03:26:39 UTC: Vercel built previews for `sen-site` and `vraelis` (GitHub
  statuses 03:26:40 and 03:28:01/05).
- The same commit was pushed to `main` at about 03:29:23 UTC. GitHub delivered the push: the Railway service
  "appealing-love" started a production deploy of it at 03:29:25. Vercel created no deployment and posted no status,
  for either project.
- Eight minutes earlier the identical sequence for `917c9c33` worked: the `main` push at 03:21:42 started both Vercel
  projects within two seconds. Settings at the time and now: production branch `main`, Git deployments enabled, no
  ignored build step, no deploy hooks, the repository linked (`sansxelt/sen-site`), team on Pro (no daily limit near).
- Cause: a missed GitHub event on Vercel's side (the Vercel GitHub App's deliveries are visible only to Vercel). Not a
  configuration error, so nothing was changed.
- From now on: after every push to `main`, confirm within about three minutes that a `Vercel – sen-site` status
  appears on the commit (or that `vercel api /v6/deployments?projectId=sen-site&target=production` lists its SHA). If
  it does not, create a Git-sourced production deployment through the API (`POST /v13/deployments` with
  `gitSource: { type: "github", ref: "main", repoId }`, `target: "production"`) so Vercel records the commit; a CLI
  upload works too but records no SHA. The next ordinary push to `main` returns production to Git-built deployments.

### Found while investigating (not changed; founder's decision)

- The repository `sansxelt/sen-site` is public: anyone can read the code, this runbook and the strategy notes.
- A Railway service, "appealing-love", is connected to the repository and deploys every push to `main` as production.
  It is not part of the Vercel setup described here.

## PROMOTED 2026-10-11 22:4x UTC

- vraelis.com and docs.vraelis.com now serve v8 from production deployment `sen-site-54hezn9j6-sansxel.vercel.app`
  (`dpl_9Aysnbqib237K9vGSWFLvc245sGJ`), commit `b5e5338a` (site-v8 merged into main 5dc06187). Steps taken: merge to
  main (flag off, verified unchanged on `sen-site-boj7vkmh5`), docs.vraelis.com attached to `sen-site` (verified,
  configuredBy http, no DNS change), `NEXT_PUBLIC_VRAELIS_V8_PUBLIC=1` added to Production, `vercel deploy --prod
  --skip-domain`, checked on its URL, `vercel promote`.
- Follow-up fixes (founder review, same evening) shipped as 47d17a27, production `sen-site-mai2h9giv`: the docs
  Products tab opens its menu (and the menu is no longer clipped on phones), facts top-aligned, one way in (header
  Join us only; /contact is the Join us page with the same chips every visit; room under the form), the logo intro
  replays on arriving home. Verified live; crawl clean apart from Cloudflare's email-obfuscation paths.
- **Rollback target: `sen-site-lt64iii0o-sansxel.vercel.app` (5dc06187).** `vercel rollback
  sen-site-lt64iii0o-sansxel.vercel.app --scope sansxel`, then remove `NEXT_PUBLIC_VRAELIS_V8_PUBLIC` from Production
  (or the next push to main rebuilds v8) and remove docs.vraelis.com from `sen-site` Domains (a v6 build would show
  the v6 homepage there).
- Verified live: v8 home, pages and legal pages 200; old addresses 308 to their successors; /docs/* 308 to
  docs.vraelis.com; docs host 200 with site pages sent back to vraelis.com; no noindex on either host; robots,
  sitemap and llms files served; cleanup intact (/install, /install.ps1, /cli/vraelis.mjs 410; /invite, /signin,
  /app 307 to /beta; waitlist, plan setup, subscription start 503); account recovery pages 200; contact,
  reset-password, data-rights, account deletion, the three payment webhooks and the credit balance unchanged;
  www 308, app.vraelis.com 307, data.vraelis.com 200 (untouched). Two-host crawl: 122 pages, no broken links (the
  only misses are Cloudflare's email-obfuscation paths, which decode in a browser: checked, no page errors). One
  labelled test inquiry delivered both emails (Resend).
- Operator details (founder): Foremake, Inc as operator (unincorporated brand, no individuals named), notices by
  email, California, USA law with EU residents' mandatory protections kept. A background security review noted that
  this names a brand rather than an identifiable person or registered entity as operator and controller; that is a
  legal point for a parent or guardian or counsel (with the under-18 items), not a code fault.

## Promotion prepared (2026-10-11)

- `main` (5dc06187) merged into `site-v8` (b1b5887d), so the promotion carries the live cleanup and email footer.
- Found while preparing: with the flag on, v8 rewrote every path it did not know into its own 404, which would have
  broken account recovery (`/auth/reset-password`, its emailed confirm link, email verification) and turned the
  retired installers' 410 into 404. Fixed in 2f8650b2 (`v8Machine` lets `/auth/*`, `/install`, `/install.ps1` keep
  their own handling); `npm run v8:paths:test` pins it, and fails without the fix.
- Review deployment `vraelis-v8-review-dkcn8rmh5` (2f8650b2, v8 flag on): cleanup paths 410/503/307 as on
  production, account recovery pages 200, the operational APIs unchanged (the Stripe webhook answers 503 there only
  because the review project has no Stripe secrets), two-host crawl 122 pages, 0 broken links.
- docs.vraelis.com resolves through Cloudflare to Vercel and answers `DEPLOYMENT_NOT_FOUND`: attaching it to
  `sen-site` is all it needs. Rollback target for the promotion: `sen-site-lt64iii0o` (5dc06187).
- Founder answers (2026-10-11), applied in b1eac4da: the earlier product's terms stay in force for its users while
  its retirement is resolved (balances do not expire, refund and billing-error commitments apply); retention text
  states current practice only, with no deletion period promised. Still missing, and blocking the promotion: the
  legal entity (registered name, type, state or country), the notice address, governing law and courts (the terms
  say California today), and the data controller. The founder's reply had placeholders for these four.
- Founder, 2026-10-11 (second answer): Foremake, Inc, Vraelis and Overlym are unincorporated brands; "Foremake, Inc"
  stays the brand name exactly as written, but nothing may call it a corporation or invent an entity. Applied in
  1399ea15: a "Who operates Vraelis" section opens Terms and Privacy, with the operator, the notice address and the
  governing law in app/dev-preview/v8/_legal/operator.ts (all unset). A live v8 build fails while any is unset, so a
  placeholder cannot be published; `npm run v8:operator:test -- --ready` must pass before step 2. Neither a parent or
  guardian nor counsel is to be filled in as the operator by default.

## Code switch (already on site-v8, inert until the flag is set)

- `NEXT_PUBLIC_VRAELIS_V8_PUBLIC=1` turns on the promotion in `proxy.ts` (`v8Promoted`, `V8_ROOTS`, `V8_SUCCESSORS`).
- With the flag on and `VERCEL_ENV=production`, site links to /docs point at https://docs.vraelis.com, and /docs/* on
  vraelis.com redirects there. `NEXT_PUBLIC_VRAELIS_DOCS_ORIGIN=local` would keep the docs on vraelis.com/docs instead
  (the fallback if the docs host is not ready).
- v8 claims paths on the main host only; app.vraelis.com keeps the closed-product rule for every path.
- Do NOT set `VRAELIS_REVIEW_LABEL` on `sen-site` (it makes everything noindex and tags contact mail).

## Steps, in order

1. **Founder sign-off** on the open decisions at the end of this file (legal entity and policy text first).
2. **Merge.** Open a PR `site-v8` -> `main` (merges cleanly into `5dc06187`, checked 2026-10-11) and merge it. This is safe on its own:
   the push deploys production as usual, but with the flag off the v8 code is inert and vraelis.com keeps serving v6.
   Check vraelis.com once after the merge deploy (home, contact error path) to confirm nothing changed. One visible
   side effect: vraelis.com/dev-preview/v8 becomes reachable (noindex, nofollow), as /dev-preview/v7 already is.
3. **Docs domain (no DNS change expected).** In Vercel, `sen-site` > Settings > Domains > add `docs.vraelis.com`. Vercel
   shows the record it expects. In Cloudflare, confirm the existing `docs` record matches it (CNAME to Vercel's target)
   and uses the same proxy setting as the apex record. If Vercel cannot verify or issue a certificate while proxied, set
   the `docs` record to DNS only. Once the domain is attached (after the merge), docs.vraelis.com already serves the v8
   docs, marked noindex while the flag is off; their links to site pages land on today's v6 pages until step 7.
4. **Flag.** In `sen-site` > Settings > Environment Variables (Production): add `NEXT_PUBLIC_VRAELIS_V8_PUBLIC=1`. Leave
   `NEXT_PUBLIC_VRAELIS_V6_PUBLIC=1` as it is (v8 runs first; v6 rules only see what v8 does not claim).
5. **Build without going live.** `vercel deploy --prod --skip-domain` from `main` (or redeploy the latest `main`
   deployment with "Assign domains" off). This builds a production deployment with the flag baked in and gives it a
   `*.vercel.app` URL without moving vraelis.com.
6. **Check that build** on its URL: `npm run v8:paths:test` locally first; then home, /contour, /docs redirect,
   /auth/reset-password 200, /install 410, /cli/vraelis.mjs 410, /invite/x 307, contact form error path (POST
   /api/contact with a bad email returns 400), /api/v/data-requests returns 200, /app and /systems redirect to /beta, robots.txt allows, sitemap
   lists v8 URLs. (The docs host can only be checked after step 7.)
7. **Promote.** `vercel promote <url from step 5> --scope sansxel`, or "Promote to Production" in the dashboard.
   vraelis.com and docs.vraelis.com switch together.
8. **Verify live** (within 10 minutes): run the two-host crawl
   (`ORIGINS=https://docs.vraelis.com node review-crawl2.mjs https://vraelis.com`), send one labelled test inquiry and
   confirm both emails in Resend, open the cookie banner on a fresh browser, check app.vraelis.com still closes.
9. **After a stable day:** submit the sitemap in Google Search Console (and IndexNow), then decide the
   older projects (see decisions).

## Rollback

- **Fast (seconds):** `vercel rollback sen-site-lt64iii0o-sansxel.vercel.app --scope sansxel` (or "Instant Rollback" in the
  dashboard); see "Rollback targets" above if anything else ships to `main` first. The flag is baked into each
  build, so the previous deployment serves v6 exactly as today. Vercel then
  stops auto-promoting new `main` deploys until one is promoted by hand.
- **Make it stick:** remove `NEXT_PUBLIC_VRAELIS_V8_PUBLIC` from Production, and either revert the merge on `main`
  (`git revert -m 1 <merge>`) or leave the code (it is inert without the flag).
- **Docs host:** a rollback to 5dc06187 has no docs-host routing, so docs.vraelis.com would show the v6 homepage. Remove
  `docs.vraelis.com` from `sen-site` Domains (it returns to `DEPLOYMENT_NOT_FOUND`); the Cloudflare record can stay.
- **Contact form and www:** unaffected by rollback (the fix b68c5540 is in both builds; the www redirect is a domain
  setting, not part of a deployment).

## Open decisions (founder, or founder and lawyer)

1. Legal entity, address and governing law named in the policies; whether the earlier product's terms remain in force.
2. Retention period for contact-form rate-limit keys (IP and email in Supabase) and a purge job.
3. Whether old subscriptions are still billing (the `/api/vraelis/cron/subscriptions` cron still runs daily on
   `sen-site`; the lifecycle cron was removed in 52b80277).
4. (Done 2026-10-11: `ops/retired-cleanup-2` and `ops/email-footer` deployed as 5dc06187.) Whether the older
   projects' Git-triggered builds and crons should be switched off (see the `vraelis` section).
5. The older projects and domains: `vraelis` (data.vraelis.com, plus Git-triggered builds of every branch, see above)
   and `sen-site-main` (vraelis.ai, platform/chat.vraelis.com).
6. Purchased credits: honour or refund. Until decided they stay under the existing non-expiry promise and no balance
   changes. One 50-credit top-up (2026-07-26 23:50 UTC) has no matching payment in the live Stripe account and is
   recorded as "payment unverified" by an append-only `v_events` row (`credit_payment_unverified`, id 1a4d022d,
   2026-10-11 21:24 UTC) that points at ledger row 3aaea4ba; the ledger and the balance are untouched. It is not to be
   called a test payment without evidence.
7. Written permission before any partner logo returns (names stay as text meanwhile); partnership wording and dates.
8. Footage: v8 uses a civilian Pexels edit; the earlier footage findings are research, to be confirmed, not legal advice.
9. Earlier-product docs ("Earlier references"): runnable commands are removed; keep public with banners, or unpublish.

## www.vraelis.com migration (DONE 2026-10-11)

Executed with the founder's approval on 2026-10-11: www.vraelis.com now answers 308 to vraelis.com from `sen-site`, and
`vraelis` keeps only data.vraelis.com. The plan as it was prepared is kept below for the record and for the rollback.

Before the move, www.vraelis.com was attached to the older Vercel project `vraelis`. That project builds the same repository and
branch as production (`sen-site`, `main`) but without `NEXT_PUBLIC_VRAELIS_V6_PUBLIC`, so www showed the retired Rank pages
(matched path `/rank`), and every push to `main` redeploys it. Both vraelis.com and www.vraelis.com are verified at Vercel
through Cloudflare (`configuredBy: http`), so moving www between projects in the same team needs no DNS change.

Steps (minutes apart, so www is unserved for seconds at most):
1. `vraelis` > Settings > Domains: remove `www.vraelis.com`. API: `DELETE /v9/projects/vraelis/domains/www.vraelis.com`.
2. `sen-site` > Settings > Domains: add `www.vraelis.com` as a redirect to `vraelis.com`, status 308. API:
   `POST /v10/projects/sen-site/domains {"name":"www.vraelis.com","redirect":"vraelis.com","redirectStatusCode":308}`.
3. Check: `curl -I https://www.vraelis.com/contour` returns 308 to `https://vraelis.com/contour` (path kept).
Leave `data.vraelis.com` on `vraelis` and every other domain unchanged.
Rollback: remove www from `sen-site`, add it back to `vraelis` (same two calls reversed).
This can run before or after the v8 promotion; before is fine (www then redirects to today's vraelis.com).

Mechanism verified 2026-10-11 on the review project (a throwaway `vraelis-v8-review-www.vercel.app` domain configured
the same way, then removed): `/` -> 308 to the target root, `/contour?x=1` -> 308 to `/contour?x=1` (path and query
kept), and the project's other domains kept answering 200. Baseline before the move (2026-10-11): vraelis.com 200,
www.vraelis.com 200 (retired Rank pages), app.vraelis.com 307 to /beta, data.vraelis.com 200, docs.vraelis.com 404,
platform.vraelis.com 404, chat.vraelis.com 404, vraelis.ai and www.vraelis.ai no response. After the move only the www
line should change (to 308 vraelis.com); re-run the same probe to confirm.

## Contact-form rate-limit data (measured 2026-10-11, read-only)

Table `vraelis_rate_limits` (Supabase): `key` (route + IP or route + email, stored in clear), `count`, `window_start`.
Nothing ever deletes rows. On 2026-10-11 it held 591 rows, the oldest 125 days old; 486 were older than 7 days.
Contact form rows: 7 keyed by IP (`contact:<ip>`, 10-minute window) and 1 by email (`contact-to:<email>`, 1-hour window).
Most rows come from other routes (CSP reports, funnel, the closed v1 API, sign-in and two-step). The longest window any
limiter uses is one day (`two-step-verify-day`, `two-step-recovery-used`). Limiter errors also log the key (an IP or an
email) to the server logs through `captureError`.

Proposal (scoped, checked against every consumer on 2026-10-11): 41 key prefixes use the table; an expired row
behaves exactly like a missing row (vraelis_rate_check resets it, peekAllowed treats it as allowed), and no consumer
relies on a row outliving its window (TOTP and email-code replay markers, recovery codes and invites are all
enforced elsewhere or within the window). So: an hourly purge that deletes rows 2 hours after the window start for
every prefix with a window of 1 hour or less, 25 hours for `two-step-verify-day` and `two-step-recovery-used`
(1-day windows), and 7 days for any unknown prefix. The function `vraelis_rate_limits_purge()` and its pg_cron
schedule are written out in the inventory report (needs `create extension if not exists pg_cron;` first). Not
executed. Privacy text to publish only after the job runs: keys hold a count and a start time, not the message,
and are deleted within three hours of last use (26 hours for the two two-step keys); plus a server-logs note
(Vercel request logs, and limiter errors can log the key), with the retention period checked in the Vercel
dashboard (1 day on Pro, 30 days with Observability Plus).

Optional hardening: store
an HMAC of the IP or email instead of the value (no lookup ever needs the raw value back).
