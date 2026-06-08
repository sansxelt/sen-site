# Vraelis Design System

Vraelis is a single-product hardware brand. The product is **Vraelis** — a pair of glasses with a 360° camera ring for recording, near-field stereo audio audible only to the wearer, an ambient HUD layered over your sight, and on-device voice recognition tuned to both speech and whisper.

One product. One brand. Dark, quiet, cinematic — the product is the hero, the UI gets out of the way.

> **Pivot history (informational only):** Earlier Vraelis surfaces referenced multiple products — an AI workspace ("Workshop"), a contact-lens R&D line ("Lens"), audio earbuds ("Whisper"), an "AI contacts" range. **All of those are retired.** The brand is now consolidated around a single wearable: the Vraelis glasses. The system retains its violet brand accent and Geist typography from the prior identity, but every mention of the old sub-products has been removed.

---

## Sources

This design system was distilled from:

- **Marketing + onboarding site:** [`sansxelt/sen-site`](https://github.com/sansxelt/sen-site) — the legacy Next.js codebase. The visual system (color tokens, cinematic-act layout, Geist type stack, hairline-card recipe, scrim ramps, easing curves) is lifted directly from this repo. The product framing is **not** — that's been rewritten for the new single-product direction. Browse the repo if you need additional layout patterns (3D scenes, scroll-driven dollies, glass slabs) the system doesn't expose yet.

---

## Brand at a glance

- **Product:** Vraelis — wearable glasses. 360° camera, private stereo audio, ambient HUD, voice + whisper recognition.
- **Personality:** Quiet, cinematic, considered. More Kubrick than Apple-Keynote.
- **Voice:** Plain English. Sentence-case product. Never shouty. Never emoji.
- **Visual:** Dark-only. Full-bleed photography (real lifestyle / studio stock). One signature violet accent. Mono-uppercase eyebrows. Generous radii. Hairline borders, no drop shadows.
- **Type:** Geist Sans for everything; Geist Mono for labels, specs, status, code.

---

## Index — what's in this folder

```
/                          → you are here
README.md                  → this file
SKILL.md                   → invocation contract for Claude Code / agent skills
colors_and_type.css        → all design tokens (CSS vars) + semantic styles
assets/                    → logos and brand marks
preview/                   → small HTML cards that populate the Design System tab
ui_kits/
  website/                 → marketing-site UI kit
    README.md
    index.html             → live interactive preview
    *.jsx                  → modular React components
```

Cards in `preview/` are not meant to be opened directly — they auto-mount into the Design System tab. UI kits, by contrast, are real prototypes you can open from `ui_kits/<product>/index.html`.

---

## Content fundamentals

### Voice & tone

Vraelis copy is **direct, considered, and quiet**. It assumes the reader is smart and gives them facts, not adjectives. No exclamation, no hype, no "revolutionary," no "AI-powered." Hardware claims are stated, then qualified.

Examples (production-faithful in tone):

> "Glasses with a 360° camera ring, near-field stereo audio only you hear, an ambient HUD layered over your sight, and on-device voice tuned to whisper."

> "Be first to wear Vraelis. We will email when there is an early-access window or development-kit signup. No spam, no marketing pollution."

> "The glasses don't run heavy AI. Your phone does. Compute lives on your phone or PC where there is power and thermal headroom. Vraelis renders the result."

Notice:

- **Sentence-case product name.** "Vraelis." Never "VRAELIS" in body copy or "Vraelis™."
- **Periods, not exclamations.** Every line ends in a calm period.
- **The brand effaces itself.** Headlines describe what the product does ("Record what you saw."), not what the company built.
- **Lowercase mono eyebrows** sit above sections — `mode`, `vraelis · in r&d`, `360° capture`. Always uppercase mono in the rendered UI.
- **Em-dashes are rare.** Sentences are short. Fragments are common.
- **No emoji.** Not in product, not in marketing. The only "decorative" character used is the right-pointing arrow `→` next to a CTA.
- **No bullets in body copy.** Lists exist (mode cards, specs) but prose is prose.

### "I" vs "you"

- Marketing voice talks **to "you"** — "Be first to wear Vraelis," "Record what you saw."
- Product UI **avoids both** — it states facts ("3 unread," "Recording," "Battery 78%").
- The brand **never says "we"** in product surfaces and uses "we" sparingly in marketing — only for literal team actions ("We will email when…").

### Casing rules

| Surface | Style |
|---|---|
| Product name in body copy | Sentence-case: *Vraelis* |
| Section headlines | Sentence-case: "Three ways to wear them." |
| Mono eyebrows / labels | UPPERCASE, 0.16em letter-spacing |
| Buttons | Sentence-case, no period: "Join the waitlist" |
| Status pills | UPPERCASE mono: `RECORDING`, `LIVE`, `PAIRED` |

### Punctuation

Headlines that fit on one line **end with a period.** Headlines that wrap with a `<br/>` use a period at the end of the last line. Declarative, not interrogative.

> "Three ways to wear them."
> "Record what you saw. From every angle."
> "Be first to wear Vraelis."

---

## Visual foundations

### Color

Dark-only. **No light mode** and no toggle. Page floor is `#050507` — slightly cool, slightly desaturated, sits behind cinematic photography without competing.

- **Primary accent: violet `#c084fc`.** The brand color. Used for product CTAs, the brand dot, status halos, primary waitlist plate. (Carried over from the prior identity — its meaning is no longer "the Lens product" but simply "Vraelis.")
- **Secondary: cyan `#22d3ee`.** Used as the audio/signal color — voice waveforms, sync, the "audio" act. Never used as the primary brand accent.
- **Tertiary: pale sky `#a8c4ff`.** A cool neutral accent for chrome — CTAs over photos, focus rings, secondary glow gradients. The most-used "soft" accent.
- **Semantic:** emerald (`#34d399`) for success, amber (`#fbbf24`) for warning, rose (`#fca5a5`) for error, red (`#ef4444`) for the recording dot only.

Foregrounds step down in five quiet beats — `#f5f5f7` for headlines, then `e4e4e7`, `a1a1aa`, `71717a`, `52525b`. Never pure white.

See `colors_and_type.css` for the full token list.

### Type

- **Geist Sans** for everything. Headlines use weight 300 (light) at huge sizes (`clamp(2.2rem, 5vw, 4.5rem)`) with `-0.025em` tracking. Body uses weight 400. Labels use Geist Mono uppercase with `0.16em` tracking.
- **Geist Mono** for: labels, specs, eyebrows, code, time/date, pricing units, status text — anywhere the type is doing a job rather than reading.
- **No serif anywhere.** No italic. No underline except on inline links (with `text-underline-offset: 4px`).
- **Text-wrap:** display headlines use `text-wrap: balance`; body uses `text-wrap: pretty`.

### Backgrounds

The visual signature of the brand is **full-bleed real photography with cinematic scrims.**

- Hero sections are `100svh` photographs with a bottom-anchored scrim ramping `transparent → #050507` over the lower 65% of the frame. Text sits on the dark side; the photo stays clean on the light side.
- `leftScrim` is a compound vertical + horizontal gradient that darkens only the corner where the headline anchors.
- A radial accent halo (`radial-gradient(ellipse 60% 50% at 50% 50%, var(--vio-soft) 0%, transparent 60%)`) sits behind the outro / waitlist plate.
- **Imagery is real-world**, never illustrated. Lifestyle stock or bespoke studio work. Mood-matched: warm subject against cool environment, shallow focus, slight grain, no people front-and-center.
- No repeating patterns. No noise textures. No mesh gradients. No animated SVG backgrounds.

### Layout rules

- Section padding: `clamp(64px, 12vh, 140px) clamp(20px, 5vw, 80px)`. Generous on every viewport.
- Content max-widths: 1280px main, 880px center-aligned editorial, 540px body paragraph, 640px hero copy.
- Hero anchors are off-centre — `bottom-left`, `bottom-right`, occasionally `bottom-center`. Never `top-left`. Low-anchor reads better with the scroll dolly.
- **Three-column "node" grid** is a recurring pattern — three pills, each with a colored dot + uppercase mono label + tiny description. Used for product architecture (Glasses / Phone / Cloud).
- Cards always have a hairline border (`rgba(255,255,255,0.07)`) and a soft tinted background (`rgba(255,255,255,0.02)` or an accent at `0.04` opacity). Never solid-fill cards.

### Animation

- **One signature ease**: `cubic-bezier(0.16, 1, 0.3, 1)` — slow ease-out with a long tail. Branded as `--ease-cinematic`.
- **Cinematic acts** scale `1.0 → 1.12` and drift `-40px → 40px` on scroll (slow dolly push). Text parallaxes at a slower rate.
- **Entrances** stagger: headline rises `28px → 0` over 900ms with 0.1s delay; body rises 16px over 700ms with 0.25s delay; CTA rises 8px over 500ms with 0.40s delay. This stagger is the brand's heartbeat.
- All motion gated by `prefers-reduced-motion`. No bounces, no springs, no elastic, no keyframe spinners.

### Hover, press, focus

- **Hover** raises border opacity (e.g. `rgba(192,132,252,0.22) → 0.50`) and shifts text color from faded to full. No background fill change.
- **Press** translates the element down by `1px` (`transform: translateY(1px)`). Physical, minimal. No scale.
- **Focus** uses a 2px sky-blue outline at `rgba(168,196,255,0.55)` with `2px` offset. Only on `:focus-visible`.
- Inline links are underlined with `text-underline-offset: 4px`. Stand-alone CTAs are unstyled wraps around a `.cta` pill.

### Borders, lines, dividers

- `rgba(255,255,255,0.05)` — default hairline
- `rgba(255,255,255,0.07)` — card border
- `rgba(255,255,255,0.10)` — button, hover
- `rgba(255,255,255,0.16)` — loudest separator
- Accent borders at `0.22` for default, `0.50` for emphasis.

### Shadows

The brand **almost never uses drop shadows.** When it does:

- `--shadow-card` — 1px inset highlight + long-tail 80px shadow at 80% black. Used only on cards over noisy photography.
- The signature elevation is **glow** — coloured halo behind a dot or chip, never around a card.

### Transparency & blur

- `backdrop-filter: blur(8px)` — pills over photos
- `backdrop-filter: blur(10px)` — CTAs over photos
- `backdrop-filter: blur(20px)` — "glass slabs" (waitlist plates on a section halo)
- Solid surfaces use no blur. Blur is reserved for UI overlapping photography.

### Corner radius

- `6px` chips/inline tags
- `10px` buttons, inputs
- `14px` small cards, mode tiles
- `18px` product cards, glass slabs (most-used)
- `24px` hero panels, waitlist plates
- `32px` device frames
- `999px` full-pill — CTAs, status chips

The brand **never** uses square corners on a clickable element.

### Cards

Default card recipe:

```css
background: rgba(255,255,255,0.02);
border: 1px solid rgba(255,255,255,0.07);
border-radius: 18px;
padding: clamp(18px, 3vw, 28px);
```

Featured / accent card recipe:

```css
background: rgba(168,196,255,0.04);   /* or any accent at 0.04 */
border: 1px solid rgba(168,196,255,0.22);
border-radius: 18px;
```

No drop shadow. No gradient fill. The accent variant tints the surface by 4% of its hue.

### Imagery vibe

- **Warm subject, cool environment.** Skin tones and product highlights are warm; backgrounds and shadows are cool blue-black.
- **Shallow focus.** Hero photos almost always have a fast-lens look — sharp subject, soft background.
- **Slight grain.** Never noisy, never plasticky-clean.
- **No people front-and-centre.** The product is the hero; people are in profile, partial, gestural.
- **Stock or bespoke — real.** No illustration, no 3D-rendered product placeholder unless explicitly approved. The website UI kit pulls lifestyle stock from Unsplash for now; production should swap to bespoke studio shots when assets are ready.

---

## Iconography

Vraelis uses **icons sparingly.** The default UI has fewer icons than a typical product — most cards are pure type.

- **No icon font in the codebase.** No Lucide, no Heroicons, no FontAwesome.
- **No proprietary SVG icon set.** When the UI needs an icon, it draws one inline (the `→` next to a CTA is the Unicode character).
- **The "node dot"** — an 8px circle with a colored glow halo next to a mono uppercase label — is the brand's signature decoration. It does the job of an icon in product chips, status pills, and architecture diagrams. See `.dot` in `colors_and_type.css`.
- **Unicode arrows** are used: `→` in CTAs, occasionally `↑` for trend. Never decorative emoji.
- **No emoji, ever.** Hard rule.

> **Substitution flag — for any project that needs an icon library:** because the brand has no committed set, **pull from [Lucide](https://lucide.dev/)** at stroke weight 1.5px in `var(--fg-3)` (`#a1a1aa`). It's the closest match to the brand's quiet, line-based feel. **Flag the substitution** — the brand has not blessed an icon library yet.

### Logos

The Vraelis mark is a stylized **"V"** — two angled strokes converging to a point on a black rounded square (24px radius) at 680×680px. Four color variants exist for use against different photo backgrounds, plus a circle-clipped variant for avatars. See `assets/`.

- `assets/logo-mark.svg` — primary V mark, white-on-black square
- `assets/logo-circle.svg` — circle-clipped variant for avatars
- `assets/logo-mark-cyan.svg`, `-amber.svg`, `-emerald.svg` — color variants
- `assets/icon-original.png` — original PNG mark

---

## Notes for designers

- **One product. One brand.** Don't add a second SKU, a sub-brand, or a separate marketing surface for an old product line. If the user asks for a sub-product, push back and confirm.
- **Resist adding sections.** The marketing site is 4–6 cinematic acts plus an outro. Don't add a 7th. If you need to communicate a new idea, ask whether one of the existing acts should change.
- **Photography > illustration > SVG.** When you need to fill a hero, ask for a real photograph or use lifestyle stock. Procedural 3D, gradient art, or hand-drawn illustration are last resorts.

---

## Caveats

- **Geist font files were not pulled into `fonts/`.** The system loads Geist Sans + Mono via Google Fonts CDN in `colors_and_type.css`. For offline-capable assets, request the WOFF2/OTF files from the production `geist` npm package.
- **Bespoke product photography does not exist yet.** The marketing site UI kit uses **lifestyle stock from Unsplash** as placeholders, hot-linked at 2000px wide. These are atmospheric stand-ins — none of them shows the actual Vraelis device. When real studio renders or product photography exist, swap them in (`PHOTOS` constant in `ui_kits/website/App.jsx`).
- **No icon set is committed.** As above. Substitute Lucide and flag.

