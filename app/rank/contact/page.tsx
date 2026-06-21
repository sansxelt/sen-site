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
        <p className="lead-copy" style={{ marginBottom: 28 }}>Questions, support, or business inquiries? Get in touch.</p>

        <div className="tile-grid cols-3">
          {WAYS.map(([t, d, email, href]) => (
            <a key={t} href={href} className="acard" style={{ textDecoration: "none", gap: 6 }}>
              <div className="acard__t">{t}</div>
              <div className="acard__d">{d}</div>
              <div style={{ marginTop: 4, fontFamily: "var(--font-code)", fontSize: 13, color: "var(--acc-deep)", wordBreak: "break-all" }}>{email}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
