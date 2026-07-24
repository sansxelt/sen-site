# Stage 1 — Public route audit

Branch `feature/design-05-public-system`, from `main` (28a5db8f). Read-only audit of the current public
website so the rebuilt `/dev-preview/site-v1` system inherits only truthful content. Nothing here is
merged or deployed.

## Cross-cutting findings

- **CTA verb is inconsistent and wrong.** The shell and most pages say **"Check your application"**; the
  homepage and app cards say **"Verify an outcome."** The founder's single global CTA is **"Verify an
  application."** Every public CTA in `site-v1` uses that one verb, pointing at `/signin?callbackUrl=%2Fapp`.
- **"Preflight" is an internal codename** that still leaks into public copy (Developers, Enterprise). Public
  vocabulary is **verification / Verified / Failed / Blocked** and **Guarantee**. Drop "Preflight" as a
  public noun.
- **The "guarantee" word clashes.** Enterprise says "Not a guarantee, it is a readiness assessment," but the
  product now centres on the **Guarantee** object (a durable named requirement, not a legal warranty).
  Reconcile site-wide to the object meaning.
- **Decorative serif must go.** The current homepage sets "Vraelis proves it" and "done" in `.em`
  (Instrument Serif italic). Founder bans decorative serif. `site-v1` is Geist-only, mono for machine text.
- **Route prefix.** Files live under `app/rank/**` but every canonical path and link is the un-prefixed
  `/`, `/developers`, `/pricing`, `/research`, `/enterprise` (a host proxy maps them). `site-v1` uses a
  clean `/dev-preview/site-v1/*` preview namespace and does not touch the live routes.

## Route matrix

| Route | Purpose | Current product language | Stale / risky claims | Current CTA → dest | Reusable truthful content | Recommendation |
|---|---|---|---|---|---|---|
| `/` (home) | Category + how the primitive works | "Independent verification layer"; "AI says it's done. Vraelis proves it."; describe outcome → derive checks → decision+evidence; repair loop; people+agents | `.em` serif; no **Guarantee** object; Failed colour is amber `#B45309`, not clay; "Verify an **outcome**" verb | "Verify an outcome" → `/signin?callbackUrl=%2Fapp`; "View the API" → `/developers` | Category thesis; derive-from-claim; Verified/Failed/**Blocked** with evidence; "checks from outside the application"; repair division of labour ("Vraelis does not edit your code"); "Starting with deployed web applications" honesty line | **REWRITE** (Stage 3) — recenter on the Guarantee, real Failed→Verified production proof, current-vs-next |
| `/product` | — | **Does not exist yet** | — | — | — | **CREATE** (Stage 3) — System → Guarantee → obligations → reviewed plan → approval → execution → conclusion → repair |
| `/developers` | Put verification in CI; create/read a verification | Real POST/GET `/api/v1/verifications`; CI exit codes 0/1/2/3; idempotency header; verified/failed/blocked from one explainable rule; private short-lived artifacts; "Not available yet" gate honesty | "Check your application" verb; "Preflight" framing; no webhook snippet shown though `verification.completed` is real | "Check your application" → signin; "How it works"; "See the decision rule" → `/how-it-works` | The whole create→poll→decision flow; CI exit-code table; idempotency; privacy model; "we will not document an endpoint we have not shipped" | **RETAIN + light REWRITE** (Stage 4) — verb, drop "Preflight", add real webhook, keep "Not available yet" honesty; do **not** show `/v1/guarantees` as live |
| `/pricing` | Buy verification capacity | Live = `pricing-v1.tsx` (flag ON). Free / Builder $49 / Pro $149 / Scale $399; PAYG $15 (5 flows, $3 extra, $3 rerun); monthly/yearly toggle, "Save 17%" | Legacy `pricing-legacy.tsx` (flag OFF) is stale; `lib/pricing.ts` + `lib/vraelis-plans.ts` are unrelated products — never read them | "Run a verification"; "Choose Builder/Pro/Scale" → `/checkout?plan=…&cycle=…`; "Add balance" → `/credits` | All numbers from **`lib/preflight/pass-pricing.ts`** only (machine-verified against hardcoding) | **RETAIN + re-skin** (Stage 4) — read the same constants, restrained editorial comparison |
| `/research` | Thesis: why independent verification matters | Index + article template; 5 published essays; Verified/Failed/Blocked trichotomy; "browser is the start, not the whole" honesty | Article #5 "from-failure-to-verified-repair" asserts a real run — the file's own rule says keep unpublished until a real run backs it (a real paid loop did close 2026-07-22; **re-verify before featuring**) | Whole-card → `/research/[slug]`; article CTAs → `/how-it-works`, `/limitations` | Articles #1–#4 in full; the "What is true today" note pattern; the Blocked-refusal differentiator | **RETAIN** index+template+#1–#4 (Stage 4); **DEFER/verify** #5 |
| `/enterprise` | Governance around the decision | Owner-scoped apps + ownership gate; billing-admin ≠ data owner; sanitized audit export (specific exclusion list); AES-256-GCM secret at rest; SHA-256 DNS token; private signed-URL evidence; OIDC validation; "no SOC 2 / SAML in preview / SCIM planned" | Blanket "Controls that exist today" (per-item verify); "Unlimited runs" (verify); "Not a guarantee" line clashes with the Guarantee object | "Check your application"; "View developer platform" → `/developers`; "Talk to us"/"Contact sales" → `/contact` | Separation of duties; audit exclusion list; crypto specifics; SSO/SAML/SCIM honesty ladder; "What Vraelis is not" | **RETAIN if justified** (Stage 4) — there is enough real separation-of-duties content; rewrite the guarantee clash + soften "exist today"; else drop from nav for launch |
| `/how-it-works` | Long-form explainer | Overlaps Product | — | — | Fold the strongest parts into `/product` | **DEFER** — likely merges into Product |
| `/limitations` | What is live vs not | Honest coverage boundary | — | — | The current-vs-next boundary language | **RETAIN** (Stage 4) — powers the CurrentNextBoundary component |
| Legal/support (`/privacy` `/terms` `/refunds` `/data-rights` `/subprocessors` `/trademark` `/contact` `/security`) | Compliance/support | Standard | — | — | Keep as-is under the new shell | **RETAIN** (later) — re-shell only |

## Nav + footer (from `app/rank/_components/rank-ui.tsx`)

- **Current nav:** How it works · Pricing · Developers · Research · Enterprise · (Sign in) · **Check your
  application**. Sticky, transparent at top → `rgba(250,248,244,0.82)` + 14px blur + hairline after 4px scroll.
- **Target nav (founder):** Vraelis · **Product** · Research · Developers · Pricing · Enterprise*
  · Sign in · **Verify an application**. (*Enterprise only if kept.) "How it works" folds into Product.
- **Footer:** real social (Instagram, Facebook, YouTube, X, LinkedIn) + Product / Developers / Account /
  Legal columns. Keep only real links; no invented enterprise grid. Tagline replaced to lead with the
  Guarantee.

## Route decision for `site-v1` launch

Build now (Stage 3): **Home**, **Product**. Build after approval (Stage 4): **Developers**, **Research**,
**Pricing**, **Enterprise** (only if the separation-of-duties story renders compelling and fully truthful).
Fold **How it works** into Product; keep **Limitations** as the source of the current-vs-next boundary.
