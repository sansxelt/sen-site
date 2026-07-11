# Vraelis Preflight demo fixture

A tiny, self-contained "project dashboard" used to verify Vraelis Preflight
against a **real browser**. It genuinely reproduces two common AI-built-app
defects (persistence failure and a mobile nav overlay) so a preflight run has
something honest to find. Nothing here is hardcoded to produce a Vraelis result:
the defects come from real page behavior.

- Plain HTML / CSS / vanilla JS. No build step, no framework, no backend.
- No external requests, no fonts, no images, no analytics.
- No real data, no billing, no email, no secrets.

## Files

- `index.html` - the whole app (markup, styles, and script inline).
- `vercel.json` - minimal static config.
- `README.md` - this file.

## Deploy (Vercel static)

This folder is a standalone static site. Deploy it as its own Vercel project:

1. Create a new Vercel project and set the **Root Directory** to
   `fixtures/preflight-demo`.
2. Framework preset: **Other** (the included `vercel.json` sets
   `"framework": null` and no build command; the output directory is `.`).
3. Deploy. Vercel serves `index.html` directly.

Local preview without any tooling: open `index.html` in a browser, or serve the
folder with any static server (for example `npx serve fixtures/preflight-demo`).

## Modes (switch via the URL query)

Behavior is controlled by a `mode` read from the URL, so a run or smoke test can
target one mode by URL:

- `?mode=broken` (default) - persistence failure **and** mobile nav overlay.
- `?mode=partially_fixed` - persistence works; mobile nav overlay remains.
- `?mode=fixed` - everything passes.

Examples:

```
https://<your-deployment>/?mode=broken
https://<your-deployment>/?mode=partially_fixed
https://<your-deployment>/?mode=fixed
```

An unknown or missing `mode` falls back to `broken`.

## Expected failures per mode

| Mode              | Persistence (create, then refresh) | Mobile nav overlay (viewport <= 480px) |
| ----------------- | ---------------------------------- | -------------------------------------- |
| `broken`          | FAILS: records are kept in memory only, so a refresh loses them (fake success) | FAILS: the fixed top nav covers the "Create project" button |
| `partially_fixed` | PASSES: records persist in `localStorage` and survive a refresh | FAILS: the nav still covers the "Create project" button |
| `fixed`           | PASSES                              | PASSES: the button stays in normal flow, visible and clickable |

### How each defect is real

- **Persistence.** In `broken` mode created projects live only in an in-memory
  array and are never written to storage, so a browser refresh genuinely loses
  them even though a "Project created" toast showed. In `partially_fixed` and
  `fixed` modes records are written to `localStorage` and reload after refresh.
- **Mobile nav overlay.** The top nav is a `position: fixed`, opaque bar at
  `z-index: 1000`. At a phone viewport (<= 480px) in `broken` and
  `partially_fixed` modes the "Create project" button is pinned into the top
  strip beneath the nav at a lower `z-index`, so the nav paints over it:
  `document.elementFromPoint` at the button's center returns the nav, and a real
  tap lands on the nav. In `fixed` mode the button remains in normal flow below
  the nav and is fully reachable. Use a phone-sized viewport (device emulation or
  a window <= 480px wide) to observe it.

## Accessible names (stable selectors for checks)

- Heading: `Your projects`
- Text input label: `Project name` (`<label for="project-name">`)
- Primary button accessible name: `Create project`
- Success toast text: `Project created` (`role="status"`)
- Hamburger accessible name: `Open navigation menu` (intentionally distinct from
  the primary button)

## Cleanup

- Created records are prefixed `Vraelis Fixture:` and carry a `fixture` badge.
- A page-level banner reads **This is a Vraelis test fixture**.
- The **Clear all (fixture only)** button empties the in-memory list and removes
  the `vraelis-fixture-projects` key from `localStorage`.
- The site is static and safe to run repeatedly; `vercel.json` sets
  `Cache-Control: no-store` so each run gets a fresh copy.

## Safety boundary

This is a Vraelis-owned fixture for verification only. It touches no real
systems: no backend, no network calls, no billing, no email, no authentication,
no secrets. The only client-side state is a single `localStorage` key
(`vraelis-fixture-projects`) holding fake project names, cleared by the "Clear
all" button. Point preflight runs at this fixture, never at third-party or
production apps you do not own.
