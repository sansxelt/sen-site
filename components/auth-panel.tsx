"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  getAuthErrorMessage,
  getAuthCallbackUrl,
  getAuthUnavailableMessage,
  getSupabaseBrowserClient,
  isProviderEnabled,
  isSupabaseConfigured,
  oauthProviders,
  providerLabels,
  type OauthProvider,
} from "../lib/supabase";

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

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [activeProvider, setActiveProvider] = useState<OauthProvider | null>(
    null,
  );
  const [loadingAction, setLoadingAction] = useState<AuthMode | "signout" | null>(
    null,
  );
  const authReady = isSupabaseConfigured();
  const liveProviders = oauthProviders.filter((option) => option.enabled);
  const upcomingProviders = oauthProviders.filter((option) => !option.enabled);
  const emailBusy = loadingAction === "signup" || loadingAction === "signin";
  const visibleStatus =
    status ??
    (!authReady
      ? {
          message: getAuthUnavailableMessage(),
          tone: "info" as const,
        }
      : null);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    void supabase.auth.getSession().then(({ data }) => {
      setSessionEmail(data.session?.user.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
      setActiveProvider(null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [authReady]);

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

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!authReady) {
      setStatus({
        tone: "info",
        message: getAuthUnavailableMessage(),
      });
      return;
    }

    setStatus(null);
    setLoadingAction(mode);

    try {
      const supabase = getSupabaseBrowserClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: name.trim() || null,
              source: "website",
            },
            emailRedirectTo: getAuthCallbackUrl(),
          },
        });

        if (error) {
          throw error;
        }

        setPassword("");

        if (data.session?.user) {
          setStatus({
            tone: "success",
            message:
              "Your sansxel account is ready. Taking you to your account.",
          });
          router.push("/account");
          return;
        }

        setStatus({
          tone: "success",
          message:
            "Your sansxel account is almost ready. Check your inbox to confirm your email and finish signing in.",
        });

        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      setPassword("");
      setStatus({
        tone: "success",
        message: "Welcome back. Taking you to your account.",
      });
      router.push("/account");
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
    if (!authReady) {
      setStatus({
        tone: "info",
        message: getAuthUnavailableMessage(),
      });
      return;
    }

    if (!isProviderEnabled(provider)) {
      setStatus({
        tone: "info",
        message: `${providerLabels[provider]} sign-in is not available in this build yet.`,
      });
      return;
    }

    setStatus(null);
    setActiveProvider(provider);

    try {
      const supabase = getSupabaseBrowserClient();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: getAuthCallbackUrl(),
          queryParams:
            provider === "google" ? { prompt: "select_account" } : undefined,
        },
      });

      if (error) {
        throw error;
      }

      if (data.url) {
        window.location.assign(data.url);
        return;
      }

      throw new Error("No redirect URL returned.");
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
    if (!authReady) {
      return;
    }

    setLoadingAction("signout");
    setStatus(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      setStatus({
        tone: "success",
        message: "You have been signed out on this device.",
      });
      router.refresh();
    } catch (error) {
      console.error("Sign out failed:", error);
      setStatus({
        tone: "error",
        message: getAuthErrorMessage(error, "signout"),
      });
    } finally {
      setLoadingAction(null);
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
            Sign in to sansxel.
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
        Email, Google, and GitHub are ready now. Microsoft and Apple stay
        disabled until their production setup is complete.
      </p>

      <div className="mt-5 flex flex-wrap gap-2.5 text-sm text-neutral-100">
        {["Secure handling", "Fast return", "Clear support"].map((item) => (
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
              href="/account"
              className="sansxel-white-button rounded-2xl bg-white px-4 py-2 text-center text-sm font-medium text-black transition hover:opacity-90"
            >
              Open workspace
            </Link>
            <Link
              href="/download#early-access"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-center text-sm text-white transition hover:bg-white/10"
            >
              Request invite
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={Boolean(loadingAction)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-2 text-sm text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingAction === "signout" ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 grid items-start gap-5 xl:grid-cols-[minmax(0,1.02fr)_minmax(18rem,0.98fr)]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div>
            <div className="text-sm font-medium text-white">
              Email and password
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-200">
              This is the live account flow for the current build.
            </p>
          </div>

          <form onSubmit={handleEmailAuth} className="mt-4 space-y-3">
            {mode === "signup" && (
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name"
                disabled={!authReady || emailBusy}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              disabled={!authReady || emailBusy}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              disabled={!authReady || emailBusy}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              required
              minLength={8}
            />
            <button
              type="submit"
              disabled={!authReady || emailBusy}
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
              By continuing, you agree to sansxel&apos;s{" "}
              <Link
                href="/terms"
                className="text-white transition hover:opacity-80"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-white transition hover:opacity-80"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </form>
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-5 sm:p-6">
          <div>
            <div className="text-sm font-medium text-white">
              Continue with
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-200">
              Fast provider sign-in with a secure return to your account.
            </p>
          </div>
          <div className="mt-5 grid gap-3">
            {liveProviders.map((option) => {
              const providerBusy = activeProvider === option.provider;
              const providerMark = option.provider === "github" ? "GH" : "G";

              return (
                <button
                  key={option.provider}
                  type="button"
                  onClick={() => void handleOAuth(option.provider)}
                  disabled={!authReady || providerBusy}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-wait disabled:opacity-80"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20 text-sm font-medium text-white">
                      {providerMark}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white">
                        {option.label}
                      </div>
                      <div className="mt-1 text-xs uppercase tracking-[0.18em] text-neutral-400">
                        Secure redirect
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
              More soon
            </div>
            <div className="mt-3 grid gap-2.5">
              {upcomingProviders.map((option) => (
                <div
                  key={option.provider}
                  className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-3 opacity-75"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-neutral-200">
                        {option.label}
                      </div>
                      <div className="mt-1 text-sm text-neutral-400">
                        Unavailable for now
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-300">
                      Disabled
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {visibleStatus && (
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${statusClasses(
            visibleStatus.tone,
          )}`}
        >
          {visibleStatus.message}
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
      </div>
    </div>
  );
}
