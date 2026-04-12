"use client";

import Link from "next/link";
import { signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  getAuthErrorMessage,
  getSafeRedirectPath,
  oauthProviders,
  type OauthProvider,
} from "../lib/auth-ui";

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
  standalone = false,
}: {
  callbackUrl?: string;
  initialSessionEmail?: string | null;
  standalone?: boolean;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [sessionEmail] = useState(initialSessionEmail);
  const [activeProvider, setActiveProvider] = useState<OauthProvider | null>(
    null,
  );
  const [signingOut, setSigningOut] = useState(false);
  const safeRedirectPath = getSafeRedirectPath(callbackUrl);

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
    setSigningOut(true);
    setStatus(null);

    try {
      await signOut({
        redirectTo: "/",
      });
    } catch (error) {
      console.error("Sign out failed:", error);
      setSigningOut(false);
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

        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-emerald-100">
          App-hosted auth
        </div>
      </div>

      <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-200">
        Start on sansxel, choose Google or GitHub, and return straight to your
        workspace with your session already ready.
      </p>

      <div className="mt-5 flex flex-wrap gap-2.5 text-sm text-neutral-100">
        {["Google live", "GitHub live", "Email later"].map((item) => (
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
              disabled={signingOut}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {signingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 grid items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div>
            <div className="text-sm font-medium text-white">
              Choose a provider
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-200">
              Premium OAuth starts here on sansxel before you continue to the
              provider.
            </p>
          </div>

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
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6">
          <div className="text-sm font-medium text-white">What changes now</div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-200">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              The sign-in entry point, error handling, and return flow stay on
              the `sansxel.ai` domain.
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              Google and GitHub are ready now. Email sign-in can be added later
              without rebuilding the whole auth surface.
            </div>
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-neutral-300">
              Microsoft and Apple are intentionally out of the way until they
              are actually configured.
            </div>
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

      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-sm text-neutral-100">
        <Link href="/privacy" className="transition hover:text-white">
          Privacy Policy
        </Link>
        <Link href="/terms" className="transition hover:text-white">
          Terms of Service
        </Link>
        <Link href="/contact" className="transition hover:text-white">
          Contact / Support
        </Link>
        {standalone && (
          <Link href="/" className="transition hover:text-white">
            Back home
          </Link>
        )}
      </div>
    </div>
  );
}
