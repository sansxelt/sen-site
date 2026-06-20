# Vraelis — Product & Technical Build Plan

> **Vraelis is a human preference engine for creative content.**
> Upload your options. Real people vote. Vraelis tells you what to launch.

This document is the working blueprint for building Vraelis end-to-end, grounded in the
**existing repo's stack** (Next.js 16 + Supabase + Stripe + NextAuth on Vercel). We are NOT
starting from scratch — auth, Stripe (subs + one-time + webhooks), Supabase, and the design
system already exist from the prior product. Reuse them.

---

## 0. The one thing that matters most

This is a **two-sided marketplace**: buyers (who pay) and voters (who supply judgments).
The website is the easy 40%. **Voter supply + quality is the hard 60%** and the real moat.
Every technical decision below is in service of: *trustworthy human judgments, at volume,
that buyers will pay for again.* Build the buyer side to be sellable on day one with a small,
hand-recruited voter pool; harden voter quality before scaling.

---

## 1. Product Requirements Document (PRD)

### Vision
Short-term: A/B testing for creative decisions, powered by real human feedback.
Long-term: the **preference layer** that lives inside Discord, AI tools, design tools, and APIs —
"Add human preference testing to your product with one API."

### Positioning
- Buyers: *Test which creative real people prefer before you launch.*
- AI tools: *Add human preference testing to your product with one API.*
- Never lead with "we sell AI training data" (true later, toxic as positioning).

### Personas
1. **Creator/Indie** (Free→Creator): YouTubers, TikTokers, game devs, designers testing thumbnails/icons/logos occasionally.
2. **Brand/Studio/Agency** (Pro→Scale): teams testing ads, product images, UI, landing pages with audience targeting + exports.
3. **AI/Tool builder** (Scale→Enterprise): wants the API/SDK to add "Test with Vraelis" to their product.
4. **Voter**: a real person who votes for points/credits/rewards (and later payouts). Supply side.
5. **Admin/Operator**: us — routing tests, moderating voters, monitoring quality, support.

### The core loop
`Buyer creates test (2–8 options) → pays in credits → test routed to voters →
voters judge (+ optional reasons) → quality filter → report generated → buyer decides.`
**1 credit = 1 valid human judgment.** A 100-voter test on 4 options costs 100 credits.

### Categories (broad — not just Roblox)
thumbnail · YouTube/TikTok · ad · logo · game icon · app icon · UI design · product image ·
landing page hero · AI image · brand name · text/hook · banner · profile picture · gamepass/shop icon · other.

### Audiences
general · gamers · creators · designers · Gen Z · shoppers · entrepreneurs · custom community.

### Internal product names
- **Vraelis Rank** — the core web testing product (MVP).
- **Vraelis Bot** — Discord/community testing (Phase 3).
- **Vraelis API** — developer/AI-tool product (Phase 5).
- **Vraelis Studio** — team/agency dashboard (Phase 4).
- **Vraelis Pulse** — trend/taste insights (later).

### MVP feature list (build this first)
**Buyer:** landing → auth (✅ exists) → create test → upload 2–8 options → pick category →
pick audience → pick vote count → checkout/credits → see credit balance → results page → basic report.
**Voter:** join → vote queue → pick preferred option → optional reason → earn points/credits.
**Payments:** Stripe one-time test packs + credit packs + subscriptions; credit balance; deduct on launch;
add-on purchases; basic plan limits.
**Results:** winner, vote %, vote count, comments, one simple score, basic recommendation.
**Ops:** admin dashboard, manual voter routing at first.
**Explicitly out of MVP:** Discord bot, public API, SDK, browser extension, AI-generated creative,
white-label, advanced multi-score reports, custom voter pools, data marketplace.

---

## 2. User roles & flows

### Roles
`buyer`, `voter` (a user can be both), `admin`. Stored on `profiles.roles` (array). Auth is email-based
via NextAuth Google; `profiles.user_id = lowercased email` (matches the existing repo convention).

### Buyer flow
1. Sign up / sign in (Google).
2. New Test wizard: **(a)** category → **(b)** upload 2–8 options (images, or text for brand-name/hook) →
   **(c)** title + context → **(d)** audience → **(e)** votes target (e.g. 50/100/300) → **(f)** add-ons.
3. Price preview: `credits needed = votes_target` + add-on $$. Show balance and the 3 ways to cover it
   (use credits / buy credit pack / buy one-time test pack / upgrade).
