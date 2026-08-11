"use client";

import { useEffect } from "react";

/* THE ROOT ERROR BOUNDARY, IN DESIGN 06.
 *
 * This catches errors in the root layout itself, so it REPLACES that layout and renders its own <html> and
 * <body>. No stylesheet has loaded and none may be linked: a <link> here is a network round trip on a page
 * that only exists because something already failed, and if the failure is the network the page arrives
 * unstyled. So every value is inline, restated, the same arrangement app/not-found.tsx and
 * app/_components/stealth-screen.tsx already carry. Keep them in step by hand.
 *
 * WHAT IT USED TO BE, AND WHY THAT WAS THE WRONG PAGE TO GET WRONG. Warm paper #FAF8F4, a Georgia serif
 * wordmark, and a #0d5c46 emerald button: the retired generation's brand, kept alive here because nothing
 * links to this file and nobody re-reads it. Design 06 has no serif wordmark, no warm ground, and reserves
 * green to mean "a verification held". A reader whose page had just failed was shown a different company's
 * error screen, wearing the product's success colour on its primary button.
 *
 * Graphite, contrast instead of hue, and the system sans. Same voice as the 404 and the route boundary, so
 * the three failure surfaces read as one product rather than three.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    // color-scheme as well as background: it is what the browser paints for its own canvas, the overscroll
    // gutter and native controls, and it applies before the document does. Leaving it out is what kept a
    // pale strip past the end of every dark page on the rest of the site.
    <html lang="en" style={{ colorScheme: "dark", background: "#0A0A0B" }}>
      <body
        style={{
          margin: 0, minHeight: "100vh", display: "grid", placeItems: "center",
          background: "#0A0A0B", color: "#C4C5C9",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          padding: "clamp(40px, 8vw, 96px) clamp(20px, 5vw, 64px)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 620 }}>
          {/* The wordmark is the sans wordmark, at the kicker's scale. It says which product this is and
              then gets out of the way; it is not the headline. */}
          <p style={{ margin: "0 0 18px", fontSize: 13, fontWeight: 500, letterSpacing: "0.14em", textTransform: "uppercase", color: "#8E9095" }}>
            Vraelis
          </p>
          <h1 style={{ margin: 0, fontSize: "clamp(2rem, 4.2vw, 3.1rem)", fontWeight: 600, letterSpacing: "-0.032em", lineHeight: 1.04, color: "#FAFAFA" }}>
            Something went wrong.
          </h1>
          <p style={{ margin: "20px 0 0", maxWidth: "54ch", fontSize: "clamp(1rem, 1.2vw, 1.08rem)", lineHeight: 1.6, color: "#C4C5C9" }}>
            We hit an unexpected error. Your account and your credits are unaffected. Try again, and if it
            keeps happening, email{" "}
            <a href="mailto:help@vraelis.com" style={{ color: "#FAFAFA", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.4)", paddingBottom: 1 }}>
              help@vraelis.com
            </a>.
          </p>
          <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap", marginTop: 34 }}>
            <button
              type="button"
              onClick={reset}
              style={{ background: "#FAFAFA", color: "#0A0A0B", border: 0, borderRadius: 11, padding: "12px 22px", fontSize: 15, fontWeight: 550, letterSpacing: "-0.01em", fontFamily: "inherit", cursor: "pointer" }}
            >
              Try again
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a hard reload is intentional here: the root layout has errored, so a full navigation gives a clean slate rather than a soft client transition. */}
            <a href="/" style={{ fontSize: 14.5, color: "#C4C5C9", textDecoration: "none", borderBottom: "1px solid rgba(255,255,255,0.22)", paddingBottom: 2 }}>
              Back to Vraelis
            </a>
          </div>
          {error.digest ? (
            <p style={{ margin: "22px 0 0", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11.5, color: "#8E9095" }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  );
}
