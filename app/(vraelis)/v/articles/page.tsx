import type { Metadata } from "next";
import Link from "next/link";
import { ARTICLES, formatArticleDate } from "./_articles";

export const metadata: Metadata = {
  title: "Articles — Vraelis",
  description:
    "The follow-up playbook: speed-to-lead, follow-up sequences, and turning missed calls into booked work.",
};

export default function VraelisArticlesPage() {
  return (
    <section className="section" id="top" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.4 }} />
      <div className="wrap" style={{ position: "relative" }}>
        <div style={{ maxWidth: 760, marginBottom: "clamp(36px,5vw,56px)" }}>
          <p className="eyebrow">Articles</p>
          <h1 className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)", marginBottom: 16 }}>
            The follow-up <span className="mark"><span>playbook.</span></span>
          </h1>
          <p className="lead-copy">
            Field notes on answering, qualifying, and booking inbound leads before they go cold.
          </p>
        </div>

        <div className="grid cols-3" style={{ alignItems: "start" }}>
          {ARTICLES.map((a) => (
            <Link
              key={a.slug}
              href={`/v/articles/${a.slug}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                textDecoration: "none",
                background: "var(--bg-1)",
                border: "1px solid var(--line-2)",
                borderRadius: "var(--r-sm)",
                boxShadow: "var(--shadow-card)",
                padding: 24,
                minHeight: 240,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="pill"><span className="dot dot--acc" />{a.tag}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>
                  {a.readingMinutes} min
                </span>
              </div>
              <h2 style={{ fontSize: 20, letterSpacing: "-0.02em", color: "var(--fg-1)", lineHeight: 1.25 }}>
                {a.title}
              </h2>
              <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.55, flex: 1 }}>{a.excerpt}</p>
              <div
                style={{
                  paddingTop: 14,
                  borderTop: "1px solid var(--line-1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11.5,
                  color: "var(--fg-4)",
                }}
              >
                <span>{formatArticleDate(a.date)}</span>
                <span style={{ color: "var(--acc-deep)", fontWeight: 600 }}>Read →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
