import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { isAdminEmail } from "../../../../lib/admin";
import { getPieceWithChapters } from "../../../../lib/learn-db";
import {
  publishAction,
  unpublishAction,
  deleteAction,
  saveMetaAction,
  saveChapterAction,
} from "./actions";

// Edit + publish surface for a single piece. Lists every chapter as
// its own form so saving a single chapter doesn't replay the
// metadata save (and vice versa) — keeps each operation atomic and
// makes the diff in the DB obvious.

export const dynamic = "force-dynamic";

type Params = { id: string };

export default async function ContentEditPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) redirect(`/auth/signin?callbackUrl=/account/content/${id}`);
  if (!isAdminEmail(email)) redirect("/account");

  const piece = await getPieceWithChapters(id);
  if (!piece) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/account/content"
          className="text-xs text-neutral-400 transition hover:text-white"
        >
          ← All content
        </Link>
        <div className="flex items-center gap-2">
          {piece.status !== "published" ? (
            <form action={publishAction}>
              <input type="hidden" name="id" value={piece.id} />
              <button
                type="submit"
                className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/[0.18]"
              >
                Publish
              </button>
            </form>
          ) : (
            <form action={unpublishAction}>
              <input type="hidden" name="id" value={piece.id} />
              <button
                type="submit"
                className="rounded-full border border-amber-400/30 bg-amber-400/[0.10] px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-400/[0.18]"
              >
                Unpublish
              </button>
            </form>
          )}
          <form action={deleteAction}>
            <input type="hidden" name="id" value={piece.id} />
            <button
              type="submit"
              className="rounded-full border border-red-400/30 bg-red-400/[0.08] px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-400/[0.16]"
              // No browser confirm() — server actions can't be intercepted
              // for a JS-less confirm. Real safety is the audit trail
              // (cascade delete on FK) + the unpublish-first habit.
            >
              Delete
            </button>
          </form>
        </div>
      </div>

      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-3xl">{piece.cover_emoji ?? "📄"}</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            {piece.type} · {piece.topic}
            {piece.subtopic ? ` · ${piece.subtopic}` : ""}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            · {piece.status}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-white">{piece.title}</h1>
        <div className="text-xs text-neutral-500">
          Slug:{" "}
          <code className="text-neutral-300">/learn/p/{piece.slug}</code>{" "}
          · Updated {new Date(piece.updated_at).toLocaleString()}
        </div>
      </header>

      {/* Metadata form */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-neutral-300">
          Metadata
        </h2>
        <form action={saveMetaAction} className="space-y-4">
          <input type="hidden" name="id" value={piece.id} />
          <Field label="Title" name="title" defaultValue={piece.title} />
          <Field
            label="Excerpt"
            name="excerpt"
            defaultValue={piece.excerpt ?? ""}
            multiline
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Topic" name="topic" defaultValue={piece.topic} />
            <Field
              label="Subtopic"
              name="subtopic"
              defaultValue={piece.subtopic ?? ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Cover emoji"
              name="cover_emoji"
              defaultValue={piece.cover_emoji ?? ""}
            />
            <Field
              label="Read minutes"
              name="read_minutes"
              defaultValue={piece.read_minutes?.toString() ?? ""}
            />
          </div>
          <SaveButton label="Save metadata" />
        </form>
      </section>

      {/* Chapters */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-neutral-300">
          Chapters{" "}
          <span className="ml-1 text-neutral-600">
            ({piece.chapters.length})
          </span>
        </h2>
        {piece.chapters.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-sm font-medium text-white">{c.title}</div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                Chapter {c.ord + 1} · /{c.slug}
              </div>
            </div>
            <form action={saveChapterAction} className="space-y-3">
              <input type="hidden" name="chapter_id" value={c.id} />
              <textarea
                name="body_md"
                defaultValue={c.body_md}
                rows={Math.max(8, Math.min(40, c.body_md.split("\n").length + 2))}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[13px] leading-relaxed text-neutral-100 outline-none transition focus:border-white/30"
                spellCheck={false}
              />
              <SaveButton label="Save chapter" />
            </form>
          </div>
        ))}
      </section>

      {/* Sources */}
      {piece.sources.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-neutral-300">
            Sources{" "}
            <span className="ml-1 text-neutral-600">
              ({piece.sources.length})
            </span>
          </h2>
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
            {piece.sources.map((s) => (
              <li key={s.id} className="px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-sm text-neutral-200 underline-offset-2 hover:underline"
                  >
                    [{s.ord + 1}] {s.title ?? s.url}
                  </a>
                  {s.source_type && (
                    <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                      {s.source_type}
                    </span>
                  )}
                </div>
                {s.excerpt && (
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500 line-clamp-3">
                    {s.excerpt}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  multiline,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  multiline?: boolean;
}) {
  const className =
    "w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-white/30";
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
        {label}
      </span>
      {multiline ? (
        <textarea
          name={name}
          defaultValue={defaultValue}
          rows={3}
          className={className}
        />
      ) : (
        <input name={name} defaultValue={defaultValue} className={className} />
      )}
    </label>
  );
}

function SaveButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.12]"
    >
      {label}
    </button>
  );
}