4. Pay / confirm → credits are **held** (escrow) and the test goes `active`.
5. Watch progress (votes_collected / target). Get notified at completion.
6. Results report → decide. Re-run or export.

### Voter flow
1. Join (Google, or via Discord later). Lightweight onboarding (a few taste/demographic questions →
   feeds audience targeting + a starter reputation).
2. Vote queue: see a test, pick the preferred option, optionally answer "why" (one line).
3. Quality gates run invisibly (min time-on-task, attention checks, dup/device checks).
4. Earn points → convert to test credits (vote-to-earn) and badges/leaderboard; payouts later.
5. Their valid judgments become Vraelis preference data.

### Admin flow
Route/approve tests to voter segments, monitor quality dashboards, moderate/ban voters,
issue refunds/credits, view revenue + usage, manage the catalog (plans/packs/add-ons/audiences).

---

## 3. Database schema (Postgres / Supabase)

Conventions match the existing repo: service-role access server-side, tables prefixed `v_` for the new
product (so they never collide with the legacy `flip_*`/`vraelis_*` tables; archive those separately).
All ids `uuid default gen_random_uuid()`; `user_id text` = lowercased email.

```sql
-- IDENTITY / ACCOUNTS ---------------------------------------------------------
create table v_profiles (
  user_id        text primary key,          -- lowercased email
  display_name   text,
  roles          text[] not null default '{buyer}',  -- buyer | voter | admin
  stripe_customer_id text,
  created_at     timestamptz not null default now()
);

create table v_subscriptions (
  user_id          text primary key references v_profiles(user_id),
  plan             text not null default 'free',   -- free|starter|creator|pro|scale|enterprise
  status           text not null default 'active', -- active|past_due|canceled
  cycle            text,                            -- monthly|yearly
  stripe_subscription_id text,
  monthly_credits  int not null default 0,
  current_period_end timestamptz,
  updated_at       timestamptz not null default now()
);

-- CREDITS: append-only ledger is the source of truth -------------------------
create table v_credit_ledger (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null references v_profiles(user_id),
  delta       int not null,                  -- + grant, - spend
  reason      text not null,                 -- monthly_reset|pack|test_pack|hold|spend|refund|reward|bonus
  ref_type    text,                          -- test|payment|vote
  ref_id      uuid,
  bucket      text not null default 'purchased', -- monthly (expires on reset) | purchased (persists)
  expires_at  timestamptz,                   -- set for monthly bucket
  created_at  timestamptz not null default now()
);
create index on v_credit_ledger (user_id, created_at desc);
-- balance(user) = sum(delta) where (expires_at is null or expires_at > now())
-- spend monthly bucket first, then purchased (so non-expiring credits are preserved).

-- TESTS -----------------------------------------------------------------------
create table v_tests (
  id             uuid primary key default gen_random_uuid(),
  user_id        text not null references v_profiles(user_id),
  title          text not null,
  context        text,
  category       text not null,
  audience       text not null default 'general',
  visibility     text not null default 'public',  -- public|private|pool
  status         text not null default 'draft',   -- draft|active|complete|canceled
  votes_target   int not null,
  votes_valid    int not null default 0,
  credits_held   int not null default 0,
  addons         jsonb not null default '[]',     -- ["written_feedback","advanced_report",...]
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index on v_tests (user_id, created_at desc);
create index on v_tests (status, audience);   -- voter routing

create table v_test_options (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references v_tests(id) on delete cascade,
  position    int not null,                  -- A=0,B=1,...
  asset_url   text,                          -- Supabase Storage URL (image) ...
  label       text,                          -- ...or text option (brand name / hook)
  created_at  timestamptz not null default now()
);

-- JUDGMENTS (votes) -----------------------------------------------------------
create table v_judgments (
  id            uuid primary key default gen_random_uuid(),
  test_id       uuid not null references v_tests(id) on delete cascade,
  voter_id      text not null,               -- v_profiles.user_id or 'discord:<id>'
  option_id     uuid not null references v_test_options(id),
  reason        text,
  scores        jsonb,                        -- per-judgment signals (clarity/trust...) when collected
  time_spent_ms int,
  source        text not null default 'web',  -- web|discord|api_pool
  status        text not null default 'valid',-- valid|rejected (quality)
  reject_reason text,
  created_at    timestamptz not null default now(),
  unique (test_id, voter_id)                  -- one judgment per voter per test
);
create index on v_judgments (test_id) where status='valid';

-- REPORTS ---------------------------------------------------------------------
create table v_reports (
  test_id        uuid primary key references v_tests(id) on delete cascade,
  winner_option_id uuid,
  results        jsonb not null,              -- percentages, scores, summaries, recs (see §13)
  generated_at   timestamptz not null default now()
);

-- PAYMENTS / CATALOG ----------------------------------------------------------
create table v_payments (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null,
  stripe_id    text,                          -- session/payment_intent/invoice
  kind         text not null,                 -- subscription|test_pack|credit_pack|addon
  sku          text,                          -- quick_test|pack_500|written_feedback...
  amount_cents int,
  credits      int not null default 0,
  status       text not null default 'paid',
  created_at   timestamptz not null default now()
);

-- VOTER QUALITY / REPUTATION --------------------------------------------------
create table v_voter_quality (
  voter_id     text primary key,
  reputation   numeric not null default 0.5,  -- 0..1
  accuracy     numeric,                        -- agreement w/ consensus / gold tasks
  judgments    int not null default 0,
  rejected     int not null default 0,
  flags        jsonb not null default '{}',
  banned       boolean not null default false,
  updated_at   timestamptz not null default now()
);

create table v_voter_attributes (   -- audience targeting
  voter_id   text not null,
  attribute  text not null,          -- gamer|designer|gen_z|shopper|entrepreneur|creator...
  verified   boolean not null default false,
  primary key (voter_id, attribute)
);

-- DEVELOPER / EXTENSIONS (later phases) --------------------------------------
create table v_api_keys (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null,
  key_hash   text not null unique,            -- store hash only
  prefix     text not null,                   -- shown in UI, e.g. vr_live_ab12
  scopes     text[] not null default '{tests:write,tests:read}',
  last_used  timestamptz,
  created_at timestamptz not null default now()
);
create table v_webhooks (
  id        uuid primary key default gen_random_uuid(),
  user_id   text not null,
  url       text not null,
  secret    text not null,
  events    text[] not null default '{test.completed}',
  created_at timestamptz not null default now()
);
create table v_discord_links (
  guild_id   text primary key,
  user_id    text not null,                   -- Vraelis account that owns the server's tests
  channel_id text,
  created_at timestamptz not null default now()
);
```

