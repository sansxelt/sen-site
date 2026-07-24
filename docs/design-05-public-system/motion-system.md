# Vraelis public-site motion system (site-v1)

One motion grammar across the whole public site. The site feels smooth because motion is **consistent and
restrained**, not because every element performs. Native scrolling only. No Lenis, no scroll hijacking, no
ambient loops, no particles, no parallax, no marquees, no custom cursor, no magnetic buttons.

Everything shares one easing (`--sv-ease: cubic-bezier(0.22, 1, 0.36, 1)`) and a small duration set.

## The classes

1. **Page entrance** — `.sv1-page` (in `RouteTransition`, keyed by pathname). On each route mount the page
   body fades + rises (`opacity 0→1`, `translateY 10px→0`, 380ms). The shell (nav/footer) persists; no blank
   flash; navigation is never delayed for effect.
2. **Section / media reveal** — `.sv1-reveal` (IntersectionObserver adds `.in`). Opacity + a 13px settle,
   560ms, plays once. `--i` gives a small stagger only where a sequence benefits (the numbered steps, the
   breadth rows). Media centerpieces use `.sv1-reveal--media` (a scale-settle), then their own signature
   plays — never a plain fade-up for the hero visual.
3. **State transition** — the homepage signature. On the production-proof panel, the requirement stays fixed
   while the deployment moves Failed → Verified. Only the two rows that actually changed mutate
   (`account.plan`, `entitlement.pro`); their value colour and the row background crossfade (400ms), the
   verdict word swaps, and both records stay in the preserved-lineage strip. A segmented control
   (First deployment / After repair) makes it explorable and keyboard-operable.
4. **Assembling narrative** — the product signature. A sticky Guarantee card assembles as the eight lifecycle
   stages scroll past: requirement → obligations → reviewed plan → approval → execution → evidence →
   preserved records. Each layer expands with a `grid-template-rows 0fr→1fr` + opacity reveal (480ms). The
   active stage is marked on the right; the card accumulates and never disassembles.
5. **Link & button interaction** — arrow nudge (`translateX 3px`, 180ms), editorial underline grows
   (`background-size`, 220ms), CTA press (`scale 0.98`, 130ms). 120–220ms throughout. No magnetic, no cursor.
6. **Route transition** — restrained; the shell stays, only the page body transitions (class 1). Back /
   forward restore correctly (verified). No full-screen loader, no fake progress bar.
7. **Nav theme flip** — the sticky nav goes transparent → blurred paper on scroll (`data-scrolled`), and
   flips to a dark treatment while a `data-nav-dark` evidence section sits under it (`data-theme`), 260ms, so
   it stays legible across light and dark sections with no jump.

## Rules honoured

- Native scroll; no Lenis; no scroll hijacking.
- No decorative ambient motion, particles, parallax, or velocity marquees.
- No animation hides essential content.
- **Reduced motion shows everything immediately**: reveals resolve to visible, the page/hero entrances are
  disabled, the assembling card is fully assembled, and every stage is at full opacity. Verified: 0 hidden
  reveals on home, 7/7 layers and 0 hidden stages on product.
- Mobile motion is simpler, not merely slower: the sticky narrative un-pins and shows the assembled card;
  hero and panels stack.

## Performance

Motion is transform / opacity / colour, plus one `grid-template-rows` on a single small card. No
`transition: all`, no `ease-in` on UI, no `scale(0)`. `will-change` is not left persistently on elements.
The homepage auto-advance and the reveal observers each run once and disconnect.

## Per-page signatures (one each, as required)

- **Home:** the Failed → Verified evidence transformation on a real production run (class 3).
- **Product:** the Guarantee assembling from requirement to preserved records (class 4).

Each page has exactly one authored centerpiece; everything else is the shared, quiet grammar.
