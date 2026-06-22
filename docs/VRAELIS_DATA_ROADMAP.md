# Vraelis Data Architecture & Enterprise Roadmap

Planning artifact. No infrastructure was changed to produce this. Grounded in a
parallel audit of the real codebase (schema in `sql/vraelis-rank.sql`, `lib/v-*`,
`app/api/v1/*`, `app/api/v/*`, `proxy.ts`, `next.config.ts`).

**Headline decision:** keep Supabase/Postgres as the transactional database. Do
**not** integrate Databricks, BigQuery, Snowflake, ClickHouse, clean rooms,
cross-customer benchmarks, or ML pipelines now. The cheapest way to become a
credible *data product* is Postgres event tracking + a real `/app/data`.

---

## Build order (one prompt at a time)

1. **`v_events` table** — append-only event log in Postgres (the foundation).
2. **Customer analytics on `/app/data`** — make the data page useful, not decorative.
3. **API usage analytics** — per-key call counts, latency, errors; a developer view.
4. **Export tiers** — Free summary / Pro standard / Scale dataset+quality / Enterprise cohorts.
5. **Audit logs** — admin/account/security actions recorded as `v_events` (actor = admin/system).
6. **Admin quality dashboard** — expand `/app/admin` beyond vote review.
7. **Account / data-request workflow** — finish the deferred deletion + "export my data".
8. **Team / project structure** — folders, projects, seats (multi-user accounts).
9. **Enterprise-only data features** — retention policies, RLS, governed preference exports.
10. **Databricks / warehouse** — only if real volume or an enterprise customer asks.

Steps 1–4 are the near-term value. 5–8 are enterprise-credibility. 9–10 are gated
behind actual enterprise demand.

---

## 1. Current data model summary

Thirteen core tables, plus derived/computed layers. All access is app-layer scoped
by `user_id` (no Supabase RLS today; service-role admin client + code-level `.eq`).

| Object | Stores | Sensitivity |
|---|---|---|
| `v_profiles` | user_id (lowercased email, PK), display_name, roles[], stripe_customer_id | sensitive |
| `v_subscriptions` | plan, status, cycle, stripe_subscription_id, monthly_credits, current_period_end | sensitive |
| `v_credit_ledger` | append-only ±delta, reason, ref_type/ref_id, bucket, expires_at, ext_ref (idempotency) | sensitive |
| `v_tests` | title, context, category, audience, visibility, status, votes_target/valid, credits_held, share_token, share_enabled | internal |
| `v_test_options` | position (A–H), asset_url, label, asset_path, mime_type, size_bytes | public |
| `v_judgments` | voter_id, option_id, reason (comment), time_spent_ms, status, reject_reason, ip_hash, device_hash, unique(test_id,voter_id) | sensitive |
| `v_reports` | winner_option_id, results jsonb (ranked, comments, analysis), generated_at | internal |
| `v_payments` | stripe_id (dedup), kind, sku, amount_cents, credits, status | sensitive |
| `v_api_keys` | key_hash (SHA-256), prefix, scopes[], name, last_used | sensitive |
| `v_webhook_endpoints` | url, secret (plaintext HMAC key), enabled, event_types[], failure_count | sensitive |
| `v_webhook_deliveries` | status, response_status, attempts, payload, next_retry_at, unique(endpoint,test,event) | internal |
| `v_voter_rep` | voter_id, valid, rejected counts | internal |
| Storage `vraelis-test-assets` | public-read creative assets (image/video) | public |

Computed layers: `v-quality.ts` (vote verdicts), `v-export.ts` (the safe export
builder), `v-entitlements.ts` (plan → feature gates).

**Notable schema gaps worth filling later:** no `archived`/soft-delete on tests; no
`credits_refunded` amount on tests; no voter identity/signup table (voters only
exist as ids inside `v_judgments`); no `score`/accuracy on `v_voter_rep`; no
`expires_at`/`revoked` on API keys; no per-key rate-limit config.

---

## 2. What data is valuable (the actual product)

