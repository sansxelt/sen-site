# Cookie topology — measured, not read

Every earlier statement about cookies in this remediation was read out of `auth.ts`. Source strings are not
behaviour: Auth.js supplies defaults for every cookie the config does not override, and that is where most
of the real attributes come from.

This document records what the application **actually emits**. `scripts/phase41-cookie-verify.ts` drives
the real NextAuth handlers with synthetic requests and reads the `Set-Cookie` headers back. It runs one
child process per case, because `auth.ts` reads `VERCEL_ENV` at module scope and module state is cached —
mutating the environment in-process would measure whichever value happened to load first.

**No network, no database, no deployed environment is touched.** Handlers run in-process against synthetic
`Request` objects with a throwaway secret.

## The matrix

| Host | `VERCEL_ENV` | Cookie | Domain | Path | Secure | HttpOnly | SameSite | Who must read it |
|---|---|---|---|---|---|---|---|---|
| `vraelis.com` | production | `__Secure-authjs.session-token` | **`.vraelis.com`** | `/` | yes | yes | Lax | apex **and every subdomain** |
| `vraelis.com` | production | `__Host-authjs.csrf-token` | *(host-only)* | `/` | yes | yes | Lax | issuing host only |
| `vraelis.com` | production | `__Secure-authjs.callback-url` | *(host-only)* | `/` | yes | yes | Lax | issuing host only |
| `www.vraelis.com` | production | `__Secure-authjs.session-token` | **`.vraelis.com`** | `/` | yes | yes | Lax | apex and every subdomain |
| `www.vraelis.com` | production | `__Host-authjs.csrf-token` | *(host-only)* | `/` | yes | yes | Lax | `www.` only |
| `app.vraelis.com` | production | `__Secure-authjs.session-token` | **`.vraelis.com`** | `/` | yes | yes | Lax | apex and every subdomain |
| `app.vraelis.com` | production | `__Host-authjs.csrf-token` | *(host-only)* | `/` | yes | yes | Lax | `app.` only |
| `*.vercel.app` | preview | `__Secure-authjs.session-token` | *(host-only)* | `/` | yes | yes | Lax | that preview host only |
| `*.vercel.app` | preview | `__Host-authjs.csrf-token` | *(host-only)* | `/` | yes | yes | Lax | that preview host only |
| `localhost:3000` | *(unset)* | `authjs.session-token` | *(host-only)* | `/` | **no** | yes | Lax | localhost only |
| `localhost:3000` | *(unset)* | `authjs.csrf-token` | *(host-only)* | `/` | **no** | yes | Lax | localhost only |

Three things worth reading off this table:

- **The session cookie's `Domain` is the same literal on every production host**, including `app.` and
  `www.`. It is not derived from the request — see "not attacker-influenced" below.
- **Only the session cookie spans subdomains.** CSRF and callback-url are host-only. That is the correct
  split: a stolen session must be usable on `app.`, a CSRF token must not be settable from a sibling host.
- **Non-production degrades correctly.** Preview and localhost get host-only cookies, and over `http`
  Auth.js drops the `__Secure-`/`__Host-` prefixes and the `Secure` flag automatically.

## Where cookies come from — every path

| # | Path | Sets | Notes |
|---|---|---|---|
| 1 | NextAuth handlers via `app/api/auth/[...nextauth]/route.ts` | session, csrf, callback-url, and the OAuth flow cookies (pkce/state/nonce) | The `cookies:` block in `auth.ts` overrides **only** the session token. Everything else is an Auth.js default. |
| 2 | `lib/v-sso.ts:325` → `app/api/v/sso/oidc/[providerId]/callback/route.ts` | the session cookie, directly | A **second** session-cookie path. Same name, same domain, same flags as path 1. |

Path 2 matters and is easy to miss. It builds the cookie itself rather than going through NextAuth, so if
its options ever drifted there would be two session cookies with different scopes and which one a browser
held would depend on how the user signed in. They currently match, and the test asserts each attribute.

**One real divergence:** path 2 is **not** keyed on `VERCEL_ENV`. It always sets
`domain: ".vraelis.com"` and `secure: true`. On localhost or a preview deployment a browser rejects that
cookie outright, so **SSO sign-in cannot work outside production**. That is a development limitation, not a
leak — the cookie is rejected, not misdirected.

