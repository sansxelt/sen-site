import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import { isDatabaseConfigured } from "../../../lib/supabase-admin";
import {
  listPiecesByStatus,
  type LearnPiece,
  type LearnPieceStatus,
} from "../../../lib/learn-db";
import {
  createDraftFromFormAction,
  publishAllDraftsAction,
  publishOneAction,
} from "./actions";

// Admin-only Learn content review board. Lists drafts, in-review,
// and recently published pieces so the operator can land thousands
// of pages with a real review step rather than autopilot publish.
//
// /account/content is excluded from proxy.ts's auth gate (see the
// comment in proxy.ts) because getToken() and auth() can disagree
// on cookie visibility, which produced an infinite /signin loop in
// production. The page-level auth() check below uses /signin
// (canonical signin route, matches lib/auth-ui.getSignInPath) plus
// the admin role check.

export const dynamic = "force-dynamic";

export default async function ContentAdminPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) redirect("/signin?callbackUrl=%2Faccount%2Fcontent");
  if (!isAdminEmail(email)) redirect("/account");

  const dbReady = isDatabaseConfigured();
  const [drafts, inReview, recentPublished] = dbReady
    ? await Promise.all([
        listPiecesByStatus("draft", 100),
        listPiecesByStatus("review", 100),
        listPiecesByStatus("published", 30),
      ])
    : [[], [], []];

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="space-y-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-300/70">
          Learn admin
        </div>
        <h1 className="text-3xl font-semibold text-white">Content review</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-400">
          Drafts ingested by <code className="text-neutral-300">scripts/ingest-content.mjs</code> land here. Approve before publish, since every page on <code className="text-neutral-300">VRAELIS.ai</code> shares a domain reputation.
        </p>
      </header>

      {!dbReady && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200">
          Database isn&apos;t configured. Set <code>SUPABASE_URL</code> and <code>SUPABASE_SERVICE_ROLE_KEY</code>, then run <code>docs/v0.1.16-learn-content.sql</code>.
        </div>
      )}

      {dbReady && (
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-neutral-300">
            New piece
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Create a draft, then write the body on the next screen.
          </p>
          <form
            action={createDraftFromFormAction}
            className="mt-4 grid gap-3 sm:grid-cols-[1.6fr_1fr_1fr_auto]"
          >
            <input
              name="title"
              required
              placeholder="Title"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-white/30"
            />
            <input
              name="topic"
              placeholder="Topic (e.g. products)"
              defaultValue="general"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-white/30"
            />
            <input
              name="subtopic"
              placeholder="Subtopic (optional)"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-white/30"
            />
            <select
              name="type"
              defaultValue="article"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-white/30"
            >
              <option value="article">Article</option>
              <option value="info">Info</option>
              <option value="research">Research</option>
            </select>
            <button
              type="submit"
              className="col-span-full justify-self-end rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-4 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/[0.18]"
            >
              Create draft
            </button>
          </form>
        </section>
      )}

      <Bucket
        title="Drafts"
        empty="No drafts. Run scripts/ingest-content.mjs to create one."
        items={drafts}
        showInlinePublish
        bulkAction={drafts.length > 1 ? (
          <form action={publishAllDraftsAction}>
            <button
              type="submit"
              className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/[0.18]"
            >
              Publish all {drafts.length}
            </button>
          </form>
        ) : null}
      />
      {inReview.length > 0 && (
        <Bucket title="In review" empty="" items={inReview} showInlinePublish />
      )}
      <Bucket
        title="Recently published"
        empty="No pieces published yet."
        items={recentPublished}
      />
    </div>
  );
}

function Bucket({
  title,
  empty,
  items,
  showInlinePublish = false,
  bulkAction = null,
}: {
  title: string;
  empty: string;
  items: LearnPiece[];
  showInlinePublish?: boolean;
  bulkAction?: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-neutral-300">
          {title}{" "}
          <span className="ml-1 text-neutral-600">({items.length})</span>
        </h2>
        {bulkAction}
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-sm text-neutral-500">
          {empty}
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
          {items.map((p) => (
            <li key={p.id} className="flex items-stretch">
              <Link
                href={`/account/content/${p.id}`}
                className="flex flex-1 items-start gap-4 px-4 py-4 transition hover:bg-white/[0.03]"
              >
                <span className="text-2xl">{p.cover_emoji ?? "📄"}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-medium text-white">
                      {p.title}
                    </h3>
                    <StatusPill status={p.status} />
                    <TypePill type={p.type} />
                    <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                      {p.topic}
                      {p.subtopic ? ` · ${p.subtopic}` : ""}
                    </span>
                  </div>
                  {p.excerpt && (
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-400">
                      {p.excerpt}
                    </p>
                  )}
                  <div className="mt-1 text-[11px] text-neutral-600">
                    Updated {new Date(p.updated_at).toLocaleString()}
                  </div>
                </div>
              </Link>
              {showInlinePublish && p.status !== "published" && (
                <form action={publishOneAction} className="flex shrink-0 items-center pr-3">
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    title="Publish this piece"
                    className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/[0.18]"
                  >
                    Publish
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: LearnPieceStatus }) {
  const map: Record<LearnPieceStatus, { label: string; className: string }> = {
    draft: { label: "Draft", className: "bg-amber-400/[0.10] text-amber-200 border-amber-400/30" },
    review: { label: "Review", className: "bg-cyan-400/[0.10] text-cyan-200 border-cyan-400/30" },
    published: { label: "Published", className: "bg-emerald-400/[0.10] text-emerald-200 border-emerald-400/30" },
    archived: { label: "Archived", className: "bg-white/[0.05] text-neutral-400 border-white/10" },
  };
  const s = map[status];
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${s.className}`}>
      {s.label}
    </span>
  );
}

function TypePill({ type }: { type: LearnPiece["type"] }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-300">
      {type}
    </span>
  );
}
