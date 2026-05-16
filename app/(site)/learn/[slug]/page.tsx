import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AuroraBackground } from "@/components/aurora-background";
import { ArticleShell } from "@/components/learn/article-shell";
import { LearnShell } from "@/components/learn/learn-shell";
import {
  ARTICLE_BY_SLUG,
  ARTICLES,
  getTopic,
  LEVEL_TONE,
} from "@/lib/learn-content";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

const CANONICAL_BASE = "https://www.vraelis.ai";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLE_BY_SLUG[slug];
  if (!article) return { title: "Not found" };
  const url = `${CANONICAL_BASE}/learn/${article.slug}`;
  return {
    title: `${article.title} · Learn`,
    description: article.excerpt,
    alternates: { canonical: url },
    authors: [{ name: "vraelis (OWNER)" }],
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: "article",
      url,
      siteName: "vraelis",
      publishedTime: article.publishedAt,
      authors: ["vraelis (OWNER)"],
      tags: [article.topic, article.subtopic ?? ""].filter(Boolean),
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
    },
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = ARTICLE_BY_SLUG[slug];
  if (!article) notFound();

  // 'Keep learning' = same topic first, anything else as filler.
  const others = ARTICLES.filter((a) => a.slug !== article.slug);
  const sameTopic = others.filter((a) => a.topic === article.topic);
  const fillers = others.filter((a) => a.topic !== article.topic);
  const related = [...sameTopic, ...fillers].slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.excerpt,
    datePublished: article.publishedAt,
    author: { "@type": "Person", name: "vraelis (OWNER)" },
    publisher: {
      "@type": "Organization",
      name: "vraelis",
      url: "https://www.vraelis.ai",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${CANONICAL_BASE}/learn/${article.slug}`,
    },
    articleSection: article.topic,
  };

  return (
    <>
      <AuroraBackground />
      <LearnShell activeTopic={article.topic} activeSubtopic={article.subtopic}>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <ArticleShell meta={article}>{article.render()}</ArticleShell>

        {related.length > 0 && (
          <section className="mx-auto max-w-[780px] pb-20">
            <div className="border-t border-white/10 pt-10">
              <h2 className="text-lg font-semibold text-white sm:text-xl">
                Keep learning
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-3 sm:gap-4">
                {related.map((r) => {
                  const t = getTopic(r.topic);
                  return (
                    <Link
                      key={r.slug}
                      href={`/learn/${r.slug}`}
                      className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${LEVEL_TONE[r.level]}`}
                        >
                          {r.level}
                        </span>
                        <span className="text-neutral-500">{r.readMinutes} min</span>
                      </div>
                      <div className="mt-3 text-sm font-semibold text-white transition group-hover:text-violet-200">
                        {r.title}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-400">
                        {r.excerpt}
                      </p>
                      {t && (
                        <div className="mt-2 text-[10px] uppercase tracking-[0.14em] text-neutral-600">
                          {t.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </LearnShell>
    </>
  );
}
