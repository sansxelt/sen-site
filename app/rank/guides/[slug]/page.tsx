import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ogMeta } from "@/lib/og-meta";
import { getGuide, allGuideSlugs, relatedGuides, ISSUE_LABEL } from "@/lib/rank-guides";

// One programmatic QA guide. Statically generated per slug (generateStaticParams), fully
// indexable, with Article + FAQ JSON-LD for rich results and internal links to the sibling
// guides and the free check. All content is a self-contained QA guide, not thin filler.

export function generateStaticParams() {
  return allGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  // Retired "AI output QA" guide content: the route redirects to /how-it-works (proxy.ts) and is out of the
  // sitemap. Neutral, noindexed metadata is a backstop so no retired title/OG is indexable if reached direct.
  return ogMeta({ title: "Vraelis", description: "Production verification for AI-built applications and systems.", path: `/guides/${slug}`, index: false });
}

const kicker = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" } as const;

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();
  const c = guide.content;
  const related = relatedGuides(slug);
  const paragraphs = c.intro.split("\n\n").filter(Boolean);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: c.h1,
        description: c.metaDescription,
        author: { "@type": "Organization", name: "Vraelis" },
        publisher: { "@type": "Organization", name: "Vraelis" },
        mainEntityOfPage: `https://vraelis.com/guides/${slug}`,
      },
      {
        "@type": "FAQPage",
        mainEntity: c.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <article className="wrap" style={{ maxWidth: 780, paddingTop: "clamp(28px, 4vw, 56px)", paddingBottom: 80 }}>
        {/* breadcrumb */}
        <div style={{ ...kicker, marginBottom: 16 }}>
          <Link href="/guides" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Guides</Link>
          <span style={{ margin: "0 8px", color: "var(--fg-5)" }}>/</span>
          <span>{guide.outputType.replace(/_/g, " ")}</span>
        </div>

        {/* hero */}
        <p className="eyebrow">{c.eyebrow}</p>
        <h1 className="display" style={{ fontSize: "clamp(1.9rem, 3.6vw, 2.8rem)", margin: "8px 0 16px", lineHeight: 1.12 }}>{c.h1}</h1>
        {paragraphs.map((p, i) => (
          <p key={i} className="lead-copy" style={{ fontSize: 16, color: "var(--fg-2)", lineHeight: 1.7, margin: "0 0 14px" }}>{p}</p>
        ))}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "22px 0 8px" }}>
          <Link href="/free-report" className="btn">Run your first Production Pass, free <span aria-hidden>→</span></Link>
          <Link href="/how-it-works" className="btn btn--ghost">How Vraelis works</Link>
        </div>

        {/* criteria */}
        <section style={{ marginTop: 44 }}>
          <p className="eyebrow">What to score</p>
          <h2 className="display" style={{ fontSize: "clamp(1.4rem, 2.6vw, 1.9rem)", margin: "6px 0 18px" }}>The four things that decide if it ships</h2>
          <div className="tile-grid cols-2" style={{ gap: 12 }}>
            {c.criteria.map((cr) => (
              <div key={cr.name} className="acard" style={{ gap: 6 }}>
                <div className="acard__t">{cr.name}</div>
                <div className="acard__d">{cr.what}</div>
                <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 4, lineHeight: 1.55 }}><span style={{ color: "var(--acc-deep)", fontWeight: 600 }}>Look for:</span> {cr.check}</div>
              </div>
            ))}
          </div>
        </section>

        {/* failure modes: before / after */}
        <section style={{ marginTop: 44 }}>
          <p className="eyebrow">Common failure modes</p>
          <h2 className="display" style={{ fontSize: "clamp(1.4rem, 2.6vw, 1.9rem)", margin: "6px 0 18px" }}>What AI gets wrong here, and the fix</h2>
          <div style={{ display: "grid", gap: 14 }}>
            {c.failures.map((f, i) => (
              <div key={i} className="card" style={{ padding: "clamp(14px, 2vw, 18px)" }}>
                <span className="pill" style={{ fontSize: 10.5, background: "var(--bg-2)", color: "var(--fg-3)", marginBottom: 10, display: "inline-block" }}>{ISSUE_LABEL[f.issueKey]}: {f.label}</span>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ borderLeft: "3px solid var(--err)", paddingLeft: 12 }}>
                    <div style={{ ...kicker, color: "var(--err)", marginBottom: 3 }}>Before</div>
                    <div style={{ fontSize: 14, color: "var(--fg-2)", lineHeight: 1.55 }}>{f.example}</div>
                  </div>
                  <div style={{ borderLeft: "3px solid var(--acc-deep)", paddingLeft: 12 }}>
                    <div style={{ ...kicker, color: "var(--acc-deep)", marginBottom: 3 }}>After</div>
                    <div style={{ fontSize: 14, color: "var(--fg-1)", lineHeight: 1.55 }}>{f.fix}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* checklist */}
        <section style={{ marginTop: 44 }}>
          <p className="eyebrow">Before you ship</p>
          <h2 className="display" style={{ fontSize: "clamp(1.4rem, 2.6vw, 1.9rem)", margin: "6px 0 18px" }}>The pre-ship checklist</h2>
          <div className="card" style={{ padding: "clamp(16px, 2.4vw, 22px)" }}>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 11 }}>
              {c.checklist.map((item, i) => (
                <li key={i} style={{ display: "flex", gap: 10, fontSize: 14.5, color: "var(--fg-2)", lineHeight: 1.55 }}>
                  <span aria-hidden style={{ color: "var(--acc-deep)", flex: "none", fontWeight: 700 }}>✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: "14px 0 0", lineHeight: 1.6 }}>
            A checklist catches bad copy. Vraelis catches what breaks in production: it runs your AI-built app in a real browser and returns a launch decision with evidence. <Link href="/how-it-works" style={{ color: "var(--acc-deep)", textDecoration: "none" }}>See how it works →</Link>
          </p>
        </section>

        {/* FAQ */}
        <section style={{ marginTop: 44 }}>
          <p className="eyebrow">FAQ</p>
          <h2 className="display" style={{ fontSize: "clamp(1.4rem, 2.6vw, 1.9rem)", margin: "6px 0 18px" }}>Questions</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {c.faq.map((f, i) => (
              <div key={i} className="card" style={{ padding: "clamp(14px, 2vw, 18px)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", marginBottom: 6 }}>{f.q}</div>
                <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.6, margin: 0 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* related */}
        {related.length > 0 && (
          <section style={{ marginTop: 44 }}>
            <p className="eyebrow">More QA guides</p>
            <div className="tile-grid cols-3" style={{ gap: 12, marginTop: 12 }}>
              {related.map((r) => (
                <Link key={r.slug} href={`/guides/${r.slug}`} className="acard" style={{ gap: 6, textDecoration: "none" }}>
                  <div className="acard__t">{r.content.metaTitle}</div>
                  <div className="acard__d">{r.cardBlurb}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* final CTA */}
        <section style={{ marginTop: 48, textAlign: "center", paddingTop: 30, borderTop: "1px solid var(--line-1)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20, color: "var(--fg-1)", marginBottom: 8 }}>Stop shipping demos as products</div>
          <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.6, margin: "0 auto 18px", maxWidth: 460 }}>
            Your {guide.outputType.replace(/_/g, " ")} lives inside an app. Vraelis runs that app like production and tells you what blocks the launch, with the evidence to prove it. Your first Production Pass is free.
          </p>
          <Link href="/signin?callbackUrl=%2Fapp" className="btn btn--lg">Check your application <span aria-hidden>→</span></Link>
        </section>
      </article>
    </>
  );
}
