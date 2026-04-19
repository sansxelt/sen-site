import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Download",
  description: "Download the Sansxel desktop app and follow release notes.",
};

/**
 * Real release log. Sansxel started April 12, 2026; these entries
 * reflect actual work shipped since then. Each version is an alpha
 * channel entry — nothing is stable until a signed installer lands.
 *
 * When new work ships, add a new entry to the TOP of this array.
 */
type Release = {
  version: string;
  date:    string;
  channel: "stable" | "beta" | "alpha";
  summary: string;
  changes: Array<{ type: "new" | "fix" | "improve"; text: string }>;
};

const releases: Release[] = [
  {
    version: "0.7.0",
    date: "Apr 18, 2026",
    channel: "alpha",
    summary: "Honest download surfaces + real release notes.",
    changes: [
      { type: "fix",     text: "/account/updates no longer implies a shipped installer — status card reads 'In development'." },
      { type: "fix",     text: "Fake version history (v0.4.x stable) removed; entries below are actual work since project start." },
      { type: "improve", text: "Sidebar tab renamed 'Updates' → 'Download' so install + release log sit under one entry point." },
      { type: "improve", text: "Top-nav 'Download' routes signed-in users directly to their account download page." },
    ],
  },
  {
    version: "0.6.0",
    date: "Apr 17, 2026",
    channel: "alpha",
    summary: "Verification, security hardening, responsive polish.",
    changes: [
      { type: "new",     text: "Email verification before account creation — 24h link, rate-limited resend, pending row promoted on click." },
      { type: "new",     text: "Auto-signin on whichever device clicked the verify link + cross-device polling on the originating tab." },
      { type: "new",     text: "OAuth signup confirmation page — Google requires explicit consent on first sign-in or post-deletion return." },
      { type: "new",     text: "Transactional email lifecycle: subscription activated / cancellation scheduled / ended / payment failed / renewal / payment method updated." },
      { type: "fix",     text: "XSS in contact + support emails — every user-supplied field is HTML-escaped." },
      { type: "fix",     text: "Account deletion now cancels live Stripe subs, wipes pending_signups / password_reset_tokens / api_keys / subscriptions / credentials / profile, and signs the session out." },
      { type: "improve", text: "Heist-style design pass — aurora background, spotlight cards, gradient headlines across marketing pages." },
      { type: "improve", text: "Email templates responsive — @media block stacks buttons full-width, reflows the details table, tightens padding below 480px." },
      { type: "improve", text: "Emails stop looping replies through help@ — hello@ and noreply@ reply to themselves so support traffic stays on-channel." },
    ],
  },
  {
    version: "0.5.0",
    date: "Apr 16, 2026",
    channel: "alpha",
    summary: "Native checkout, PayPal, Compare tool.",
    changes: [
      { type: "new",     text: "Native Stripe Payment Element on /checkout — no Stripe-hosted redirect." },
      { type: "new",     text: "Native PayPal checkout alongside Stripe on paid plans." },
      { type: "new",     text: "Compare: guided plan recommender on /pricing with templated char-by-char reveal." },
      { type: "new",     text: "Contact form routes to help@ / sales@ / privacy@ based on the selected channel." },
      { type: "improve", text: "Tagline locked in: Sansxel — Build something REAL." },
      { type: "improve", text: "Checkout + billing UI tightened for small screens; more payment methods enabled." },
    ],
  },
  {
    version: "0.4.0",
    date: "Apr 15, 2026",
    channel: "alpha",
    summary: "Narrative pivot + cycling-word hero.",
    changes: [
      { type: "new",     text: "HeroActivity — cycling-word headline with crossfading scenario panels on the right." },
      { type: "improve", text: "Site reframed as a response engine with smart escalation." },
      { type: "improve", text: "Account center re-skinned to match the response-engine vision." },
      { type: "improve", text: "Header: right CTA is Access; Download sits in the primary nav for signed-in users." },
    ],
  },
  {
    version: "0.3.0",
    date: "Apr 14, 2026",
    channel: "alpha",
    summary: "Transition polish + finder redesign.",
    changes: [
      { type: "new",     text: "Finder layouts redesigned: spotlight, file tree, sysfinder." },
      { type: "improve", text: "Page transitions tuned — 260ms enter / 180ms exit, header pinned through the swap." },
      { type: "improve", text: "Account pages skip the transition to feel app-native." },
      { type: "fix",     text: "Modal centering — portal EmailComposer to document.body so transformed ancestors don't offset it." },
      { type: "fix",     text: "Scroll position no longer sticks across route changes." },
    ],
  },
  {
    version: "0.2.0",
    date: "Apr 13, 2026",
    channel: "alpha",
    summary: "Navigation + Framer Motion transitions.",
    changes: [
      { type: "new",     text: "Framer Motion page transitions — crossfade via View Transitions API." },
      { type: "improve", text: "Nav + hero controls refined; NavArrows removed." },
      { type: "fix",     text: "Send button label visible in the contact composer." },
    ],
  },
  {
    version: "0.1.0",
    date: "Apr 12, 2026",
    channel: "alpha",
    summary: "Project start — scaffolding and core routes.",
    changes: [
      { type: "new", text: "Next.js 16 + Tailwind + NextAuth + Supabase baseline." },
      { type: "new", text: "Marketing routes: /home, /features, /function, /pricing, /contact, /download." },
      { type: "new", text: "Account area: overview, library, API keys, integrations, usage, settings." },
      { type: "new", text: "Credentials + Google + GitHub sign-in." },
    ],
  },
];

