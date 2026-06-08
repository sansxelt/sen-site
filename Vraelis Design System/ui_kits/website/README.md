# Vraelis website UI kit

A high-fidelity recreation of the Vraelis marketing site, rebuilt around the **single-product pivot**: Vraelis Lens, the head-worn wearable. Built from the patterns in [`sansxelt/sen-site`](https://github.com/sansxelt/sen-site) — same cinematic-act layout, Geist Sans + Mono, dark-only palette, violet accent, glass slabs.

## Open

`index.html` — opens the full site. Scroll through the cinematic acts; click the Lens nav, the waitlist CTA, the capability tabs.

## Components

| File | What it is |
|---|---|
| `App.jsx` | The full single-page marketing site, composed from the parts below |
| `Header.jsx` | Top nav — wordmark, links, sign-in CTA |
| `HeroAct.jsx` | Opening cinematic act — placeholder photo, scrim, bottom-center type slab, product pill, primary CTA |
| `CinematicAct.jsx` | Reusable full-bleed scene — accepts headline, body, accent, anchor, scrim |
| `CapabilityModes.jsx` | Three-up mode cards (Ambient / Mainframe / Minimal) |
| `ArchitectureGrid.jsx` | Three-node architecture pills (LENS · PHONE · CLOUD) |
| `WaitlistPlate.jsx` | Glass slab with headline + email form on a radial accent halo |
| `Footer.jsx` | Footer with link columns + small wordmark |
| `ProductChips.jsx` | Pill row with brand dots — Lens / Audio / HUD |

## Substitutions

- **Hero photography:** the production site uses bespoke product/lifestyle photos (`lens-hero.png`, `mainimage.png`, `case-hero.png`) that were not pulled into this project. The UI kit substitutes a stylized **placeholder hero** — a dark gradient stage with a violet radial halo and a wireframed lens silhouette. **Flag to the user that real hero photography is the missing piece.**
- **3D scene:** the Lens architecture section in production uses an R3F scene rendered on a `<canvas>`. This kit uses a static SVG illustration of the same composition.
- **Icons:** none — the brand uses none. Unicode `→` is used for CTAs as in production.

## What's faithful to source

- Geist Sans + Geist Mono loaded via Google Fonts CDN (matches the production stack)
- Color tokens lifted from `app/globals.css` and `cinematic-act.tsx`
- `100svh` hero with bottom-anchored scrim, identical scrim ramp
- Mono uppercase eyebrows (0.16em tracking)
- Pill CTAs with backdrop-blur, sky-line border, sentence-case label
- Cinematic-display type uses weight 300 + `-0.025em` letter-spacing
- Mode card recipe (accent-tinted border + gradient surface) matches `/lens` page
