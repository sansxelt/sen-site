"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";
import { getSignInPath } from "../../../lib/auth-ui";

/**
 * Fires the credentials sign-in on mount using the HMAC token the verify
 * route stashed in the URL. The credentials provider accepts `autoSigninToken`
 * in place of `password` for this exact flow.
 *
 * On success we land the user straight in the app (onboarding for a new
 * account). The account is already live by this point, so on ANY failure
 * (expired token, db blip, missing params) we move them FORWARD to the
 * sign-in screen with their email prefilled — never a dead-end "almost" wall.
 */
export function AutoSigninClient({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  useEffect(() => {
    const forwardToSignIn = () => {
      window.location.href = getSignInPath(
        email ? `/account?email=${encodeURIComponent(email)}` : "/account",
      );
    };

    if (!email || !token) {
      forwardToSignIn();
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
        forwardToSignIn();
      } catch {
        if (cancelled) return;
        forwardToSignIn();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [email, token]);

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
        One moment, setting up your session so you land straight in your workspace.
      </p>
    </>
  );
}
