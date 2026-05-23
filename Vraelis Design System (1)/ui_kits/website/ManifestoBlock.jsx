// ManifestoBlock.jsx — editorial paragraph between hero and features.
// No eyebrow / spec marker. Just the paragraph.

function ManifestoBlock() {
  return (
    <section style={{
      padding: "var(--section-y) var(--gutter)",
      borderBottom: "1px solid var(--line-1)",
    }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <p style={{
          fontSize: "clamp(1.5rem, 2.4vw, 1.875rem)",
          lineHeight: 1.35,
          color: "var(--fg-1)",
          letterSpacing: "-0.02em",
          fontWeight: 400,
        }}>
          Vraelis is a tool you wear. It has a camera, a microphone, a speaker, an indicator. <span className="em" style={{ fontSize: "1.05em" }}>It earns its place on your face</span> by remembering what you saw — every angle, every word, every quiet thought you whispered into it.
        </p>
      </div>
    </section>
  );
}

Object.assign(window, { ManifestoBlock });