const platformRequestHref =
  "/contact?subject=Platform%20availability&message=Please%20notify%20me%20when%20macOS%20or%20Linux%20builds%20are%20available.%20I%20plan%20to%20use%20sansxel%20for%3A%20#contact-form";

const issueReportHref =
  "/contact?subject=Issue%20report&message=What%20happened%3F%0AWhat%20were%20you%20trying%20to%20do%3F%0AHow%20can%20we%20reproduce%20it%3F%0AAny%20screenshots%20or%20error%20messages%3F%0A#contact-form";

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
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-white">Download</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Install the Sansxel desktop app and follow what&apos;s shipped. Nothing
        is installable yet — the log below is the work so far since the
        project started Apr 12, 2026.
      </p>

      {/* ── Status card — not a real release ────────────────────────── */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-lg font-semibold text-white">
                Sansxel desktop app
              </span>
              <span className="rounded-full border border-amber-300/30 bg-amber-300/[0.08] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-amber-200/90">
                In development
              </span>
            </div>
            <p className="mt-1 text-sm text-neutral-400">
              Layered responses, output library, and universal input — shaping
              toward a Windows-first installer.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-500">
              <span>Project started Apr 12, 2026</span>
              <span>Windows 10 / 11 · x64 at rollout</span>
              <span>Invite-only at rollout</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            {/* Intentionally NOT a <Link> — the installer doesn't exist yet.
                Styled as an inverted/muted pill so it reads "unavailable"
                at a glance. Click does nothing by design. */}
            <span
              aria-disabled="true"
              className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-medium text-neutral-500"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300/60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300" />
              </span>
              In development
            </span>
            <span className="text-[11px] text-neutral-600 sm:text-right">
              Not yet available for download
            </span>
          </div>
        </div>
      </div>

      {/* ── Platform note ─────────────────────────────────────────── */}
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/60" />
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs leading-5 text-neutral-500">
          <span>
            macOS and Linux builds are on the roadmap, after the Windows-first
            rollout.
          </span>
          <Link href={platformRequestHref} className="sansxel-subtle-link">
            Notify me when available →
          </Link>
        </div>
      </div>

      {/* ── Release notes — empty state until the first build ships ── */}
      <div className="mt-10">
        <h2 className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
          Release notes
        </h2>

        {releases.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300/60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-300" />
                </span>
              </span>
              <div>
                <div className="text-sm font-medium text-white">
                  No releases yet.
                </div>
                <p className="mt-1 text-sm leading-6 text-neutral-400">
                  The project started Apr 12, 2026 and hasn&apos;t shipped a
                  build yet. Release notes will appear here the moment v1.0
                  lands — one entry per version from that point on.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    href="/features"
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-neutral-200 transition hover:bg-white/10"
                  >
                    What&apos;s being built →
                  </Link>
                  <Link
                    href="/function"
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-neutral-200 transition hover:bg-white/10"
                  >
                    How it&apos;s shaping up →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : (
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
                        {changeBadge(change.type)}
                        <span className="text-xs leading-relaxed text-neutral-400">{change.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Footer note ───────────────────────────────────────────── */}
      <div className="mt-10 border-t border-white/[0.06] pt-6">
        <p className="text-xs text-neutral-600">
          Release notes will be published with each build once Sansxel ships.{" "}
          <Link
            href={issueReportHref}
            className="sansxel-subtle-link"
          >
            Report an issue →
          </Link>
        </p>
      </div>
    </div>
  );
}
