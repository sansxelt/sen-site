# Cold-Pool Experiment — Seeded Supply Proof

> Operating plan for the private liquidity experiment. Documentation only — describes ops,
> SQL run via the service-role console, and Prolific setup; requires NO product code changes.
> Produced 2026-07-01 from a verified-facts -> draft -> adversarial-critique -> finalize pipeline;
> file/line citations refer to the codebase as of commit 9648954.

# FINAL EXPERIMENT PLAN — Vraelis Seeded Supply Proof (v2, post-critique)

**What changed and why (read first):** The draft's hybrid entry path does not exist in the code. Collection links resolve to the anonymous embed path (`VOTE_BASE = "https://vraelis.com/embed/vote/"`, lib/v-collection-links.ts:13); the signed-in /vote page only calls the generic router and never sends utm params (app/rank/vote/page.tsx:34,51); only the embed client reads utm from the URL (app/embed/vote/[testId]/embed-vote.tsx:41-46). The experiment therefore runs **entirely on the embed path**, which eliminates Google sign-in, PII collection, and most Prolific-policy risk. Per-worker attribution uses Prolific's URL parameter substitution — `?utm_campaign={{%PROLIFIC_PID%}}` — which survives `cleanUtm` sanitization intact (lowercase alnum ≤40 chars, lib/v-sources.ts:12-16; Prolific PIDs are 24-char lowercase hex). No links minted, no emails collected.

**What this experiment can prove (honest claim):** (1) the fully-loaded cost per valid judgment of a seeded fill pipeline; (2) whether the product's constraint machinery (one vote per test·voter, quality gates, escrow/refund, Fill Monitor, attribution) survives 150 distinct real humans; (3) the gates' false-positive rate on compliant humans and catch rate on instructed junk; (4) attribution integrity. **What it cannot prove:** organic supply. Fill *speed* on Prolific measures Prolific's queue, not Vraelis demand-side pull — timing is reported as a seeded-pipeline SLA, never as "network liquidity." The only organic measurement is the zero-cost control run J-ORG. The former "2× measured = organic" multiplier is deleted. The Google-auth evaluator funnel and credit-earn loop are **out of scope** (the embed path has no auth); this is recorded as an explicit unmeasured product question.

Distinct-human assurance comes from **Prolific's one-account-per-person enforcement + per-PID attribution**, not Google accounts. On-chain in the product: `votes_valid` still requires N distinct `voter_id`s (anon localStorage ids on embed), each mapped 1:1 to a PID via utm_campaign; the mapping is audited (Section 7).

---

## 1. JUDGE RECRUITING PLAN

**Channel: Prolific only.** Private, invitation-scoped studies; no public advertising. Note plainly: study URLs expose vraelis.com to a few hundred workers — a nonzero but acceptable footprint under the private-experiment constraint; studies say "help evaluate creative options," never pitch the product.

**Entry mechanics (one study per job):** Each job is its own Prolific study whose external URL is:

```
https://vraelis.com/embed/vote/<TEST_ID>?utm_source=pl-<wave>-<job>&utm_campaign={{%PROLIFIC_PID%}}
```

Prolific substitutes each worker's PID. Every judgment then lands with `source='campaign'`, `utm_source='pl-w2-j2'` (wave/job tag), `utm_campaign=<PID>`. Payment verification is one SQL query — no completion-code trust, no email matching:

```sql
select utm_campaign, status from v_judgments
where test_id = '<TEST_ID>' and utm_campaign = lower('<PID>');
```

**Approval policy (Prolific-compliant):** Approve every submission with ANY judgment row for that PID — **valid or gate-rejected**. Quality gates (too_fast, spam_comment, etc.) never cause nonpayment; they cost the bonus and future-wave allowlisting only. PIDs with no row at all: message first (tagging is best-effort — see Section 4), then ask to return. Completion codes are rotated per study and are a formality; the judgment row is the ground truth, so code-sharing is harmless.

**Worker instructions (study body):** (1) Open the study link, compare the options, pick one, write one honest sentence of reasoning. (2) Instant answers are auto-filtered by the site's quality system — you'll still be paid, but thoughtful responses earn a bonus. (3) Prefer your normal connection over a VPN if convenient (soft ask — CGNAT/VPN use is adjudicated, not punished). (4) Return to Prolific and enter the code shown in the instructions. Time estimate 2-3 min.

