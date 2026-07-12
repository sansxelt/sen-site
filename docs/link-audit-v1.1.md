# Outbound link + redirect audit (V1.1 S1, spec section 21) - 2026-07-12

Scope: every external href, redirect, and return URL in `app/` + `lib/` (excluding the flag-gated
`app/rank/app/legacy/**` and `docs/`). Principle: Vraelis owns the customer experience. Every hit below
is classified as one of: **keep native** (already or now first-party), **embed** (third-party runs
inside our page), **secure handoff** (deliberate exit to a processor/provider page, returns to a
canonical route), **external by nature** (social/legal/contact), **fixed in this pass**, or
**coming later** (never a fake button).

Counts: 9 fixed in this pass, 7 secure handoffs, 5 embeds, 6 external-by-nature groups,
4 keep-native dynamic redirects, 3 coming later, 2 legacy-mapped groups (tracked, not broken).

## Fixed in this pass

| # | Where | Was | Now |
|---|-------|-----|-----|
| 1 | `app/api/v/subscribe/route.ts` | `return_url: ${SITE_URL}/plans?session_id=...` (inline, page ignored the param) | `billingReturnUrls().success` from `lib/return-urls.ts` -> canonical `app.vraelis.com/billing/success` with native confirmation |
| 2 | `app/api/v/checkout/route.ts` | `return_url: ${SITE_URL}/credits?session_id=...` (inline) | `topupReturnUrl()` from the module; the `/credits?session_id=` poll flow is byte-for-byte preserved |
| 3 | `app/api/v/portal/route.ts` | `return_url: ${SITE_URL}/billing` (inline) | `billingReturnUrls().portalReturn` -> canonical `/billing/portal-return` page that re-fetches subscription state |
| 4 | `lib/auth-ui.ts` `getSafeRedirectPath` | Only rejected missing-`/` and `//`; `/\evil.com` (backslash origin trick), encoded `%2F`/`%5C`/`%2E`, dot-segment traversal, and control chars passed through | Delegates to `safeReturnPath` in `lib/return-urls.ts`; all of the above collapse to the safe default. This validator guards `app/signin/page.tsx` (the one user-input-driven redirect) and the NextAuth `authorized` callback |
| 5 | `app/rank/app/billing/page.tsx` | Sign-in guard used legacy `callbackUrl=%2Fapp%2Fbilling` | Clean `/billing` callback |
| 6 | (missing) | No canonical billing return routes existed | Four canonical pages created: `/billing/success`, `/billing/cancelled`, `/billing/payment-failed`, `/billing/portal-return` |
| 7 | `app/api/v/subscribe/route.ts` | No duplicate-checkout protection | 409 `already_subscribed` when `plan_v1` is set; 10-minute same-session reuse via `checkout_session_created` events |
| 8 | `app/rank/app/billing/page.tsx` | No native payment history (invoices only visible inside the Stripe portal) | Stripe invoices listed server-side and rendered natively; hosted invoice page is the detail fallback only |
| 9 | `app/rank/app/checkout/*` | Review screen lacked explicit renewal/cancellation terms | `V1RenewalTerms` renders renewal cadence, cancel-at-period-end behavior, yearly up-front + monthly release, and the no-overage rule before payment |

## Secure external handoffs (deliberate, allowlisted, canonical returns)

| Where | Destination | Why it stays a handoff |
|-------|-------------|------------------------|
| Stripe embedded checkout (`checkout-client.tsx` via `loadStripe`) | `js.stripe.com` iframe | PCI scope lives with Stripe; the surrounding review screen, order summary, and returns are ours |
| Stripe customer portal (`/api/v/portal`) | `billing.stripe.com` | No embedded variant exists; card entry stays with Stripe; returns to `/billing/portal-return` |
| Stripe hosted invoice links (`billing/page.tsx`, `team-billing-panel.tsx`) | `invoice.stripe.com` | Native list is primary; hosted page is the line-item/receipt detail fallback, `rel="noreferrer"` new tab |
| PayPal credit top-up buttons + subscribe redirect (`checkout-client.tsx`, `/api/v/paypal/*`) | `paypal.com` | Legacy top-up rail only; suppressed for `_v1` plans; returns to `/credits?paypal=1` / `/plans` |
| PayPal autopay management (`app/(vraelis)/v/account/page.tsx`) | `paypal.com/myaccount/autopay` | The subscription mandate lives in the buyer's PayPal account; nothing native can edit it |
| Provider OAuth consent (`accounts.google.com` calendar, `github.com/login/oauth`) | provider | OAuth consent must happen on the provider; callbacks return to fixed own-origin paths |
| SSO IdP redirect (`/api/v/sso/oidc/*`) | admin-configured IdP host | Destination comes from the org's verified SSO config (server-side discovery), never from request params |

