"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  appleAuthOption,
  getAuthErrorMessage,
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
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const authReady = isSupabaseConfigured();
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
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [authReady]);

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
            emailRedirectTo: `${window.location.origin}/auth/callback?next=/account`,
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
        message: `${providerLabels[provider]} sign-in is coming soon for this build. Use email for now.`,
      });
      return;
    }

    setStatus({
      tone: "info",
      message: `Opening ${providerLabels[provider]} sign-in...`,
    });
    setLoadingAction(`provider-${provider}`);

    try {
      const supabase = getSupabaseBrowserClient();

      // TODO: Mark each provider as enabled in the auth dashboard and set the
      // public flags only after local and production callbacks are working.
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/account`,
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
      setStatus({
        tone: "error",
        message: getAuthErrorMessage(error, "provider"),
      });
      setLoadingAction(null);
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
    <div className="rounded-[32px] border border-white/12 bg-black/25 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
            Secure Access
          </div>
          <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
            Sign in to sansxel.
          </h3>
        </div>

        <div className="inline-flex rounded-2xl border border-white/10 bg-white/5 p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("signup")}
            className={`rounded-xl px-4 py-2 transition ${
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
            className={`rounded-xl px-4 py-2 transition ${
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
        Email and password are live now. Additional sign-in methods will
        unlock as this build is configured.
      </p>

      <div className="mt-5 flex flex-wrap gap-3 text-sm text-neutral-100">
        {[
          "Secure account handling",
          "Privacy-first product decisions",
          "Clear control over access and data",
        ].map((item) => (
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
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/account"
              className="sansxel-white-button rounded-2xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
            >
              Open workspace
            </Link>
            <Link
              href="/download#early-access"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
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

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
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
                disabled={!authReady || Boolean(loadingAction)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              disabled={!authReady || Boolean(loadingAction)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              disabled={!authReady || Boolean(loadingAction)}
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-neutral-300 focus:border-white/25 disabled:cursor-not-allowed disabled:opacity-60"
              required
              minLength={8}
            />
            <button
              type="submit"
              disabled={!authReady || Boolean(loadingAction)}
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

        <div className="rounded-3xl border border-white/10 bg-black/20 p-4 sm:p-5">
          <div>
            <div className="text-sm font-medium text-white">
              More sign-in methods
            </div>
            <p className="mt-2 text-sm leading-6 text-neutral-200">
              These options stay visible so the sign-in path feels complete,
              but they only unlock when this build is fully configured for
              them.
            </p>
          </div>
          <div className="mt-4 space-y-3">
            {oauthProviders.map((option) => {
              const providerEnabled = authReady && option.enabled;
              const providerLoading =
                loadingAction === `provider-${option.provider}`;

              return (
                <button
                  key={option.provider}
                  type="button"
                  onClick={
                    providerEnabled
                      ? () => void handleOAuth(option.provider)
                      : undefined
                  }
                  disabled={!providerEnabled || Boolean(loadingAction)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    providerEnabled
                      ? "border-white/10 bg-white/5 hover:bg-white/10"
                      : "cursor-not-allowed border-white/10 bg-white/[0.025]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-white">
                        Continue with {option.label}
                      </div>
                      <div className="mt-1 text-sm text-neutral-200">
                        {providerEnabled
                          ? option.description
                          : `${option.label} sign-in is coming soon for this build.`}
                      </div>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-100">
                      {providerLoading
                        ? "Opening"
                        : providerEnabled
                          ? "Live"
                          : "Coming soon"}
                    </span>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-4 text-left"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-medium text-white">
                    Continue with {appleAuthOption.label}
                  </div>
                  <div className="mt-1 text-sm text-neutral-200">
                    {appleAuthOption.description}
                  </div>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-neutral-100">
                  Coming soon
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {visibleStatus && (
        <div
          className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${statusClasses(
            visibleStatus.tone,
          )}`}
        >
          {visibleStatus.message}
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-5 text-sm text-neutral-100">
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
