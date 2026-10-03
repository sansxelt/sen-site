"use client";

import { useEffect } from "react";

/* THE ROOT ERROR BOUNDARY, IN DESIGN 06.
 *
 * This catches errors in the root layout itself, so it REPLACES that layout and renders its own <html> and
 * <body>. No stylesheet has loaded and none may be linked: a <link> here is a network round trip on a page
 * that only exists because something already failed, and if the failure is the network the page arrives
 * unstyled. So every value is written into the page itself, restated, the same arrangement app/not-found.tsx
 * and app/_components/stealth-screen.tsx already carry. Keep them in step by hand. The <style> below is part of
 * this document, not a request: it carries only what inline styles cannot say (hover, focus, the phone size).
 *
 * WHAT IT USED TO BE, AND WHY THAT WAS THE WRONG PAGE TO GET WRONG. Warm paper #FAF8F4, a Georgia serif
 * wordmark, and a #0d5c46 emerald button: the retired generation's brand, kept alive here because nothing
 * links to this file and nobody re-reads it. Design 06 has no serif wordmark, no warm ground, and reserves
 * green for a check that held. A reader whose page had just failed was shown a different company's error
 * screen, wearing the product's success colour on its primary button.
 *
 * Black, contrast instead of hue, the system sans (the brand font is set by the root layout, which is what
 * failed). The same voice and the same buttons as the 404 and the route boundary, so the three failure surfaces
 * read as one product (plan C, 2026-10-02): a React <title>, since this cannot export metadata; the way to try
 * again first, as the white button at the large size, then the way home as the ghost beside it; radius 8.
 * "Try again" re-fetches with unstable_retry where Next 16.2 provides it, and falls back to reset.
 */
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const BTN = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box", minHeight: 52,
  padding: "8px 26px", borderRadius: 8, fontSize: 16, fontWeight: 600, letterSpacing: "-0.005em", lineHeight: 1.2,
  fontFamily: "inherit", textDecoration: "none", cursor: "pointer", margin: 0,
} as const;
const GE_CSS = `
.vge-cta:hover { background: #E4E4E7 !important; border-color: #E4E4E7 !important; color: #0A0A0B !important; }
.vge-ghost:hover { background: rgba(255,255,255,0.05) !important; border-color: #FAFAFA !important; color: #FAFAFA !important; }
.vge-mail:hover { color: #FAFAFA !important; border-color: #FAFAFA !important; }
.vge-cta:focus-visible, .vge-ghost:focus-visible, .vge-mail:focus-visible { outline: 2px solid #FAFAFA; outline-offset: 3px; }
@media (max-width: 560px) {
  .vge-actions { gap: 10px !important; }
  .vge-cta, .vge-ghost { min-height: 44px !important; padding: 6px 16px !important; font-size: 15px !important; flex: 1 1 auto; }
}
`;

export default function GlobalError({ error, reset, unstable_retry }: { error: Error & { digest?: string }; reset: () => void; unstable_retry?: () => void }) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    // color-scheme as well as background: it is what the browser paints for its own canvas, the overscroll
    // gutter and native controls, and it applies before the document does. Leaving it out is what kept a
    // pale strip past the end of every dark page on the rest of the site.
    <html lang="en" style={{ colorScheme: "dark", background: "#0A0A0B" }}>
      <head>
        <title>Error | Vraelis</title>
        <style>{GE_CSS}</style>
      </head>
      <body
        style={{
          margin: 0, minHeight: "100vh", display: "grid", placeItems: "center",
          background: "#0A0A0B", color: "#C9CBD1", fontFamily: SANS,
          padding: "clamp(40px, 8vw, 96px) clamp(20px, 5vw, 64px)", boxSizing: "border-box",
        }}
      >
        <div style={{ width: "100%", maxWidth: 640 }}>
          {/* The wordmark at the eyebrow's scale, in sentence case like every label on the site. It says which
              product this is and then gets out of the way; it is not the headline. */}
          <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 500, lineHeight: 1.3, letterSpacing: 0, color: "#A1A3A9" }}>
            Vraelis
          </p>
          <h1 style={{ margin: 0, maxWidth: "20ch", fontSize: "clamp(2.25rem, 3.9vw, 3.5rem)", fontWeight: 500, letterSpacing: "-0.022em", lineHeight: 1.06, color: "#FAFAFA" }}>
            Something went wrong.
          </h1>
          <p style={{ margin: "20px 0 0", maxWidth: "52ch", fontSize: "clamp(1.0625rem, 1.39vw, 1.25rem)", lineHeight: 1.5, color: "#C9CBD1" }}>
            We hit an unexpected error. Your account and your credits are unaffected.
          </p>
          {/* The address follows its sentence instead of sitting inside it: the sentence stays whole for the
              translator, and the address is never translated. */}
          <p style={{ margin: "12px 0 0", fontSize: 16, lineHeight: 1.6, color: "#C9CBD1" }}>
            <span>If it keeps happening, email us.</span>{" "}
            <a href="mailto:help@vraelis.com" className="vge-mail" data-no-translate
              style={{ color: "#FAFAFA", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.44)", paddingBottom: 1 }}>
              help@vraelis.com
            </a>
          </p>
          <div className="vge-actions" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 32 }}>
            <button type="button" className="vge-cta" onClick={() => (unstable_retry ?? reset)()}
              style={{ ...BTN, background: "#FAFAFA", color: "#0A0A0B", border: "1px solid #FAFAFA" }}>
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a hard reload is intentional here: the root layout has errored, so a full navigation gives a clean slate rather than a soft client transition. */}
            <a href="/" className="vge-ghost" style={{ ...BTN, background: "transparent", color: "#FAFAFA", border: "1px solid rgba(255,255,255,0.24)" }}>
              Back to Vraelis
            </a>
          </div>
          {error.digest ? (
            <p style={{ margin: "24px 0 0", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, color: "#A1A3A9" }}>
              Reference <span data-no-translate>{error.digest}</span>
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
