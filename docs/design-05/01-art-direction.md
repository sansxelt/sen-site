# Design 05 — Vraelis art direction

> **Revised in Phase 0B.** The warm-paper/cream direction below was rejected (too flat, too template). The
> flagship now lives on a **dark verification-instrument scene** (deep ink, hairline grid, monospace instrument
> voice, no serif) where the agent's claim enters as a signal, the proof trace holds then BREAKS at the failing
> obligation, and the verdict is the only glowing color. See `phase-0b-notes.md` for the current direction. The
> shared principles below (verdict-quarantined color, product-as-artwork, one-idea-per-viewport, motion reflects
> a real state change, shared conclusion language with the app, honesty-as-design) all still hold.

The public site and the app are the same company seen from two distances. The **app** is operational: calm,
evidence-dense, restrained motion, tuned for repeated use. The **public site** is cinematic: it makes the trust
problem *felt* in ten seconds and lets the product be the spectacle. They share a brand mark, a type system, a
color language, an evidence language, a conclusion language, and one motif — the proof path.

## Visual thesis

> **A claim enters. Reality answers.** Everything on the page is in service of one sentence becoming provable, and
> the evidence — not a headline — carrying the verdict.

The surface is warm paper and ink, engineered and quiet, so the only saturated thing on the page is a *conclusion*.
That restraint is the argument: a trust company that shouts is compensating; a trust company that shows you the
evidence and lets the color mean something is credible.

## The proof-path motif (the one proprietary device)

A verification is a path with a fixed grammar:

```
Claim → Reviewed plan → Pinned deployment → Live execution → Evidence → Conclusion → Historical record
```

- **The gapped ring** is the mark. The center is *what must be true*; the swept arc is *independent verification*.
  Completion is a near-closed ring with a signature gap (Verified). Interruption is the arc stopping and breaking at
  the point of contradiction (Failed). It animates only while verification is genuinely progressing — never a spinner.
- **The spine** is the path made linear: obligation nodes connected by a rail that *fills* as each obligation
  resolves and *breaks* (a dashed red segment) at a failure. This is the flagship's live-execution surface.
- **Reuse across surfaces:** hero interaction, section connectors, verification lineage, loading/progress, evidence
  provenance, Proof Links, developer diagrams, and future Guarantee surfaces all draw from the same node-rail-ring
  vocabulary, so the whole product feels authored by one hand.

## Typography (shared with the app)

- **Display / body:** Geist Sans (`--font-display`, `--font-sans`) — the app's face. Headlines at 600, tight
  tracking (−0.03em display, −0.022em section), leading ~1.02–1.08. Body at 400, 1.5–1.55, measure capped 52–62ch.
- **The one flourish:** Instrument Serif italic (`--font-italic`, class `.pv-serif`) for one or two words inside a
  display line ("proves it works", "proves whether it is"). Used *once per view*, never more.
