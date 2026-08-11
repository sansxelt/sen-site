"use client";

import { useEffect, useState } from "react";

// Sign-in top bar: TRANSPARENT until the user scrolls, then it fades in a blurred veil + hairline border.
// Nothing on first paint, so the hero glow and grid behind it bleed through the top and the auth surface
// reads as part of the page rather than a boxed-in form.
//
// THE VEIL IS A TOKEN, NOT A LITERAL, AND THAT IS THE WHOLE OF THIS FILE'S HISTORY.
//
// It was hardcoded rgba(250, 248, 244, 0.82). That is CREAM: the retired generation's paper ground, written
// when /signin was a cream page. /signin is graphite now (proxy.ts groundFor returns "graphite" for it, the
// layout wraps the page in ProductSurface, and authenticated.css re-resolves every token to its on-dark
// value), so the literal did not move with the page. Measured on the live surface: the bar faded in at
// rgb(250, 248, 244) while the wordmark and "Back to site" inside it stayed var(--fg-1) = rgb(250, 250, 250).
// Near-white type on a near-white plate, over a near-black page. That is what "scrolling makes the top bar
// go lighter for no reason" was.
//
// --chrome-veil exists for exactly this and is already what app/auth/layout.tsx uses: styles.css defines it
// as the cream veil for light surfaces and authenticated.css redefines it as rgba(10, 10, 11, 0.88) for the
// product and the auth round-trip. Reading it means the bar cannot disagree with the ground it sits on,
// on either theme, and cannot be left behind by the next theme move the way the literal was.
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
        background: scrolled ? "var(--chrome-veil)" : "transparent",
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
