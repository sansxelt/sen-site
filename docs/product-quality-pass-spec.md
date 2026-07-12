# Product-wide quality pass (founder spec, 2026-07-12) — PLAN REQUIRED BEFORE IMPLEMENTATION

Founder: polish the signed-in product so it feels like a serious software company, not a reused
AI-generated dashboard. Product-wide quality pass, not a one-page redesign. "We aren't AI slop."

## 1. PRICING
- Monthly/yearly toggle even in early access; yearly = real incentive (~2 months free) without
  destroying margins.
- RE-EVALUATE plans from scratch (margins, browser+API costs, revenue headroom, upgrade paths, annual
  prepay). Serious B2B, not credit packs. BEFORE changing prices return: recommended plans, monthly +
  yearly prices, included passes, flow limits, rerun rules, overages, margin assumptions, implemented vs
  future. Never activate fake subscription checkout.

## 2. NAVIGATION / BRAND LINKS (bugs found by founder)
- App logo (topbar) must be clickable -> https://app.vraelis.com/ (currently doesn't take you back).
- "Back to site" (sidebar foot) must -> https://vraelis.com/ (currently -> app host "/" = overview; the
  one-line fix was interrupted mid-tool-call and is NOT applied yet).
- Audit EVERY logo, back link, breadcrumb, sidebar foot link, auth-page return link for correct host.

## 3. REMOVE LOW-VALUE REUSED SECTIONS
- Front page: DELETE the "Gate every deploy on a launch decision" CTA reuse section (founder-confirmed).
- Remove anything repeated / filler / weak copy / reused from the old product. Do not preserve weak
  sections because they exist.

## 4. ICON SYSTEM (product-wide audit)
- One consistent library (extend the existing inline stroke set: 2px, round caps/joins, matched sizing;
  brand marks stay Simple Icons). Icons for: all nav items (Applications, Production Passes, Issues,
  Repairs, Deployments, Activity, Team, Organization, API & Webhooks, Plans, Credits, Billing, Account),
  connection kinds (GitHub, Vercel, Railway, Supabase, Stripe, auth, test accounts, specs, requirements,
  environments, security boundaries), statuses (passed / blocked / repair verified / ready), evidence
  (screenshots, browser execution), actions (edit / remove / retry / configure / disconnect).
- No emoji, no mixed styles, no decorative noise. Purposeful empty-state icons instead of blank cards.
- Founder: "a lot of icons work and that's respect, just not enough."

## 5. PRODUCT DEFINITION redesign (connect workspace section 3)
- Kill the one-giant-textarea feel. Progressive disclosure: a new user starts with URL + short product
  summary + original prompt; advanced context (core user goal, roles, critical workflows, data behavior,
  auth expectations, billing expectations, known risks, requirements) expands on demand.
- Keep paste/upload (PRD/README/requirements) + manual requirement + import connected-repo context where
  available + edit discovered requirements before approval. Source cards: source, status, date added,
  discovered requirements, edit action, remove action.

## 6. ACCOUNT / PROFILE
- Custom profile picture: upload, crop/reposition, remove, initials fallback; same avatar in the topbar
  account menu and account settings. Validate formats + max size + safe processing + ownership; private
  storage where appropriate; replacement cleanup; removal cleanup.
- Account page adds: display name, email, profile picture, timezone, notification preferences, security
  and active sessions, connected accounts, account deletion, sign out. NO fake controls: every visible
  setting works or is labeled honestly.
- Topbar account menu: add more useful items (founder: "you could add more things here").

## 7. MORE PRODUCT DEPTH
- Fill thin pages with real data: connection health, last verified deployment, contract coverage, latest
  repair, recent activity, provider status, usage and limits, account security, integration state,
  environment labels, timestamps, clear next actions. Never generic copy or extra white cards.

## RETURN FORMAT
Plan FIRST (before implementation): 1 Pricing recommendation / 2 Navigation and link audit / 3 Sections
recommended for removal / 4 Icon-system audit / 5 Product Definition redesign / 6 Account and profile
expansion / 7 Exact routes and files affected / 8 Migrations and storage changes / 9 Security
implications / 10 Execution order. Then implement in focused commits.

Implementation report: PRICING / REMOVED SECTIONS / NAVIGATION FIXES / ICON SYSTEM / PRODUCT DEFINITION /
PROFILE AND ACCOUNT / SECURITY / TEST RESULTS / COMMITS / DEPLOYMENT STATUS / OPERATOR ACTIONS.

Verify: monthly/yearly toggle, logo destination, Back to site destination, signed-in and signed-out
behavior, icon consistency, Product Definition usability, avatar upload/replace/remove, mobile layout,
keyboard navigation, ownership isolation, loading/empty/error states, tsc, lint, production build, suites.
