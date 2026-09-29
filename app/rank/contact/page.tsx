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
            {/* LINKEDIN ONLY (2026-09-28). This row listed Instagram and Facebook profiles that were never
                confirmed to exist, and the X profile it once shared a footer with returned 404. A contact page
                that sends a reader to a missing profile is worse than one that lists fewer. */}
            <a href="https://www.linkedin.com/company/vraelis" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "10px 16px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-2)", textDecoration: "none", fontSize: 14 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></svg>
              LinkedIn <span style={{ color: "var(--fg-4)" }}>Vraelis</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
