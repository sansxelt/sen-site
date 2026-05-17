import type { Metadata } from "next";
import Link from "next/link";
import { AuroraBackground } from "@/components/aurora-background";
import { LearnShell } from "@/components/learn/learn-shell";
import { Reveal } from "@/components/landing/reveal";
import {
  ARTICLES,
  LEVEL_TONE,
  TOPICS,
  countArticlesInTopic,
} from "@/lib/learn-content";
import { listPublishedPieces } from "@/lib/learn-db";

// 5 min so freshly-published DB pieces show up without a redeploy.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Learn AI",
  description:
    "Plain-English guides to AI, coding, APIs, MCP, system design, and shipping real products. Beginner to advanced.",
};

export default async function LearnIndexPage() {
  // DB-backed published pieces live alongside the hardcoded ARTICLES.
  // Topic counts merge both sources so the sidebar reflects real
  // total content, not just the legacy hardcoded list.
  const dbPieces = await listPublishedPieces({ limit: 50 });

  function totalCountForTopic(topicKey: string): number {
    const hardcoded = countArticlesInTopic(topicKey as Parameters<typeof countArticlesInTopic>[0]);
    const dbCount = dbPieces.filter((p) => p.topic === topicKey).length;
    return hardcoded + dbCount;
  }

  // Featured = newest 4 across both sources, by ISO date desc.
  const merged: Array<{
    slug: string;
    title: string;
    excerpt: string;
    readMinutes: number | null;
    level: keyof typeof LEVEL_TONE | null;
    publishedAt: string;
    href: string;
  }> = [
    ...ARTICLES.map((a) => ({
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      readMinutes: a.readMinutes,
      level: a.level,
      publishedAt: a.publishedAt,
      href: `/learn/${a.slug}`,
    })),
    ...dbPieces.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? "",
      readMinutes: p.read_minutes,
      level: null,
      publishedAt: p.published_at ?? p.created_at,
      href: `/learn/p/${p.slug}`,
    })),
  ];
  const featured = merged
    .sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1))
    .slice(0, 6);

  return (
    <>
      <AuroraBackground />
      <LearnShell>
        <section className="pt-6 pb-16 sm:pt-8 sm:pb-24">
          {/* Hero */}
          <Reveal as="div" className="max-w-2xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-200/80">
              Learn
            </div>
            <h1 className="hx-gradient-text mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              AI, coding, and shipping, explained simply.
            </h1>
            <p className="mt-4 text-base leading-7 text-neutral-200 sm:text-lg sm:leading-8">
              Pick a topic, ship something by the end. Short reads, real
              code, no fluff.
            </p>
          </Reveal>

          {/* Topic grid, text-first, no big emojis */}
          <section className="mt-12">
            <Reveal>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
                Topics
              </div>
            </Reveal>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {TOPICS.map((topic, i) => {
                const count = totalCountForTopic(topic.key);
                return (
                  <Reveal key={topic.key} delay={i * 0.05}>
                    <Link
                      href={`/learn/topics/${topic.key}`}
                      className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.04]"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="text-base font-semibold text-white transition group-hover:text-violet-200">
                          {topic.label}
                        </h3>
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                          {count > 0 ? `${count} article${count === 1 ? "" : "s"}` : "Coming soon"}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-neutral-400">
                        {topic.description}
                      </p>
                    </Link>
                  </Reveal>
                );
              })}
            </div>
          </section>

          {/* Featured articles */}
          <section className="mt-14">
            <Reveal>
              <div className="flex items-baseline justify-between gap-4">
                <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
                  Latest
                </div>
                <Link href="/learn/all" className="text-xs text-neutral-500 transition hover:text-neutral-300">
                  See all →
                </Link>
              </div>
            </Reveal>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4">
              {featured.map((article, i) => (
                <Reveal key={article.href} delay={i * 0.05}>
                  <Link
                    href={article.href}
                    className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      {article.level ? (
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${LEVEL_TONE[article.level]}`}
                        >
                          {article.level}
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-400">
                          New
                        </span>
                      )}
                      {article.readMinutes && (
                        <span className="text-xs text-neutral-500">{article.readMinutes} min</span>
                      )}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-white transition group-hover:text-violet-200">
                      {article.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-neutral-400">
                      {article.excerpt}
                    </p>
                  </Link>
                </Reveal>
              ))}
            </div>
          </section>

          {/* CTA */}
          <Reveal as="div" className="mt-16 rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.05] p-6 sm:p-8">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300">
              Done reading?
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Try what you just learned in the workshop.
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-200">
              Free plan ships with 50 chats a week, enough to get a real feel
              for how Vraelis works without committing to anything.
            </p>
            <Link
              href="/app"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
            >
              Open the workshop <span aria-hidden>→</span>
            </Link>
          </Reveal>
        </section>
      </LearnShell>
    </>
  );
}
