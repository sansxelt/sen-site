import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AuroraBackground } from "@/components/aurora-background";
import { ArticleShell } from "@/components/learn/article-shell";
import { ARTICLE_BY_SLUG, ARTICLES, CATEGORY_LABEL } from "@/lib/learn-content";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = ARTICLE_BY_SLUG[slug];
  if (!article) return { title: "Not found" };
  return {
    title: `${article.title} · Learn`,
    description: article.excerpt,
  };
}

export default async function ArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = ARTICLE_BY_SLUG[slug];
  if (!article) notFound();

  // Show 2-3 other articles at the bottom — same category first,
  // anything else if there aren't enough peers.
  const others = ARTICLES.filter((a) => a.slug !== article.slug);
  const sameCategory = others.filter((a) => a.category === article.category);
  const fillers = others.filter((a) => a.category !== article.category);
  const related = [...sameCategory, ...fillers].slice(0, 3);

  return (
    <>
      <AuroraBackground />
      <ArticleShell meta={article}>{article.render()}</ArticleShell>

      {related.length > 0 && (
        <section className="mx-auto max-w-[1100px] px-4 pb-20 sm:px-6 sm:pb-24 lg:px-8">
          <div className="border-t border-white/10 pt-10">
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              Keep learning
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-3 sm:gap-4">
              {related.map((r) => (
                <Link
                  key={r.slug}
                  href={`/learn/${r.slug}`}
                  className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-4 transition hover:border-white/20 hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-500">{CATEGORY_LABEL[r.category]}</span>
                    <span className="text-neutral-500">{r.readMinutes} min</span>
                  </div>
                  <div className="mt-3 text-2xl" aria-hidden>{r.coverEmoji}</div>
                  <div className="mt-2 text-sm font-semibold text-white transition group-hover:text-violet-200">
                    {r.title}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-400">
                    {r.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
