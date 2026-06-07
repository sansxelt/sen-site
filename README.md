# Vraelis

**The AI that books your leads for you — then collects the payment.**

Vraelis answers every inbound lead in seconds over chat, SMS, and email, qualifies them, books the appointment, takes a deposit, and collects payment on-platform. It only earns when the business does: Vraelis takes a small revenue cut of the payments it helps move, deducted automatically at payment time.

Live at **[vraelis.com](https://vraelis.com)** · [@usevraelis](https://instagram.com/usevraelis)

---

## The problem

Service businesses (detailers, salons, contractors, coaches, tutors) lose most of their leads to slow replies. Whoever answers first wins, and a solo operator on a job can't answer at 11pm. A missed call or an unanswered DM is a missed job — pure lost revenue.

## The solution

Vraelis is an always-on AI front desk:

1. A lead comes in (chat link, SMS, missed call, web form, or widget).
2. Vraelis replies in under a minute, in the business's voice.
3. It qualifies the lead and pushes toward a booking within 1–2 messages.
4. It books the appointment and takes a deposit through Stripe.
5. It follows up on quiet leads and recovers abandoned payments automatically.
6. Money is split at payment: the business gets paid, Vraelis keeps its cut.

The business risks nothing to start (free tier), and Vraelis only makes money when real money moves — a structural, hard-to-game alignment.

---

## Architecture

```
                      ┌──────────────────────── Channels ─────────────────────────┐
   Lead ── chat /f ── │  SMS (Twilio)   Missed call (Twilio)   Web form / widget   │
                      └───────────────┬───────────────────────────────────────────┘
                                      ▼
                        POST /api/vraelis/intake · /intake/continue · /sms/inbound
                                      │  (rate-limited, owner-scoped)
                                      ▼
                          ┌─────────────────────────────┐
                          │  AI qualification (Claude)    │  new → qualifying → booking_ready
                          │  business context + prices    │  injects booking / pay links
                          └────────────┬──────────────────┘
                                       ▼
                 ┌─────────── Booking ───────────┐      ┌──────── Payment ─────────┐
                 │ self-serve slots + Google Cal  │      │ Stripe Connect            │
                 │ deposit-to-book (default on)   │ ───▶ │ destination charge        │
                 └────────────────────────────────┘      │ + application fee (cut)   │
                                                          │ + on_behalf_of (merchant  │
                                                          │   pays processing fee)    │
                                                          └────────────┬─────────────┘
                                                                       ▼
                       Stripe webhook → mark paid → confirm booking → owner payout
                                                                       ▼
                       Automation (Vercel Cron): follow-ups · reminders · payment recovery
```

Data + access: **Supabase (Postgres)** via a server-only service-role client, every query scoped by `owner_email`. All AI / payment / SMS logic runs server-side in Next.js route handlers on Vercel.

---

## Core workflows

**AI** — `lib/vraelis-ai.ts` (Claude `claude-sonnet-4-6`). `continueLeadConversation` takes the full thread + business profile + services/prices and returns `{reply, status, payment}`. Hard rules: no off-platform payment, no collecting card/SSN, quote only owner-set prices, push to booking fast, hand off to a human when unsure.

**SMS** — `lib/vraelis-sms.ts` + `/api/vraelis/sms/inbound` (text → route to workspace by Twilio number → match/create lead → AI reply → text back) and `/sms/voice` (missed-call text-back). SMS reuses the exact same lead, thread, qualification, and pipeline as web chat. Owner gets a text on every new lead.

**Booking** — `lib/vraelis-booking.ts`. Self-serve weekday slots, minus taken slots and Google Calendar busy times. Optional deposit (default on) collects payment before the slot locks. Bookings mirror to Google Calendar.

**Payment** — `lib/vraelis-connect.ts`. Stripe Connect **destination charge**: `application_fee_amount` = Vraelis's cut (taken whole), `on_behalf_of` = the merchant (so Stripe's processing fee comes off their side, not the cut), `transfer_data.destination` = merchant. Webhook (`/api/stripe/webhook`) is idempotent (pending→paid), confirms the booking, advances the lead, and flags `fee_billed` so the cut is never double-charged.

**Revenue-sharing** — cut rates per plan (`lib/vraelis-plans.ts`): Starter 20% (free), Solo 7%, Growth 5%, Agency 1–2% (lifetime tiers higher). Taken at payment via the application fee; dashboard revenue is real processed money, not self-reported.

