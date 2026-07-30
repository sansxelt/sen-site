import Link from "next/link";
import { notFound } from "next/navigation";
import { ogMeta } from "@/lib/og-meta";
import {
  articleBySlug, publishedArticles, relatedArticles, readingMinutes, formatDate,
  type Block,
} from "../_articles";

export function generateStaticParams() {
  return publishedArticles().map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) return ogMeta({ title: "Research", description: "Vraelis Research.", path: "/research" });
  return ogMeta({ title: a.title, description: a.summary, path: `/research/${a.slug}` });
}

// Blocks render through a fixed set of components. Article bodies are structured data, never markup, so no
// authored string can inject an element or a style into the page.
function Blocks({ body }: { body: Block[] }) {
  return (
    <>
      {body.map((b, i) => {
        if (b.t === "h2") {
          return <h2 key={i} className="display" style={{ fontSize: "clamp(1.28rem, 2.2vw, 1.62rem)", letterSpacing: "-0.02em", margin: "44px 0 14px", textWrap: "balance" }}>{b.text}</h2>;
        }
        if (b.t === "quote") {
          return (
            <blockquote key={i} style={{ margin: "32px 0", paddingLeft: 20, borderLeft: "2px solid var(--acc-line)" }}>
              <p style={{ margin: 0, fontSize: "1.14rem", lineHeight: 1.5, color: "var(--fg-1)", letterSpacing: "-0.01em", textWrap: "pretty" }}>{b.text}</p>
            </blockquote>
          );
        }
        if (b.t === "list") {
          return (
            <ul key={i} style={{ margin: "18px 0", paddingLeft: 20, display: "grid", gap: 9 }}>
              {b.items.map((it, j) => (
                <li key={j} style={{ color: "var(--fg-2)", lineHeight: 1.6 }}>{it}</li>
              ))}
            </ul>
          );
        }
        if (b.t === "code") {
          return (
            <div key={i} style={{ margin: "24px 0" }}>
              {b.label && <div className="codebar"><i /><i /><i /><span>{b.label}</span></div>}
              <pre className="codeblock" style={{ overflowX: "auto" }}><code>{b.text}</code></pre>
            </div>
          );
        }
        if (b.t === "note") {
          // Notes exist to LIMIT a claim made nearby. Visually distinct so a qualification is never mistaken
          // for body copy and skimmed past, which is exactly how an honest article becomes a misleading one.
          return (
            <aside key={i} style={{ margin: "28px 0", padding: "14px 16px", border: "1px solid var(--line-2)", borderRadius: 8, background: "var(--bg-1)" }}>
              <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 7 }}>What is true today</div>
              <p style={{ margin: 0, fontSize: "0.94rem", lineHeight: 1.6, color: "var(--fg-2)" }}>{b.text}</p>
            </aside>
          );
        }
        return <p key={i} style={{ margin: "0 0 17px", lineHeight: 1.68, color: "var(--fg-2)", fontSize: "1.045rem", textWrap: "pretty" }}>{b.text}</p>;
      })}
    </>
  );
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = articleBySlug(slug);
  if (!a) notFound();
  const related = relatedArticles(a.slug, 2);

  return (
    <article className="section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.3 }} />
      {/* A narrow measure, near 68 characters, because these are read rather than scanned. */}
      <div className="wrap" style={{ position: "relative", maxWidth: 680 }}>

        <p style={{ marginBottom: 22 }}>
          <Link href="/research" style={{ fontFamily: "var(--font-code)", fontSize: 11, letterSpacing: "0.06em", color: "var(--fg-4)", textDecoration: "none" }}>
            &larr; Research
          </Link>
        </p>

        <header style={{ marginBottom: 34 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--acc-deep)" }}>{a.category}</span>
            <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-5)" }}>
              {a.author}, {formatDate(a.date)}, {readingMinutes(a)} min read
            </span>
          </div>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 4.4vw, 3rem)", lineHeight: 1.08, letterSpacing: "-0.03em", margin: "0 0 16px", textWrap: "balance" }}>
            {a.title}
          </h1>
          <p style={{ fontSize: "1.14rem", lineHeight: 1.55, color: "var(--fg-3)", margin: 0, textWrap: "pretty" }}>{a.summary}</p>
        </header>

        <div style={{ borderTop: "1px solid var(--line-2)", paddingTop: 30 }}>
          <Blocks body={a.body} />
        </div>

        {/* One restrained CTA. No pricing cards: an article that turns into a sales page stops being worth
            citing, and being citable is the entire reason this section exists. */}
        <div style={{ marginTop: 52, paddingTop: 24, borderTop: "1px solid var(--line-2)", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <Link href="/how-it-works" className="btn">Verify an outcome with Vraelis</Link>
          <Link href="/limitations" style={{ fontSize: 13.5, color: "var(--fg-4)" }}>What Vraelis cannot do yet</Link>
        </div>

        {related.length > 0 && (
          <div style={{ marginTop: 52 }}>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.09em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>Related</div>
            {related.map((r) => (
              <Link key={r.slug} href={`/research/${r.slug}`} style={{ display: "block", textDecoration: "none", color: "inherit", borderTop: "1px solid var(--line-2)", padding: "15px 0" }}>
                <span style={{ display: "block", fontSize: "1rem", fontWeight: 550, color: "var(--fg-1)", marginBottom: 4, letterSpacing: "-0.01em" }}>{r.title}</span>
                <span style={{ display: "block", fontSize: "0.9rem", color: "var(--fg-4)", lineHeight: 1.5 }}>{r.summary}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
