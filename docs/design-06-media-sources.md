# Design 06 — media sources and licensing

Branch `feature/design-06-public-rebuild`. This records the media strategy for the new public site and the
license status of every external asset. It is kept truthful: nothing is hotlinked, and nothing is claimed to
be sourced that is not.

## Strategy: authored product media first

The visual richness of the new site comes primarily from **authored product-UI and composition**, not stock
imagery. This is deliberate. The founder's brief explicitly bans "random AI stock footage," "glowing brains,"
"humanoid robots staring at screens," "neon neural networks," and "generic server rooms." For a product whose
subject is *oversight of live agent work*, a bespoke product environment is both more specific and more
credible than any stock photograph.

Authored media currently in the build (no external license needed; all first-party CSS/SVG/product-UI):

- **The oversight console** (homepage hero) — a live responsibility with an activity stream, a tracking rail,
  and a human-decision state.
- **The lifecycle timeline** — one continuous, state-changing timeline (Assign → Remember).
- **The verification proof panel** — the real requirement-held / Failed → Verified capability, shown deeper.
- **The three-signal system** — trusted / needs-review / stopped, as a reusable visual language.
- **Diagrams** on Research and the platform (expected-vs-observed, coverage) are inline SVG/CSS.

## External assets

**None used yet.** No photographic or video assets have been downloaded or embedded in this pass. When real
media is warranted (for example a single "software operating in the physical world" band on the company or
platform page), it will be sourced under the process below and this file updated with the exact asset, source
URL, license, and local path.

### Approved sourcing process (for when external media is added)

1. Source only from providers with explicit commercial-use / CC0 terms: **Poly Haven** (CC0), **Pexels**
   (Pexels License), **Mixkit** (Mixkit License), or equivalent with documented commercial rights.
2. Confirm and record the license for each asset.
3. **Download into the repository** (`public/media/design-06/…`) — never hotlink.
4. Optimize: `next/image` for stills with responsive `sizes` and AVIF/WebP; compressed MP4/WebM for video
   with a poster frame; lazy-load below the fold; preload only critical hero media.
5. Record the asset, source, license, and path in the table below.

### Asset register

| Asset | Type | Source | License | Local path | Used on |
|---|---|---|---|---|---|
| _(none yet)_ | — | — | — | — | — |

## Subjects allowed / disallowed (from the brief)

- **Allowed** when it genuinely supports the narrative: people supervising systems, software operating in the
  physical world, infrastructure, robotics, logistics, workstations, real development environments,
  autonomous systems.
- **Disallowed:** glowing brains, humanoid robots at screens, neon neural networks, generic server rooms,
  fake holograms, crypto-style graphics, decorative "AI" stock.
