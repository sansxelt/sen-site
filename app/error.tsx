"use client";

import Link from "next/link";
import { useEffect } from "react";

// Route-level error boundary. Renders INSIDE the app shell, so the design tokens from the
// root layout are available. Branded, reassuring (paid product), and offers recovery.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <main style={{ minHeight: "70svh", display: "grid", placeItems: "center", padding: "clamp(40px, 8vw, 96px) var(--gutter)", textAlign: "center" }}>
      <div style={{ maxWidth: 520 }}>
        <p className="eyebrow" style={{ justifyContent: "center" }}>Something broke</p>
        <h1 className="display" style={{ fontSize: "clamp(1.9rem, 4vw, 2.8rem)", margin: "8px 0 12px" }}>This page hit an <span className="em">error</span>.</h1>
        <p className="lead-copy" style={{ margin: "0 auto 24px", maxWidth: 440 }}>Something on our end went wrong loading this page. Your account and credits are safe. Try again, and if it keeps happening, email <a href="mailto:help@vraelis.com" style={{ color: "var(--acc-deep)" }}>help@vraelis.com</a>.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn--lg" onClick={reset}>Try again</button>
          <Link href="/" className="btn btn--ghost btn--lg">Back home</Link>
        </div>
        {error.digest ? <p style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 18 }}>Reference: {error.digest}</p> : null}
      </div>
    </main>
  );
}