**Anti-abuse columns** live alongside judgments (ip/device hashing handled in code, not stored raw).
Storage: Supabase Storage bucket `v-assets` (or Vercel Blob) for uploaded option images; signed URLs.

---

## 4. Stripe / payment implementation plan

Reuse the existing Stripe client (`lib/stripe`), the webhook route, and the embedded-checkout pattern
we just built (`ui_mode: "embedded_page"`). Add Vraelis-specific SKUs and a credit engine.

### Stripe objects to create (your manual task — see end)
- **Subscriptions** (recurring prices, monthly + yearly): Starter $19/$190, Creator $49/$490,
  Pro $149/$1490, Scale $399/$3990. (Free = no Stripe object.) Put `monthly_credits` in price metadata.
- **One-time test packs** (one-time prices): Quick $19, Creator $39, Launch $99, Pro $199, Studio $499 —
  with `credits` in metadata.
- **Credit packs** (one-time): 100/$9, 500/$39, 1000/$69, 5000/$299, 10000/$499 — `credits` in metadata.
- **Add-ons**: mostly per-test one-time prices (Written $15, Advanced $29, Priority $20, AI $9, Benchmark $49,
  Private Pool $49, Targeting $10–49). Recurring add-ons: White-label $99/mo, Discord $19/mo.

Store the mapping `SKU → price_id` in env (`STRIPE_PRICE_<SKU>`), resolved server-side exactly like the
current checkout route does — so adding a SKU = create price + add env, no code change.

### Flows
- **Embedded checkout** (`/v/checkout`): for any SKU (subscription, pack, add-on). Returns `client_secret`,
  mounts on-site. Already the pattern.
- **Customer portal**: Stripe Billing Portal for plan change / cancel / invoices. One route + a button.
- **Webhook** (extend the existing `/api/stripe/webhook`):
  - `checkout.session.completed` / `invoice.paid` → grant credits (write `v_credit_ledger`), set plan,
    record `v_payments`. Idempotent on the Stripe event id.
  - `customer.subscription.updated/deleted` → update `v_subscriptions.status/plan`.
  - `customer.subscription` renewal (`invoice.paid`, `billing_reason=subscription_cycle`) →
    monthly credit reset (expire old monthly bucket, grant fresh `monthly_credits`).
  - `invoice.payment_failed` → mark `past_due`, email, grace, then downgrade.