Vraelis does not sell votes. It sells **decisions with evidence**. The valuable data:

- **Valid human judgments** — the core unit (`1 credit = 1 valid judgment`).
- **Winner + margin + confidence** — the answer, with how sure.
- **Reasons (comments)** — *why* people chose, the part screenshots sell.
- **Quality-aware results** — valid vs filtered, and the filter reasons.
- **Structured exports** (JSON/CSV) and **API/webhook automation** — the data becomes a feed.
- **Category/audience signal over time** — "thumbnails win on contrast," benchmarks (later, privacy-safe).

Internal definitions to standardize:
- *Raw vote* = one `v_judgments` row (valid or rejected).
- *Valid judgment* = `status='valid'` (counts toward target, earns reward, billed).
- *Filtered judgment* = `status='rejected'` + `reject_reason` (held the slot, not billed, not counted).
- *Test result* = `v_reports.results` (ranked + winner + analysis).
- *Report* = the customer-facing render of a result (+ optional public share).
- *Export* = the safe-field projection from `v-export.ts`.
- *Preference dataset* = anonymized voter-level judgments (a future Scale+ export).
- *Customer-visible* = report-level + aggregated quality.
- *Internal-only* = voter ids, ip/device hashes, billing internals, key hashes, webhook secrets.

---

## 3. What data is sensitive (never in public reports or exports)

The export builder already excludes these (verified in `v-export.ts` lines 2–4, and
ownership/status checks in `exportResponse`). Keep this list authoritative:

