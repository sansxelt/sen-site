# Vraelis public-site design system (site-v1)

One coherent, white-first, editorial system meant to feel the same on every public route. Scoped entirely
under `.sv1` in `app/dev-preview/site-v1/_system/system.css`; it never touches the live site or the app.
The light palette is aliased to the real brand tokens (`public/vraelis/styles.css`), so the system *is* the
brand rather than a look-alike.

## Palette

White-first. Dark surfaces are used only where technical proof genuinely belongs (execution, browser
evidence, code). Emerald is reserved for actions and Verified; clay for Failed; a neutral for Blocked.

| Token | Value | Role |
|---|---|---|
| `--sv-paper` | `#FAF8F4` (= `--bg-0`) | page floor |
| `--sv-card` | `#FFFFFF` (= `--bg-1`) | cards, panels |
| `--sv-well` | `#F1EEE7` (= `--bg-2`) | alternating sections |
| `--sv-ink` | `#1B1A16` (= `--fg-1`) | headlines |
| `--sv-body` | `#35322B` (= `--fg-2`) | body (~10:1) |
| `--sv-mut` | `#565249` (= `--fg-3`) | secondary (~6:1) |
| `--sv-meta` | `#54504A` (= `--fg-4`) | meta / labels (~7:1) |
| `--sv-ok` | `#0A7B54` (= `--acc-deep`) | action + Verified |
| `--sv-fail` | `#A8452A` | Failed (clay) |
| `--sv-block` | `#6B665C` | Blocked (neutral, never alarming) |
| `--sv-line / --sv-line-2` | brand hairlines | rules, borders |
| **dark evidence** | `--sv-dark #0E1320`, `--sv-dfg #ECEFF4`, `--sv-dfg2/3`, `--sv-dok #35D6A0`, `--sv-dfail #F0714F` | execution / browser / code only |

Rule: light surfaces carry category, product explanation, Guarantees, reviewed plans, pricing, company
narrative. Dark surfaces carry browser execution, evidence, deployment state, verification conclusions.

## Typography

One authoritative sans — **Geist Sans** (`--sv-sans`, via `--font-geist-sans`). **No serif, no script, no
gradient type.** Monospace (`--sv-mono`, via `--font-geist-mono`) is used *only* for machine text:
deployment IDs, evidence values, API code, timestamps, eyebrows, and technical labels.

| Class | Size | Use |
|---|---|---|
| `.sv1-display-xl` | `clamp(2.5rem, 5.4vw, 4.4rem)`, 600, -0.035em | hero H1 |
| `.sv1-display-l` | `clamp(1.95rem, 3.7vw, 2.95rem)`, 600 | section H2 |
| `.sv1-display-m` | `clamp(1.35rem, 2.4vw, 2rem)`, 600 | sub-statement |
| `.sv1-lead` | `clamp(1.08rem, 1.35vw, 1.28rem)`, 1.55, ≤62ch | lead paragraph |
| `.sv1-body` | 16px, 1.62, ≤66ch | body |
| `.sv1-eyebrow` | mono 12px, 0.14em, emerald + rule | section kicker |
| `.sv1-tlabel` | mono 10.5px, 0.11em, meta | technical label |

Emphasis inside a headline is **tonal** (a clause set in `--sv-mut`), never a second colour or a serif.

## Spacing & section rhythm

`--sv-gutter clamp(20px,4vw,64px)`, content `--sv-max 1200px` / `--sv-max-wide 1320px`, section rhythm
`--sv-sec clamp(88px,12vh,168px)` (deliberately generous). Every section follows the recurring unit:
**strong statement → concise explanation → real proof/visual → one clear next action.** Compositions vary
deliberately: asymmetric hero (home), centered editorial hero (product), dark evidence panel, numbered
editorial sequence, two-part status rows, sticky narrative, current/next split. No wall of identical cards.

## Components

Built and in use (Stage 3):

- **PublicShell / PublicNav / MobileNav / PublicFooter / RouteTransition** — `_system/shell.tsx`
- **Reveal, SectionHead, PrimaryCTA, EditorialLink, TechnicalLabel, Eyebrow, Verdict, Pill,
  PreservedRecord, EvidenceSurface, EvidenceRows, CurrentNext** — `_system/ui.tsx`

Planned for Stage 4 (Developers / Pricing / Research / Enterprise): **CodeExample** (tab + copy, keyboard
accessible), **MediaStage**, **StickyNarrative** (generalised from the product signature), **PriceCompare**
(reads `lib/preflight/pass-pricing.ts` only). Each supports several compositions rather than forcing one
template.

## Accessibility

- Visible `:focus-visible` outlines on every interactive element (2px, emerald / dark-emerald over dark).
- Mobile drawer is a real `role="dialog" aria-modal`, focus-trapped, Escape / scrim / link close, body-scroll
  locked, focus returned.
- Nav CTA verb is one word everywhere: **Verify an application**. `aria-current="page"` on the active link.
- Text contrast holds the brand's ratios (body ~10:1, secondary ~6:1) on paper; dark-surface text uses the
  lighter dark-foreground set.
- Non-navigable "soon" items are inert `<span>`s, correctly skipped in tab order.

## Responsive

Breakpoints at 900 / 860 / 560 / (tested to 320). Nav collapses to a burger + drawer under 860. Hero grids,
the proof panel, and the product narrative collapse to a single column; the sticky narrative un-pins and the
Guarantee card shows fully assembled. No primary text below ~13px; no horizontal scroll at any width down to
320. Verified: 0 overflow across 1440 / 1280 / 1024 / 768 / 430 / 390 / 320 on both pages.

## Adding a route

Create `app/dev-preview/site-v1/<route>/page.tsx` (server, thin) rendering a client view that composes the
primitives. It inherits the shell, nav, footer, route transition, and tokens automatically. Only add a route
when there is current, truthful content for it (see `route-audit.md`).
