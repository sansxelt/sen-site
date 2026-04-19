import type { Metadata } from "next";
import Link from "next/link";
import {
  desktopCurrentCodeVersion,
  desktopCurrentReleaseChannel,
  desktopLatestShippedDateLabel,
  desktopLatestShippedVersion,
  desktopNextVersion,
  desktopNextVersionHighlights,
  desktopPlatformLabel,
  desktopProjectStartedLabel,
} from "@/lib/desktop-release";

export const metadata: Metadata = {
  title: "Download",
  description: "Download the current Sansxel desktop build and see the live release state.",
};

const platformRequestHref =
  "/contact?subject=Platform%20availability&message=Please%20notify%20me%20when%20macOS%20or%20Linux%20builds%20are%20available.%20I%20plan%20to%20use%20sansxel%20for%3A%20#contact-form";

export default function AccountDownloadPage() {
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Download</h1>
        <p className="mt-1 max-w-3xl text-sm text-neutral-400">
          Install the current Windows build from here. The desktop repo is already on
          v{desktopCurrentCodeVersion}, but the latest signed installer and auto-update
          feed are still on v{desktopLatestShippedVersion}.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="text-lg font-semibold text-white">Sansxel desktop app</span>
                <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300">
                  Windows live
                </span>
              </div>
              <p className="mt-1 text-sm text-neutral-400">
                Threads, voice, toolbar modes, MCP tools, and desktop-native updates in
                one Windows build.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-neutral-500">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  Latest shipped v{desktopLatestShippedVersion}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  Published {desktopLatestShippedDateLabel}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  {desktopPlatformLabel}
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  Auto-update ready
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <span
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 py-2.5 text-sm font-medium text-neutral-400"
                aria-disabled="true"
              >
                Download closed \u2014 invite-only
              </span>
              <span className="text-[11px] text-neutral-600 sm:max-w-[220px] sm:text-right">
                Public installer is paused while v{desktopLatestShippedVersion} stabilizes.
                Existing installs keep auto-updating; new downloads are invite-only
                until v{desktopNextVersion} ships.
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
            Repo status
          </div>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-3xl font-semibold text-white">v{desktopCurrentCodeVersion}</span>
            <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-200/90">
              In progress
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-neutral-300">
            That&apos;s the version line sitting in the desktop config right now, so
            seeing v{desktopCurrentCodeVersion} in VS Code is correct. It just
            isn&apos;t the shipped installer yet.
          </p>
          <div className="mt-4 border-t border-white/10 pt-4">
            <Link href="/account/updates" className="sansxel-subtle-link text-xs">
              See shipped release notes -&gt;
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Up next
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-white">v{desktopNextVersion}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-300">
              {desktopCurrentReleaseChannel}
            </span>
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            The next desktop cut is already moving in the repo. The biggest work in
            flight right now:
          </p>
          <div className="mt-4 space-y-2">
            {desktopNextVersionHighlights.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-neutral-300"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Release track
          </div>
          <div className="mt-3 space-y-3 text-sm text-neutral-300">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-neutral-500">Installable now</div>
              <div className="mt-1 text-base font-medium text-white">v{desktopLatestShippedVersion}</div>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-neutral-500">Current code</div>
              <div className="mt-1 text-base font-medium text-white">v{desktopCurrentCodeVersion}</div>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
              <div className="text-xs uppercase tracking-[0.14em] text-neutral-500">Project started</div>
              <div className="mt-1 text-base font-medium text-white">{desktopProjectStartedLabel}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/60" />
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs leading-5 text-neutral-500">
          <span>macOS and Linux builds are still on the roadmap after the Windows rollout.</span>
          <Link href={platformRequestHref} className="sansxel-subtle-link">
            Notify me when available -&gt;
          </Link>
        </div>
      </div>
    </div>
  );
}
