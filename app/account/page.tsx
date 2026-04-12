import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "../../auth";
import { listApiKeys } from "../../lib/api-keys";
import { readSessionState } from "../../lib/account-session";
import { getUserProfileByEmail } from "../../lib/user-profile";

export const metadata: Metadata = {
  title: "Overview",
  description: "Your sansxel account overview.",
};

const MONTHLY_LIMIT = 10_000;

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const profile = await getUserProfileByEmail(email);
  const keys = await listApiKeys(email);
  const sessionState = readSessionState(session, profile);

  const displayName =
    profile?.display_name ??
    (typeof session?.user?.name === "string" ? session.user.name : null) ??
    email.split("@")[0];

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      })
    : null;

  const releaseChannel = profile?.release_channel ?? "stable";
  const summaryStyle = profile?.summary_style ?? "balanced";
  const hasEarlyAccess = Boolean(profile?.early_access_requested_at);
  const usedRequests = 0;
  const usagePct = Math.min((usedRequests / MONTHLY_LIMIT) * 100, 100);

  // Checklist
  const checks = [
    { label: "Account created", done: true },
    { label: "Profile filled out", done: Boolean(profile?.display_name || profile?.focus_area) },
    { label: "API key created", done: keys.length > 0 },
    { label: "Early access requested", done: hasEarlyAccess },
    { label: "Desktop app downloaded", done: false },
  ];

  return (
    <div className="space-y-6">
      {/* ── Profile header ─────────────────────────────────────── */}
      <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:gap-5">
        {/* Avatar */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 text-lg font-semibold text-white ring-1 ring-white/10">
          {initials || "?"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-white">{displayName}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-neutral-400">
              {sessionState?.signInMethod ?? "Email"}
            </span>
            <span className={`rounded-full border px-2 py-0.5 text-xs ${
              releaseChannel === "preview"
                ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                : "border-white/10 bg-white/5 text-neutral-400"
            }`}>
              {releaseChannel === "preview" ? "Preview" : "Stable"}
            </span>
          </div>
          <div className="mt-0.5 text-sm text-neutral-400">{email}</div>
          {memberSince && (
            <div className="mt-0.5 text-xs text-neutral-600">Member since {memberSince}</div>
          )}
        </div>

        <Link
          href="/account/settings"
          className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200"
        >
          Edit profile
        </Link>
      </div>

      {/* ── Stat strip ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="API keys" value={String(keys.length)} href="/account/keys" />
        <MiniStat label="Requests this month" value={usedRequests.toLocaleString()} href="/account/usage" />
        <MiniStat label="Monthly limit" value={MONTHLY_LIMIT.toLocaleString()} href="/account/usage" />
        <MiniStat label="Summary style" value={summaryStyle.charAt(0).toUpperCase() + summaryStyle.slice(1)} href="/account/settings" />
      </div>

      {/* ── Two-column body ────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">

        {/* Left: API keys preview */}
        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <span className="text-sm font-medium text-white">API Keys</span>
              <Link
                href="/account/keys"
                className="text-xs text-neutral-400 transition hover:text-neutral-200"
              >
                Manage →
              </Link>
            </div>
            {keys.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-neutral-500">No keys yet.</p>
                <Link
                  href="/account/keys"
                  className="mt-3 inline-block rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-white/10"
                >
                  Create your first key
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {keys.slice(0, 5).map((key) => (
                  <div key={key.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="text-sm text-neutral-100">{key.name}</div>
                      <div className="mt-0.5 font-mono text-xs text-neutral-500">{key.key_prefix}</div>
                    </div>
                    <div className="text-xs text-neutral-600">
                      {new Date(key.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                ))}
                {keys.length > 5 && (
                  <div className="px-5 py-2.5 text-xs text-neutral-500">
                    +{keys.length - 5} more —{" "}
                    <Link href="/account/keys" className="text-neutral-400 hover:text-neutral-200">
                      view all
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Usage bar */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Usage</span>
              <Link href="/account/usage" className="text-xs text-neutral-400 hover:text-neutral-200">
                Details →
              </Link>
            </div>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-2xl font-semibold text-white">{usedRequests.toLocaleString()}</span>
              <span className="mb-0.5 text-sm text-neutral-500">/ {MONTHLY_LIMIT.toLocaleString()} req this month</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/60"
                style={{ width: usagePct > 0 ? `${usagePct}%` : "0%" }}
              />
            </div>
            <div className="mt-2 text-xs text-neutral-600">Free plan · resets 1st of month</div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Getting started checklist */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="border-b border-white/10 px-5 py-3.5">
              <span className="text-sm font-medium text-white">Setup</span>
              <span className="ml-2 text-xs text-neutral-500">
                {checks.filter((c) => c.done).length}/{checks.length} done
              </span>
            </div>
            <div className="divide-y divide-white/5 px-5">
              {checks.map((check) => (
                <div key={check.label} className="flex items-center gap-3 py-2.5">
                  <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                    check.done
                      ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                      : "border-white/15 bg-transparent text-transparent"
                  }`}>
                    ✓
                  </div>
                  <span className={`text-sm ${check.done ? "text-neutral-300" : "text-neutral-500"}`}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Plan card */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Plan</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-neutral-400">
                Free
              </span>
            </div>
            <ul className="mt-3 space-y-1.5 text-xs text-neutral-400">
              <li className="flex items-center gap-2"><span className="text-neutral-500">—</span> 10,000 requests/month</li>
              <li className="flex items-center gap-2"><span className="text-neutral-500">—</span> Unlimited API keys</li>
              <li className="flex items-center gap-2"><span className="text-neutral-500">—</span> Desktop memory capture</li>
              <li className="flex items-center gap-2"><span className="text-neutral-500">—</span> Early access to features</li>
            </ul>
            <div className="mt-4 border-t border-white/10 pt-3">
              <a
                href="mailto:hello@sansxel.app?subject=Upgrade inquiry"
                className="text-xs text-neutral-400 underline-offset-2 transition hover:text-neutral-200 hover:underline"
              >
                Ask about Pro →
              </a>
            </div>
          </div>

          {/* Account details */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <span className="text-sm font-medium text-white">Account</span>
            <div className="mt-3 space-y-2 text-xs">
              <Row label="Email" value={email} />
              <Row label="Sign-in" value={sessionState?.signInMethod ?? "Email"} />
              <Row label="Release" value={releaseChannel === "preview" ? "Preview" : "Stable"} />
              {profile?.focus_area && <Row label="Focus area" value={profile.focus_area} />}
            </div>
            <div className="mt-4">
              <Link
                href="/account/settings"
                className="text-xs text-neutral-400 underline-offset-2 transition hover:text-neutral-200 hover:underline"
              >
                Edit settings →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:bg-white/[0.05]"
    >
      <div className="text-xl font-semibold text-white">{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500 group-hover:text-neutral-400">{label}</div>
    </Link>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-neutral-500">{label}</span>
      <span className="truncate text-right text-neutral-300">{value}</span>
    </div>
  );
}
