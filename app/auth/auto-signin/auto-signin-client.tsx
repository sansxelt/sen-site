"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { getSignInPath } from "../../../lib/auth-ui";

type Status =
  | { kind: "signing-in" }
  | { kind: "error"; message: string };

/**
 * Fires the credentials sign-in on mount using the HMAC token the
 * verify route stashed in the URL.  The credentials provider accepts
 * `autoSigninToken` in place of `password` for this exact flow.
 *
 * If NextAuth replies with an error (expired token, database blip,
 * etc.), we fall back to a plain "sign in manually" screen so the
 * user isn't stranded — their account is already live at this point,
 * they just need to type the password they set at signup.
 */
export function AutoSigninClient({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const [status, setStatus] = useState<Status>({ kind: "signing-in" });

  useEffect(() => {
    if (!email || !token) {
      setStatus({ kind: "error", message: "Missing sign-in token. Please sign in manually." });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await signIn("credentials", {
          email,
          autoSigninToken: token,
          redirect: false,
        });
        if (cancelled) return;
        if (res?.ok) {
          window.location.href = "/account";
          return;
        }
        setStatus({
          kind: "error",
          message: res?.error
            ? "Sign-in link expired — sign in manually to continue."
            : "Couldn't sign you in automatically. Please sign in manually.",
        });
      } catch {
        if (cancelled) return;
        setStatus({
          kind: "error",
          message: "Couldn't sign you in automatically. Please sign in manually.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email, token]);

  if (status.kind === "signing-in") {
    return (
      <>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Email verified
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Signing you in…
        </h1>
        <p className="mt-3 text-sm leading-6 text-neutral-300">
          One moment — setting up your session so you land straight in
          your workspace.
        </p>
      </>
    );
  }

  return (
    <>
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        Email verified
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
        You&apos;re in — almost.
      </h1>
      <p className="mt-3 text-sm leading-6 text-neutral-300">
        Your account is live. {status.message}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href={getSignInPath(email ? `/account?email=${encodeURIComponent(email)}` : "/account")}
          className="sansxel-white-button flex-1 rounded-2xl bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/"
          className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm font-medium text-white transition hover:bg-white/10"
        >
          Home
        </Link>
      </div>
    </>
  );
}
