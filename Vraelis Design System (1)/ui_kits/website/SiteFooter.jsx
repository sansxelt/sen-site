// SiteFooter.jsx
// Big inverted wordmark, three columns, mono colophon.

function SiteFooter() {
  return (
    <footer style={{
      padding: "calc(var(--section-y) * 0.7) var(--gutter) var(--section-y)",
      background: "var(--bg-2)",
    }}>
      <div style={{ maxWidth: "var(--max-content)", margin: "0 auto" }}>

        <div style={{
          paddingBottom: 48, marginBottom: 48,
          borderBottom: "1px solid var(--line-2)",
        }}>
          <div style={{
            fontSize: "clamp(4rem, 11vw, 10.5rem)",
            fontWeight: 600,
            letterSpacing: "-0.045em",
            lineHeight: 0.9,
            color: "var(--fg-1)",
          }}>
            vraelis<span style={{ color: "var(--acc)" }}>.</span>
          </div>
          <div className="mono" style={{ marginTop: 16, fontSize: 12, color: "var(--fg-4)", letterSpacing: "0.05em" }}>
            wearable optics · in development
          </div>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr 1fr 1fr",
          gap: 40,
          marginBottom: 64,
        }} className="vra-footer-grid">
          <div>
            <p style={{ color: "var(--fg-3)", fontSize: 14, maxWidth: 300, lineHeight: 1.55 }}>
              A pair of glasses that record what you saw from every angle, let you hear directional audio only you can hear, and let you talk — or whisper — to AI without anyone else hearing.
            </p>
          </div>
          <FooterCol title="Product" items={[
            { label: "Overview", href: "#top" },
            { label: "Specifications", href: "#spec" },
            { label: "Waitlist", href: "#waitlist" },
          ]} />
          <FooterCol title="Apps" items={[
            { label: "Chat", href: "https://chat.vraelis.com", external: true },
            { label: "Platform", href: "https://platform.vraelis.com", external: true },
          ]} />
          <FooterCol title="Company" items={[
            { label: "Contact", href: "mailto:hello@vraelis.com" },
            { label: "Press", href: "#" },
            { label: "Privacy", href: "#" },
            { label: "Terms", href: "#" },
          ]} />
        </div>

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
          paddingTop: 24,
          borderTop: "1px solid var(--line-2)",
          fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", letterSpacing: "0.04em",
        }}>
          <div>© 2026 vraelis</div>
          <div>hello@vraelis.com</div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 12, color: "var(--fg-4)", marginBottom: 14, letterSpacing: "0.04em" }}>{title}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
        {items.map((it) => (
          <li key={it.label}>
            <a href={it.href} style={{ color: "var(--fg-1)", textDecoration: "none", fontSize: 14, opacity: 0.92, display: "inline-flex", alignItems: "center", gap: 4 }}>
              {it.label}{it.external && <i className="ph ph-arrow-up-right" style={{ fontSize: 12, opacity: 0.55 }} />}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

Object.assign(window, { SiteFooter, FooterCol });
