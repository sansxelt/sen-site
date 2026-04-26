"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { useEffect, useState, type FormEvent } from "react";
import {
  getAuthErrorMessage,
  getSafeRedirectPath,
  getSignInPath,
  oauthProviders,
  type OauthProvider,
} from "../lib/auth-ui";

export type AuthMode = "signup" | "signin";
type StatusTone = "error" | "info" | "success";
type Status = {
  message: string;
  tone: StatusTone;
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        d="M21.64 12.2c0-.68-.06-1.34-.17-1.98H12v3.74h5.41a4.63 4.63 0 0 1-2.01 3.04v2.52h3.25c1.9-1.75 2.99-4.33 2.99-7.32Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.25-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.06v2.6A9.99 9.99 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.42 13.89A5.98 5.98 0 0 1 6.1 12c0-.66.11-1.3.32-1.89V7.51H3.06A10 10 0 0 0 2 12c0 1.61.39 3.13 1.06 4.49l3.36-2.6Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.98c1.47 0 2.79.5 3.83 1.48l2.87-2.87C16.97 2.98 14.7 2 12 2a9.99 9.99 0 0 0-8.94 5.51l3.36 2.6c.78-2.36 2.98-4.13 5.58-4.13Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 fill-white"
    >
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.04c-3.34.73-4.04-1.42-4.04-1.42-.55-1.38-1.33-1.75-1.33-1.75-1.09-.74.08-.73.08-.73 1.2.09 1.83 1.23 1.83 1.23 1.08 1.84 2.82 1.31 3.5 1 .11-.78.42-1.31.77-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.39 1.23-3.23-.12-.3-.53-1.52.12-3.17 0 0 1.01-.32 3.3 1.23A11.48 11.48 0 0 1 12 6.3c1.02 0 2.05.14 3.01.4 2.29-1.55 3.29-1.23 3.29-1.23.66 1.65.25 2.87.13 3.17.77.84 1.23 1.92 1.23 3.23 0 4.61-2.81 5.62-5.49 5.92.43.38.82 1.1.82 2.22v3.3c0 .32.21.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function ProviderIcon({ provider }: { provider: OauthProvider }) {
  return provider === "google" ? <GoogleIcon /> : <GitHubIcon />;
}

function statusClasses(tone: StatusTone) {
  if (tone === "success") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }

  if (tone === "error") {
    return "border-rose-400/20 bg-rose-400/10 text-rose-100";
  }

  return "border-white/10 bg-white/5 text-neutral-100";
}

