import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Contact",
  description: "Get in touch with Vraelis.",
  path: "/contact",
});

const WAYS: [string, string, string, string][] = [
  ["Support", "Questions or help using Vraelis.", "help@vraelis.com", "mailto:help@vraelis.com"],
  ["Sales", "Plans, volume, or partnerships.", "sales@vraelis.com", "mailto:sales@vraelis.com"],
  ["Privacy", "Questions about your data.", "privacy@vraelis.com", "mailto:privacy@vraelis.com"],
];

export default function ContactPage() {
  return (
    <section className="section" style={{ borderBottom: "none" }}>
      <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(28px, 4vw, 52px)" }}>
        <p className="eyebrow">Contact</p>
        <h1 className="display" style={{ fontSize: "clamp(2rem, 3.4vw, 2.8rem)", marginBottom: 10 }}>Contact</h1>
        <p className="lead-copy" style={{ marginBottom: 28 }}>Vraelis checks AI-built web applications: it runs the flows you approve in a real browser against your deployed app and shows what held and what broke. Questions, support, or business inquiries? Get in touch.</p>

        <div className="tile-grid cols-3">
          {WAYS.map(([t, d, email, href]) => (
            <a key={t} href={href} className="acard" style={{ textDecoration: "none", gap: 6 }}>
              <div className="acard__t">{t}</div>
              <div className="acard__d">{d}</div>
              <div style={{ marginTop: 4, fontFamily: "var(--font-code)", fontSize: 13, color: "var(--acc-deep)", wordBreak: "break-all" }}>{email}</div>
            </a>
          ))}
        </div>

        <div style={{ marginTop: 40 }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Follow Vraelis</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a href="https://instagram.com/usevraelis" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "10px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-2)", textDecoration: "none", fontSize: 14 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="2" width="20" height="20" rx="5.5" /><circle cx="12" cy="12" r="4.2" /><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" /></svg>
              Instagram <span style={{ color: "var(--fg-4)" }}>@usevraelis</span>
            </a>
            <a href="https://facebook.com/vraelis" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "10px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-2)", textDecoration: "none", fontSize: 14 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12Z" /></svg>
              Facebook <span style={{ color: "var(--fg-4)" }}>Vraelis</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