**Recovery & retention** — Vercel Cron: daily follow-ups on quiet leads, appointment reminders (SMS), and abandoned-payment recovery (regenerates a fresh checkout link and nudges by SMS + email at ~1h/24h/72h tiers).

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, design-token CSS |
| Backend | Next.js route handlers (serverless on Vercel), Vercel Cron |
| Database | Supabase (Postgres), service-role server client |
| Auth | NextAuth v5 (Google, GitHub, email/password), per-host cookie |
| AI | Anthropic Claude (`claude-sonnet-4-6`) |
| Payments | Stripe Checkout + Stripe Connect (destination charges), PayPal |
| SMS / Voice | Twilio (REST) |
| Calendar | Google Calendar API (OAuth) |
| Email | Resend |
| Monitoring | structured logging + optional Sentry forward |

## Security model

- Secrets are server-only; only publishable keys reach the browser (Stripe publishable, PayPal client id, Supabase URL).
- Payments via Stripe — no card data stored. HTTPS everywhere (Vercel).
- Tenant isolation: every query scoped by `owner_email` (service-role bypasses RLS).
- Public endpoints rate-limited (Postgres fixed-window) against spam / AI-cost abuse.
- AI guardrails: never collects sensitive data, never moves payment off-platform.
- Legal: Privacy / Terms / Refunds pages; AI-output disclosure.

---

## Deployment

Deployed on Vercel. `proxy.ts` (middleware) maps clean public paths to the internal `/v` route group and redirects `/v/*` back to clean URLs. Cron jobs are declared in `vercel.json`.

```bash
vercel deploy --prod
```

Run `sql/vraelis.sql` once in the Supabase SQL editor (idempotent) to create all tables, columns, functions, and indexes.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the variables below
npm run dev                  # http://localhost:3000
```

> On Windows, `next build` can segfault (pdf-parse + Turbopack). The Vercel/Linux build is clean; use `npx tsc --noEmit` to typecheck locally.

## Environment variables

```
# Core
NEXT_PUBLIC_SUPABASE_URL=        SUPABASE_SERVICE_ROLE_KEY=
NEXTAUTH_SECRET=                 ANTHROPIC_API_KEY=
RESEND_API_KEY=                  VRAELIS_FROM_EMAIL=

# Auth providers
GOOGLE_CLIENT_ID=  GOOGLE_CLIENT_SECRET=   GITHUB_ID=  GITHUB_SECRET=

# Payments
STRIPE_SECRET_KEY=  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=  STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_PAYPAL_CLIENT_ID=

# Automation
CRON_SECRET=   INBOUND_SECRET=

# SMS / voice (Twilio)
TWILIO_ACCOUNT_SID=  TWILIO_AUTH_TOKEN=  TWILIO_PHONE_NUMBER=  TWILIO_INBOUND_SECRET=

# Calendar (Google — free, no billing)
GOOGLE_CALENDAR_CLIENT_ID=  GOOGLE_CALENDAR_CLIENT_SECRET=

# Monitoring (optional)
SENTRY_DSN=
```

## Demo

1. **vraelis.com** → "Start free" → sign in.
2. **Setup → Your business**: name, what you do, services/prices.
3. **Money → Payouts → Set up payouts** (Stripe Connect); turn on a deposit.
4. Open your chat link (`/f/<key>`) and play a lead — the AI qualifies, offers a time, sends a deposit link.
5. Pay the deposit → it shows as real revenue, cut taken automatically.
6. Text the Twilio number → the same AI handles it over SMS.

## Screenshots

`docs/screenshots/` — `dashboard.png` · `chat.png` · `pricing-calculator.png` · `booking.png` · `payouts.png` *(placeholders)*

## Roadmap

- Abandoned-payment analytics + A/B-tested recovery copy
- Reschedule/cancel flow with calendar sync
- Per-business Twilio number provisioning (subaccounts) for scale
- **Vraelis Intelligence Engine** — proprietary qualification/booking model trained on conversation + outcome data

## Contributors

Built by the Vraelis team (solo founder + AI pair-engineering).

---

*Vraelis replies are AI-generated and may contain mistakes. Vraelis is a tool — businesses are responsible for their own services and customers.*
