"use client";

import { useEffect } from "react";

// Root error boundary — catches errors in the root layout itself, so it REPLACES the layout
// and must render its own <html>/<body>. That means the design-token stylesheet (loaded by
// the layout) is NOT available here, so everything is self-contained inline styles that
// mirror the brand (warm paper, deep-emerald accent).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#FAF8F4", color: "#1a1a1a", fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif", padding: "40px 24px", textAlign: "center" }}>
        <div style={{ maxWidth: 500 }}>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 20 }}>Vraelis</div>
          <h1 style={{ fontSize: "clamp(1.7rem, 4vw, 2.4rem)", margin: "0 0 12px", fontWeight: 600, letterSpacing: "-0.02em" }}>Something went wrong.</h1>
          <p style={{ fontSize: 16, lineHeight: 1.55, color: "#4a4a4a", margin: "0 auto 26px", maxWidth: 400 }}>We hit an unexpected error. Your account and credits are safe. Please try again, or email help@vraelis.com if it persists.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={reset} style={{ background: "#0d5c46", color: "#fff", border: "none", borderRadius: 10, padding: "13px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}>Try again</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a hard reload is intentional here: the root layout has errored, so a full navigation gives a clean slate rather than a soft client transition. */}
            <a href="/" style={{ background: "transparent", color: "#1a1a1a", border: "1px solid #d8d4cc", borderRadius: 10, padding: "13px 24px", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>Back home</a>
          </div>
          {error.digest ? <p style={{ fontSize: 12, color: "#8a8a8a", marginTop: 18 }}>Reference: {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
