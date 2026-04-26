import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuroraBackground } from "@/components/aurora-background";
import { LearnShell } from "@/components/learn/learn-shell";
import {
  TOPICS,
  articlesInTopic,
  getTopic,
  LEVEL_TONE,
} from "@/lib/learn-content";

type Props = { params: Promise<{ topic: string }> };

export async function generateStaticParams() {
  return TOPICS.map((t) => ({ topic: t.key }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params;
  const t = getTopic(topic);
  if (!t) return { title: "Not found" };
  return {
    title: `${t.label} · Learn`,
    description: t.description,
  };
}

export default async function TopicPage({ params }: Props) {
  const { topic } = await params;
  const t = getTopic(topic);
  if (!t) notFound();

  const articles = articlesInTopic(t.key);
  // Group articles by their subtopic so the page reads as
  // "Concepts (3), How it works (2), ..." instead of one long list.
  const bySubtopic = t.subtopics.map((sub) => ({
    sub,
    items: articles.filter((a) => a.subtopic === sub.key),
  }));
  const orphans = articles.filter((a) => !a.subtopic);

  return (
    <>
      <AuroraBackground />
      <LearnShell activeTopic={t.key}>
        <section className="pt-6 pb-16 sm:pt-8 sm:pb-24">
          <nav className="text-xs text-neutral-500">
            <Link href="/learn" className="transition hover:text-neutral-300">Learn</Link>
            <span className="mx-2 text-neutral-700">/</span>
            <span className="text-neutral-400">{t.label}</span>
          </nav>

          <header className="mt-4">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {t.label}
            </h1>
            <p className="mt-3 text-base leading-7 text-neutral-300 sm:text-lg">
              {t.description}
            </p>
          </header>

          {articles.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-neutral-400">
                No articles in {t.label} yet, coming soon.
              </p>
              <Link
                href="/learn"
                className="mt-4 inline-block text-xs text-violet-300 transition hover:text-violet-200"
              >
                ← Back to all topics
              </Link>
            </div>
          ) : (
            <div className="mt-10 space-y-10">
              {bySubtopic.map(({ sub, items }) =>
                items.length === 0 ? null : (
                  <section key={sub.key}>
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="text-xl font-semibold text-white">{sub.label}</h2>
                      <Link
                        href={`/learn/topics/${t.key}/${sub.key}`}
                        className="text-xs text-neutral-500 transition hover:text-neutral-300"
                      >
                        See all →
                      </Link>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
                      {items.map((article) => (
                        <ArticleCard key={article.slug} article={article} />
                      ))}
                    </div>
                  </section>
                ),
              )}
              {orphans.length > 0 && (
                <section>
                  <h2 className="text-xl font-semibold text-white">Other</h2>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4">
                    {orphans.map((article) => (
                      <ArticleCard key={article.slug} article={article} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </section>
      </LearnShell>
    </>
  );
}

function ArticleCard({
  article,
}: {
  article: ReturnType<typeof articlesInTopic>[number];
}) {
  return (
    <Link
      href={`/learn/${article.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.04]"
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${LEVEL_TONE[article.level]}`}
        >
          {article.level}
        </span>
        <span className="text-xs text-neutral-500">{article.readMinutes} min</span>
      </div>
      <h3 className="mt-3 text-base font-semibold text-white transition group-hover:text-violet-200">
        {article.title}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-400">
        {article.excerpt}
      </p>
    </Link>
  );
}
