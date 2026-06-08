import type { Metadata } from "next";
import Link from "next/link";
import { LearnShell } from "@/components/learn/learn-shell";
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
  const dbPieces = await listPublishedPieces({ limit: 50 });

  function totalCountForTopic(topicKey: string): number {
    const hardcoded = countArticlesInTopic(topicKey as Parameters<typeof countArticlesInTopic>[0]);
    const dbCount = dbPieces.filter((p) => p.topic === topicKey).length;
    return hardcoded + dbCount;
  }

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
    <LearnShell>
      <section
        className="pt-6 pb-16 sm:pt-8 sm:pb-24"
        style={{ fontFamily: '"Inter Tight", -apple-system, sans-serif' }}
      >
        {/* Hero */}
        <div className="max-w-2xl pb-10 border-b" style={{ borderColor: "rgba(199,205,215,0.08)" }}>
          <div
            className="text-xs font-medium uppercase tracking-[0.18em] mb-4"
            style={{ color: "#5CE5D5", fontFamily: '"JetBrains Mono", monospace' }}
          >
            Learn
          </div>
          <h1
            className="text-3xl font-medium tracking-tight sm:text-5xl"
            style={{ color: "#ECEFF4", letterSpacing: "-0.03em", lineHeight: 1.05 }}
          >
            AI, coding, and shipping, explained simply.
          </h1>
          <p className="mt-4 text-base leading-7 sm:text-lg sm:leading-8" style={{ color: "#8B95A6" }}>
            Pick a topic, ship something by the end. Short reads, real code, no fluff.
          </p>
        </div>

        {/* Topic grid */}
        <section className="mt-12">
          <div
            className="text-xs font-medium uppercase tracking-[0.18em] mb-5"
            style={{ color: "#5A6478", fontFamily: '"JetBrains Mono", monospace' }}
          >
            Topics
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {TOPICS.map((topic) => {
              const count = totalCountForTopic(topic.key);
              return (
                <Link
                  key={topic.key}
                  href={`/learn/topics/${topic.key}`}
                  className="group flex h-full flex-col border p-5 transition"
                  style={{
                    borderColor: "rgba(199,205,215,0.10)",
                    background: "rgba(199,205,215,0.02)",
                  }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <h3
                      className="text-base font-medium transition"
                      style={{ color: "#ECEFF4" }}
                    >
                      {topic.label}
                    </h3>
                    <span
                      className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em]"
                      style={{ color: "#5A6478" }}
                    >
                      {count > 0 ? `${count} article${count === 1 ? "" : "s"}` : "Coming soon"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5" style={{ color: "#5A6478" }}>
                    {topic.description}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Featured articles */}
        <section className="mt-14">
          <div className="flex items-baseline justify-between gap-4 mb-5">
            <div
              className="text-xs font-medium uppercase tracking-[0.18em]"
              style={{ color: "#5A6478", fontFamily: '"JetBrains Mono", monospace' }}
            >
              Latest
            </div>
            <Link
              href="/learn/all"
              className="text-xs transition"
              style={{ color: "#5A6478" }}
            >
              See all →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            {featured.map((article) => (
              <Link
                key={article.href}
                href={article.href}
                className="group flex h-full flex-col border p-5 transition"
                style={{
                  borderColor: "rgba(199,205,215,0.10)",
                  background: "rgba(199,205,215,0.02)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  {article.level ? (
                    <span
                      className="border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]"
                      style={{ borderColor: "rgba(92,229,213,0.25)", color: "#5CE5D5" }}
                    >
                      {article.level}
                    </span>
                  ) : (
                    <span
                      className="border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em]"
                      style={{ borderColor: "rgba(199,205,215,0.12)", color: "#5A6478" }}
                    >
                      New
                    </span>
                  )}
                  {article.readMinutes && (
                    <span className="text-xs" style={{ color: "#5A6478" }}>
                      {article.readMinutes} min
                    </span>
                  )}
                </div>
                <h3
                  className="mt-3 text-base font-medium transition"
                  style={{ color: "#ECEFF4" }}
                >
                  {article.title}
                </h3>
                <p className="mt-2 line-clamp-3 text-sm leading-6" style={{ color: "#8B95A6" }}>
                  {article.excerpt}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div
          className="mt-16 border p-6 sm:p-8"
          style={{ borderColor: "rgba(92,229,213,0.18)", background: "rgba(92,229,213,0.03)" }}
        >
          <div
            className="text-xs font-medium uppercase tracking-[0.18em] mb-3"
            style={{ color: "#5CE5D5", fontFamily: '"JetBrains Mono", monospace' }}
          >
            Done reading?
          </div>
          <h3
            className="mt-2 text-xl font-medium sm:text-2xl"
            style={{ color: "#ECEFF4", letterSpacing: "-0.02em" }}
          >
            Try what you just learned in the workshop.
          </h3>
          <p className="mt-2 text-sm leading-6" style={{ color: "#8B95A6" }}>
            Free plan ships with 50 chats a week, enough to get a real feel
            for how Vraelis works without committing to anything.
          </p>
          <Link
            href="/chat"
            className="mt-5 inline-flex items-center gap-2 px-5 py-3 text-sm font-medium transition"
            style={{ background: "#5CE5D5", color: "#0A0F18" }}
          >
            Open the workshop <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </LearnShell>
  );
}
