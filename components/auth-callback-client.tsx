"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getAuthErrorMessage,
  getAuthUnavailableMessage,
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "../lib/supabase";

type Status = {
  message: string;
  tone: "error" | "success";
};

function statusClasses(tone: Status["tone"]) {
  return tone === "success"
    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
    : "border-rose-400/20 bg-rose-400/10 text-rose-100";
}

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawError =
    searchParams.get("error_description") || searchParams.get("error");
  const immediateError = !isSupabaseConfigured()
    ? getAuthUnavailableMessage()
    : rawError
      ? getAuthErrorMessage(rawError, "callback")
      : null;
  const [status, setStatus] = useState<Status>({
    tone: "success",
    message: "Finishing your sen sign-in...",
  });

  useEffect(() => {
    const nextPath = searchParams.get("next") || "/account";
    if (immediateError) {
      return;
    }

    const supabase = getSupabaseBrowserClient();

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        console.error("Callback session lookup failed:", error);
        setStatus({
          tone: "error",
          message: getAuthErrorMessage(error, "callback"),
        });
        return;
      }

      if (!data.session?.user) {
        setStatus({
          tone: "error",
          message:
            "We couldn't finish sign-in. Head back to account access and try again.",
        });
        return;
      }

      setStatus({
        tone: "success",
        message: "You're signed in. Redirecting to your account...",
      });

      window.setTimeout(() => {
        router.replace(nextPath);
      }, 900);
    });
  }, [immediateError, router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30">
        <div className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-300">
          Account Access
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
          Finishing your sign-in
        </h1>
        <div
          className={`mt-6 rounded-2xl border px-4 py-3 text-sm ${statusClasses(
            immediateError ? "error" : status.tone,
          )}`}
        >
          {immediateError ?? status.message}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/#auth"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
          >
            Back to sign-in
          </Link>
          <Link
            href="/account"
            className="sen-white-button rounded-2xl bg-white px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
          >
            Go to account
          </Link>
        </div>
      </div>
    </div>
  );
}
