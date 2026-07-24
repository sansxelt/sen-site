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
| _(none yet)_ | n/a | n/a | n/a | n/a | n/a |

## Identified media opportunities (specified, NOT sourced or implemented)

The mandatory design review found zero media across ten homepage sections and seven secondary routes, and all
four reviewers independently judged that this reads as visually thin rather than as restraint, because the
restraint is never paid for with scale contrast. Below are the three placements where real licensed media
would materially raise authority. **Nothing here is sourced or implemented; this awaits founder visual
review of the current recordings.**

A standing constraint applies to all three: no screens, no robots, no server racks, no blue light, no
"AI" abstraction. Grade everything near-black so the three signal colours stay the only chroma on the page.

**1. Behind the lifecycle band (homepage, section 3, currently graphite).**
- Subject: one identifiable physical object moving through sequential inspection and sign-off stations, for
  example an aerospace or precision-parts inspection line.
- Narrative purpose: this is the page's thesis section, "one responsibility followed the whole way." Physical
  sequential inspection is the real-world answer to the same problem, so it argues the thesis instead of
  decorating it.
- Crop: full-bleed, wide letterbox, object entering frame left and exiting frame right.
- Type: **scroll-linked** (scrubbed), so movement through stations maps to movement through the eight states.
- Licence source: Pexels or Mixkit (commercial-use video), or commissioned.

**2. The problem section (homepage, section 2).**
- Subject: a metrology or calibration bench. Instruments that exist purely to check other instruments.
- Narrative purpose: "the builder cannot be its own judge" made concrete. Independent measurement is a trade
  that already exists; Vraelis is that trade for software.
- Crop: tight, shallow depth of field, one instrument dominant, heavy negative space for the claim to sit in.
- Type: **still image**.
- Licence source: Pexels (Pexels Licence) or Poly Haven (CC0).

**3. The memory section (homepage, section 7, currently graphite).**
- Subject: a physical records archive; ordered, indexed, retained.
- Narrative purpose: memory as accumulated, preserved record rather than a feature list. Supports "a later
  result never overwrites an earlier one."
- Crop: deep perspective down a run of shelving, vanishing point off-centre so the copy holds the other side.
- Type: **still image**, possibly a very slow ambient loop.
- Licence source: Pexels (Pexels Licence).

### The competing strategy the founder must choose between

The reviewers split on this and it is a genuine judgment call with cost and timeline consequences:

- **Option A, documentary media** (the three placements above). Buys authority and scale contrast quickly;
  costs sourcing, licensing, grading, and weight.
- **Option B, authored engineering substrate, no photography at all.** A cream-on-cream measurement grid with
  labelled ticks running full width behind the type, the responsibility interval line as the repeating
  structural rule across every route, and one hard-numbered proof element at display scale. Buys a silhouette
  that is unmistakably Vraelis and cannot be swapped onto another company; costs authored design time and
  carries more risk of reading as sparse if executed timidly.

They are mutually exclusive on one page. Doing neither leaves the authority gap the review identified.

## Subjects allowed / disallowed (from the brief)

- **Allowed** when it genuinely supports the narrative: people supervising systems, software operating in the
  physical world, infrastructure, robotics, logistics, workstations, real development environments,
  autonomous systems.
- **Disallowed:** glowing brains, humanoid robots at screens, neon neural networks, generic server rooms,
  fake holograms, crypto-style graphics, decorative "AI" stock.