### Failed-payment handling
`past_due` keeps the account read-only-ish (can't launch new tests, can still view reports) until resolved;
auto-downgrade to Free after the grace window; never delete data.

---

## 5. Credit system logic

**Source of truth = `v_credit_ledger` (append-only).** Never store a mutable integer balance as the truth
(cache it for reads if needed, but recompute from the ledger).

```
balance(user) = Σ delta where (expires_at is null or expires_at > now())
```

Two buckets:
- **monthly** — granted on subscription renewal, `expires_at = next period end`. Resets each cycle.
- **purchased** — credit packs, test packs, rewards. **Do not expire** (or long expiry, e.g. 12mo).

**Spend order:** monthly first, then purchased (preserve the credits the user paid cash for).

### Launch = escrow (hold), not immediate burn
1. On launch: require `balance >= votes_target`. Write a `hold` ledger row (`delta = -votes_target`,
   `reason='hold'`, `ref=test`). `v_tests.credits_held = votes_target`, status `active`.
2. As **valid** judgments land, they consume the hold (accounting only — the hold already debited).
3. On completion: if `votes_valid < votes_target` (couldn't fill), **refund the difference** (positive ledger row).
4. On cancel before completion: refund the unfilled remainder.
5. **Rejected votes (quality fail) never consume the hold** and never charge the buyer.

This guarantees: buyers only ever pay for *valid* judgments actually delivered; partial fills auto-refund.

### Earning (voter side / vote-to-earn)
Valid judgment → points; points → credits at a fixed rate (e.g. 10 points/credit), capped/abuse-protected.
Reputation-weighted (low-rep voters earn less / are sampled less). Free-plan signup grant = small, one-time,
device/abuse gated.

---

## 6. Plan & add-on enforcement

A single server-side `entitlements(user)` resolver reads `v_subscriptions.plan` → returns limits.
Enforce at the action boundary (create test, launch, add-on, API call), never trust the client.

| Plan | monthly credits | active tests/mo | options/test | targeting | API | Discord | white-label | seats |
|---|---|---|---|---|---|---|---|---|
| Free | 25 one-time | 1 | 2–4 | – | – | – | – | 1 |
| Starter | 150 | 3 | 2–5 | – | – | – | – | 1 |
| Creator | 500 | 10 | 2–6 | basic | – | – | – | 1 |
| Pro | 2,000 | 30 | 2–8 | ✅ | – | ✅ | – | small team |
| Scale | 7,500 | 100 | 2–8 | ✅ | ✅ | ✅ | ✅ | seats |
| Enterprise | custom | custom | 2–8 | ✅ | ✅ | ✅ | ✅ | custom |

Add-ons are per-test purchases that flip features on for that test (`v_tests.addons`), independent of plan
(e.g. a Starter user can buy Written Feedback for one test). Recurring add-ons (white-label, Discord) set a
flag on the subscription. Gate every premium report field/score behind the relevant entitlement or add-on.

---

## 7. App surfaces — Dashboard structure

Routes under a clean prefix (reuse the proxy clean-URL pattern). `/` = marketing; app behind auth:

```
/                      landing (marketing)
/pricing               plans + packs + add-ons (toggle monthly/yearly/lifetime style)
/how, /examples        marketing
/login, /signin        auth (✅)
/app                   dashboard home: balance, active tests, recent results, CTA "New test"
/app/new               create-test wizard (category→upload→context→audience→votes→add-ons→pay)
/app/tests             list (filters: active/complete/draft)
/app/tests/[id]        live progress
/app/tests/[id]/report results report (the value)
/app/credits           balance, ledger history, buy credit packs, buy test packs
/app/billing           plan, change/cancel (Stripe portal), invoices
/app/projects          (Phase 4) brands/projects grouping
/app/team              (Phase 4) seats/roles
/app/api-keys          (Phase 5) keys + webhooks + usage
/app/settings          profile, audiences, notifications
/checkout              embedded Stripe checkout (✅ pattern)
/vote                  VOTER app: queue, vote UI, points/leaderboard, rewards
```

## 9. Admin panel structure (`/admin`, role-gated)
```
/admin                 KPIs: revenue, MRR, tests today, fill rate, voter supply, quality flags
/admin/tests           all tests; route to audiences; force-complete; refund
/admin/voters          reputation, accuracy, flags, ban/unban, manual verify attributes
/admin/quality         rejected-vote stream, anomaly alerts, gold-task accuracy
/admin/payments        payments, refunds, credit adjustments (writes ledger)
/admin/catalog         plans/packs/add-ons/audiences (SKU↔price mapping health check)
/admin/support         user lookup, impersonate-read, manual credit grants
```

---

## 10. API route structure

Internal app routes (`/api/...`) + the **public Vraelis API** (`/api/v1/...`, API-key auth, Phase 5).

```
# internal (session auth)
POST /api/tests                 create draft
POST /api/tests/[id]/options    upload option (returns signed URL or accepts blob)
POST /api/tests/[id]/launch     escrow credits + activate (entitlement + balance check)
POST /api/tests/[id]/cancel     refund remainder
GET  /api/tests/[id]/report     report json
POST /api/checkout              embedded session for any SKU (✅ pattern)
POST /api/credits/purchase      credit/test pack checkout
GET  /api/me                    profile, plan, balance, entitlements
POST /api/vote                  voter submits a judgment (quality-checked)
GET  /api/vote/next             next test for this voter (routing + audience)
POST /api/stripe/webhook        Stripe events (✅, extend)

# public API v1 (X-Api-Key) — Phase 5
POST /api/v1/tests              create + set options + audience + votes
GET  /api/v1/tests/{id}         status + results
POST /api/v1/tests/{id}/launch
GET  /api/v1/credits            balance
POST /api/v1/webhooks           register; emits test.completed
# usage metered → Stripe metered billing for Scale+/usage-based
```

---

## 11. Discord bot plan (Vraelis Bot — Phase 3)

- Hosted as a small always-on service (Railway/Fly/render) using `discord.js`; talks to the same Supabase +
  the Vraelis API. Verified server links via `v_discord_links`.
- Commands: `/vraelis test` (upload 2–8 images, title, votes) → posts an embed with **A/B/C buttons** +
  a "💬 reason" modal. Votes write `v_judgments` (`source='discord'`, `voter_id='discord:<userid>'`).
- On completion → posts a result summary embed + link to the full web report.
- Strategic value: distribution. Communities run free/cheap tests → Vraelis spreads through creator/gaming/
  design servers → those servers become a **voter pool**. Bot access gated to Pro+ or $19/mo add-on.
- Quality: Discord voters get their own reputation; dedupe by Discord user id; rate-limit per server.

### Embeddable widget / SDK (Phase 5)
A `<script>`/iframe "Test with Vraelis" button other apps drop in; backed by API v1 + an embed token.
This is how Vraelis becomes infrastructure ("any tool that generates content can add Test with Vraelis").

---

## 12. Voter quality & anti-abuse plan (the moat)

Layered defense — no single check is enough:
1. **Identity friction**: Google/Discord login; one account per identity; device+IP hashing to catch farms.
2. **Attention/effort**: min time-on-task per judgment; reject sub-threshold; randomize option order (kill
   position bias); occasional **gold tasks** (known-answer) to measure accuracy.
3. **Consensus accuracy**: a voter's agreement with the eventual consensus feeds `reputation`/`accuracy`.
   Persistent outliers/contrarian-randoms get down-weighted, then sampled out.
4. **Dedup & velocity**: `unique(test_id, voter_id)`; per-window rate limits; flag bursts.
5. **Comment quality**: length/lang/duplicate/templated checks on "why" answers; low-quality → no reward,
   not shown in report.
6. **Reputation-weighted sampling & pay**: high-rep voters seen more, earn more; new voters start neutral
   and earn trust. Buyers can pay for "verified/high-rep pool" (add-on).
7. **Audience verification**: self-declared attributes start unverified; verify over time via behavior /
   light proof; targeting prefers verified voters.
8. **Bot protection**: hCaptcha/Turnstile on voter signup + suspicious sessions; honeypots.
9. **Charge integrity**: rejected votes never charge the buyer (§5) — so quality failures cost *us*, which
   aligns our incentives with buyers' trust.

Operate a **quality dashboard** (`/admin/quality`) from day one even with manual routing.

---

## 13. Results / report generation logic

A report is generated when a test completes (target filled or closed). Stored in `v_reports.results` (jsonb).

### Inputs
Valid judgments (option choices, reasons, per-judgment scores), reputation weights, audience tags.

### Computation
- **Winner + vote %**: reputation-weighted tally per option; Wilson/Bayesian interval for stability.
- **Confidence score**: from sample size + margin between top options (don't over-claim on small n).
- **Score dimensions** (Phase 2; collected via quick voter sub-questions or model-assisted on the assets):
  clickability, trust, clarity, "looks fake/AI" (when relevant). 0–100, with audience breakdown.
- **Comment summarization** (LLM, the existing Anthropic setup): cluster the "why" reasons into
  *top reasons the winner won* and *weaknesses of the losers* — quote real voter comments.
- **Improvement suggestions / AI recommendations** (add-on): feed winner + comments + the images to the
  model → concrete edits ("increase contrast around the subject, cut the small text").
- **Launch recommendation**: a clear call ("Use Option C") + the caveat.

### Example output (the buyer's payoff)
> **Option C won with 62%.** Voters said it looked clearer, more premium, easier to understand.
> Option A had stronger colors but felt cluttered. **Recommendation:** use C, but increase contrast
> around the subject and reduce the small text. *(Confidence: high · 100 judgments · gamers audience.)*

Gate dimensions/summaries/AI recs behind plan/add-on entitlements (§6).

---

## 14. Launch roadmap

| Phase | Goal | Build |
|---|---|---|
| **1 — MVP web** (wk 1–3) | buyers pay + test with real voters | Rank web app, payments+credits, voting page, results, admin, manual routing |
| **2 — Better reports** (wk 4 / mo2) | feel valuable, not a poll | score dimensions, comment summarization, AI suggestions, exportable report |
| **3 — Discord bot** (mo2) | distribution + voter supply | `/vraelis test`, vote buttons, server tests, result summaries |
| **4 — Teams/subs** (mo3) | recurring revenue | projects/brands, seats, saved audiences, white-label export, portal |
| **5 — API/SDK** (mo4–6) | become infrastructure | API v1, keys, webhooks, embed widget, metered billing |
| **6 — Data** (mo6–12) | the big business | anonymized preference datasets, licensing to AI tools |

**Concrete first sprint (the next 2 weeks, in THIS repo):**
1. Archive the Flip listing code; point `/` at the new Vraelis Rank landing (reuse the proxy pattern).
2. Ship `v_*` schema + `entitlements`/`credits` engine (ledger + escrow) + extend the Stripe webhook for credits.
3. Create-test wizard + Supabase Storage uploads + launch (escrow) + a public voting page (`/vote`) writing `v_judgments`.
4. Minimal report (winner, %, count, comments) + `/app` dashboard with balance.
5. Hand-recruit 30–100 voters (your Discord/community) → run free beta tests → first paid one-time test.

### Revenue path (intended, not guaranteed)
Mo1 $100–500 (hand-sold one-time tests) → Mo2 $500–2k → Mo3 $1–5k MRR → Mo6–12 $10k+/mo if API + teams + B2B land.

---

## 15. Recommended tech stack (reuse what exists)

| Concern | Choice | Status |
|---|---|---|
| Framework | Next.js 16 App Router + React 19 + TS | ✅ in repo |
| Hosting | Vercel | ✅ |
| DB | Supabase Postgres (raw `@supabase/supabase-js`, service-role server-side) | ✅ |
| Auth | NextAuth v5 (Google) | ✅ |
| Payments | Stripe (subs + one-time + embedded checkout + webhooks + portal) | ✅ pattern built |
| Storage | Supabase Storage (or Vercel Blob) for option images | add |
| AI (reports) | `@anthropic-ai/sdk` (comment summary, AI recs) | ✅ in repo |
| Design system | existing light/green `.wrap/.section/.display/.em` CSS | ✅ |
| Discord bot | `discord.js` on a small always-on host (Railway/Fly) | Phase 3 |
| Bot/queues | Supabase + cron/edge functions for routing + report gen | add |
| Anti-bot | Cloudflare Turnstile / hCaptcha | add |

**Do NOT add a heavy backend, a second framework, or a microservice mesh.** One Next.js app + Supabase +
Stripe carries you to real revenue. Add the bot/host only at Phase 3.

---

## Manual tasks for you (founder) — do these in parallel with the build
1. **Stripe**: create the subscription prices (monthly+yearly), the 5 test packs, the 5 credit packs, and the
   per-test add-on prices. Send me each `price_id` (or set `STRIPE_PRICE_<SKU>` envs).
2. **Supabase**: confirm we reuse the existing project (run the `v_*` schema) or spin a fresh one.
3. **Voter seed**: line up 1–3 Discord/creator/design communities you can recruit the first 50–100 voters from.
   This is the make-or-break input.
4. **Discord app** (Phase 3): create a Discord application + bot token when we get there.
5. **Decide**: fully replace the Flip listing product at vraelis.com with Vraelis Rank (recommended), or keep it parked.
