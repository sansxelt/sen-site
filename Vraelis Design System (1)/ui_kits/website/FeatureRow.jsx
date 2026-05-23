// FeatureRow.jsx
// Reusable feature section. Alternating two-column layout.
// LEFT  — index, label with icon, headline, paragraph, spec list
// RIGHT — bespoke diagram in a framed card

function FeatureRow({ index, label, icon, headline, body, specs, diagram, reverse = false }) {
  return (
    <section id={label.toLowerCase().replace(/[^a-z0-9]+/g, "-")} style={{
      padding: "var(--section-y) var(--gutter)",
      borderBottom: "1px solid var(--line-1)",
    }}>
      <div style={{
        maxWidth: "var(--max-content)",
        margin: "0 auto",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)",
        gap: "clamp(40px, 6vw, 88px)",
        alignItems: "center",
      }} className={`vra-feature-grid ${reverse ? "vra-feature-reverse" : ""}`}>

        {/* TYPE COLUMN */}
        <div style={{ order: reverse ? 2 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <span className="num" style={{ fontSize: 28, color: "var(--fg-1)", opacity: 0.3, fontWeight: 500 }}>
              {String(index).padStart(2, "0")}
            </span>
            <span style={{ width: 32, height: 1, background: "var(--line-3)" }} />
            <span className="mono" style={{ fontSize: 13, color: "var(--fg-3)", letterSpacing: "0.04em" }}>{label.toLowerCase()}</span>
          </div>

          <h2 className="display" style={{ fontSize: "clamp(1.875rem, 3.4vw, 3rem)", marginBottom: 28 }}>
            {headline}
          </h2>

          <p style={{ fontSize: "1.0625rem", color: "var(--fg-2)", marginBottom: 32, maxWidth: 520, lineHeight: 1.5 }}>
            {body}
          </p>

          {specs && (
            <div style={{ borderTop: "1px solid var(--line-strong)", marginTop: 8, maxWidth: 480 }}>
              {specs.map((s, i) => (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "150px 1fr",
                  padding: "14px 0",
                  borderBottom: i === specs.length - 1 ? "1px solid var(--line-strong)" : "1px solid var(--line-1)",
                  alignItems: "baseline",
                }}>
                  <div className="mono" style={{ color: "var(--fg-4)", fontSize: 12 }}>{s.label}</div>
                  <div style={{ color: "var(--fg-1)", fontSize: 14 }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DIAGRAM COLUMN */}
        <div style={{ order: reverse ? 1 : 2 }}>
          <DiagramFrame label={`${String(index).padStart(2, "0")} · ${label}`}>
            {diagram}
          </DiagramFrame>
        </div>
      </div>
    </section>
  );
}

function DiagramFrame({ label, children }) {
  return (
    <div style={{
      position: "relative",
      aspectRatio: "4 / 3",
      background: "var(--bg-1)",
      border: "1px solid var(--line-2)",
      overflow: "hidden",
    }}>
      <CornerBrackets />
      <div style={{
        position: "absolute", top: 14, left: 14,
        fontFamily: "var(--font-mono)", fontSize: 11,
        letterSpacing: "0.05em",
        color: "var(--fg-3)",
      }}>{label}</div>
      <div style={{ position: "absolute", inset: 0, padding: 32, display: "grid", placeItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

function CornerBrackets() {
  const c = "var(--line-strong)";
  const len = 18, off = 8, sw = 1;
  return (
    <svg aria-hidden style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} preserveAspectRatio="none">
      <line x1={off} y1={off} x2={off + len} y2={off} stroke={c} strokeWidth={sw} />
      <line x1={off} y1={off} x2={off} y2={off + len} stroke={c} strokeWidth={sw} />
      <line x1={`calc(100% - ${off + len}px)`} y1={off} x2={`calc(100% - ${off}px)`} y2={off} stroke={c} strokeWidth={sw} />
      <line x1={`calc(100% - ${off}px)`} y1={off} x2={`calc(100% - ${off}px)`} y2={off + len} stroke={c} strokeWidth={sw} />
      <line x1={off} y1={`calc(100% - ${off}px)`} x2={off + len} y2={`calc(100% - ${off}px)`} stroke={c} strokeWidth={sw} />
      <line x1={off} y1={`calc(100% - ${off + len}px)`} x2={off} y2={`calc(100% - ${off}px)`} stroke={c} strokeWidth={sw} />
      <line x1={`calc(100% - ${off + len}px)`} y1={`calc(100% - ${off}px)`} x2={`calc(100% - ${off}px)`} y2={`calc(100% - ${off}px)`} stroke={c} strokeWidth={sw} />
      <line x1={`calc(100% - ${off}px)`} y1={`calc(100% - ${off + len}px)`} x2={`calc(100% - ${off}px)`} y2={`calc(100% - ${off}px)`} stroke={c} strokeWidth={sw} />
    </svg>
  );
}

Object.assign(window, { FeatureRow, DiagramFrame, CornerBrackets });