**Screeners:** Prolific approval rate ≥ 98%, fluent English, one submission per person (platform-enforced). Re-invites via custom allowlists; re-invite return budgeted at **50-60%**, never 100%.

**Ceiling-run sizing (from the constraint math):** 150 valid requires 150 distinct voter_ids; a rejected vote permanently burns that voter's slot (`unique(test_id, voter_id)`, sql/vraelis-rank.sql:87). Places = 150 / (0.95 completion × 0.92 valid) ≈ 172 → **open 180 places with a pre-authorized +30 top-up tranche** (pre-registered trigger: valid count < 135 when 160 places consumed).

**Pay (out-of-band, ≥$12/hr effective):** $0.50 per single-judgment study (~2-2.5 min); $0.75 for screening/sensitive studies; screen-outs paid via Prolific's built-in screened-out flow (~$0.20-0.25 pro-rata); $0.25 "thoughtful reasoning" bonus to ~top 30% — **criteria not published** (publishing the rubric induces templated comments and false farming signals).

---

## 2. BUDGET

| Item | Math | Cost |
|---|---|---|
| J0 pilot | 15 × $0.50 | $7.50 |
| J1 (25-target) | 32 × $0.50 | $16 |
| J2 ceiling (150-target) | 180 × $0.50 + 30 reserve | $105 |
| J3 (50, 3-candidate copy) | 60 × $0.50 | $30 |
| J4 (50, image pair) | 60 × $0.50 | $30 |
| J5 screening (25-target) | 45 × $0.75 incl. screen-outs | $34 |
| J6 sensitive (optional, 25) | 30 × $0.75 | $23 |
| J-RED red-team arm | 10 × $0.50, approved regardless | $5 |
| W3b auth probe (optional) | 20 × $1.00 | $20 |
| Bonuses | ~90 × $0.25 | $23 |
| Prolific fee (~33% + possible VAT) | 0.33 × ~$295 | ~$97 |
| No-fault pays, repricing top-ups, disputes | ~15% | ~$60 |
| One pre-authorized re-run of one botched study | | ~$60 |
| In-product escrow credits | seeded via service-role ledger insert (below); unfilled refunded on close | $0 external |
| **Cash total** | | **~$450-650** |

**Operator labor is logged and reported** (study writing, approvals, audits, re-invites; est. 25-35 h). Two cost numbers are produced: cash-only (~**$1.15-1.55/valid judgment**) and fully-loaded including operator hours at a stated internal rate (~**$4-6/valid** at this scale) — the fully-loaded number is the managed-service pricing floor, and its labor share is the scaling argument.

**Credit seeding (no product change; founder-owned DB, service role):**

