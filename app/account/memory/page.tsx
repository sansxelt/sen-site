import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Memory",
  description: "Browse and manage your sansxel workspace memory.",
};

const categories = [
  {
    label: "Active tasks",
    description: "Interrupted work, open loops, and in-progress decisions.",
    count: 0,
    icon: "◎",
  },
  {
    label: "Recent context",
    description: "Files, tabs, apps, and sessions from the last 7 days.",
    count: 0,
    icon: "⊙",
  },
  {
    label: "Code snapshots",
    description: "Functions, errors, and repo states captured during work.",
    count: 0,
    icon: "⌥",
  },
  {
    label: "Decisions",
    description: "Notes and reasoning captured from focused work sessions.",
    count: 0,
    icon: "◈",
  },
  {
    label: "Browsing trail",
    description: "Visited pages and research threads tied to work sessions.",
    count: 0,
    icon: "◇",
  },
  {
    label: "Conversations",
    description: "Messages and threads that shaped your recent work.",
    count: 0,
    icon: "◌",
  },
];

export default function MemoryPage() {
  const totalEntries = 0;

  return (
    <div className="max-w-3xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Memory</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Everything sansxel has captured from your desktop sessions.
          </p>
        </div>
        {totalEntries > 0 && (
          <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200">
            Search memory
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="text-center">
          <div className="text-xl font-semibold text-white">{totalEntries}</div>
          <div className="mt-0.5 text-xs text-neutral-500">Total entries</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-white">0</div>
          <div className="mt-0.5 text-xs text-neutral-500">Sessions captured</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-white">—</div>
          <div className="mt-0.5 text-xs text-neutral-500">Last capture</div>
        </div>
      </div>

      {/* Categories */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {categories.map((cat) => (
          <div
            key={cat.label}
            className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
          >
            <span className="mt-0.5 shrink-0 text-base text-neutral-500">{cat.icon}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-neutral-200">{cat.label}</span>
                <span className="shrink-0 text-xs text-neutral-600">{cat.count}</span>
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">{cat.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state CTA */}
      {totalEntries === 0 && (
        <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
          <p className="text-sm text-neutral-400">
            No memory captured yet. Install the desktop app to start building ambient context.
          </p>
          <Link
            href="/download"
            className="mt-4 inline-block rounded-lg border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
          >
            Get desktop app
          </Link>
        </div>
      )}

      {/* Retention note */}
      <p className="mt-6 text-xs text-neutral-600">
        Memory is stored privately and linked to your account.{" "}
        <Link href="/privacy" className="underline underline-offset-2 hover:text-neutral-400 transition">
          Privacy policy →
        </Link>
      </p>
    </div>
  );
}