- **Technical voice:** `--font-mono` (Inter Tight, the app's "instrument" label font) for eyebrows, ids, obligation
  state labels, and capture metadata — uppercase, 0.08–0.12em tracking. Numerals are treated as content, not fine print.
- **Scale is a small deliberate set:** display / section-h2 / claim / body / meta / label. No in-between noise.

## Color (verdict-quarantined)

Base palette is the shared brand (warm paper + emerald), tokens from `/vraelis/tokens.css` + `/vraelis/styles.css`:

| Role | Token / value |
| --- | --- |
| Paper floor | `--bg-0` #FAF8F4 |
| Card | `--bg-1` #FFFFFF · recessed `--bg-2` #F1EEE7 |
| Ink | `--fg-1` #1B1A16 → `--fg-5` #6B645A (five warm steps) |
| Primary / brand | emerald `--acc` #0E9E6C · deep `--acc-deep` #0A7B54 |
| **Verified** | ink #0A7B54 · bg #E7F3EC · line rgba(14,158,108,.30) |
| **Failed** | ink #A8452A · bg #F6ECE7 · line #E7CFC5 |
| **Blocked / running** | ink #7E6F43 · bg #F2ECDD |
| Structure | warm hairlines rgba(28,27,24, .07/.12/.20) |

Rule: **paper + ink for ~90% of the page; saturated color appears only on a conclusion, a pass/fail node, or the
primary CTA.** The green Verified and the red-brown Failed are the same tones the app uses (Design 02 conclusion
language), so a verdict reads identically on the site and in the product.

## Layout

- Centered editorial column, `--pv-max` 1120px, gutter clamp(20–48px). One idea per band, wide calm margins around
  dense product surfaces.
- The flagship console is a white panel with a hairline border, soft warm shadow, and a thin instrument status bar —
  it reads as a real product surface dropped onto paper, not a screenshot in a browser chrome.
- Structure is drawn with **hairlines and whitespace**, not boxes and shadows (Mercor/Linear discipline).

## Evidence language

Evidence is an *object*, never a decorative thumbnail. Each carries: which obligation it belongs to, an
Expected-vs-Observed pair, and a stylized state frame (a small depiction of the app's plan state — Free/Pro — with
capture metadata), plus an honest caption. Screenshots in the real product load only through the owner-checked
signed route; the public prototype uses stylized frames so no private surface is ever shown.

## Conclusion language (shared with the app)

Only **Verified / Failed / Blocked** plus honest non-conclusions (Verifying / Not yet verified). Verified is always
scoped ("on the checked workflow"), Failed means the checked claim did not hold, Blocked is never a confirmed
product failure. repair_verified renders publicly as Blocked. This vocabulary is identical to Design 02.

## Motion

- **Only ever reflects a real state change.** The ring sweep and node reveal are driven by the actual (fixture)
  step results; the rail fills as an obligation holds and breaks when one fails.
- Timing: transitions 160–500ms on the token easing `cubic-bezier(.4,0,.2,1)`. A single "live" pulse marks an
  in-progress run. Entrance is a short rise/fade, gated so it can never strand content.
- **No** scroll-jacking, parallax spectacle, autoplay audio, or decorative WebGL. Auto-play pauses when the tab is
  hidden, when the console scrolls out of view, and on any interaction.

## Interaction

The flagship is a replayable product demonstration: play/pause, replay, step scrubber, jump-to-obligation, and three
record tabs (Failed / Failed / Verified). It auto-plays the Failed→Failed→Verified story; the visitor can take over
at any time. Every control is a real `<button>`; nothing requires precise pointer control or hover-only reveal.

## Responsive

- Console grid is 2-column (spine | ring+verdict+evidence) ≥880px, single-column below. Lineage is 3-up ≥720px,
  stacked below. Nav links collapse ≤720px to brand + CTAs.
- Long values wrap; identifiers use tabular mono; nothing exceeds the viewport. Verified 0px horizontal overflow at
  1440/1280/1024/768/430/390/320.

## Reduced motion

`prefers-reduced-motion: reduce` holds the **resolved** frame (record 1, Failed, fully shown) with no auto-play, no
pulse, no entrance — the story is fully comprehensible statically. Controls still work for manual stepping.

## Accessibility

One `<h1>` per page; semantic section headings; every control a real button; visible focus ring (`--acc-deep`, 2px);
a polite `role="status"` live region announces each phase and conclusion without moving focus; icons are aria-hidden
with meaning carried by adjacent text; verdict is conveyed by label + shape, never color alone; touch targets are
comfortable. Verified via Playwright: keyboard toggle of play/pause, tab semantics, live-region text.

## Performance

Server-rendered static structure; one small client component (the console) — no other section hydrates. CSS
transforms/opacity + lightweight inline SVG only; no canvas/WebGL, no animation library, no web-font network fetch
(Geist is self-hosted; the fixture data is a few KB). 0 console errors across all captures. Budget for the full
build: keep the flagship's JS well under a modest ceiling and never hydrate a static section without reason.