export function OAuthSection({
  callbackUrl = "/account",
}: {
  callbackUrl?: string;
}) {
  const safeRedirectPath = getSafeRedirectPath(callbackUrl);
  const [activeProvider, setActiveProvider] = useState<OauthProvider | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    if (!activeProvider) return;

    const resetProviderState = () => {
      setActiveProvider((current) =>
        current === activeProvider ? null : current,
      );
    };

    const timeoutId = window.setTimeout(resetProviderState, 4500);
    const handleFocus = () => resetProviderState();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") resetProviderState();
    };

    window.addEventListener("focus", handleFocus);
    window.addEventListener("pageshow", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("pageshow", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeProvider]);

  async function handleOAuth(provider: OauthProvider) {
    setStatus(null);
    setActiveProvider(provider);
    try {
      await signIn(provider, { redirectTo: safeRedirectPath });
    } catch (error) {
      console.error("Provider auth failed:", error);
      setActiveProvider(null);
      setStatus({
        tone: "error",
        message: getAuthErrorMessage(error, "provider"),
      });
    }
  }

  return (
    <div className="rounded-[28px] border border-white/10 bg-black/20 p-5 sm:p-6">
      <div className="text-sm font-medium text-white">Continue with a provider</div>
      <p className="mt-1.5 text-sm leading-6 text-neutral-400">
        Faster start — picks up in the same workspace flow.
      </p>

      <div className="mt-5 grid gap-3">
        {oauthProviders.map((option) => {
          const providerBusy = activeProvider === option.provider;
          return (
            <button
              key={option.provider}
              type="button"
              onClick={() => void handleOAuth(option.provider)}
              disabled={providerBusy}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-wait disabled:opacity-80"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                  <ProviderIcon provider={option.provider} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white">
                    Continue with {option.label}
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-400">
                    {option.provider === "google" ? "Use your Google account" : "Use your GitHub account"}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-neutral-400">
                  {providerBusy ? "Redirecting…" : "Live"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 border-t border-white/[0.08] pt-4">
        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500">
          Destination
        </div>
        <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-neutral-400">
          {safeRedirectPath}
        </div>
      </div>

      {status && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusClasses(status.tone)}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}

export function ModeSwitcher({
  mode,
  onModeChange,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}) {
  return (
    // Sized to content (not w-full) so the active 'Create account'
    // pill never clips. Heading flex-row above shrinks the ModeSwitcher
    // when w-full was set; sizing to content + a wrap-friendly heading
    // row fixes the 'Create acco…' clipping.
    <div className="inline-flex shrink-0 rounded-[20px] border border-white/10 bg-white/5 p-1 text-sm">
      <button
        type="button"
        onClick={() => onModeChange("signup")}
        className={`whitespace-nowrap rounded-[16px] px-4 py-2 leading-none transition focus-visible:outline-none sm:px-5 ${
          mode === "signup"
            ? "sansxel-white-button bg-white text-black"
            : "text-neutral-200 hover:text-white"
        }`}
      >
        Create account
      </button>
      <button
        type="button"
        onClick={() => onModeChange("signin")}
        className={`whitespace-nowrap rounded-[16px] px-4 py-2 leading-none transition focus-visible:outline-none sm:px-5 ${
          mode === "signin"
            ? "sansxel-white-button bg-white text-black"
            : "text-neutral-200 hover:text-white"
        }`}
      >
        Sign in
      </button>
    </div>
  );
}

export function AuthPanel({
  mode: modeProp,
  onModeChange,
  callbackUrl = "/account",
  initialSessionEmail = null,
}: {
  mode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
  callbackUrl?: string;
  initialSessionEmail?: string | null;
}) {
  const router = useRouter();
  const [modeInternal, setModeInternal] = useState<AuthMode>("signup");
  const mode = modeProp ?? modeInternal;
  const setMode = onModeChange ?? setModeInternal;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [sessionEmail] = useState(initialSessionEmail);
  const [loadingAction, setLoadingAction] = useState<
    AuthMode | "signout" | null
  >(null);
  const safeRedirectPath = getSafeRedirectPath(callbackUrl);
  const emailBusy = loadingAction === "signup" || loadingAction === "signin";

  async function finishCredentialsSignIn() {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      redirectTo: safeRedirectPath,
    });

    if (result?.error) {
      throw new Error(result.error);
    }

    setPassword("");
    router.push(result?.url ?? safeRedirectPath);
    router.refresh();
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setLoadingAction(mode);

    try {
      if (mode === "signup") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            name,
            password,
          }),
        });

        const payload = (await response.json()) as {
          error?: string;
          verify?: "pending";
          email?: string;
        };

        if (!response.ok) {
          throw new Error(
            payload.error ?? "We couldn't create your account right now.",
          );
        }

        // Verification flow: don't auto-sign-in.  User has to click the
        // link in their email first.  Route them to the "check your
        // inbox" landing page with their email prefilled.
        if (payload.verify === "pending") {
          setPassword("");
          router.push(`/auth/verify-email?email=${encodeURIComponent(payload.email ?? email)}`);
          return;
        }
      }

      await finishCredentialsSignIn();
      setStatus({
        tone: "success",
        message: "Welcome back. Opening your workspace.",
      });
    } catch (error) {
      console.error("Email auth failed:", error);
      setStatus({
        tone: "error",
        message: getAuthErrorMessage(error, mode),
      });
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleSignOut() {
    setLoadingAction("signout");
    setStatus(null);

    try {
      await signOut({
        redirectTo: getSignInPath(safeRedirectPath),
      });
    } catch (error) {
      console.error("Sign out failed:", error);
      setLoadingAction(null);
      setStatus({
        tone: "error",
        message: getAuthErrorMessage(error, "signout"),
      });
    }
  }

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div>
        {/* SECURE ACCESS line — always one line */}
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="whitespace-nowrap uppercase tracking-[0.2em] text-neutral-300">Secure Access</span>
          {sessionEmail && (
            <>
              <span className="text-neutral-600">·</span>
              <span className="truncate text-emerald-400">{sessionEmail}</span>
            </>
          )}
        </div>

        {/* Heading + toggle. Wraps to two rows when the toggle won't
            fit cleanly next to the heading (avoids the 'Create acco…'
            text clip). */}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h3 className="text-2xl font-semibold tracking-tight text-white">
            Continue into sansxel.
          </h3>
          {!onModeChange && <ModeSwitcher mode={mode} onModeChange={setMode} />}
        </div>

        {sessionEmail && (
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={safeRedirectPath}
              className="sansxel-white-button rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90"
            >
              Open workspace
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={loadingAction === "signout"}
              className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-neutral-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAction === "signout" ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
      </div>

      {/* ── Email card ──────────────────────────────────────────── */}
      <div className="mt-6">

        <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="text-sm font-medium text-white">
            {mode === "signup" ? "Create with email" : "Sign in with email"}
          </div>
          <p className="mt-1.5 text-sm leading-6 text-neutral-400">
            {mode === "signup"
              ? "Password-based account on sansxel."
              : "Use your email and password."}
          </p>

          <form onSubmit={handleEmailAuth} className="mt-5 space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name"
                disabled={emailBusy}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-400 focus:border-white/25 disabled:opacity-60"
                required
                minLength={1}
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              disabled={emailBusy}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-400 focus:border-white/25 disabled:opacity-60"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              disabled={emailBusy}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-400 focus:border-white/25 disabled:opacity-60"
              required
              minLength={8}
            />
            <button
              type="submit"
              disabled={emailBusy}
              className="sansxel-white-button w-full rounded-2xl bg-white px-6 py-3 text-sm font-medium text-black transition hover:opacity-90 disabled:cursor-not-allowed"
            >
              {loadingAction === "signup"
                ? "Creating account..."
                : loadingAction === "signin"
                  ? "Signing in..."
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
            </button>
            {mode === "signin" && (
              <div className="flex justify-end">
                <Link
                  href="/auth/reset-password"
                  className="text-xs text-neutral-400 transition hover:text-neutral-200"
                >
                  Forgot password?
                </Link>
              </div>
            )}
          </form>
        </div>
      </div>

      {status && (
        <div className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${statusClasses(status.tone)}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}
