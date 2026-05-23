// ArchitectureGrid.jsx — the three-node pill grid. A signature
// pattern from /lens and /product.

function ArchitectureGrid() {
  const NODES = [
    { name: "GLASSES",    color: "#c084fc", role: "capture + render" },
    { name: "PHONE / PC", color: "#a8c4ff", role: "compute + memory" },
    { name: "CLOUD",      color: "#22d3ee", role: "AI + context" },
  ];

  return (
    <section id="architecture" style={{
      background: "var(--bg-2)",
      padding: "clamp(64px, 10vh, 120px) clamp(20px, 5vw, 80px)",
    }}>
      <div style={{ maxWidth: 880, margin: "0 auto", textAlign: "center" }}>
        <h2 className="cinematic-display cinematic-display--gradient" style={{ marginBottom: 18 }}>
          The glasses don't run heavy AI.
        </h2>
        <p className="cinematic-body" style={{ maxWidth: 540, margin: "0 auto 40px" }}>
          Compute lives on your phone or PC where there is power and thermal headroom. Vraelis renders the result. That keeps the frame thin, cool, and battery-conscious.
        </p>

        <div className="vra-arch-grid" style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(3, 1fr)", maxWidth: 720, margin: "0 auto" }}>
          {NODES.map((n) => (
            <div
              key={n.name}
              style={{
                padding: "18px 14px",
                borderRadius: 14,
                border: `1px solid ${n.color}30`,
                background: `linear-gradient(180deg, ${n.color}08, transparent)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: n.color, boxShadow: `0 0 8px ${n.color}` }} />
                <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", letterSpacing: "0.1em", color: n.color, whiteSpace: "nowrap" }}>{n.name}</div>
              </div>
              <div style={{ fontSize: 11, color: "var(--fg-4)", textAlign: "center" }}>{n.role}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { ArchitectureGrid });
