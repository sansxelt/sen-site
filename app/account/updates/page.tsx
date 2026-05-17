import type { Metadata } from "next";
import Link from "next/link";
import {
  desktopCurrentCodeVersion,
  desktopCurrentReleaseChannel,
  desktopLatestShippedDateLabel,
  desktopLatestShippedVersion,
  desktopNextVersion,
  desktopNextVersionHighlights,
  desktopShippedReleases,
} from "@/lib/desktop-release";

export const metadata: Metadata = {
  title: "Updates",
  description: "Follow shipped Vraelis desktop releases and the next build in progress.",
};

const issueReportHref =
  "/contact?subject=Issue%20report&message=What%20happened%3F%0AWhat%20were%20you%20trying%20to%20do%3F%0AHow%20can%20we%20reproduce%20it%3F%0AAny%20screenshots%20or%20error%20messages%3F%0A#contact-form";

function channelBadge(channel: "stable" | "beta" | "alpha") {
  if (channel === "stable") {
    return (
      <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-300">
        Stable
      </span>
    );
  }
  if (channel === "beta") {
    return (
      <span className="rounded-full border border-sky-400/20 bg-sky-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-sky-300">
        Beta
      </span>
    );
  }
  return (
    <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-300">
      Alpha
    </span>
  );
}

function changeBadge(type: "new" | "fix" | "improve") {
  if (type === "new") {
    return (
      <span className="mt-0.5 shrink-0 rounded border border-sky-400/20 bg-sky-400/[0.08] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-sky-400">
        New
      </span>
    );
  }
  if (type === "fix") {
    return (
      <span className="mt-0.5 shrink-0 rounded border border-rose-400/20 bg-rose-400/[0.08] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-rose-400">
        Fix
      </span>
    );
  }
  return (
    <span className="mt-0.5 shrink-0 rounded border border-amber-400/20 bg-amber-400/[0.08] px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-amber-400">
      Improved
    </span>
  );
}

export default function AccountUpdatesPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-white">Updates</h1>
      <p className="mt-1 max-w-3xl text-sm text-neutral-400">
        Track what has actually shipped on desktop. Latest live build is
        v{desktopLatestShippedVersion}; the repo is already on v{desktopCurrentCodeVersion},
        so if you see v{desktopCurrentCodeVersion} in VS Code that&apos;s the next build line,
        not the public release yet.
      </p>

      <div className="mt-8 grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Latest shipped
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <span className="text-3xl font-semibold text-white">v{desktopLatestShippedVersion}</span>
            {channelBadge(desktopCurrentReleaseChannel)}
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            Published {desktopLatestShippedDateLabel}. This is the build the
            auto-update feed is currently serving to existing installs. Public
            downloads are paused, no ETA on reopening.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200/90">
            Next build in progress
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold text-white">v{desktopNextVersion}</span>
            <span className="rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-200/90">
              Repo only
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-neutral-300">
            This is the version already staged in the desktop app config. It becomes the
            next update only after the installer, signature, and updater manifest move off
            v{desktopLatestShippedVersion}.
          </p>
          <div className="mt-4 space-y-2">
            {desktopNextVersionHighlights.map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-neutral-300"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
          Release notes
        </h2>

        <div className="relative mt-5">
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-white/[0.06]" />

          <div className="space-y-8">
            {desktopShippedReleases.map((release, index) => (
              <div key={release.version} className="relative pl-6">
                <div
                  className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full border ${
                    index === 0
                      ? "border-emerald-400/40 bg-emerald-400/20"
                      : "border-white/10 bg-neutral-900"
                  }`}
                />

                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-base font-semibold text-white">v{release.version}</span>
                  {channelBadge(release.channel)}
                  <span className="text-xs text-neutral-600">{release.dateLabel}</span>
                </div>
                <p className="mt-1 text-sm text-neutral-400">{release.summary}</p>

                <div className="mt-3 space-y-2">
                  {release.changes.map((change, changeIndex) => (
                    <div key={changeIndex} className="flex items-start gap-2.5">
                      {changeBadge(change.type)}
                      <span className="text-xs leading-relaxed text-neutral-400">
                        {change.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-10 border-t border-white/[0.06] pt-6">
        <p className="text-xs text-neutral-600">
          Need the installer instead of the changelog?{" "}
          <Link href="/account/download" className="VRAELIS-subtle-link">
            Open downloads -&gt;
          </Link>{" "}
          If something feels off after an update,{" "}
          <Link href={issueReportHref} className="VRAELIS-subtle-link">
            report an issue -&gt;
          </Link>
        </p>
      </div>
    </div>
  );
}
