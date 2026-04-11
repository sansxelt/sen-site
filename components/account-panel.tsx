"use client";

import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getAuthErrorMessage,
  getAuthUnavailableMessage,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  oauthProviders,
  providerLabels,
  type OauthProvider,
} from "../lib/supabase";

type StatusTone = "error" | "info" | "success";
type Status = {
  message: string;
  tone: StatusTone;
};

type SummaryStyle = "concise" | "balanced" | "detailed";
type ReleaseChannel = "stable" | "preview";

type SessionState = {
  displayName: string;
  earlyAccessRequestedAt: string | null;
  email: string | null;
  emailConfirmed: boolean;
  focusArea: string;
  releaseChannel: ReleaseChannel;
  signInMethod: string;
  summaryStyle: SummaryStyle;
  workStyle: string;
};

const summaryStyleOptions: Array<{
  description: string;
  label: string;
  value: SummaryStyle;
}> = [
  {
    description: "Short recaps that keep the signal high.",
    label: "Concise",
    value: "concise",
  },
  {
    description: "A calm middle ground for daily use.",
    label: "Balanced",
    value: "balanced",
  },
  {
    description: "More context when you want deeper recall.",
    label: "Detailed",
    value: "detailed",
  },
];

const releaseChannelOptions: Array<{
  description: string;
  label: string;
  value: ReleaseChannel;
}> = [
  {
    description: "Prioritize stability and predictable updates.",
    label: "Stable",
    value: "stable",
  },
  {
    description: "See new releases sooner when access expands.",
    label: "Preview",
    value: "preview",
  },
];

function statusClasses(tone: StatusTone) {
  if (tone === "success") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }

  if (tone === "error") {
    return "border-rose-400/20 bg-rose-400/10 text-rose-100";
  }

  return "border-white/10 bg-white/5 text-neutral-100";
}

function isSummaryStyle(value: unknown): value is SummaryStyle {
  return value === "concise" || value === "balanced" || value === "detailed";
}

function isReleaseChannel(value: unknown): value is ReleaseChannel {
  return value === "stable" || value === "preview";
}

function getSignInMethod(user: User) {
  const provider =
    typeof user.app_metadata?.provider === "string"
      ? user.app_metadata.provider
      : "email";

  if (provider === "email") {
    return "Email";
  }

  return providerLabels[provider as OauthProvider] ?? provider;
}

function readSessionState(user: User | null): SessionState | null {
  if (!user) {
    return null;
  }

  const metadata = user.user_metadata ?? {};

  return {
    displayName:
      typeof metadata.display_name === "string" ? metadata.display_name : "",
    earlyAccessRequestedAt:
      typeof metadata.early_access_requested_at === "string"
        ? metadata.early_access_requested_at
        : null,
    email: user.email ?? null,
    emailConfirmed: Boolean(user.email_confirmed_at),
    focusArea: typeof metadata.focus_area === "string" ? metadata.focus_area : "",
    releaseChannel: isReleaseChannel(metadata.release_channel)
      ? metadata.release_channel
      : "stable",
    signInMethod: getSignInMethod(user),
    summaryStyle: isSummaryStyle(metadata.summary_style)
      ? metadata.summary_style
      : "balanced",
    workStyle: typeof metadata.work_style === "string" ? metadata.work_style : "",
  };
}

