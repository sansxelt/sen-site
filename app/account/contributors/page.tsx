import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import {
  listContributorsByStatus,
  type Contributor,
} from "../../../lib/contributors";
import { isDatabaseConfigured } from "../../../lib/supabase-admin";
import {
  approveAction,
  rejectAction,
  seedApprovedAction,
} from "./actions";

// Admin-only contributor management. Lists pending applications,
// approved + rejected for context. Each pending row gets an
// approve form (admin types the hardlocked display_name) and a
// reject form. A seed form at the top lets admins add approved
// contributors manually before the public /contribute page exists.

export const dynamic = "force-dynamic";

export default async function ContributorsAdminPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) redirect("/signin?callbackUrl=%2Faccount%2Fcontributors");
  if (!isAdminEmail(email)) redirect("/account");

  const dbReady = isDatabaseConfigured();
  const [pending, approved, rejected] = dbReady
    ? await Promise.all([
        listContributorsByStatus("pending", 100),
        listContributorsByStatus("approved", 100),
        listContributorsByStatus("rejected", 30),
      ])
    : [[], [], []];

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header className="space-y-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-300/70">
          Learn admin
        </div>
        <h1 className="text-3xl font-semibold text-white">Contributors</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-400">
          Approve applicants and assign their hardlocked byline. Once approved, every piece they publish carries that name forever.
        </p>
      </header>

      {!dbReady && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200">
          Database isn&apos;t configured. Run <code>docs/v0.2.0-contributors.sql</code> in Supabase first.
        </div>
      )}

      {dbReady && (
        <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
          <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-neutral-300">
            Seed an approved contributor
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Use this to add a contributor without going through the public application form.
          </p>
          <form
            action={seedApprovedAction}
            className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1.2fr_auto]"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="contributor@email"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-white/30"
            />
            <input
              name="display_name"
              required
              placeholder="Display name (hardlocked)"
              className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-neutral-100 outline-none transition focus:border-white/30"
            />
            <button
              type="submit"
              className="rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-4 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/[0.18]"
            >
              Add + approve
            </button>
          </form>
        </section>
      )}

      <Bucket
        title="Pending"
        empty="No applications waiting."
        items={pending}
        showApproveForm
      />
      <Bucket
        title="Approved"
        empty="No approved contributors yet."
        items={approved}
      />
      {rejected.length > 0 && (
        <Bucket title="Rejected" empty="" items={rejected} />
      )}
    </div>
  );
}

function Bucket({
  title,
  empty,
  items,
  showApproveForm = false,
}: {
  title: string;
  empty: string;
  items: Contributor[];
  showApproveForm?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-neutral-300">
        {title}{" "}
        <span className="ml-1 text-neutral-600">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-sm text-neutral-500">
          {empty}
        </div>
      ) : (
        <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
          {items.map((c) => (
            <li key={c.email} className="space-y-3 px-4 py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-white">
                    {c.display_name ?? c.applied_name ?? c.email}
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-neutral-500">
                    {c.email}
                    {c.applied_name && c.applied_name !== c.display_name && (
                      <span className="ml-2 text-neutral-600">
                        applied as &ldquo;{c.applied_name}&rdquo;
                      </span>
                    )}
                  </div>
                </div>
                <StatusPill status={c.status} />
              </div>
              {c.applied_reason && (
                <p className="text-sm leading-relaxed text-neutral-400">
                  {c.applied_reason}
                </p>
              )}
              <div className="text-[11px] text-neutral-600">
                Applied {new Date(c.applied_at).toLocaleString()}
                {c.decided_at && (
                  <> · Decided {new Date(c.decided_at).toLocaleString()} by {c.decided_by ?? "?"}</>
                )}
              </div>

              {showApproveForm && c.status === "pending" && (
                <div className="grid gap-3 border-t border-white/[0.06] pt-3 sm:grid-cols-2">
                  <form
                    action={approveAction}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="email" value={c.email} />
                    <input
                      name="display_name"
                      required
                      defaultValue={c.applied_name ?? ""}
                      placeholder="Hardlocked display name"
                      className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-neutral-100 outline-none transition focus:border-white/30"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/[0.10] px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/[0.18]"
                    >
                      Approve
                    </button>
                  </form>
                  <form
                    action={rejectAction}
                    className="flex items-center gap-2"
                  >
                    <input type="hidden" name="email" value={c.email} />
                    <input
                      name="notes"
                      placeholder="Reject note (optional)"
                      className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-neutral-100 outline-none transition focus:border-white/30"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-full border border-red-400/30 bg-red-400/[0.06] px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-400/[0.16]"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: Contributor["status"] }) {
  const map: Record<Contributor["status"], { label: string; className: string }> = {
    pending: { label: "Pending", className: "bg-amber-400/[0.10] text-amber-200 border-amber-400/30" },
    approved: { label: "Approved", className: "bg-emerald-400/[0.10] text-emerald-200 border-emerald-400/30" },
    rejected: { label: "Rejected", className: "bg-white/[0.05] text-neutral-400 border-white/10" },
  };
  const s = map[status];
  return (
    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${s.className}`}>
      {s.label}
    </span>
  );
}
