// LAYERED ENTRANCES IN THE DOCS (founder 2026-10-10: blocks fade up in order on load, lower ones as they scroll in).
// The docs mark their layers by hand: an element with data-rv is one layer, and every child of a data-rv-kids
// element is one (a child that is itself data-rv-kids passes the job to its own children). The header, the sidebar,
// search and Ask AI are not layers.
//
// Before first paint the layers are hidden by CSS alone (docs.css, "Layered entrance"): only where scripting is on and
// motion is allowed, and only until DocsReveal (_ui/reveal.tsx) marks the docs root ready; a 3 second CSS fallback
// shows them if it never does. No inline script, so nothing has to run before paint, and React never has to render a
// <script> on the client (it warns when a not-found page re-renders the layout there).
//
// On the main host the v8 layout's own pre-paint style (_kit/scripts.ts REVEAL_SCRIPT) also hides the direct children
// of #v8-main and every <section>; docs.css lifts that for the docs (everything they render is data-no-reveal), and
// the site's RevealOnRoute skips anything inside data-no-reveal.

export const DOCS_LAYERS = ".v8-docs [data-rv], .v8-docs [data-rv-kids] > :not([data-rv-kids]):not(script):not(style)";
/** Set on .v8-docs once DocsReveal has taken over; until then the CSS keeps the layers hidden. */
export const DOCS_READY_ATTR = "data-rv-ready";
