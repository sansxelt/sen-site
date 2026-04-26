import type { Metadata } from "next";
import Link from "next/link";
import { AuroraBackground } from "@/components/aurora-background";
import { LearnShell } from "@/components/learn/learn-shell";
import { ARTICLES, LEVEL_TONE } from "@/lib/learn-content";

export const metadata: Metadata = {
  title: "All articles · Learn",
  description: "Every guide on sansxel Learn, newest first.",
};

export default function AllArticlesPage() {
  const sorted = [...ARTICLES].sort((a, b) =>
    a.publishedAt > b.publishedAt ? -1 : 1,
  );

  return (
    <>
      <AuroraBackground />
      <LearnShell>
        <section className="pt-6 pb-16 sm:pt-8 sm:pb-24">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-200/80">
            Learn
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            All articles
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            {sorted.length} article{sorted.length === 1 ? "" : "s"} · newest first
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
            {sorted.map((article) => (
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
      </LearnShell>
    </>
  );
}
