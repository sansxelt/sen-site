import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "../../auth";
import { listApiKeys } from "../../lib/api-keys";
import { readSessionState } from "../../lib/account-session";
import { getPlanActionHref, pricingPlans } from "../../lib/pricing";
import { getSubscriptionByEmail, readPricingSnapshot } from "../../lib/subscriptions";
import { getUserProfileByEmail } from "../../lib/user-profile";

export const metadata: Metadata = {
  title: "Overview",
  description: "Your sansxel account overview.",
};

function formatSubscriptionStatus(value: string) {
  switch (value) {
    case "selection_pending":
      return "Saved for rollout";
    case "active":
      return "Active";
    case "contact_required":
      return "Contact required";
    case "canceled":
      return "Canceled";
    default:
      return "Free";
  }
}

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const [profile, keys, rawSubscription] = await Promise.all([
    getUserProfileByEmail(email),
    listApiKeys(email),
    getSubscriptionByEmail(email),
  ]);
  const subscription = readPricingSnapshot(rawSubscription);
  const sessionState = readSessionState(session, profile);

  const displayName =
    profile?.display_name ??
    (typeof session?.user?.name === "string" ? session.user.name : null) ??
    email.split("@")[0];

  const initials = displayName
    .split(" ")
    .map((word) => word[0])
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
  const monthlyLimit = subscription.plan.apiRequestLimit;
  const usagePct =
    monthlyLimit && monthlyLimit > 0
      ? Math.min((usedRequests / monthlyLimit) * 100, 100)
      : 0;
  const nextPlans = pricingPlans.filter(
    (plan) => plan.key !== subscription.plan.key && plan.key !== "enterprise",
  );

  const checks = [
    { label: "Account created", done: true },
    {
      label: "Profile filled out",
      done: Boolean(profile?.display_name || profile?.focus_area),
    },
    { label: "API key created", done: keys.length > 0 },
    { label: "Early access requested", done: hasEarlyAccess },
    { label: "Paid plan selected", done: subscription.plan.key !== "free" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:gap-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neutral-600 to-neutral-800 text-lg font-semibold text-white ring-1 ring-white/10">
          {initials || "?"}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-white">
              {displayName}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-neutral-400">
              {sessionState?.signInMethod ?? "Email"}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-neutral-400">
              {subscription.plan.name}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs ${
                releaseChannel === "preview"
                  ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                  : "border-white/10 bg-white/5 text-neutral-400"
              }`}
            >
              {releaseChannel === "preview" ? "Preview" : "Stable"}
            </span>
          </div>
          <div className="mt-0.5 text-sm text-neutral-400">{email}</div>
          {memberSince && (
            <div className="mt-0.5 text-xs text-neutral-600">
              Member since {memberSince}
            </div>
          )}
        </div>

        <Link
          href="/account/settings"
          className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/5 hover:text-neutral-200"
        >
          Edit profile
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat label="Plan" value={subscription.plan.name} href="/pricing" />
        <MiniStat label="API keys" value={String(keys.length)} href="/account/keys" />
        <MiniStat
          label="Monthly limit"
          value={monthlyLimit === null ? "Unlimited" : monthlyLimit.toLocaleString()}
          href="/account/usage"
        />
        <MiniStat
          label="Summary style"
          value={summaryStyle.charAt(0).toUpperCase() + summaryStyle.slice(1)}
          href="/account/settings"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Usage</span>
              <Link
                href="/account/usage"
                className="text-xs text-neutral-400 transition hover:text-neutral-200"
              >
                Details →
              </Link>
            </div>
            <div className="mt-4 flex items-end gap-3">
              <span className="text-2xl font-semibold text-white">
                {usedRequests.toLocaleString()}
              </span>
              <span className="mb-0.5 text-sm text-neutral-500">
                /{" "}
                {monthlyLimit === null
                  ? "Unlimited API"
                  : `${monthlyLimit.toLocaleString()} requests/month`}
              </span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-white/60"
                style={{ width: usagePct > 0 ? `${usagePct}%` : "0%" }}
              />
            </div>
            <div className="mt-2 text-xs text-neutral-600">
              {subscription.plan.name} plan · resets 1st of month
            </div>
          </div>

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
                  <div
                    key={key.id}
                    className="flex items-center justify-between px-5 py-3"
                  >
                    <div>
                      <div className="text-sm text-neutral-100">
                        {key.name}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-neutral-500">
                        {key.key_prefix}
                      </div>
                    </div>
                    <div className="text-xs text-neutral-600">
                      {new Date(key.created_at).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Plan</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-neutral-400">
                {formatSubscriptionStatus(subscription.status)}
              </span>
            </div>
            <div className="mt-3">
              <div className="text-lg font-semibold text-white">
                {subscription.plan.name}
              </div>
              <div className="mt-1 text-xs text-neutral-500">
                {subscription.plan.monthlyLabel}
              </div>
            </div>
            <div className="mt-3 text-xs leading-6 text-neutral-400">
              {subscription.plan.description}
            </div>
            <ul className="mt-4 space-y-1.5 text-xs text-neutral-400">
              <li className="flex items-center gap-2">
                <span className="text-neutral-500">—</span>
                {subscription.plan.memoryWindow}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-neutral-500">—</span>
                {subscription.plan.monthlyCredits}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-neutral-500">—</span>
                {subscription.plan.support}
              </li>
              <li className="flex items-center gap-2">
                <span className="text-neutral-500">—</span>
                {subscription.plan.seats}
              </li>
            </ul>
            <div className="mt-4 border-t border-white/10 pt-3">
              <Link
                href="/pricing"
                className="text-xs text-neutral-400 underline-offset-2 transition hover:text-neutral-200 hover:underline"
              >
                Review all plans →
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="border-b border-white/10 px-5 py-3.5">
              <span className="text-sm font-medium text-white">Upgrade path</span>
            </div>
            <div className="space-y-2 px-5 py-4">
              {nextPlans.slice(0, 3).map((plan) => (
                <Link
                  key={plan.key}
                  href={getPlanActionHref(plan)}
                  className="block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 transition hover:bg-white/[0.06]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white">{plan.name}</span>
                    <span className="text-xs text-neutral-400">
                      {plan.monthlyLabel}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {plan.note}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02]">
            <div className="border-b border-white/10 px-5 py-3.5">
              <span className="text-sm font-medium text-white">Setup</span>
              <span className="ml-2 text-xs text-neutral-500">
                {checks.filter((check) => check.done).length}/{checks.length} done
              </span>
            </div>
            <div className="divide-y divide-white/5 px-5">
              {checks.map((check) => (
                <div key={check.label} className="flex items-center gap-3 py-2.5">
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                      check.done
                        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                        : "border-white/15 bg-transparent text-transparent"
                    }`}
                  >
                    ✓
                  </div>
                  <span
                    className={`text-sm ${
                      check.done ? "text-neutral-300" : "text-neutral-500"
                    }`}
                  >
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <span className="text-sm font-medium text-white">Account</span>
            <div className="mt-3 space-y-2 text-xs">
              <Row label="Email" value={email} />
              <Row label="Sign-in" value={sessionState?.signInMethod ?? "Email"} />
              <Row
                label="Release"
                value={releaseChannel === "preview" ? "Preview" : "Stable"}
              />
              {profile?.focus_area && (
                <Row label="Focus area" value={profile.focus_area} />
              )}
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

function MiniStat({
  href,
  label,
  value,
}: {
  href: string;
  label: string;
  value: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-white/10 bg-white/[0.02] p-4 transition hover:bg-white/[0.05]"
    >
      <div className="text-xl font-semibold text-white">{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500 group-hover:text-neutral-400">
        {label}
      </div>
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
