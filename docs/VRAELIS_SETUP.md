# Vraelis — setup & what you need to configure

This is the live checklist for turning on the Vraelis backend + payments.
Status legend: ✅ built in code · ⏳ needs you to configure · 🔜 not built yet.

---

## 1. Supabase — REQUIRED for the lead backend ⏳

The lead pipeline, account, and contact form store data in Supabase.

1. Open the Supabase project → **SQL Editor** → New query.
2. Paste the contents of [`sql/vraelis.sql`](../sql/vraelis.sql) → **Run**.
   - Creates: `vraelis_workspaces`, `vraelis_leads`, `vraelis_messages`, `vraelis_contacts`.
   - Safe to re-run (idempotent).

Until this runs, the account page shows empty/no intake key and the intake
API returns "Invalid intake key". After it runs, a workspace + intake key
are auto-created the first time you open `vraelis.com/account`.

---

## 2. Email sending — for AI replies + sales notifications ⏳

The AI **drafts** a reply to every lead and stores it (visible in the
pipeline) even with no email configured. To actually **send** replies to
leads (and email the contact form to sales@), set up a verified sender.

You already have `vraelis.com` on **Brevo** (help@/privacy@/sales@). Two paths:

- **Option A — Resend (code already wired):** add `vraelis.com` (or a
  subdomain like `mail.vraelis.com`) as a domain in Resend → add the
  DKIM/SPF DNS records it gives you in Cloudflare (grey cloud) → set the
  Vercel env var `VRAELIS_FROM_EMAIL="Vraelis <hello@vraelis.com>"`.
- **Option B — Brevo (you already have it):** tell me and I'll switch the
  sender code to Brevo's transactional API; you add `BREVO_API_KEY` to Vercel.

Either way, once `VRAELIS_FROM_EMAIL` (Resend) or Brevo is set, auto-send
turns on with no further code changes.

---

## 3. Stripe — products & prices to create ⏳ (checkout flow 🔜)

Create these in Stripe → Products. Starter is free (no Stripe). Agency is
custom (handled via /contact). After creating, send me the price IDs (or
set them as env vars) and I'll wire Checkout to the pricing buttons.

| Plan | Cycle | Type | Amount |
|---|---|---|---|
| Solo | Monthly | recurring (monthly) | $39 |
| Solo | Yearly | recurring (yearly) | $390 |
| Solo | Lifetime | one-time | $590 |
| Growth | Monthly | recurring (monthly) | $89 |
| Growth | Yearly | recurring (yearly) | $890 |
| Growth | Lifetime | one-time | $1,490 |

Suggested env var names (Vercel):
```
STRIPE_PRICE_VRAELIS_SOLO_MONTHLY=price_...
STRIPE_PRICE_VRAELIS_SOLO_YEARLY=price_...
STRIPE_PRICE_VRAELIS_SOLO_LIFETIME=price_...
STRIPE_PRICE_VRAELIS_GROWTH_MONTHLY=price_...
STRIPE_PRICE_VRAELIS_GROWTH_YEARLY=price_...
STRIPE_PRICE_VRAELIS_GROWTH_LIFETIME=price_...
```
Webhook: a Stripe webhook → `/api/vraelis/stripe/webhook` (🔜 to build) so
paid status flows back to the workspace.

---

## 4. PayPal — plans to create ⏳ (checkout flow 🔜)

- **Subscriptions** (recurring): Solo Monthly, Solo Yearly, Growth Monthly,
  Growth Yearly → create as PayPal billing plans.
- **Lifetime**: one-time PayPal order (not a subscription plan) — Solo $590,
  Growth $1,490.

Suggested env var names mirror Stripe (`PAYPAL_PLAN_VRAELIS_*`). Send the
plan IDs and I'll wire the PayPal buttons.

---

## 5. Revenue cut / compensation 🔜 (later, by your call)

The pricing copy promises a cut of booked revenue (10% / 4% / 2% / from 1%,
higher on lifetime). Actually charging it needs:

1. Recording booked revenue per lead (mark a lead **won** with a $ value —
   the `value` field already exists on `vraelis_leads`).
2. Summing won revenue per workspace per period.
3. Charging the % via Stripe (metered/usage billing or a monthly invoice).

This is its own milestone — we'll build it once base plans + payments work.

---

## Already done ✅
- vraelis.com live (marketing) + `app.vraelis.com` routing (pending your CNAME).
- Auth (Google/GitHub/email), vraelis-branded sign-in, account area.
- Lead loop: hosted form (`/f/<key>`) + webhook (`/api/vraelis/intake`) →
  store lead → Claude drafts reply → (sends when email configured) → pipeline.
- Pricing page with Monthly/Yearly/Lifetime + per-plan cut.
- Contact page (`/contact`) → stores submissions + emails sales@ when configured.
