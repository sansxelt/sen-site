import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VraelisArticleBody } from "@/components/vraelis-article-body";
import { ARTICLES, formatArticleDate, getArticle } from "../_articles";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Article — Vraelis" };
  return {
    title: `${article.title} — Vraelis`,
    description: article.excerpt,
  };
}

export default async function VraelisArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  return (
    <article className="section" style={{ position: "relative", overflow: "hidden" }}>
      <div className="gridbg" style={{ opacity: 0.35 }} />
      <div className="wrap" style={{ position: "relative", maxWidth: 760 }}>
        <Link
          href="/v/articles"
          style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)", textDecoration: "none" }}
        >
          ← All articles
        </Link>

        <div style={{ margin: "20px 0 26px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <span className="pill"><span className="dot dot--acc" />{article.tag}</span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>
              {formatArticleDate(article.date)} · {article.readingMinutes} min read
            </span>
          </div>
          <h1 className="display" style={{ fontSize: "clamp(2rem, 3.8vw, 3rem)", lineHeight: 1.12 }}>
            {article.title}
          </h1>
          <p className="lead-copy" style={{ marginTop: 16 }}>{article.excerpt}</p>
        </div>

        <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 28 }}>
          <VraelisArticleBody body={article.body} />
        </div>
      </div>
    </article>
  );
}
