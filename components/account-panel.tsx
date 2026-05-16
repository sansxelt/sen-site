"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  type ReleaseChannel,
  type SessionState,
  type SummaryStyle,
} from "../lib/account-session";
import { getAuthErrorMessage, getSignInPath, oauthProviders } from "../lib/auth-ui";

type BackendStatus = {
  status: "healthy" | "degraded";
  database: { configured: boolean; connected: boolean };
  auth: { configured: boolean };
};

type StatusTone = "error" | "info" | "success";
type Status = {
  message: string;
  tone: StatusTone;
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

export function AccountPanel({
  initialSessionState,
}: {
  initialSessionState: SessionState | null;
}) {
  const [savingProfile, setSavingProfile] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(
    initialSessionState,
  );
  const [displayName, setDisplayName] = useState(
    initialSessionState?.displayName ?? "",
  );
  const [workStyle, setWorkStyle] = useState(
    initialSessionState?.workStyle ?? "",
  );
  const [focusArea, setFocusArea] = useState(
    initialSessionState?.focusArea ?? "",
  );
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>(
    initialSessionState?.summaryStyle ?? "balanced",
  );
  const [releaseChannel, setReleaseChannel] =
    useState<ReleaseChannel>(initialSessionState?.releaseChannel ?? "stable");
  const [status, setStatus] = useState<Status | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<Status | null>(null);

  // Delete account state
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<Status | null>(null);

  // Backend status state
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [checkingBackend, setCheckingBackend] = useState(false);

  async function checkBackendStatus() {
    setCheckingBackend(true);
    try {
      const response = await fetch("/api/status");
      const data = (await response.json()) as BackendStatus;
      setBackendStatus(data);
    } catch {
      setBackendStatus(null);
    } finally {
      setCheckingBackend(false);
    }
  }

  useEffect(() => {
    if (initialSessionState) {
      void checkBackendStatus();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleProfileSave() {
    if (!sessionState) {
      return;
    }

    setSavingProfile(true);
    setStatus(null);

    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          displayName,
          focusArea,
          releaseChannel,
          summaryStyle,
          workStyle,
        }),
      });

      const payload = (await response.json()) as {
        error?: string;
        sessionState?: SessionState | null;
      };

      if (!response.ok || !payload.sessionState) {
        throw new Error(
          payload.error ?? "We couldn't save your workspace settings right now.",
        );
      }

      setSessionState(payload.sessionState);
      setDisplayName(payload.sessionState.displayName);
      setWorkStyle(payload.sessionState.workStyle);
      setFocusArea(payload.sessionState.focusArea);
      setSummaryStyle(payload.sessionState.summaryStyle);
      setReleaseChannel(payload.sessionState.releaseChannel);
      setStatus({
        tone: "success",
        message: "Your workspace settings were saved.",
      });
    } catch (error) {
      console.error("Profile update failed:", error);
      setStatus({
        tone: "error",
        message: getAuthErrorMessage(error, "profile"),
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    setStatus(null);

    try {
      await signOut({
        redirectTo: "/",
      });
    } catch (error) {
      console.error("Account sign out failed:", error);
      setSigningOut(false);
      setStatus({
        tone: "error",
        message: getAuthErrorMessage(error, "signout"),
      });
    }
  }

  async function handlePasswordChange() {
    setChangingPassword(true);
    setPasswordStatus(null);

    try {
      const response = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const payload = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "We couldn't update your password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setPasswordStatus({ tone: "success", message: "Password updated successfully." });
    } catch (error) {
      setPasswordStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "We couldn't update your password.",
      });
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleDeleteAccount() {
    setDeletingAccount(true);
    setDeleteStatus(null);

    try {
      const response = await fetch("/api/account/delete", { method: "DELETE" });
      const payload = (await response.json()) as { error?: string; ok?: boolean };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "We couldn't delete your account.");
      }

      await signOut({ redirectTo: "/" });
    } catch (error) {
      setDeletingAccount(false);
      setDeleteStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "We couldn't delete your account.",
      });
    }
  }

  if (!sessionState) {
    return (
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
          Account
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Sign in to open your VRAELIS workspace.
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
        <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
          <Link
            href={getSignInPath("/account")}
            className="VRAELIS-white-button rounded-2xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
          >
            Sign in
          </Link>
          <Link
            href="/download#early-access"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
          >
            Request invite
          </Link>
        </div>
      </div>
    );
  }

  const inviteRequested = Boolean(sessionState.earlyAccessRequestedAt);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.9fr)]">
      <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
          Workspace Setup
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Your VRAELIS workspace is live on this device.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-200">
          Save how you work, what you want VRAELIS to remember, and which
          release track you want to follow.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Access", "Account active"],
            [
              "Invite",
              inviteRequested ? "Request on file" : "Ready when you are",
            ],
            ["Security", `${sessionState.signInMethod} session active`],
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

        <div className="mt-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-white">
              Display name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="How should VRAELIS address you?"
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
              What should VRAELIS help you recover?
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
              VRAELIS keeps sign-in and return routes on the same account
              surface, whether you use email, Google, or GitHub.
            </p>
          </div>

          <div className="grid gap-3 pt-2 sm:flex sm:flex-wrap">
            <button
              type="button"
              onClick={() => void handleProfileSave()}
              disabled={savingProfile || signingOut}
              className="VRAELIS-white-button rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed"
            >
              {savingProfile ? "Saving workspace..." : "Save workspace"}
            </button>
            <Link
              href="/download#early-access"
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
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

      <div className="space-y-4 sm:space-y-6">
        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
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
                className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm text-neutral-200">{label}</div>
                <div className="text-sm font-medium text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
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
                "Read how VRAELIS handles account details, context, deletion, and support.",
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
                className="rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5 transition hover:bg-white/5"
              >
                <div className="text-sm font-medium text-white">{label}</div>
                <div className="mt-1 text-sm leading-6 text-neutral-200">
                  {description}
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
            Sign-in Options
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-white">Email</div>
                <div className="mt-1 text-sm text-neutral-200">
                  Live now through the Auth.js credentials flow.
                </div>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                Live
              </span>
            </div>

            {oauthProviders.map((provider) => (
              <div
                key={provider.provider}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-white">
                    {provider.label}
                  </div>
                  <div className="mt-1 text-sm text-neutral-200">
                    Live now through the VRAELIS-hosted Auth.js flow.
                  </div>
                </div>
                <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                  Live
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
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

        <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
            Backend Status
          </div>
          <div className="mt-5 space-y-3">
            {backendStatus ? (
              <>
                {[
                  ["Overall", backendStatus.status === "healthy" ? "Healthy" : "Degraded", backendStatus.status === "healthy"],
                  ["Database", backendStatus.database.connected ? "Connected" : backendStatus.database.configured ? "Unreachable" : "Not configured", backendStatus.database.connected],
                  ["Auth", backendStatus.auth.configured ? "Configured" : "Not configured", backendStatus.auth.configured],
                ].map(([label, value, ok]) => (
                  <div
                    key={label as string}
                    className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="text-sm text-neutral-200">{label as string}</div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${ok ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100" : "border-rose-400/20 bg-rose-400/10 text-rose-100"}`}>
                      {value as string}
                    </span>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-sm text-neutral-200">
                {checkingBackend ? "Checking..." : "Status unavailable."}
              </div>
            )}
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => void checkBackendStatus()}
              disabled={checkingBackend}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checkingBackend ? "Checking..." : "Re-check"}
            </button>
          </div>
        </div>

        {sessionState.signInMethod === "Email" && (
          <div className="rounded-[32px] border border-white/10 bg-white/5 p-6 sm:p-8">
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-200">
              Change Password
            </div>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-white">
                  Current password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={changingPassword}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={changingPassword}
                  placeholder="At least 8 characters"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              {passwordStatus && (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${statusClasses(passwordStatus.tone)}`}>
                  {passwordStatus.message}
                </div>
              )}
              <button
                type="button"
                onClick={() => void handlePasswordChange()}
                disabled={changingPassword || !currentPassword || !newPassword}
                className="VRAELIS-white-button rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed"
              >
                {changingPassword ? "Updating..." : "Update password"}
              </button>
            </div>
          </div>
        )}

        <div id="danger" className="rounded-[32px] border border-rose-400/10 bg-rose-400/5 p-6 sm:p-8">
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-rose-300">
            Danger Zone
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">
            Delete your account
          </h3>
          <p className="mt-2 text-sm leading-6 text-neutral-200">
            This permanently removes your profile, preferences, and invite
            request. It cannot be undone.
          </p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-white">
                Type <span className="font-mono text-rose-300">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                disabled={deletingAccount}
                className="mt-2 w-full rounded-2xl border border-rose-400/20 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-rose-400/40 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            {deleteStatus && (
              <div className={`rounded-2xl border px-4 py-3 text-sm ${statusClasses(deleteStatus.tone)}`}>
                {deleteStatus.message}
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleDeleteAccount()}
              disabled={deletingAccount || deleteConfirm !== "DELETE"}
              className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-5 py-3 text-sm font-medium text-rose-100 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deletingAccount ? "Deleting account..." : "Delete my account"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
