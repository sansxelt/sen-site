// Footer.jsx — quiet outro footer with link columns and small mark.
// Discord call-out removed per brand direction. No external community links.

function Footer() {
  return (
    <footer style={{
      background: "var(--bg-0)",
      borderTop: "1px solid var(--line-1)",
      padding: "60px clamp(20px, 5vw, 80px) 40px",
    }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40 }} className="vra-footer-grid">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <img src={(window.VRAELIS_BASE || "") + "assets/logo-mark.svg"} alt="Vraelis" style={{ width: 24, height: 24, borderRadius: 6, display: "block" }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-2)", letterSpacing: "-0.01em" }}>Vraelis</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--fg-4)", lineHeight: 1.55, maxWidth: 320 }}>
            Wearable optics with a 360° camera, private audio, ambient HUD, and on-device voice. In concept and R&amp;D.
          </p>
        </div>

        <FooterCol title="Product" items={["Capabilities", "Architecture", "Specs", "Waitlist"]} />
        <FooterCol title="Company" items={["About", "Press", "Careers", "Contact"]} />
        <FooterCol title="Legal" items={["Privacy", "Terms", "Security", "DPA"]} />
      </div>

      <div style={{ maxWidth: 1280, margin: "48px auto 0", paddingTop: 20, borderTop: "1px solid var(--line-1)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-5)", letterSpacing: "0.06em" }}>© 2026 VRAELIS · ALL RIGHTS RESERVED</div>
        <div className="mono" style={{ fontSize: 11, color: "var(--fg-5)", letterSpacing: "0.06em" }}>hello@vraelis.com</div>
      </div>
    </footer>
  );
}

function FooterCol({ title, items }) {
  return (
    <div>
      <div className="label" style={{ color: "var(--fg-4)", marginBottom: 12 }}>{title}</div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => (
          <li key={it}><a href="#" style={{ fontSize: 13, color: "var(--fg-3)", textDecoration: "none", letterSpacing: "-0.005em" }}>{it}</a></li>
        ))}
      </ul>
    </div>
  );
}

Object.assign(window, { Footer, FooterCol });
