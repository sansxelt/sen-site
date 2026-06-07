// Slim top-of-page Instagram promo bar. Server-safe (no hooks) so it can be
// used in both the client marketing shell and the server sign-in layout.
// Single centered line; font scales down on small screens so it never wraps.
export function VraelisPromoBar() {
  return (
    <a
      href="https://instagram.com/usevraelis"
      target="_blank"
      rel="noreferrer"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        padding: "8px 16px",
        background: "var(--acc-deep)",
        color: "#fff",
        textDecoration: "none",
        fontSize: "clamp(11px, 2.4vw, 12.5px)",
        fontWeight: 500,
        letterSpacing: "-0.005em",
        lineHeight: 1.2,
        textAlign: "center",
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="20" height="20" rx="5.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
      </svg>
      <span>
        Follow <b style={{ fontWeight: 700 }}>@usevraelis</b> on Instagram <span aria-hidden>→</span>
      </span>
    </a>
  );
}
