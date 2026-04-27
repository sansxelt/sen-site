import Link from "next/link";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { isAdminEmail } from "@/lib/admin";
import type {
  LearnChapter,
  LearnPieceWithChapters,
} from "@/lib/learn-db";
import { BecomeContributorCard } from "./become-contributor-card";

// Author label rule: null author OR an admin email both render as
// the operator's display name. Seeded pieces (no author_email) and
// owner-written pieces share a single byline. External contributors
// (once they onboard via help@sansxel.ai) will surface their own
// email until we add a per-author display_name lookup.
const OWNER_DISPLAY_NAME = "Nishanth";
function authorLabel(authorEmail: string | null): string {
  if (!authorEmail || isAdminEmail(authorEmail)) return OWNER_DISPLAY_NAME;
  return authorEmail;
}

// ReactMarkdown component overrides: explicit Tailwind classes
// instead of @tailwindcss/typography, since the plugin isn't
// installed and prose classes would be no-ops.
const MD_COMPONENTS: Components = {
  h1: (props) => (
    <h1 className="mt-10 mb-4 text-2xl font-semibold tracking-tight text-white" {...props} />
  ),
  h2: (props) => (
    <h2 className="mt-10 mb-4 text-xl font-semibold tracking-tight text-white" {...props} />
  ),
  h3: (props) => (
    <h3 className="mt-6 mb-3 text-base font-semibold tracking-tight text-white" {...props} />
  ),
  p: (props) => <p className="my-4 leading-relaxed text-neutral-200" {...props} />,
  ul: (props) => <ul className="my-4 space-y-2 pl-5 list-disc marker:text-neutral-600" {...props} />,
  ol: (props) => <ol className="my-4 space-y-2 pl-5 list-decimal marker:text-neutral-600" {...props} />,
  li: (props) => <li className="leading-relaxed text-neutral-200" {...props} />,
  a: (props) => (
    <a className="text-violet-300 underline-offset-2 hover:underline" {...props} />
  ),
  blockquote: (props) => (
    <blockquote className="my-4 border-l-2 border-white/15 pl-4 italic text-neutral-400" {...props} />
  ),
  code: ({ className, children, ...rest }) => {
    const isBlock = /language-/.test(className ?? "");
    if (isBlock) {
      return (
        <code className={`${className ?? ""} text-[0.9em] text-neutral-100`} {...rest}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[0.9em] text-neutral-100" {...rest}>
        {children}
      </code>
    );
  },
  pre: (props) => (
    <pre className="my-4 overflow-x-auto rounded-xl border border-white/[0.06] bg-black/40 p-4" {...props} />
  ),
  hr: () => <hr className="my-8 border-white/[0.08]" />,
  table: (props) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props} />
    </div>
  ),
  th: (props) => (
    <th className="border-b border-white/[0.10] px-3 py-2 text-left font-medium text-neutral-300" {...props} />
  ),
  td: (props) => (
    <td className="border-b border-white/[0.06] px-3 py-2 text-neutral-300" {...props} />
  ),
};

// Renders a DB-backed Learn piece (article / info / research). The
// caller picks which chapter is active so the same component drives
// both /learn/p/[slug] (defaults to chapter 0) and
// /learn/p/[slug]/[chapter] (specific ord).

export function LearnPieceView({
  piece,
  activeChapter,
}: {
  piece: LearnPieceWithChapters;
  activeChapter: LearnChapter;
}) {
  const multi = piece.chapters.length > 1;
  const idx = piece.chapters.findIndex((c) => c.id === activeChapter.id);
  const prev = idx > 0 ? piece.chapters[idx - 1] : null;
  const next = idx < piece.chapters.length - 1 ? piece.chapters[idx + 1] : null;

  return (
    <article className="pb-24 pt-4">
      <header className="space-y-4">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500">
          <Link href="/learn" className="transition hover:text-white">
            Learn
          </Link>
          <span aria-hidden>·</span>
          <span>{piece.type}</span>
          <span aria-hidden>·</span>
          <span>
            {piece.topic}
            {piece.subtopic ? ` / ${piece.subtopic}` : ""}
          </span>
          {piece.read_minutes && (
            <>
              <span aria-hidden>·</span>
              <span>{piece.read_minutes} min read</span>
            </>
          )}
        </div>
        <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl">
          {piece.title}
        </h1>
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <span>By</span>
          <span className="font-medium text-neutral-200">
            {authorLabel(piece.author_email)}
          </span>
          {(!piece.author_email || isAdminEmail(piece.author_email)) && (
            <span className="rounded-full border border-violet-400/30 bg-violet-400/[0.10] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-violet-200">
              Owner
            </span>
          )}
          {piece.published_at && (
            <>
              <span aria-hidden className="text-neutral-600">·</span>
              <span>
                {new Date(piece.published_at).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>
        {piece.excerpt && (
          <p className="max-w-2xl text-base leading-relaxed text-neutral-400">
            {piece.excerpt}
          </p>
        )}
      </header>

      {/* Sources at the top: readers can audit what the piece is
          grounded in before they invest time reading. Citation
          numbers in the body link back to this list by ordinal. */}
      {piece.sources.length > 0 && (
        <section className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-400">
            Sources
          </h2>
          <ol className="mt-3 space-y-2 text-sm text-neutral-300">
            {piece.sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="shrink-0 text-xs text-neutral-600">
                  [{s.ord + 1}]
                </span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="break-words text-violet-300 underline-offset-2 hover:underline"
                >
                  {s.title ?? s.url}
                </a>
                {s.source_type && (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-neutral-400">
                    {s.source_type}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      {multi && (
        <ChapterNav piece={piece} activeId={activeChapter.id} />
      )}

      <div className="mt-8 max-w-2xl text-base leading-relaxed text-neutral-200">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
          {activeChapter.body_md}
        </ReactMarkdown>
      </div>

      {(prev || next) && (
        <nav className="mt-12 flex items-stretch justify-between gap-4 border-t border-white/[0.06] pt-6">
          {prev ? (
            <Link
              href={`/learn/p/${piece.slug}/${prev.slug}`}
              className="group flex max-w-[48%] flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:bg-white/[0.06]"
            >
              <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                ← Previous chapter
              </span>
              <span className="mt-1 text-sm font-medium text-neutral-200">
                {prev.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/learn/p/${piece.slug}/${next.slug}`}
              className="group ml-auto flex max-w-[48%] flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-right transition hover:bg-white/[0.06]"
            >
              <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
                Next chapter →
              </span>
              <span className="mt-1 text-sm font-medium text-neutral-200">
                {next.title}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      <BecomeContributorCard />
    </article>
  );
}

function ChapterNav({
  piece,
  activeId,
}: {
  piece: LearnPieceWithChapters;
  activeId: string;
}) {
  return (
    <nav className="mt-6 flex flex-wrap gap-2">
      {piece.chapters.map((c, i) => {
        const active = c.id === activeId;
        return (
          <Link
            key={c.id}
            href={
              i === 0
                ? `/learn/p/${piece.slug}`
                : `/learn/p/${piece.slug}/${c.slug}`
            }
            className={
              "rounded-full border px-3 py-1 text-xs transition " +
              (active
                ? "border-white/30 bg-white/[0.10] text-white"
                : "border-white/[0.10] bg-white/[0.02] text-neutral-400 hover:bg-white/[0.06] hover:text-white")
            }
          >
            <span className="mr-1.5 text-[10px] text-neutral-500">
              {i + 1}.
            </span>
            {c.title}
          </Link>
        );
      })}
    </nav>
  );
}
