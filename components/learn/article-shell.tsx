import Link from "next/link";
import type { ReactNode } from "react";
import {
  getSubtopic,
  getTopic,
  LEVEL_TONE,
  type ArticleMeta,
} from "@/lib/learn-content";
import { BecomeContributorCard } from "./become-contributor-card";

export function ArticleShell({
  meta,
  children,
}: {
  meta: ArticleMeta;
  children: ReactNode;
}) {
  const topic = getTopic(meta.topic);
  const sub = topic && meta.subtopic ? getSubtopic(topic, meta.subtopic) : null;

  return (
    <article className="mx-auto max-w-[780px] pt-8 pb-20 sm:pt-10 sm:pb-24">
      {/* Breadcrumb shows full path: Learn / Topic / Subtopic */}
      <nav className="text-xs text-neutral-500">
        <Link href="/learn" className="transition hover:text-neutral-300">
          Learn
        </Link>
        {topic && (
          <>
            <span className="mx-2 text-neutral-700">/</span>
            <Link
              href={`/learn/topics/${topic.key}`}
              className="transition hover:text-neutral-300"
            >
              {topic.label}
            </Link>
          </>
        )}
        {sub && topic && (
          <>
            <span className="mx-2 text-neutral-700">/</span>
            <Link
              href={`/learn/topics/${topic.key}/${sub.key}`}
              className="transition hover:text-neutral-300"
            >
              {sub.label}
            </Link>
          </>
        )}
      </nav>

      <header className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.14em] ${LEVEL_TONE[meta.level]}`}
          >
            {meta.level}
          </span>
          <span className="text-xs text-neutral-500">{meta.readMinutes} min read</span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl lg:text-5xl">
          {meta.title}
        </h1>
        <p className="mt-3 text-base leading-7 text-neutral-300 sm:text-lg sm:leading-8">
          {meta.excerpt}
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-neutral-400">
          <span>By</span>
          <span className="font-medium text-neutral-200">VRAELIS (OWNER)</span>
          {meta.publishedAt && (
            <>
              <span aria-hidden className="text-neutral-600">·</span>
              <span>
                {new Date(meta.publishedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>
      </header>

      <div className="mt-8">{children}</div>

      <BecomeContributorCard />
    </article>
  );
}
