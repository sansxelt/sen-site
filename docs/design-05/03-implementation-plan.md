# Design 05 — Implementation plan (full public-site rebuild)

The rebuild proceeds as small, reviewable increments behind `/dev-preview/public-v2` while the live site
(`/rank`) stays intact. Each increment is one branch commit, inspected before the next begins — the same
cadence as Design 01/02. Nothing replaces the live homepage until Phase 5, and only on explicit approval.

**Ground rules:** shared brand tokens only; verdict color quarantined; one client component per interactive
surface; real or clearly-labeled fixture data; honesty boundaries per section; every increment ships with
7-viewport + reduced-motion captures and a keyboard/overflow check.

---

## Phase 0 — Art direction + flagship prototype  *(this increment — DONE)*
Reference analysis, art-direction doc, storyboard, and the flagship proof console (hero + trust-gap + 3-record
lineage + evidence expansion + final CTA) at `/dev-preview/public-v2`, with captures and a11y/perf verification.

## Phase 1 — Hero, trust-gap, and the production story, hardened
- **1a** Extract the proof-path/ring/evidence primitives into a small shared module (`_proof/`) so every later
  section draws from one vocabulary; add a couple of unit-style source checks (honesty vocabulary, no verdict term
  drift from the app).
- **1b** Motion polish: refine the ring sweep + rail-fill easing; add the "take-over on interaction" affordance copy;
  tune the auto-play cadence and the conclusion dwell.
- **1c** Copy pass on hero + trust-gap with the founder; finalize the honesty note wording.

## Phase 2 — How it works + real product surfaces
- **2a** Section 04 "How Vraelis proves it" — the eight-beat horizontal proof-path over one evolving workspace.
- **2b** Section 05 product surfaces — hairline-framed real component crops (web app, reviewed plans, records,
  evidence, repair handoff, API, CLI, webhooks, CI). Each crop anonymized; no private data.
- **2c** Section 06 Today / Next / Horizon timeline, with Next/Horizon visibly marked as direction.

## Phase 3 — Developers, integrations, pricing, trust/research
- **3a** Developers page — real API/CLI/webhook/CI artifacts (mono-for-code voice), a machine-readable decision
  contract sample.
- **3b** Pricing — reuse the app's real gate-parity numbers; no invented tiers.
- **3c** Trust & research — real methodology (determinism, scoped verdicts, false-Verified emphasis), no invented
  logos/metrics.

## Phase 4 — Mobile, motion, performance, accessibility hardening
- Full responsive audit across the 7 viewports for every page; reduced-motion parity; keyboard/focus order; a
  measured performance budget (bundle size of the interactive surfaces, CLS, no layout shift); axe-style a11y pass.

## Phase 5 — Replace vraelis.com + production smoke
- **5a** Move the finished experience from `/dev-preview/public-v2` to the real `/rank` homepage (and supporting
  routes), keeping the proxy rewrite intact; retire the old hero/timeline.
- **5b** Merge, deploy, verify deployment READY, and run an unauthenticated production smoke of the public pages
  (they need no auth). Keep stealth handling correct.

---

## Route / file map (current prototype)
```
app/dev-preview/public-v2/
  page.tsx          server shell: nav, hero, flagship section, trust-gap, final CTA, footer (noindex)
  proof-console.tsx "use client" flagship: proof-path spine, gapped ring, evidence, controls, 3-record lineage
  fixtures.ts       deterministic anonymized Failed/Failed/Verified records + obligations + conclusion tones
  public-v2.css     scoped .pv-* visual system (brand tokens; verdict color; reduced-motion; responsive)
docs/design-05/
  00-reference-analysis.md  01-art-direction.md  02-homepage-storyboard.md  03-implementation-plan.md
  captures/  (7 viewports + Verified + running frames)
```

## Known follow-ups / limitations recorded in Phase 0
- The nav renders correctly at the top in-browser; Playwright *full-page* screenshots can paint a `position:sticky`
  header mid-page — a capture artifact only (deliverable captures neutralize sticky for cleanliness).
- With JavaScript fully disabled in **dev**, component-imported CSS (Next injects it via JS in dev) does not load, so
  the page appears unstyled; the **SSR HTML is complete** (hero, claim, all obligations, trust-gap, footer are
  present) and production serves that CSS via `<link>`, so it renders without JS. The stated requirement
  (reduced-motion + no-interaction comprehension) is met and verified.
- Fixtures are static; when Phase 4 wires any real telemetry it must stay anonymized and never touch customer records.
