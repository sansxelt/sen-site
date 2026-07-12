# app.vraelis.com migration (EXECUTING 2026-07-12)

Founder-approved spec: marketing + auth stay on vraelis.com; the signed-in product lives at app.vraelis.com
with renamed clean routes. app.vraelis.com is already added + valid in Vercel (user did DNS/domain).

## Public URL map (user's spec)

- Marketing + auth on vraelis.com: /, /pricing, /demo, /contact, /signin, /signup, auth callbacks.
- Product on app.vraelis.com: / (overview), /applications, /applications/new, /passes, /issues, /repairs,
  /deployments, /activity, /team, /organization, /api, /billing, /account (+ /plans, /credits, /checkout,
  /legacy/* which the spec omitted but exist).
- Per app: /applications/[id]{,/contract,/passes,/passes/[runId],/issues,/repairs,/deployments,/settings}.

## Physical renames (internal dirs under app/rank/app/) so internal path = "/rank/app" + public path

- apps -> applications
- apps/[id]/runs -> applications/[id]/passes  (runs/[runId] -> passes/[runId])
- audit -> activity
- api-keys -> api
- everything else keeps its name (passes, issues, repairs, deployments, team, organization, plans,
  credits, billing, account, checkout, data, data-quality, projects, shared, sandbox, legacy).

## Single source of truth: lib/app-routes.ts (NEW)

- APP_ROOTS: first path segments that belong to the product (post-rename dir list above).
- isAppPath(pathname): pathname === "/app" || startsWith("/app/") || first segment in APP_ROOTS.
- legacyToNew(path): "/app/apps/X/runs/Y" -> "/applications/X/passes/Y"; "/app/audit"->"/activity";
  "/app/api-keys"->"/api"; "/app" -> "/"; generic "/app/X" -> "/X".
- appHostUrl(path): "https://app.vraelis.com"+path in production, path as-is otherwise (dev).

## proxy.ts host logic (order matters)

1. isAppHost = host starts with "app." (app.vraelis.com; also app.localhost for dev).
2. On app host: /api/* and /r/* pass through untouched (NextAuth session endpoints must work here).
   /signin|/signup|/auth/* -> redirect https://vraelis.com + path + search (auth on main).
   /app or /app/* -> redirect to legacyToNew(path) on the app host (kills doubled URLs).
   first segment in APP_ROOTS or "/" -> rewrite "/rank/app" + (path === "/" ? "" : path).
   anything else -> redirect https://vraelis.com + path (marketing does not render on app host).
3. On main host: /app or /app/* -> redirect https://app.vraelis.com + legacyToNew(path) IN PROD;
   on localhost keep the old rewrite "/rank" + path so dev works without subdomains.
   Top-level APP_ROOTS on main host: prod -> redirect to app host same path; localhost -> rewrite
   "/rank/app" + path. APP_ROOTS check must run BEFORE the SANSXEL retired-routes list ("/account"
   collides; product wins).

## auth.ts

- Session cookie domain ".vraelis.com" ONLY in production (VERCEL_ENV/NODE_ENV production or host check
  unavailable at config time -> gate on process.env.VERCEL_ENV === "production"); dev keeps default so
  localhost auth is untouched. NOTE: changing the cookie domain logs out existing sessions (founder only).
- redirect callback: allow absolute callbackUrls whose hostname === "vraelis.com" or ends with
  ".vraelis.com" (else default same-origin rule). Sign-in then lands on app.vraelis.com/... deep links.
- signOut callbackUrl "/" -> main-host home; the .vraelis.com cookie clears for both hosts.

## Guards + links

- requirePreflightOwner(path) call sites get NEW public paths; the guard redirects to
  "/signin?callbackUrl=" + encodeURIComponent(appHostUrl(path)). /signin on app host redirects to main
  host preserving the query (proxy rule above), so logged-out deep links round-trip per the spec.
- Repo-wide link sweep (href/router.push/redirect/fetch NAV only, NOT /api/preflight/* API routes):
  /app/apps -> /applications ; /apps/[id]/runs -> /applications/[id]/passes ; /app/audit -> /activity ;
  /app/api-keys -> /api ; /app/team -> /team ; /app/organization -> /organization ; /app/plans -> /plans ;
  /app/credits -> /credits ; /app/billing -> /billing ; /app/account -> /account ; /app/checkout ->
  /checkout ; /app/passes -> /passes ; /app/issues -> /issues ; /app/repairs -> /repairs ;
  /app/deployments -> /deployments ; /app/legacy -> /legacy ; nav Overview href "/app" stays (proxy
  redirects it home on the app host; keeps localhost workable).
- lib/email.ts links: vraelis.com/app/apps -> https://app.vraelis.com/applications ; /app/plans ->
  https://app.vraelis.com/plans (absolute, since emails).
- CLI drivers print report route: -> https://app.vraelis.com/applications/<app>/passes/<run>.
- RankShell inApp check: use isAppPath() from lib/app-routes.
- API routes and /api/preflight/** paths DO NOT change (shared on both hosts).

## Verify (scripts/preflight-routes-verify.ts NEW)

- legacyToNew mapping table incl. the user's exact examples.
- isAppPath positives/negatives (marketing paths false).
- Static: no remaining 'href="/app/apps' / 'push("/app/' outside legacy dir; guard callbacks use
  appHostUrl; proxy handles app host before SANSXEL; email links absolute to app host.
- Static back-link sweep: every "← " link uses display:"flex" + width:"fit-content" (user's standing
  complaint: never a back arrow mashed against green text).
- tsc, eslint (changed files), build, all existing suites (security/limits auto-adapt), pricing/copy.

## Operator checklist (after deploy)

1. DNS/domain: DONE (app.vraelis.com valid in Vercel).
2. In a private window: vraelis.com/signin -> sign in -> should land signed-in; open
   app.vraelis.com/applications -> still signed in (cookie domain works). Sign out from the app ->
   lands on vraelis.com, BOTH hosts logged out.
3. Old link check: vraelis.com/app/apps -> 308 -> app.vraelis.com/applications.
4. NEXTAUTH_URL/AUTH_URL stays https://vraelis.com (auth pages on main host).

## Rollback

Revert the commit; cookie domain reverts with it (sessions reset again, founder only). DNS can stay.
