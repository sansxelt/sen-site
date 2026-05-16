import type { Metadata } from "next";
import Link from "next/link";
import { AuroraBackground } from "@/components/aurora-background";
import { LearnShell } from "@/components/learn/learn-shell";
import { ARTICLES, LEVEL_TONE, type LevelKey } from "@/lib/learn-content";
import { listPublishedPieces } from "@/lib/learn-db";

export const metadata: Metadata = {
  title: "All articles · Learn",
  description: "Every guide on vraelis Learn, newest first.",
};

// 5 min so newly published DB pieces show up without a redeploy.
export const revalidate = 300;

type MergedArticle = {
  slug: string;
  title: string;
  excerpt: string;
  level: LevelKey | null;
  readMinutes: number | null;
  publishedAt: string;
  href: string;
};

export default async function AllArticlesPage() {
  const dbPieces = await listPublishedPieces({ limit: 200 });

  const merged: MergedArticle[] = [
    ...ARTICLES.map((a) => ({
      slug: a.slug,
      title: a.title,
      excerpt: a.excerpt,
      level: a.level,
      readMinutes: a.readMinutes,
      publishedAt: a.publishedAt,
      href: `/learn/${a.slug}`,
    })),
    ...dbPieces.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt ?? "",
      level: null,
      readMinutes: p.read_minutes,
      publishedAt: p.published_at ?? p.created_at,
      href: `/learn/p/${p.slug}`,
    })),
  ];
  const sorted = merged.sort((a, b) =>
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
                key={article.href}
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
            ))}
          </div>
        </section>
      </LearnShell>
    </>
  );
}
