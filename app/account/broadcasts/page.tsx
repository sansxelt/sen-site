import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import {
  listRecentBroadcasts,
  type Broadcast,
} from "../../../lib/broadcasts";
import { isDatabaseConfigured } from "../../../lib/supabase-admin";
import { BroadcastComposer } from "./broadcast-composer";

// Admin-only owner-broadcast composer + history. v0.2.0 phase D.
// Compose a markdown body, pick an audience (all / free / paid),
// hit Send, the server fans the email out via Resend and records
// the row.

export const dynamic = "force-dynamic";

export default async function BroadcastsPage() {
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (!email) redirect("/signin?callbackUrl=%2Faccount%2Fbroadcasts");
  if (!isAdminEmail(email)) redirect("/account");

  const dbReady = isDatabaseConfigured();
  const recent = dbReady ? await listRecentBroadcasts(30) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <header className="space-y-2">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-violet-300/70">
          Owner broadcasts
        </div>
        <h1 className="text-3xl font-semibold text-white">
          Email everyone (or just paid)
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-400">
          Compose a markdown update, pick an audience, hit Send. We
          fan it out through Resend and log the row below for the
          audit trail.
        </p>
      </header>

      {!dbReady && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200">
          Database isn&apos;t configured. Run{" "}
          <code>docs/v0.2.0-broadcasts.sql</code> in Supabase first.
        </div>
      )}

      <BroadcastComposer />

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-[0.14em] text-neutral-300">
          Recent sends{" "}
          <span className="ml-1 text-neutral-600">({recent.length})</span>
        </h2>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-sm text-neutral-500">
            No broadcasts yet. Your first send will land here.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
            {recent.map((b) => (
              <BroadcastRow key={b.id} broadcast={b} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BroadcastRow({ broadcast }: { broadcast: Broadcast }) {
  const successRate =
    broadcast.recipient_count > 0
      ? Math.round((broadcast.delivered / broadcast.recipient_count) * 100)
      : 0;
  return (
    <li className="space-y-2 px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-white">
            {broadcast.subject}
          </div>
          <div className="mt-0.5 text-[11px] text-neutral-600">
            {new Date(broadcast.sent_at).toLocaleString()} by{" "}
            {broadcast.sent_by}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AudiencePill audience={broadcast.audience} />
          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-300">
            {broadcast.delivered}/{broadcast.recipient_count} ({successRate}%)
          </span>
          {broadcast.failed > 0 && (
            <span className="rounded-full border border-rose-400/30 bg-rose-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-rose-300">
              {broadcast.failed} failed
            </span>
          )}
        </div>
      </div>
      <p className="line-clamp-2 text-sm leading-relaxed text-neutral-400">
        {broadcast.body_md}
      </p>
    </li>
  );
}

function AudiencePill({ audience }: { audience: Broadcast["audience"] }) {
  const map: Record<Broadcast["audience"], { label: string; cls: string }> = {
    all: { label: "Everyone", cls: "border-white/10 bg-white/[0.04] text-neutral-300" },
    free: { label: "Free only", cls: "border-amber-400/30 bg-amber-400/[0.10] text-amber-200" },
    paid: { label: "Paid only", cls: "border-violet-400/30 bg-violet-400/[0.10] text-violet-200" },
  };
  const m = map[audience];
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
