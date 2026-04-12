"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { useEffect, useState, type FormEvent } from "react";
import {
  getAuthErrorMessage,
  getSafeRedirectPath,
  oauthProviders,
  type OauthProvider,
} from "../lib/auth-ui";

type AuthMode = "signup" | "signin";
type StatusTone = "error" | "info" | "success";
type Status = {
  message: string;
  tone: StatusTone;
};

function statusClasses(tone: StatusTone) {
  if (tone === "success") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-100";
  }

  if (tone === "error") {
    return "border-rose-400/20 bg-rose-400/10 text-rose-100";
  }

  return "border-white/10 bg-white/5 text-neutral-100";
}

export function AuthPanel({
  callbackUrl = "/account",
  initialSessionEmail = null,
}: {
  callbackUrl?: string;
  initialSessionEmail?: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [sessionEmail] = useState(initialSessionEmail);
  const [activeProvider, setActiveProvider] = useState<OauthProvider | null>(
    null,
  );
  const [loadingAction, setLoadingAction] = useState<
    AuthMode | "signout" | null
  >(null);
  const safeRedirectPath = getSafeRedirectPath(callbackUrl);
  const emailBusy = loadingAction === "signup" || loadingAction === "signin";

  useEffect(() => {
    if (!activeProvider) {
      return;
    }

    const resetProviderState = () => {
      setActiveProvider((current) =>
        current === activeProvider ? null : current,
      );
    };

    const timeoutId = window.setTimeout(resetProviderState, 4500);

    const handleFocus = () => {
      resetProviderState();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resetProviderState();
      }
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

        const payload = (await response.json()) as { error?: string };

        if (!response.ok) {
          throw new Error(
            payload.error ?? "We couldn't create your account right now.",
          );
        }
      }

      await finishCredentialsSignIn();
      setStatus({
        tone: "success",
        message:
          mode === "signup"
            ? "Your sansxel account is ready. Opening your workspace."
            : "Welcome back. Opening your workspace.",
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

  async function handleOAuth(provider: OauthProvider) {
    setStatus(null);
    setActiveProvider(provider);

    try {
      await signIn(provider, {
        redirectTo: safeRedirectPath,
      });
    } catch (error) {
      console.error("Provider auth failed:", error);
      setActiveProvider(null);
      setStatus({
        tone: "error",
        message: getAuthErrorMessage(error, "provider"),
      });
    }
  }

  async function handleSignOut() {
    setLoadingAction("signout");
    setStatus(null);

    try {
      await signOut({
        redirectTo: "/",
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
    <div className="rounded-[32px] border border-white/12 bg-black/25 p-5 sm:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Secure Access
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Continue into sansxel.
          </h3>
        </div>

        <div className="grid w-full grid-cols-2 overflow-hidden rounded-[20px] border border-white/10 bg-white/5 p-1 text-sm sm:inline-flex sm:w-auto">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-[16px] px-4 py-2.5 leading-none transition focus-visible:outline-none ${
              mode === "signup"
                ? "sansxel-white-button bg-white text-black"
                : "text-neutral-200 hover:text-white"
            }`}
          >
            Create account
          </button>
          <button
            type="button"
            onClick={() => setMode("signin")}
            className={`rounded-[16px] px-4 py-2.5 leading-none transition focus-visible:outline-none ${
              mode === "signin"
                ? "sansxel-white-button bg-white text-black"
                : "text-neutral-200 hover:text-white"
            }`}
          >
            Sign in
          </button>
        </div>
      </div>

      <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-200">
        Email, Google, and GitHub all start here on sansxel and return to the
        same workspace flow when they finish.
      </p>

      <div className="mt-5 flex flex-wrap gap-2.5 text-sm text-neutral-100">
        {["Email live", "Google live", "GitHub live"].map((item) => (
          <div
            key={item}
            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5"
          >
            {item}
          </div>
        ))}
      </div>

      {sessionEmail && (
        <div className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
          <div className="text-sm font-medium text-emerald-100">
            Signed in on this device
          </div>
          <div className="mt-2 text-sm leading-6 text-emerald-50/90">
            {sessionEmail}
          </div>
          <div className="mt-4 grid gap-3 sm:flex sm:flex-wrap">
            <Link
              href={safeRedirectPath}
              className="sansxel-white-button rounded-2xl bg-white px-4 py-2 text-center text-sm font-medium text-black transition hover:opacity-90"
            >
              Open workspace
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={loadingAction === "signout"}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAction === "signout" ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 grid items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div>
            <div className="text-sm font-medium text-white">Email sign-in</div>
            <p className="mt-2 text-sm leading-6 text-neutral-200">
              Use a password-based sansxel account or switch to Google and
              GitHub below.
            </p>
          </div>

          <form onSubmit={handleEmailAuth} className="mt-5 space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
                disabled={emailBusy}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              disabled={emailBusy}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              disabled={emailBusy}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
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
            <p className="text-sm leading-6 text-neutral-200">
              {mode === "signup"
                ? "Create your email account here, or use Google or GitHub below if you want a faster start."
                : "Sign in with your email and password, or continue with a provider below."}
            </p>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6">
          <div className="text-sm font-medium text-white">Continue with</div>
          <p className="mt-2 text-sm leading-6 text-neutral-200">
            Premium OAuth starts here on sansxel before you continue to the
            provider.
          </p>

          <div className="mt-5 grid gap-3">
            {oauthProviders.map((option) => {
              const providerBusy = activeProvider === option.provider;
              const providerMark = option.provider === "github" ? "GH" : "G";

              return (
                <button
                  key={option.provider}
                  type="button"
                  onClick={() => void handleOAuth(option.provider)}
                  disabled={providerBusy}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-wait disabled:opacity-80"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm font-medium text-white">
                      {providerMark}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white">
                        Continue with {option.label}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-400">
                        Redirect on sansxel
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-100">
                      {providerBusy ? "Redirecting..." : "Live"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-5 border-t border-white/10 pt-5">
            <div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
              Destination
            </div>
            <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-neutral-100">
              {safeRedirectPath}
            </div>
          </div>
        </div>
      </div>

      {status && (
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${statusClasses(
            status.tone,
          )}`}
        >
          {status.message}
        </div>
      )}
    </div>
  );
}