- Owner email / `user_id`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_id`.
- Individual `voter_id`s and any attribution of a comment to a voter.
- `ip_hash` / `device_hash` (raw signals) — only **aggregated** filter counts may leave.
- `v_credit_ledger` internals (`ext_ref`, `ref_id`), `amount_cents`.
- `v_api_keys.key_hash`, `v_webhook_endpoints.secret`, webhook `payload`.
- `share_token` (the capability is the secret), `asset_path` (Storage internal; the public `asset_url` is fine).
- Admin/entitlement fields.

Public report (`/r/<share_token>`) is read-only and token-gated; it shows a subset of
the report only. This is correct today.

---

## 4. Analytics to add now in Postgres (before any warehouse)

Two surfaces matter: **customer-facing** (`/app/data`, report, dashboard) and
**internal** (`/app/admin`). Most of these are already queryable from existing tables.

**Customer-facing (`/app/data` + report):**
- Test completion rate, time-to-fill (`completed_at − created_at`).
- Valid vs filtered rate, and the filter-reason breakdown (already in `voteStats`/report).
- Win-margin and confidence distribution across your tests.
- Comments per test, credits spent per test (from `v_credit_ledger` holds).
- Most-tested categories, recent winners (already on `/app/data`).
- API usage + webhook delivery success (once `v_events` exists) — on a developer view.

**Internal admin (`/app/admin`):**
- Revenue (MRR/ARR) from `v_payments` + `v_subscriptions`.
- Free→paid conversion, upgrade/downgrade funnel, churn (subscription status transitions).
- Voter supply: unique voters/week, votes per voter, reputation distribution.
- Rejection-rate by reason (already 7-day in `voteStats`), platform vote fill rate.
- Storage/bandwidth (`SUM(v_test_options.size_bytes)`).

**The missing primitive:** there is **no `v_events` / audit table**. Everything is
inferred from mutations. Adding an append-only event log unlocks funnels, retention,
API metering, and audit logs in one move. Proposed taxonomy:

```
signup, test_created, test_launched, vote_recorded, vote_filtered,
test_completed, report_viewed, public_report_enabled, export_downloaded,
api_key_created, api_request_made, webhook_delivered, checkout_started,
checkout_completed, credits_spent, credits_returned
```

`v_events` shape (safe fields only — never raw keys, secrets, full payment details,
or raw ip/device): `id, ts, type, actor_type (owner|voter|api|webhook|system),
user_id (nullable/where safe), test_id (nullable), source/route, metadata jsonb`.

---

## 5. Export tiers to add

Current export (one tier) is solid and safe. Proposed tiering:

| Tier | Plan | Adds | Customer-safe |
|---|---|---|---|
| Test summary | Free | id/title/category/status/winner+pct only | yes |
| Standard results (current) | Pro | full report: ranked options, comments, analysis, quality summary | yes |
| Quality & filtered summary | Scale | filter breakdown, reputation buckets (anonymized), quality score | yes |
| Preference dataset (JSONL) | Scale | anonymized voter-level judgments (voter_hash, option, time, status) | gated/contractual |
| Account usage export | Scale | webhook deliveries + API call volume + rate-limit usage (from `v_events`) | yes |
| Cohort/segment analysis | Enterprise | audience-cohort agreement, geo/time patterns (anonymized) | gated/contractual |

Rule: anything below report-level (individual judgments, voter-level) is **API-key
only**, never the session UI, and Scale+/Enterprise + contractual. Never expose voter
identity, raw ip/device, or attributed comments.

---

## 6. Does Databricks make sense now? — No.

- **Volume is far below the threshold.** Postgres handles current and near-future load.
- **Cost/complexity.** Databricks is usage-billed and adds governance/security burden before there's value to govern.
- **Nothing in the current flow needs it.** Reports, exports, dashboards, and the API are all transactional or lightweight-aggregate workloads Postgres + materialized views cover.
- **Customer value unproven.** No customer is asking for governed data sharing or large-scale ML yet.

What to do instead now: `v_events`, materialized views / scheduled rollups for admin
analytics, and the export tiers above.

---

## 7. When Databricks (or a warehouse) would make sense later

Adopt a warehouse/lake **only when a concrete trigger fires**, and prefer the cheapest
option that fits:

- **First step up** (if admin analytics get heavy): Postgres read replica +
  materialized views, or DuckDB over Parquet on R2/S3 — near-zero cost.
- **If analytical volume grows** (millions of votes, heavy cross-test queries):
  ClickHouse or BigQuery before Databricks.
- **Databricks specifically** earns its place for: governed **preference-data sharing**
  with AI-app/brand partners (Delta Sharing), **clean-room** cross-customer benchmarks
  (privacy-safe, permissioned), **ML/ranking model training** on large judgment sets,
  and **enterprise data exports/rooms**. All of these are *enterprise data-partnership*
  features, not app plumbing.

Trigger checklist (need at least one): a paying enterprise/AI-app customer requesting
governed sharing; cross-customer benchmark product with consent; ML training pipeline
with proven demand; analytical query load Postgres can't serve cost-effectively.

---

## 8. Enterprise-readiness roadmap (status grounded in code)

**Already done (verified):**
- Webhook reliability: idempotent deliveries, exponential backoff (2m/10m/1h/6h, max 5), daily retry cron (`CRON_SECRET`-gated), SSRF guard (DNS validation + IP pinning, blocks private IPs).
- Idempotency: credit grants (`unique(user_id,reason,ext_ref)`), payment dedup (`stripe_id`), vote uniqueness, advisory locks on launch/reward.
- Secrets: API keys SHA-256 hashed (raw shown once, never selected); Stripe/OAuth via env; webhook signing (HMAC-SHA256) on both Stripe-in and Vraelis-out.
- Anti-abuse: `v-quality.ts` (too-fast < 1500ms, IP velocity 60/hr, device 20/day, reputation gate > 60% rejected after 12 votes), `v_voter_rep`, admin override.
- Access control: app-layer `user_id` scoping on every query; ownership checks on tests/exports/webhooks.
- Admin tools: `/app/admin` vote review + override (`isAdmin` via `VRAELIS_ADMIN`).
- Billing records + Stripe subscription sync (dunning `past_due` grace, monthly credit reset).
- Tokenized public report sharing; entitlements enforced server-side.
- **Rate-limit infrastructure exists** (`lib/vraelis-ratelimit.ts`, Postgres fixed-window + 429/Retry-After).

**Easy next:**
- **Apply rate limiting to the v1 Rank API** — the limiter exists but the evidence shows it on the archived `/api/vraelis/*` routes; confirm/extend it to `/api/v1/*`.
- **Enforce API-key scopes per endpoint** — scopes are stored (`tests:write/read`, `credits:read`) but not checked per route yet.
- **Security headers** — only an embed CSP exists; add HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a default frame policy.
- **API usage analytics** — needs a `v_api_calls`/`v_events` row per request.
- **Audit/event logs** — no `v_events` yet; add it (this is build step 1).

**Later:**
- **Account deletion / data-request workflow** — endpoint is a deliberate 503 stub; build the safe cascade (Stripe cancel, report links, retention rules, confirmation/guard).
- **CORS policy for the v1 API** — currently unspecified (defaults to same-origin).
- **Incident process** — no runbook/status page/SLA; add monitoring alerts (webhook-failure spike) + a status page.
- **Staged rollout / feature flags** — only env allowlists today.

**Enterprise-only:**
- **Data retention policies** — append-only tables grow forever; define windows + anonymization cron.
- **Database backups / DR** — Supabase-managed; document RTO/RPO + test restores.
- **Supabase RLS** — defense-in-depth on top of app-layer scoping for enterprise assurance.

---

## 9. Revenue / product feature roadmap

| Feature | Who pays | Why | Tier | Complexity | Priority |
|---|---|---|---|---|---|
| Better report screenshots / client-ready mode | agencies, creators | the report *is* the sale | Pro | M | High |
| `/app/data` analytics (event-backed) | everyone | makes the product feel real | included | M | High |
| API usage dashboard | AI apps, devs | trust + cost visibility | Scale | M | High |
| Export tiers | Pro→Enterprise | monetize the data, not just votes | tiered | M | High |
| Test templates (thumbnail/icon/ad flows) | creators | faster, on-ramp | included/Pro | S | Med |
| Test folders / projects | teams, agencies | organization at volume | Pro | M | Med |
| Branded / white-label public reports | agencies | resell to clients | Pro / Enterprise | M | Med |
| Team seats | teams | multi-user accounts | Pro+ | L | Med |
| Audience/category targeting (deeper) | brands | relevance | Creator+ | M | Med |
| Benchmark history / recurring tests | brands, creators | trend over time | Scale | M | Low |
| Voter quality scoring surfaced | AI apps | trust in the signal | Scale | M | Low |
| Governed preference data sharing / data room | enterprise/AI apps | the Databricks story | Enterprise | XL | Later |

---

## 10. Pricing implications (recommendations only)

Keep `1 credit = 1 valid judgment` as the usage core. Suggested placement:

- **Stays usage-based:** credits (tests/votes). Top-ups $5–$99,999.
- **Pro+:** standard export, client-ready/branded reports, projects/folders.
- **Scale+:** API + webhooks (already), API usage dashboard, dataset + quality exports, account usage export.
- **Enterprise:** white-label, cohort/segment exports, retention controls, data room / governed sharing, SSO/SLA.
- **Not free:** API access, voter-level dataset exports, white-label. (Free keeps the full *loop* + summary export so the product still sells itself.)

Do not change prices from this pass — these are placements to revisit when the
features ship.

---

## Recommended next build prompt

> **Postgres event tracking + a real `/app/data`.** Add an append-only `v_events`
> table (id, ts, type, actor_type, user_id nullable, test_id nullable, source,
> metadata jsonb — never raw keys/secrets/ip/device/full payment data). Emit events
> at the existing mutation points (signup, test_created, test_launched, vote_recorded,
> vote_filtered, test_completed, report_viewed, public_report_enabled,
> export_downloaded, api_request_made, webhook_delivered, checkout_completed,
> credits_spent, credits_returned). Then rebuild `/app/data` to show real customer
> analytics from `v_events` + existing tables (completion rate, valid-vs-filtered,
> time-to-fill, credits per test, win-margin distribution, category breakdown), and
> add an API/webhook usage panel for Scale users. Keep it Postgres-only; no warehouse.
> Idempotent SQL migration; do not log sensitive fields.
