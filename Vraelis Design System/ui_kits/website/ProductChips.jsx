// ProductChips.jsx — small inline pill row used in the hero.
// Replaces the multi-product chip set with a capability chip set,
// since the brand now ships ONE product (the Lens wearable).

function ProductChips() {
  return (
    <div style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 14,
      padding: "8px 16px",
      borderRadius: 999,
      border: "1px solid var(--line-3)",
      background: "rgba(0,0,0,0.45)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      fontSize: 12,
      fontFamily: "var(--font-mono)",
      letterSpacing: "0.06em",
      color: "rgba(229,231,235,0.86)",
      flexWrap: "wrap",
    }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        <span className="dot dot--vio" style={{ width: 6, height: 6, boxShadow: "0 0 8px var(--vio)" }} />
        360° capture
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        <span className="dot dot--cya" style={{ width: 6, height: 6, boxShadow: "0 0 8px var(--cya)" }} />
        Private audio
      </span>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        <span className="dot dot--sky" style={{ width: 6, height: 6, boxShadow: "0 0 8px var(--sky)" }} />
        Ambient HUD
      </span>
    </div>
  );
}

Object.assign(window, { ProductChips });
