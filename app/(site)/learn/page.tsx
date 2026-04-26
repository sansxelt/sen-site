import type { Metadata } from "next";
import Link from "next/link";
import { AuroraBackground } from "@/components/aurora-background";
import { LearnShell } from "@/components/learn/learn-shell";
import {
  ARTICLES,
  LEVEL_TONE,
  TOPICS,
  countArticlesInTopic,
} from "@/lib/learn-content";

export const metadata: Metadata = {
  title: "Learn AI",
  description:
    "Plain-English guides to AI, coding, APIs, MCP, system design, and shipping real products. Beginner to advanced.",
};

export default function LearnIndexPage() {
  // Featured = newest 4 articles, surfaces what's worth reading first.
  const featured = [...ARTICLES]
    .sort((a, b) => (a.publishedAt > b.publishedAt ? -1 : 1))
    .slice(0, 4);

  return (
    <>
      <AuroraBackground />
      <LearnShell>
        <section className="pt-6 pb-16 sm:pt-8 sm:pb-24">
          {/* Hero */}
          <div className="max-w-2xl">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-200/80">
              Learn
            </div>
            <h1 className="hx-gradient-text mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
              AI, coding, and shipping — explained simply.
            </h1>
            <p className="mt-4 text-base leading-7 text-neutral-200 sm:text-lg sm:leading-8">
              A structured platform for going from zero to building real
              products. Short reads, real code, no PhD tone.
            </p>
          </div>

          {/* Topic grid */}
          <section className="mt-12">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
              Topics
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {TOPICS.map((topic) => {
                const count = countArticlesInTopic(topic.key);
                return (
                  <Link
                    key={topic.key}
                    href={`/learn/topics/${topic.key}`}
                    className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.04]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-2xl" aria-hidden>{topic.emoji}</div>
                      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                        {count > 0 ? `${count} article${count === 1 ? "" : "s"}` : "Coming soon"}
                      </span>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-white transition group-hover:text-violet-200">
                      {topic.label}
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-neutral-400">
                      {topic.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Featured articles */}
          <section className="mt-14">
            <div className="flex items-baseline justify-between gap-4">
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-400">
                Latest
              </div>
              <Link href="/learn/all" className="text-xs text-neutral-500 transition hover:text-neutral-300">
                See all →
              </Link>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4">
              {featured.map((article) => (
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
                  <div className="mt-4 text-3xl" aria-hidden>{article.coverEmoji}</div>
                  <h3 className="mt-3 text-lg font-semibold text-white transition group-hover:text-violet-200">
                    {article.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    {article.excerpt}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div className="mt-16 rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.05] p-6 sm:p-8">
            <div className="text-xs font-medium uppercase tracking-[0.2em] text-violet-300">
              Done reading?
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white sm:text-2xl">
              Try what you just learned in the workshop.
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-200">
              Free plan ships with 50 chats a week — enough to get a real feel
              for how sansxel works without committing to anything.
            </p>
            <Link
              href="/app"
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
            >
              Open the workshop <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      </LearnShell>
    </>
  );
}