## Embeds (third-party inside our page)

- Stripe.js / Embedded Checkout (`@stripe/stripe-js`) - three checkout surfaces.
- PayPal JS SDK script (`www.paypal.com/sdk/js`) - credit top-ups, env-gated.
- Tally intake embed (`tally.so`) on `/free-report` - env of record for demand intake.
- GA4 (`googletagmanager.com`) + Meta Pixel (`connect.facebook.net`) - env-gated analytics, `app/(vraelis)` only.
- Google Fonts preconnect/import (`fonts.googleapis.com`, `fonts.gstatic.com`) - `app/layout.tsx` + one marketing page.

## External by nature (keep, `rel` hygiene verified)

Social footers/contact (instagram, facebook, x, linkedin, youtube, discord.gg), `mailto:` support
addresses (help@/sales@/privacy@vraelis.com across legal + transactional email), `schema.org` JSON-LD
contexts, curl/API documentation snippets quoting `https://vraelis.com/api/v1/...`, and the
"Powered by Vraelis" links on embeds/share pages. All static, none user-controllable.

## Keep native (dynamic redirects reviewed, not user-controllable)

- `window.location.href = j.url|j.approveUrl|json.redirect` client assignments (plans, team, billing,
  flip, booking): all values are minted server-side by our own routes (Stripe/PayPal session URLs);
  no request parameter chooses the host.
- `NextResponse.redirect` in auth verify / integrations callbacks: fixed own-origin paths.
- NextAuth `redirect` callback: family-allowlisted (`^https://([\w-]+\.)?vraelis\.com$`), consistent
  with `familyUrl` in the new module.
- Server guards (`lib/v-preflight-guard.ts`): `appHostUrl` + encoded callback, validated on the way
  back out by `getSafeRedirectPath` (now hardened, fix 4).

## Legacy-mapped (works today via proxy legacy redirects; migrate opportunistically)

- Marketing CTAs and older app guards still using `callbackUrl=%2Fapp...` relative paths: served via
  the `legacyToNew` mapping in `lib/app-routes.ts`; no absolute `vraelis.com/app/*` link exists
  anywhere in `app/` or `lib/` (verified by grep; `routes:test` also blocks stale `/app/apps` strings).
- `app/r/check/free-check-entry.tsx` callback to `/app/checks/new` targets the retired flag-gated
  checker on purpose.

## Coming later (no fake buttons today)

- Provider OAuth for Vercel/Railway/Netlify/Supabase and the GitHub App installation flow
  (workstream C2/S12): connections stay labeled "Connected manually" until real.
- Team-seat checkout returns (`lib/v-team-billing.ts` -> `/team?team=success|cancel`): page-scoped
  params that panel already consumes; migrate onto `lib/return-urls.ts` when team billing is next
  touched (S2+), not worth breaking mid-S1.
- Dunning emails linking `/billing/payment-failed`: the page ships now; `lib/email.ts` templates adopt
  it in workstream P (notifications) alongside the notifications log.

## Invariants now enforced by `npm run billing:returns:test`

Subscription/portal/top-up return URLs come only from `lib/return-urls.ts`; `/billing/success` never
activates from the redirect (webhook authority + 2s/60s poll); the duplicate-checkout guard exists;
raw Stripe IDs render only inside the collapsed "Technical details" disclosure on `/billing`.
