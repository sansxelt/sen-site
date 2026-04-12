import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Updates",
  description: "Download sansxel and review release notes.",
};

const releases = [
  {
    version: "0.4.2",
    date: "Apr 10, 2026",
    channel: "stable" as const,
    summary: "Auth hardening, API key revocation, and onboarding polish.",
    changes: [
      { type: "fix", text: "OAuth sign-in now creates a profile for new users correctly." },
      { type: "fix", text: "API key DELETE route now requires the correct authorization header." },
      { type: "improve", text: "Dashboard nav active state works correctly on nested routes." },
      { type: "improve", text: "Session banner in auth panel reflects current device state." },
      { type: "new", text: "API key revocation endpoint is live." },
    ],
  },
  {
    version: "0.4.1",
    date: "Apr 3, 2026",
    channel: "stable" as const,
    summary: "Control center, settings persistence, and usage tracking.",
    changes: [
      { type: "new", text: "Account dashboard with sidebar navigation." },
      { type: "new", text: "Usage page with request count and monthly limit progress." },
      { type: "new", text: "Settings page — display name, focus area, release channel." },
      { type: "fix", text: "Password reset flow now lands on the correct confirmation screen." },
      { type: "improve", text: "Billing and plan detail section added to account overview." },
    ],
  },
  {
    version: "0.4.0",
    date: "Mar 24, 2026",
    channel: "stable" as const,
    summary: "Workspace memory, ambient capture, and first desktop build.",
    changes: [
      { type: "new", text: "Ambient session capture running as a background service." },
      { type: "new", text: "Memory graph — searchable timeline of files, windows, and context." },
      { type: "new", text: "First signed Windows installer available for early access accounts." },
      { type: "new", text: "REST API in beta — read and query workspace memory programmatically." },
    ],
  },
];

const channelBadge = (channel: "stable" | "beta" | "alpha") => {
  if (channel === "stable")
    return <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300">Stable</span>;
  if (channel === "beta")
    return <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-sky-300">Beta</span>;
  return <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-300">Alpha</span>;
};

const changeBadge = (type: "new" | "fix" | "improve") => {
  if (type === "new")
    return <span className="mt-0.5 shrink-0 rounded border border-sky-400/20 bg-sky-400/[0.08] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-sky-400">New</span>;
  if (type === "fix")
    return <span className="mt-0.5 shrink-0 rounded border border-rose-400/20 bg-rose-400/[0.08] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-rose-400">Fix</span>;
  return <span className="mt-0.5 shrink-0 rounded border border-amber-400/20 bg-amber-400/[0.08] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-amber-400">Improved</span>;
};

export default function UpdatesPage() {
  const latest = releases[0];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-white">Updates</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Download the desktop app and track what changed across every release.
      </p>

      {/* ── Current release download card ─────────────────────────── */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-semibold text-white">sansxel {latest.version}</span>
              {channelBadge(latest.channel)}
            </div>
            <p className="mt-1 text-sm text-neutral-400">
              Windows desktop app — ambient session capture, memory graph, and workspace recall.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-500">
              <span>Released {latest.date}</span>
              <span>Windows 10 / 11 · x64</span>
              <span>Invite-only — early access</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Link
              href="/download"
              className="sansxel-white-button inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M8 2v8M5 7l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Download installer
            </Link>
            <span className="text-[11px] text-neutral-600 sm:text-right">
              Signed · ~42 MB · .exe
            </span>
          </div>
        </div>
      </div>

      {/* ── Platform note ─────────────────────────────────────────── */}
      <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/60" />
        <p className="text-xs leading-relaxed text-neutral-500">
          macOS and Linux builds are on the roadmap. Early access is Windows-first.
          <a href="mailto:hello@sansxel.app" className="ml-1 underline underline-offset-2 transition hover:text-neutral-300">
            Notify me when available →
          </a>
        </p>
      </div>

      {/* ── Release notes ─────────────────────────────────────────── */}
      <div className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
          Release notes
        </h2>

        <div className="relative mt-5">
          {/* Timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-white/[0.06]" />

          <div className="space-y-8">
            {releases.map((release, i) => (
              <div key={release.version} className="relative pl-6">
                {/* Timeline dot */}
                <div className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border ${i === 0 ? "border-emerald-400/40 bg-emerald-400/20" : "border-white/10 bg-neutral-900"}`} />

                {/* Version header */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-semibold text-white">v{release.version}</span>
                  {channelBadge(release.channel)}
                  <span className="text-xs text-neutral-600">{release.date}</span>
                </div>
                <p className="mt-1 text-sm text-neutral-400">{release.summary}</p>

                {/* Change list */}
                <div className="mt-3 space-y-2">
                  {release.changes.map((change, j) => (
                    <div key={j} className="flex items-start gap-2.5">
                      {changeBadge(change.type as "new" | "fix" | "improve")}
                      <span className="text-xs leading-relaxed text-neutral-400">{change.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Footer note ───────────────────────────────────────────── */}
      <div className="mt-10 border-t border-white/[0.06] pt-6">
        <p className="text-xs text-neutral-600">
          Release notes are published with each stable build.{" "}
          <a
            href="mailto:hello@sansxel.app?subject=Update feedback"
            className="underline underline-offset-2 transition hover:text-neutral-400"
          >
            Report an issue →
          </a>
        </p>
      </div>
    </div>
  );
}