```sql
insert into v_credit_ledger (user_id, delta, reason, bucket, ext_ref)
values ('<owner-email>', 600, 'purchase', 'purchased', 'seed:exp1:<owner-email>');
```
(mirrors `grant()`'s insert shape, lib/v-credits.ts:45-54; escrow needs ≈ 382 credits across all jobs; fresh accounts also get SIGNUP_FREE_CREDITS = 25.)

---

## 3. EXACT TEST JOBS

All launched from 2 fresh owner Gmail accounts (owners can't vote on their own tests — RPC-enforced, sql/vraelis-rank.sql:286). The ceiling test is **neutral content** — the sensitive task is quarantined at small N so a content-policy delay can never confound the primary endpoint.

| # | Job | Cands | Target | Places | Wave | Tests |
|---|---|---|---|---|---|---|
| J-ORG | Organic control: support-prompt pair. **Recruit nobody.** | 2 | 25 | 0 | launch day 1, runs 21+ days | The ONLY organic-supply measurement |
| J0 | Pilot: pairwise LLM answers ("explain a 401k") | 2 | 12 | 15 | 0 | Plumbing hard-gate (Section 9) |
| J1 | Pairwise LLM helpfulness, support prompt | 2 | 25 | 32 | 1 | Arrival→valid funnel, valid rate, time_spent baseline |
| J2 | **CEILING: landing-hero pair for a fictional AI app** | 2 | 150 | 180+30 | 2 | 150 distinct valid voters through the constraint machinery — the kill signal |
| J3 | Onboarding-email 3-way for a fictional AI notetaker | 3 | 50 | 60 | 3 | >2 candidates; reasoning quality; runs concurrent with J4 |
| J4 | Generated-image brand pair | 2 | 50 | 60 | 3 | Whether visual tasks hug the 1500ms floor |
| J5 | Screening mechanism: copy pair + in-product question "Do you use an AI chatbot weekly?" (qualifying: yes), mirrored by a Prolific prescreener | 2 | 25 | 45 | 3 | Plumbing check that disqualified → no judgment; aggregate v_screening_responses reconciliation. Screen-out pay via Prolific's flow (v_screening_responses is count-only — it cannot identify who to pay) |
| J6 | OPTIONAL: responsible-handling pair (self-harm-adjacent), full content warnings/consent | 2 | 25 | 30 | 3 | Judge behavior on sensitive content — small, never the ceiling |
| J-RED | Red-team: 8-10 workers **instructed** to answer instantly with junk comments (disclosed as the task; approved regardless) | 2 | 20 | 10 | 3 | Gate CATCH rate — without this the "quality-filtered" claim is untested |
| W3b | OPTIONAL auth probe: dedicated test; workers asked to Google-sign-in and vote at /vote; pay all who enter the code; measure count of new signed-in voter_ids in the window ÷ places. Run only after J2 completes and only if no third-party active tests exist (`select count(*) from v_tests where status='active'` excluding experiment ids = 0), since /vote routes to the oldest 25 active tests site-wide (lib/v-db.ts:167-182) | 2 | 20 | 20 | 3 | Rough Google-auth willingness — no attribution, no PII, explicitly coarse |

Concurrency note: J3+J4 run simultaneously to observe two open seeded runs at once; this is **not** claimed as "cannibalization" evidence (workers accept studies from the Prolific feed — it measures marketplace dynamics, not pool allocation).

---

## 4. CONTAMINATION CONTROLS

**Prevention:**
- Fresh owner accounts; owner households never open vote pages (owner-IP overlap poisons diversity reads).
- Test ids treated as secrets outside study URLs — any active test is votable at /embed/vote/<id> with no visibility gate (app/embed/vote/[testId]/page.tsx:13-16).
- Workers never see /vote → **zero risk of paid judgments leaking into other buyers' production runs** (the draft's worst leak direction is closed by the embed-only design; the generic router is never invoked).
- No mid-window close/reopen; study publish timestamps logged.
- Structural residual risk: organic signed-in users on /vote CAN be routed to experiment tests (active + public + unfilled). Detect, don't fight: their judgments carry `source='internal'` and null utm_campaign, and are excluded from attributed metrics.

**Attribution integrity (the load-bearing risk):** `tagJudgmentSource` is a best-effort post-RPC UPDATE (lib/v-db.ts:379-386) — on silent failure the judgment stays valid but untagged (source defaults to 'web', null utm). Therefore: (a) Wave-0 hard gate verifies PIDs land on rows in production; (b) **re-verify at the open of every wave** with one canary click; (c) untagged rows are reconciled by timestamp-window + Prolific submission logs and **paid by default**; (d) attributed-share is itself a reported metric.

**Post-hoc detection:** source/utm split (expected paid signature: `source='campaign'`, `utm_source like 'pl-%'`, 24-hex utm_campaign); judgments outside a study's open window; distinct attributed voter_ids per wave vs approved submissions (surplus = leakage, deficit = funnel loss); referrer_host anomalies; Section 7 queries after every wave.

---

## 5. METRICS (per run; computed over ATTRIBUTED judgments, Fill Monitor's unfiltered view reported alongside, delta labeled "organic/untagged")

| Metric | Source |
|---|---|
| **Primary: cost per valid judgment** (cash and fully-loaded incl. operator-hours log) | payment ledger + hours log ÷ attributed valid count |
| **Primary: arrival→valid conversion** | attributed PIDs with ≥1 row → share with status='valid' |
| **Primary: 150-distinct feasibility** | `count(distinct voter_id) filter (where status='valid')` on J2, cross-mapped to PIDs |
| **Primary: attribution integrity** | share of valid judgments on experiment tests carrying an expected PID |
| **Primary: gate catch rate** | J-RED: share of instructed-junk rows with status='rejected' |
| Valid rate; reject-reason distribution | `count(*) filter (where status='valid')/count(*)`; `group by reject_reason where status='rejected'`; Fill Monitor error pills |
| Launch→first-valid AND first-valid→Nth (separately — Fill Monitor's timeToValid excludes launch latency) | study-publish log + `created_at` of 1st/25th/50th/100th/150th valid, ordered |
| Seeded fill SLA (publish→target), velocity — descriptive only; burst-shaped by design | owner log + Fill Monitor velocity/ETA |
| Median + p10 time_spent_ms; floor-share (1500-3000ms band) | `percentile_cont` per test, valid only; Section 7 query |
| Unique voters/IPs/devices, votes/IP, top-IP share, diversity verdict | Fill Monitor (fillStats). Note: on embed, device_hash = hashToken(anon id) is 1:1 with voter_id (app/api/embed/vote/route.ts:36) — uniqueDevices ≡ uniqueVoters, expected, not an anomaly |
| Pool-dependence index (replaces decorative top-10 metric) | share of attributed valid judgments from PIDs appearing in ≥3 jobs |
| Multi-accounting signal | voter_id ↔ PID mapping audit (Section 7) — NOT device_hash, which is structurally uninformative on this path |
| Reasoning quality | 30 random valid `reason` texts per job, 0-2 rubric (0 vague / 1 references content / 2 specific comparative claim); mean and %≥1 |
| Screening funnel (J5) | v_screening_responses qualified:disqualified (aggregate only) vs Prolific screen-out count |
| Organic supply | J-ORG: valid votes in 21 days, all `source='internal'` |
| Escrow/refund correctness | ledger rows `refund:<testId>:p/:m` after early-close of J-RED and J-ORG |

---

## 6. PASS/FAIL THRESHOLDS

Timing is a **seeded-pipeline SLA**, reported but not the headline. The verdict gates on what the experiment can actually falsify.

**SELLABLE-AS-MANAGED (all must hold):**
1. J2 reaches 150 attributed distinct valid voters consuming ≤ 210 places, within 72h of publish.
2. Arrival→valid conversion ≥ 85% (gate false-positive ≤ ~10% on compliant humans).
3. Valid rate ≥ 85% on every run (attributed).
4. Attribution integrity ≥ 95% (tagging loss <5%).
5. No run "likely-farmed" after adjudication; any "concentrated" verdict explained by CGNAT (clustered-IP voters map to distinct PIDs). Small-N runs (≤50): diversity is advisory unless corroborated by the Section 7 identity queries.
6. Median time_spent ≥ 8s text / ≥ 5s image; floor-share < 20%.
7. J-RED catch rate ≥ 70% (otherwise "quality-filtered human signal" is not yet a defensible claim).
8. Reasoning sample ≥ 70% scoring ≥ 1.
9. Cash cost ≤ $2.00/valid judgment (fully-loaded number reported regardless as the pricing floor).

**MARGINAL:** conversion 70-85%; valid 70-85%; J2 needs the top-up tranche or 72-120h; attribution 85-95%; catch rate 50-70%. Sellable once, capped, at a discount — not on a retainer.

**FAILED (any):** J2 < 150 valid after 210+ places consumed AND the top-up (i.e., the product's funnel/gates — not recruitment — is the ceiling); valid rate < 70% anywhere; farming signature confirmed by identity queries (not CGNAT); attribution < 85% (per-worker QA impossible → managed offering can't be operated honestly); catch rate < 50%.

**Separately scored:** J-ORG. Expected ≈ 0 valid in 21 days — that IS the current answer to "organic supply." >5 organic valid = unexpected upside; confirm with one more unseeded 25-target run before believing it.

---

## 7. FARMING / CONCENTRATION DETECTION

Run after each wave; `$ids` = experiment test ids. The draft's device-reuse query is **removed**: on embed, device_hash is derived from the anon id itself (1:1 with voter_id by construction), and the signed-in route never sets device_hash (app/api/v/vote/route.ts:45) — it can never fire. Identity cross-mapping replaces it:

```sql
-- One browser, many Prolific accounts (multi-accounting): same voter_id under >1 PID
select voter_id, count(distinct utm_campaign) pids
from v_judgments where test_id = any($ids) and utm_campaign is not null
group by 1 having count(distinct utm_campaign) > 1 order by pids desc;

-- One PID, many voter_ids (cleared localStorage / multiple devices — benign-ish, but audit)
select utm_campaign, count(distinct voter_id) vids
from v_judgments where test_id = any($ids) and utm_campaign is not null
group by 1 having count(distinct voter_id) > 1;

-- Organic / untagged share per test (contamination + tagging-loss tripwire, reported separately)
select test_id, source, (utm_campaign is not null) tagged, count(*)
from v_judgments where test_id = any($ids) group by 1,2,3;

-- Top-IP share (valid only) — adjudicate against distinct PIDs before calling it farming
select ip_hash, count(*) c, count(distinct utm_campaign) pids
from v_judgments where test_id = any($ids) and status='valid' and ip_hash is not null
group by 1 order by c desc limit 10;

-- Floor-hugging: valid votes racing the 1500ms gate
select count(*) filter (where time_spent_ms between 1500 and 3000)::float
     / nullif(count(*),0) floor_share
from v_judgments where test_id = any($ids) and status='valid';

-- Templated reasons across voters
select lower(trim(reason)) r, count(*) c, count(distinct voter_id) v
from v_judgments where test_id = any($ids) and status='valid' and length(reason) > 0
group by 1 having count(*) >= 3 order by c desc;

-- Gate trips + reputation near-trips
select reject_reason, count(*) from v_judgments
where test_id = any($ids) and status='rejected' group by 1;
select voter_id, valid, rejected from v_voter_rep
where rejected::float/nullif(valid+rejected,0) >= 0.4 and valid+rejected >= 6;

-- Votes outside any study window (parameterize per wave)
select test_id, count(*) from v_judgments
where test_id = any($ids) and (created_at < $open or created_at > $close) group by 1;
```

Reads: same voter_id under >1 PID = definitive multi-accounting → exclude and report. IP concentration with distinct PIDs behind it = CGNAT, not farming (pre-registered). floor_share > 30% = gate-racing. `ip_velocity` rejects mid-wave = shared NAT/VPN, adjudicate before penalizing. Never count `anon:` voter_ids as distinct humans without a PID mapping.

---

## 8. DECISION TREE

- **PASS all →** Sell a **managed/seeded evaluation service**: "launch a run, get N quality-filtered, verified-distinct human judgments in ≤72h," staffed quietly from the paid pool, priced ≥ 2× the fully-loaded cost per valid judgment. Do **not** publish organic fill-time promises — J-ORG (≈0) is the honest state of the network. No new features, no cash-out, no rebrand needed to sell this.
- **PARTIAL — J2 misses, places didn't fill:** Prolific liquidity/pricing, not Vraelis. One pre-authorized re-run at +50% pay. Pass on re-run → PASS; miss again with places still unfilled → recruitment-market problem: cap sellable size at largest passing target.
- **PARTIAL — J2 misses with 210+ places consumed:** the product machinery (dup burns, gate false-positives, dup-anon collisions) eats supply. Pre-registered disambiguation: reject-reason distribution + arrival→valid rate identify the eating gate. This is a product finding to hand upward; sell capped (≤ largest passing N) meanwhile.
- **PARTIAL — fills but dirty (valid <85% or farming-ish):** if identity queries attribute concentration to CGNAT/compliant humans → adjudicate and re-score; if rejects dominate from high-reputation workers → the task design invites junk → rewrite job copy and re-run one 50. Down to FAIL if it persists.
- **PARTIAL — attribution integrity <95%:** the best-effort tagger is the weak joint. Operate manual timestamp reconciliation per wave and flag the tagging path as the one engineering fix this business needs before scale (a product decision — out of scope here, hand upward).
- **FAIL:** the machinery or economics are broken even with bought supply — fix the product before selling anything. The cost data still prices any future managed pivot.
- **J-ORG surprise (>5 organic valid):** re-run unseeded to confirm; if real, revisit positioning with actual organic evidence.

---

## 9. TIMELINE (kill-signal first)

- **Week 1 — Setup + pilot + hard gate.** Create 2 owner accounts; seed credits (Section 2 SQL); launch **J-ORG immediately** (runs all month); draft all jobs; write studies. Run J0 (15 places). **Gate G0 — no Wave 1 until ALL pass, verified in production:** (a) `select utm_campaign, source from v_judgments where test_id='<J0>'` shows PIDs on ≥95% of rows in both framed/unframed opens; (b) every pilot PID resolves to approve/return including one deliberate mismatch; (c) credit seed + escrow + Fill Monitor tiles render; (d) early-close on a scratch test refunds (`refund:<id>:p/:m` ledger rows); (e) approval workflow ≤ 2 min/worker.
- **Week 2 — Funnel read, then the ceiling.** Mon: J1 (32 places). Wed: **Gate G1** — proceed iff arrival→valid ≥ 80% AND tagging ≥ 95%. Thu: publish **J2 (180 places + pre-authorized +30 top-up on the pre-registered trigger)**. This puts the only result that can kill the thesis inside the first ~$130 of spend.
- **Week 3 — Breadth (only if G1 passed and J2 ≥ marginal).** J3+J4 concurrent; J5 (screening); J-RED; optional J6; optional W3b after J2 completes. Detection queries after each study closes; freeze anomalies same-day.
- **Week 4 — Analysis + memo.** Full metrics per run over attributed judgments; contamination and identity audit; reasoning-sample scoring; cash and fully-loaded cost per valid judgment (operator-hours log included); threshold scoring; decision-tree verdict; one-page internal memo. Read J-ORG at day 21. Close any stuck run via early-close (unfilled escrow refunds automatically).

Elapsed ~4 weeks. Cash ~$450-650. ~360-400 attributed valid judgments + one organic control.

---

## APPENDIX — CRITIQUES REJECTED

1. **Critic 1's fix "mint one collection link per worker via createCollectionLink, label = PID"** — rejected as unnecessary: Prolific's `{{%PROLIFIC_PID%}}` URL substitution into `utm_campaign` achieves per-worker attribution with zero minting; `cleanUtm` (lib/v-sources.ts:12-16) provably preserves 24-char hex PIDs, and hand-minting ~400 links via an owner-scoped function has no offsetting benefit.
2. **Critic 2's replacement metric "share of valid judgments from device_hashes seen with >1 voter_id, computable as-is"** — rejected as structurally impossible: on the embed path device_hash = hashToken(anon id), 1:1 with voter_id by construction (app/api/embed/vote/route.ts:33-36), and the signed-in route never writes device_hash at all (app/api/v/vote/route.ts:45) — the query returns empty by design; the voter_id↔PID cross-mapping (Section 7) replaces it.
3. **Critic 2's "$1,400-2,000 realistic budget"** — the number is rejected (its drivers were sign-in time and bundled sessions, both eliminated by the embed-only, one-study-per-judgment design); its underlying principles (pay all good-faith completions, fees, top-ups, operator labor) are accepted and priced in.
4. **Critic 1's "PASS carries almost no information"** — accepted for fill-time, rejected as a general verdict: the 150-distinct-voter constraint mechanics, gate false-positive/catch rates, attribution integrity, and unit cost are all falsifiable outcomes this design can and does gate on.
5. **Critic 2's "velocity/ETA metrics are meaningless"** — rejected as deletion advice: they are retained as descriptive observations of the Fill Monitor's behavior under burst arrivals (a real thing the owner dashboard will show seeded buyers), just excluded from pass/fail.

Every other critique (dead hybrid path, seeded circularity, ceiling-wave math, Prolific policy on rejections/PII/account creation, sensitive-content confound, kill-first sequencing, screening pay mechanics, CGNAT diversity noise, decorative top-10 metric, published-rubric templating, launch-latency definition, fake cannibalization claim, brand-exposure disclosure, operator-labor exclusion) is accepted and incorporated above.
