import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuroraBackground } from "@/components/aurora-background";
import { LearnShell } from "@/components/learn/learn-shell";
import {
  TOPICS,
  articlesInSubtopic,
  getSubtopic,
  getTopic,
  LEVEL_TONE,
} from "@/lib/learn-content";

type Props = { params: Promise<{ topic: string; subtopic: string }> };

export async function generateStaticParams() {
  return TOPICS.flatMap((t) =>
    t.subtopics.map((s) => ({ topic: t.key, subtopic: s.key })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic, subtopic } = await params;
  const t = getTopic(topic);
  const sub = t ? getSubtopic(t, subtopic) : null;
  if (!t || !sub) return { title: "Not found" };
  return {
    title: `${sub.label} · ${t.label} · Learn`,
    description: `${sub.label} guides in the ${t.label} section.`,
  };
}

export default async function SubtopicPage({ params }: Props) {
  const { topic, subtopic } = await params;
  const t = getTopic(topic);
  const sub = t ? getSubtopic(t, subtopic) : null;
  if (!t || !sub) notFound();

  const articles = articlesInSubtopic(t.key, sub.key);

  return (
    <>
      <AuroraBackground />
      <LearnShell activeTopic={t.key} activeSubtopic={sub.key}>
        <section className="pt-6 pb-16 sm:pt-8 sm:pb-24">
          <nav className="text-xs text-neutral-500">
            <Link href="/learn" className="transition hover:text-neutral-300">Learn</Link>
            <span className="mx-2 text-neutral-700">/</span>
            <Link
              href={`/learn/topics/${t.key}`}
              className="transition hover:text-neutral-300"
            >
              {t.label}
            </Link>
            <span className="mx-2 text-neutral-700">/</span>
            <span className="text-neutral-400">{sub.label}</span>
          </nav>

          <header className="mt-4">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {sub.label}
            </h1>
            <p className="mt-3 text-sm text-neutral-400">
              {sub.label} guides in the {t.label} section.
            </p>
          </header>

          {articles.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center">
              <p className="text-sm text-neutral-400">
                No articles here yet — coming soon.
              </p>
              <Link
                href={`/learn/topics/${t.key}`}
                className="mt-4 inline-block text-xs text-violet-300 transition hover:text-violet-200"
              >
                ← Back to {t.label}
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
              {articles.map((article) => (
                <Link
                  key={article.slug}
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
              ))}
            </div>
          )}
        </section>
      </LearnShell>
    </>
  );
}
