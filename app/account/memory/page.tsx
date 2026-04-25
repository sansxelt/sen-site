import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Library",
  description: "Browse and manage your saved Sansxel outputs.",
};

const categories = [
  {
    label: "Answers",
    description: "Quick responses, explanations, and recommendations you saved.",
    count: 0,
    icon: "◎",
  },
  {
    label: "Plans",
    description: "Roadmaps, structured breakdowns, timelines, and next steps.",
    count: 0,
    icon: "⊙",
  },
  {
    label: "Builds",
    description: "Product concepts, landing pages, pricing, and system designs.",
    count: 0,
    icon: "◈",
  },
  {
    label: "Research",
    description: "Grouped insights, comparisons, and analysis results.",
    count: 0,
    icon: "◇",
  },
  {
    label: "Visuals",
    description: "Layouts, concept previews, and visual outputs.",
    count: 0,
    icon: "⌥",
  },
  {
    label: "Exports",
    description: "Outputs you exported or shared externally.",
    count: 0,
    icon: "◌",
  },
];

export default function LibraryPage() {
  const totalEntries = 0;

  return (
    <div className="max-w-3xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Library</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Saved outputs from your Sansxel sessions. Revisit, refine, and build forward.
          </p>
        </div>
        {totalEntries > 0 && (
          <button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200">
            Search library
          </button>
        )}
      </div>

      {/* Stats strip */}
      <div className="mt-6 grid grid-cols-3 gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <div className="text-center">
          <div className="text-xl font-semibold text-white">{totalEntries}</div>
          <div className="mt-0.5 text-xs text-neutral-500">Saved outputs</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-white">0</div>
          <div className="mt-0.5 text-xs text-neutral-500">Sessions</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-semibold text-white">—</div>
          <div className="mt-0.5 text-xs text-neutral-500">Last saved</div>
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
            No saved outputs yet. Start a session and save results to build your library.
          </p>
          <Link
            href="/account/download"
            className="sansxel-white-button mt-4 inline-block rounded-lg border border-white/10 bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
          >
            Get desktop app
          </Link>
        </div>
      )}

      {/* Note */}
      <p className="mt-6 text-xs text-neutral-600">
        Your library is stored privately and linked to your account.{" "}
        <Link href="/privacy" className="sansxel-subtle-link">
          Privacy policy →
        </Link>
      </p>
    </div>
  );
}