function formatRequestedAt(value: string | null) {
  if (!value) {
    return "Not requested yet";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Request saved";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

export function AccountPanel() {
  const router = useRouter();
  const authReady = isSupabaseConfigured();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [workStyle, setWorkStyle] = useState("");
  const [focusArea, setFocusArea] = useState("");
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>("balanced");
  const [releaseChannel, setReleaseChannel] =
    useState<ReleaseChannel>("stable");
  const [status, setStatus] = useState<Status | null>(
    authReady
      ? null
      : {
          tone: "info",
          message: getAuthUnavailableMessage(),
        },
  );

  useEffect(() => {
    if (!authReady) {
      setLoading(false);
      return;
    }

    const supabase = getSupabaseBrowserClient();

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Account session lookup failed:", error);
        setStatus({
          tone: "error",
          message: getAuthErrorMessage(error, "account"),
        });
        setLoading(false);
        return;
      }

      const nextState = readSessionState(data.session?.user ?? null);
      setSessionState(nextState);
      setDisplayName(nextState?.displayName ?? "");
      setWorkStyle(nextState?.workStyle ?? "");
      setFocusArea(nextState?.focusArea ?? "");
      setSummaryStyle(nextState?.summaryStyle ?? "balanced");
      setReleaseChannel(nextState?.releaseChannel ?? "stable");
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextState = readSessionState(session?.user ?? null);
      setSessionState(nextState);
      setDisplayName(nextState?.displayName ?? "");
      setWorkStyle(nextState?.workStyle ?? "");
      setFocusArea(nextState?.focusArea ?? "");
      setSummaryStyle(nextState?.summaryStyle ?? "balanced");
      setReleaseChannel(nextState?.releaseChannel ?? "stable");
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [authReady]);

  async function handleProfileSave() {
    if (!authReady || !sessionState) {
      return;
    }

    setSavingProfile(true);
    setStatus(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.updateUser({
        data: {
          display_name: displayName.trim() || null,
          focus_area: focusArea.trim() || null,
          release_channel: releaseChannel,
          summary_style: summaryStyle,
          work_style: workStyle.trim() || null,
        },
      });

      if (error) {
        throw error;
      }

      const nextState = readSessionState(data.user);

      setSessionState(nextState);
      setDisplayName(nextState?.displayName ?? "");
      setWorkStyle(nextState?.workStyle ?? "");
      setFocusArea(nextState?.focusArea ?? "");
      setSummaryStyle(nextState?.summaryStyle ?? "balanced");
      setReleaseChannel(nextState?.releaseChannel ?? "stable");
      setStatus({
        tone: "success",
        message: "Your workspace settings were saved.",
      });
    } catch (error) {
      console.error("Profile update failed:", error);
      setStatus({
        tone: "error",
        message: getAuthErrorMessage(error, "account"),
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSignOut() {
    if (!authReady) {
      return;
    }

    setSigningOut(true);
    setStatus(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.push("/#auth");
      router.refresh();
    } catch (error) {
      console.error("Account sign out failed:", error);
      setStatus({
        tone: "error",
        message: getAuthErrorMessage(error, "signout"),
      });
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
          Account
        </div>
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-neutral-100">
          Loading your workspace...
        </div>
      </div>
    );
  }

  if (!sessionState) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
          Account
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Sign in to open your sansxel workspace.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-200">
          Your account gives you a place to manage identity, tune workspace
          preferences, and request invite access when you are ready.
        </p>
        {status && (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${statusClasses(
              status.tone,
            )}`}
          >
            {status.message}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/#auth"
            className="sansxel-white-button rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90"
          >
            Create account or sign in
          </Link>
          <Link
            href="/download#early-access"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Request invite
          </Link>
        </div>
      </div>
    );
  }

  const inviteRequested = Boolean(sessionState.earlyAccessRequestedAt);

  return (
    <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
          Workspace Setup
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Your sansxel workspace is live on this device.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-200">
          Keep the setup moving even before desktop access opens up. Save how
          you work, what you want sansxel to remember, and which release track
          you want to follow.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          {[
            ["Access", "Account active"],
            [
              "Invite",
              inviteRequested ? "Request on file" : "Ready when you are",
            ],
            ["Security", sessionState.emailConfirmed ? "Email confirmed" : "Verify soon"],
            ["Sign-in", sessionState.signInMethod],
          ].map(([title, text]) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="text-sm font-medium text-white">{title}</div>
              <div className="mt-2 text-sm leading-6 text-neutral-200">
                {text}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="How should sansxel address you?"
              disabled={savingProfile || signingOut}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white">
              Primary workflow
            </label>
            <input
              type="text"
              value={workStyle}
              onChange={(event) => setWorkStyle(event.target.value)}
              placeholder="Game development, coding, writing, research..."
              disabled={savingProfile || signingOut}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white">
              What should sansxel help you recover?
            </label>
            <textarea
              value={focusArea}
              onChange={(event) => setFocusArea(event.target.value)}
              rows={4}
              placeholder="Recent coding context, interrupted tasks, browsing trails, design decisions..."
              disabled={savingProfile || signingOut}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-white">
                Summary style
              </label>
              <select
                value={summaryStyle}
                onChange={(event) =>
                  setSummaryStyle(event.target.value as SummaryStyle)
                }
                disabled={savingProfile || signingOut}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {summaryStyleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm leading-6 text-neutral-200">
                {
                  summaryStyleOptions.find((option) => option.value === summaryStyle)
                    ?.description
                }
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-white">
                Release track
              </label>
              <select
                value={releaseChannel}
                onChange={(event) =>
                  setReleaseChannel(event.target.value as ReleaseChannel)
                }
                disabled={savingProfile || signingOut}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {releaseChannelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-sm leading-6 text-neutral-200">
                {
                  releaseChannelOptions.find(
                    (option) => option.value === releaseChannel,
                  )?.description
                }
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white">Email</label>
            <div className="mt-2 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-100">
              {sessionState.email}
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-200">
              {sessionState.emailConfirmed
                ? "Your email is confirmed and ready for account access."
                : "Confirm your email when the verification message arrives to keep access smooth across devices."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => void handleProfileSave()}
              disabled={savingProfile || signingOut}
              className="sansxel-white-button rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed"
            >
              {savingProfile ? "Saving workspace..." : "Save workspace"}
            </button>
            <Link
              href="/download#early-access"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
            >
              {inviteRequested ? "Review invite request" : "Request invite"}
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut || savingProfile}
              className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>

        {status && (
          <div
            className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${statusClasses(
              status.tone,
            )}`}
          >
            {status.message}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
            Status
          </div>
          <div className="mt-5 space-y-3">
            {[
              ["Account", "Ready on this device"],
              ["Invite request", formatRequestedAt(sessionState.earlyAccessRequestedAt)],
              ["Preferred release", releaseChannel === "preview" ? "Preview" : "Stable"],
              ["Summary style", summaryStyleOptions.find((option) => option.value === summaryStyle)?.label ?? "Balanced"],
            ].map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div className="text-sm text-neutral-200">{label}</div>
                <div className="text-sm font-medium text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
            Continue
          </div>
          <div className="mt-5 grid gap-3">
            {[
              [
                "/download#early-access",
                inviteRequested ? "Update invite details" : "Request invite access",
                "Reserve your place in the access queue and keep rollout details attached to your account.",
              ],
              [
                "/pricing",
                "Review plans",
                "See what is included now and what opens up later for Pro and Teams.",
              ],
              [
                "/privacy",
                "Review privacy",
                "Read how sansxel handles account details, context, deletion, and support.",
              ],
              [
                "/contact",
                "Contact support",
                "Reach us directly if you need help with access, policy questions, or rollout timing.",
              ],
            ].map(([href, label, description]) => (
              <Link
                key={href}
                href={href}
                className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:bg-white/5"
              >
                <div className="text-sm font-medium text-white">{label}</div>
                <div className="mt-1 text-sm leading-6 text-neutral-200">
                  {description}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
            Sign-in Options
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <div className="text-sm font-medium text-white">Email</div>
                  <div className="mt-1 text-sm text-neutral-200">
                    Available now in the sansxel workspace.
                  </div>
                </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                Live
              </span>
            </div>

            {oauthProviders.map((provider) => (
              <div
                key={provider.provider}
                className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {provider.label}
                  </div>
                  <div className="mt-1 text-sm text-neutral-200">
                    {provider.enabled
                      ? "Ready to use in this build."
                      : `${provider.label} stays disabled until its provider setup is finished.`}
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    provider.enabled
                      ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                      : "border border-white/10 bg-white/5 text-neutral-200"
                  }`}
                >
                  {provider.enabled ? "Live" : "Coming soon"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-8">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
            Trust
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-200">
            <p>Secure account handling stays visible throughout the journey.</p>
            <p>Privacy, terms, and support links stay one click away.</p>
            <p>
              Desktop access remains invite-based until the rollout is ready to
              widen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