## Is the domain attacker-influenced? No.

The configured value is a **literal** — `domain: ".vraelis.com"` — evaluated from
`process.env.VERCEL_ENV`, never from the request. Nothing reads the `Host` header to decide cookie scope.

This is worth stating because the **deleted** per-request resolver did read it, using
`host.endsWith("vraelis.com")` — and `"evilvraelis.com".endsWith("vraelis.com")` is **true**. That code was
never live (its result was computed and discarded), but a literal is safer than a derived value and this is
part of why restoring it is not a trivial change.

Reachability, applying RFC 6265 domain-matching to the measured value:

| Host | Receives the session cookie? |
|---|---|
| `vraelis.com`, `www.vraelis.com`, `app.vraelis.com` | **yes** |
| `sansxel.ai`, `chat.sansxel.ai` | no — different registrable domain |
| `evilvraelis.com`, `notvraelis.com` | no |
| `vraelis.com.evil.test` | no |
| `vraelis.co`, `vraelis.com.br` | no |
| punycode lookalikes | no |

## Does cross-subdomain authentication work today, and how?

**Yes, and for exactly one reason: the session cookie is pinned to `.vraelis.com`.** There is no second
mechanism carrying auth across hosts — no token in a query string, no postMessage handshake, no shared
storage.

The concrete dependency: the SSO OIDC callback runs on the apex and redirects to
`https://app.vraelis.com/organization` (`app/api/v/sso/oidc/[providerId]/callback/route.ts:34`), attaching
the session cookie to that redirect. `app.vraelis.com` can only read it because of the parent-domain scope.
The billing return routes (`app/rank/app/billing/**`) are reached the same way. A host-only cookie would
break both.

## A correction to the Phase 4 report

Phase 4 said the `__Host-` CSRF cookie name was "configured in the dead helper, so the CSRF cookie uses the
default". **The measurement shows `__Host-authjs.csrf-token` is emitted** — because that *is* the Auth.js
default in a secure context. Deleting the helper did not weaken the CSRF cookie in any way. The claim was
an artifact of reading source instead of measuring output, which is why this document exists.

## If cookie changes are ever required — a migration path

**Not implemented, and not recommended yet.** Per the owner's decision, runtime behaviour is preserved until
the real topology is captured and tested in staging. Recorded so the option is costed rather than
rediscovered.

The only change that would justify the disruption is supporting a second registrable domain
(`sansxel.ai`), which needs per-request resolution because one `Domain` attribute cannot cover two
registrable domains.

**What it would cost.** Changing the session cookie's name or domain **invalidates every live session** —
the browser holds `__Secure-authjs.session-token` scoped to `.vraelis.com`, and a cookie with a different
name or scope is a different cookie. Every signed-in user is signed out once. That is not a bug to be
worked around; it is inherent, and it should be *scheduled* rather than *discovered*.

**Sequence, if it is ever done:**

1. **Capture reality first.** Run `scripts/phase41-cookie-verify.ts` against staging with production-like
   `VERCEL_ENV`, and confirm the matrix above still holds. Do not change anything you have not measured.
2. **Fix the resolver's host check before restoring it.** `host.endsWith("vraelis.com")` matches
   `evilvraelis.com`. Use an exact allowlist of hosts, not a suffix test.
3. **Change ONE thing.** Either the domain resolution or the cookie names — never both. Two simultaneous
   changes make a failed sign-in impossible to attribute.
4. **Update `lib/v-sso.ts` in the same change.** It is the second path and hardcodes the same values; a
   resolver that only fixes NextAuth leaves SSO issuing the old scope.
5. **Announce the sign-out.** A scheduled window, users told in advance.
6. **Verify on every host in the matrix**, including `www.` and a preview deployment.

**Rollback.** Reverting the code restores the old names and domain — and signs everyone out a *second*
time, because sessions issued under the new scheme become unreadable. Budget for two invalidations, not
one. There is no way to roll this back invisibly, which is the strongest argument for not doing it without
a concrete need.

Until then: `AUTH_COOKIE_DOMAIN` stays inert and documented as such in `.env.example`, and the names and
domain stay exactly as measured above.
