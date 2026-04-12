import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "../../auth";
import { listApiKeys } from "../../lib/api-keys";
import { getUserProfileByEmail } from "../../lib/user-profile";

export const metadata: Metadata = {
  title: "Overview",
  description: "Your sansxel account overview.",
};

export default async function AccountPage() {
  const session = await auth();
  const email = session?.user?.email ?? "";
  const profile = await getUserProfileByEmail(email);
  const keys = await listApiKeys(email);

  const displayName =
    profile?.display_name ??
    (typeof session?.user?.name === "string" ? session.user.name : null) ??
    email.split("@")[0];

  const releaseChannel = profile?.release_channel ?? "stable";

  return (
    <div className="max-w-3xl">
      {/* Greeting */}
      <h1 className="text-2xl font-semibold text-white">
        Hey, {displayName}
      </h1>
      <p className="mt-1 text-sm text-neutral-400">
        Welcome to your sansxel control center.
      </p>

      {/* Stats row */}
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="API keys" value={String(keys.length)} href="/account/keys" />
        <StatCard
          label="Release channel"
          value={releaseChannel === "preview" ? "Preview" : "Stable"}
          href="/account/settings"
        />
        <StatCard label="Usage this month" value="0 req" href="/account/usage" />
      </div>

      {/* Quick links */}
      <div className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-widest text-neutral-500">
          Quick actions
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <QuickLink
            href="/account/keys"
            title="Create an API key"
            description="Generate a key to authenticate requests from your desktop client."
          />
          <QuickLink
            href="/account/settings"
            title="Configure preferences"
            description="Set your display name, summary style, and release channel."
          />
          <QuickLink
            href="/account/usage"
            title="View usage"
            description="Monitor API request usage for the current billing period."
          />
          <QuickLink
            href="/download"
            title="Download desktop app"
            description="Get the sansxel desktop client and start building ambient memory."
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
    >
      <div className="text-2xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-neutral-400 group-hover:text-neutral-300">
        {label}
      </div>
    </Link>
  );
}

function QuickLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
    >
      <div className="text-sm font-medium text-white group-hover:text-white">
        {title}
      </div>
      <div className="text-xs leading-relaxed text-neutral-400 group-hover:text-neutral-300">
        {description}
      </div>
    </Link>
  );
}
