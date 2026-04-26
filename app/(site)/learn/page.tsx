import type { Metadata } from "next";
import Link from "next/link";
import { AuroraBackground } from "@/components/aurora-background";
import {
  ARTICLES,
  CATEGORY_DESCRIPTION,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  type ArticleCategory,
} from "@/lib/learn-content";

export const metadata: Metadata = {
  title: "Learn AI",
  description:
    "Plain-English guides to AI: how it works, how to use it, and how to build with it. Beginner to advanced.",
};

const CATEGORY_TONE: Record<ArticleCategory, string> = {
  beginner:     "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-300",
  intermediate: "border-sky-400/25 bg-sky-400/[0.06] text-sky-300",
  advanced:     "border-violet-400/25 bg-violet-400/[0.06] text-violet-300",
  build:        "border-amber-400/25 bg-amber-400/[0.06] text-amber-300",
  api:          "border-fuchsia-400/25 bg-fuchsia-400/[0.06] text-fuchsia-300",
};

export default function LearnIndexPage() {
  // Group articles by category, in canonical order, dropping empty cats
  // so the page doesn't render a section for "Intermediate (0 articles)".
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    articles: ARTICLES.filter((a) => a.category === cat),
  })).filter((g) => g.articles.length > 0);

  return (
    <>
      <AuroraBackground />
      <section className="mx-auto max-w-[1100px] px-4 pt-6 pb-16 sm:px-6 sm:pt-10 sm:pb-24 lg:px-8">
        {/* Hero */}
        <div className="max-w-2xl">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-200/80">
            Learn AI
          </div>
          <h1 className="hx-gradient-text mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
            AI explained like a smart friend, not a textbook.
          </h1>
          <p className="mt-4 text-base leading-7 text-neutral-200 sm:text-lg sm:leading-8">
            Plain-English guides for everyone — from &quot;what is AI?&quot; to
            building real apps with the sansxel API. Short reads, lots of
            visuals, no PhD tone.
          </p>
        </div>

        {/* Grouped article list */}
        <div className="mt-14 space-y-12">
          {grouped.map(({ category, articles }) => (
            <section key={category}>
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                    {CATEGORY_LABEL[category]}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    {CATEGORY_DESCRIPTION[category]}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-neutral-500">
                  {articles.length} article{articles.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-4">
                {articles.map((article) => (
                  <Link
                    key={article.slug}
                    href={`/learn/${article.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 hover:bg-white/[0.04] sm:p-6"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] ${CATEGORY_TONE[article.category]}`}
                      >
                        {CATEGORY_LABEL[article.category]}
                      </span>
                      <span className="shrink-0 text-xs text-neutral-500">
                        {article.readMinutes} min
                      </span>
                    </div>
                    <div className="mt-4 text-3xl" aria-hidden>
                      {article.coverEmoji}
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-white transition group-hover:text-violet-200">
                      {article.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-neutral-400">
                      {article.excerpt}
                    </p>
                    <div className="mt-auto pt-4 text-xs font-medium text-violet-300/80">
                      Read →
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* CTA into the product */}
        <div className="mt-16 rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/[0.08] to-fuchsia-500/[0.05] p-6 sm:mt-20 sm:p-8">
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
    </>
  );
}
