# Vraelis — Data Handling, Retention & Deletion Policy

_Status: policy of record (repo doc). Not yet published as a public page — do that
before onboarding a real customer. Last updated with the PII-guardrail work._

Vraelis shows customer-submitted content to **real human evaluators**. The moment a
customer sends real, user-facing AI output, Vraelis is processing data on their
behalf — potentially including their end-users' personal data. This document states
what we store, for how long, how it is deleted, and the guardrails that keep personal
data out of the evaluation pipeline. It reflects **what the code actually does today**,
with roadmap items called out honestly.

## What we store

| Data | Where | Contains |
|---|---|---|
| Candidate content (text/images submitted for a run) | `v_tests`, `v_test_options` | The exact content the customer submits — shown to evaluators |
| Judgments | `v_judgments` | Which option a person chose, optional free-text reason, timing, source, quality verdict |
| Evaluator reputation | `v_voter_rep` | Per-evaluator valid/rejected counts (keyed by an internal id) — no content |
| Reports / Decision Packages | `v_reports` | Aggregated results only — no evaluator identities, no raw IPs/device hashes |
| Billing | `v_payments`, `v_credit_ledger` | Stripe references + credit movements — never full card data |
| Governance events | `v_events` | Sanitized audit trail — no secrets, tokens, emails, or raw payloads |

Judgment records store an **IP hash and device hash** for fraud controls — never the raw
IP or device fingerprint. Decision Packages and exports are pure aggregates and never
include evaluator identities, emails, IPs, device hashes, tokens, or Stripe ids
(enforced in `lib/v-decision-package.ts` and `lib/v-audit.ts`).

## The no-PII guardrail (enforced in code)

Because content reaches real people, submissions are scanned for obvious personal data
at creation, on **both** the web form and the public API, before anything is stored or
routed:

- `lib/v-content-policy.ts` blocks candidate text containing an **email address, phone
  number, US Social Security number, or Luhn-valid payment card number**.
- Both `POST /api/v/tests` and `POST /api/v1/tests` reject such submissions (`422
  pii_detected`) with a message asking the customer to redact.
- The submission form warns explicitly: _"Real people read what you submit. Don't
  include personal data."_

**Limits (honest):** the scanner covers structured identifiers only. It does **not**
detect names or free-form PII — that requires NLP and would flag ordinary copy — so the
notice + this policy carry that expectation. Images are not scanned. This is a
guardrail, not compliance-grade DLP.

## Retention

- **Active runs:** candidate content and judgments are retained while the run is open and
  for as long as the run and its report exist in the workspace.
- **Completed runs:** retained so the customer can review the Decision Package, until the
  customer deletes the run or requests deletion.
- **Backups:** may persist in operational backups for **up to 30 days** after deletion,
  then are purged (consistent with `lib/email.ts`).
- **Automated retention windows / anonymization cron:** _not yet built_ (roadmap —
  `docs/VRAELIS_DATA_ROADMAP.md`). Today, append-only tables grow until explicit deletion.

## Deletion

- **Per-run deletion exists in code:** `deleteTest()` (`lib/v-db.ts`) removes a run; its
  options and judgments cascade via `on delete cascade`.
- **Data requests:** customers can file access/deletion requests (`lib/v-data-requests.ts`,
  `v_data_requests`); an operator actions them. Turnaround target: **30 days**.
- **Self-serve run deletion in the UI** and a full **account-deletion cascade** (Stripe
  cancel + link teardown + retention rules) are **roadmap** — account deletion is
  currently a deliberate 503 stub. Until shipped, deletion is request-based.

Contact for any data request: **hello@vraelis.com**.

## Sub-processors (as used)

- **Supabase** — primary datastore.
- **Stripe** — payments (no card data stored by Vraelis).
- **Prolific** (when used for managed fulfillment) — evaluator sourcing, identity, and
  payout; evaluators are governed by Prolific's terms.
- **Resend** — transactional email.

## Before customer #1 (checklist)

- [x] Block obvious PII at submission (both create paths).
- [x] Submission-time notice that real people read the content.
- [x] Written retention + deletion policy (this file).
- [ ] Publish this as a public `/data` (or privacy) page.
- [ ] Self-serve run deletion in the UI.
- [ ] A signed DPA + sub-processor list for customers who ask.
