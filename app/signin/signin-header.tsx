"use client";

import { useEffect, useState } from "react";

// Sign-in top bar, matching the homepage nav: TRANSPARENT until the user scrolls, then it fades in a
// blurred paper background + hairline border. Non-sticky visual noise on first paint — the hero glow/grid
// behind it bleeds through the top, so the auth surface reads as part of the page, not a boxed-in form.
export function SignInHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      style={{
        position: "sticky", top: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        padding: "15px var(--gutter)",
        background: scrolled ? "rgba(250,248,244,0.82)" : "transparent",
        backdropFilter: scrolled ? "blur(14px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(14px)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--line-1)" : "transparent"}`,
        transition: "background .25s ease, border-color .25s ease",
      }}
    >
      <a href="/" style={{ display: "inline-flex", alignItems: "center", fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, color: "var(--fg-1)", textDecoration: "none" }}>
        Vraelis
      </a>
      <a href="/" style={{ display: "flex", width: "fit-content", alignItems: "center", gap: 7, fontSize: 14, fontWeight: 500, color: "var(--fg-2)", textDecoration: "none", border: "1px solid var(--line-3)", borderRadius: 999, padding: "8px 16px", whiteSpace: "nowrap" }}>
        <span aria-hidden>←</span> Back to site
      </a>
    </div>
  );
}
