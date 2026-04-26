import Link from "next/link";
import type { ReactNode } from "react";
import type { ArticleMeta } from "@/lib/learn-content";

const CATEGORY_LABEL: Record<ArticleMeta["category"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  build: "Build",
  api: "API",
};

const CATEGORY_TONE: Record<ArticleMeta["category"], string> = {
  beginner:     "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-300",
  intermediate: "border-sky-400/25 bg-sky-400/[0.06] text-sky-300",
  advanced:     "border-violet-400/25 bg-violet-400/[0.06] text-violet-300",
  build:        "border-amber-400/25 bg-amber-400/[0.06] text-amber-300",
  api:          "border-fuchsia-400/25 bg-fuchsia-400/[0.06] text-fuchsia-300",
};

export function ArticleShell({
  meta,
  children,
}: {
  meta: ArticleMeta;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-[780px] px-4 pt-8 pb-20 sm:px-6 sm:pt-10 sm:pb-24 lg:px-8">
      {/* Breadcrumb */}
      <nav className="text-xs text-neutral-500">
        <Link href="/learn" className="transition hover:text-neutral-300">
          Learn
        </Link>
        <span className="mx-2 text-neutral-700">/</span>
        <span className="text-neutral-400">{CATEGORY_LABEL[meta.category]}</span>
      </nav>

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] ${CATEGORY_TONE[meta.category]}`}
          >
            {CATEGORY_LABEL[meta.category]}
          </span>
          <span className="text-xs text-neutral-500">{meta.readMinutes} min read</span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
          {meta.title}
        </h1>
        <p className="mt-3 text-base leading-7 text-neutral-300 sm:text-lg sm:leading-8">
          {meta.excerpt}
        </p>
      </header>

      <div className="mt-8">
        {children}
      </div>
    </article>
  );
}
