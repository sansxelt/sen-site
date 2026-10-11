# v8 production runbook (vraelis.com and docs.vraelis.com)

Prepared 2026-10-11. Nothing in this file has been executed against production. Promotion and every DNS or domain
change below wait for the founder's go.

## What exists today

| Host | Served by | What it shows today |
| --- | --- | --- |
| vraelis.com | Vercel project `sen-site`, branch `main`, through Cloudflare (proxied) | The v6 site (`NEXT_PUBLIC_VRAELIS_V6_PUBLIC=1`). Contact fix b68c5540 is live. |
| docs.vraelis.com | Cloudflare record already points at Vercel, but no Vercel project claims the domain | `DEPLOYMENT_NOT_FOUND` (404) |
| www.vraelis.com | Vercel project `vraelis` (older) | The retired Rank site (matched path `/rank`) |
| app.vraelis.com | `sen-site` | Redirects to vraelis.com/beta (product access closed) |
| data.vraelis.com | Vercel project `vraelis` (older) | Workspace entrance from an earlier build |
| vraelis.ai, www.vraelis.ai, platform.vraelis.com, chat.vraelis.com | Vercel project `sen-site-main` (older) | Earlier products |
| Review copy | Vercel project `vraelis-v8-review` | https://vraelis-v8-review.vercel.app and https://vraelis-v8-review-docs.vercel.app, built from `site-v8` with production's flags, noindex, robots disallow |

Production environment on `sen-site` today: `NEXT_PUBLIC_VRAELIS_V6_PUBLIC=1`, `NEXT_PUBLIC_VRAELIS_PREFLIGHT=1`,
`VRAELIS_BASE_URL=https://vraelis.com`, no `STEALTH_MODE`. Rollback target: production deployment
`sen-site-osbku11iw-sansxel.vercel.app` (commit b68c5540).

## Target

- vraelis.com serves v8 at clean paths. Previous addresses redirect (308) to their v8 successors; unknown paths get the
  v8 404. app.vraelis.com and console paths stay closed.
- docs.vraelis.com serves the docs at its root. vraelis.com/docs/* redirects (308) there, path for path.
- llms.txt, llms-full.txt and sitemap.xml come from the v8 registries; robots allows crawling (not a review build).

## Code switch (already on site-v8, inert until the flag is set)

- `NEXT_PUBLIC_VRAELIS_V8_PUBLIC=1` turns on the promotion in `proxy.ts` (`v8Promoted`, `V8_ROOTS`, `V8_SUCCESSORS`).
- With the flag on and `VERCEL_ENV=production`, site links to /docs point at https://docs.vraelis.com, and /docs/* on
  vraelis.com redirects there. `NEXT_PUBLIC_VRAELIS_DOCS_ORIGIN=local` would keep the docs on vraelis.com/docs instead
  (the fallback if the docs host is not ready).
- v8 claims paths on the main host only; app.vraelis.com keeps the closed-product rule for every path.
- Do NOT set `VRAELIS_REVIEW_LABEL` on `sen-site` (it makes everything noindex and tags contact mail).

## Steps, in order

1. **Founder sign-off** on the open decisions at the end of this file (legal entity and policy text first).
2. **Merge.** Open a PR `site-v8` -> `main` (merges cleanly as of 4c7d8819) and merge it. This is safe on its own:
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
6. **Check that build** on its URL: home, /contour, /docs redirect, contact form error path (POST /api/contact with a bad
   email returns 400), /api/v/data-requests returns 200, /app and /systems redirect to /beta, robots.txt allows, sitemap
   lists v8 URLs. (The docs host can only be checked after step 7.)
7. **Promote.** `vercel promote <url from step 5> --scope sansxel`, or "Promote to Production" in the dashboard.
   vraelis.com and docs.vraelis.com switch together.
8. **Verify live** (within 10 minutes): run the two-host crawl
   (`ORIGINS=https://docs.vraelis.com node review-crawl2.mjs https://vraelis.com`), send one labelled test inquiry and
   confirm both emails in Resend, open the cookie banner on a fresh browser, check app.vraelis.com still closes.
9. **After a stable day:** submit the sitemap in Google Search Console (and IndexNow), then decide www.vraelis.com and the
   older projects (see decisions).

## Rollback

- **Fast (seconds):** `vercel rollback sen-site-osbku11iw-sansxel.vercel.app --scope sansxel` (or "Instant Rollback" in the
  dashboard). The flag is baked into each build, so the previous deployment serves v6 exactly as today. Vercel then
  stops auto-promoting new `main` deploys until one is promoted by hand.
- **Make it stick:** remove `NEXT_PUBLIC_VRAELIS_V8_PUBLIC` from Production, and either revert the merge on `main`
  (`git revert -m 1 <merge>`) or leave the code (it is inert without the flag).
- **Docs host:** a rollback to b68c5540 has no docs-host routing, so docs.vraelis.com would show the v6 homepage. Remove
  `docs.vraelis.com` from `sen-site` Domains (it returns to `DEPLOYMENT_NOT_FOUND`); the Cloudflare record can stay.
- **Contact form:** unaffected by rollback (the fix b68c5540 is in both builds).

## Open decisions (founder, or founder and lawyer)

1. Legal entity, address and governing law named in the policies; whether the earlier product's terms remain in force.
2. Retention period for contact-form rate-limit keys (IP and email in Supabase) and a purge job.
3. Whether old subscriptions are still billing (the `/api/vraelis/cron/subscriptions` cron still runs daily).
4. www.vraelis.com: move it to `sen-site` and redirect to vraelis.com (recommended), or leave it on the retired site.
5. The older projects and domains (`vraelis`, `sen-site-main`: data.vraelis.com, vraelis.ai, platform/chat.vraelis.com).
6. Partner logos (no written permission on record), partnership wording and dates, Overlym mentions.
7. DVIDS military footage on the homepage and a DoD non-endorsement line.
8. Earlier-product docs ("Earlier references"): keep public with banners, or unpublish.
9. Whether "QA" should read "internal QA".

## www.vraelis.com migration (prepared, not executed)

Today www.vraelis.com is attached to the older Vercel project `vraelis`. That project builds the same repository and
branch as production (`sen-site`, `main`) but without `NEXT_PUBLIC_VRAELIS_V6_PUBLIC`, so www shows the retired Rank pages
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

Proposal: keep rows 7 days after their window starts (seven times the longest window), then delete them. Cleanup, in
Supabase SQL (pg_cron), daily at 04:30 UTC:

    select cron.schedule('vraelis-rate-limit-retention', '30 4 * * *',
      $$delete from vraelis_rate_limits where window_start < now() - interval '7 days'$$);

Then the privacy page can say: "These keys are deleted 7 days after the window they belong to." Optional hardening: store
an HMAC of the IP or email instead of the value (no lookup ever needs the raw value back).
