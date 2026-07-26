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
      <span style={{ display: "inline-flex", alignItems: "center", gap: 7, borderRadius: 999, border: "1px solid var(--go-line)", background: "var(--go-wash)", color: "var(--go-ink)", padding: "4px 11px", fontSize: 12, fontWeight: 600 }}>
        <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--acc)", flex: "none" }} />
        Email verified
      </span>
      <h1 style={{ marginTop: 18, fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)", lineHeight: 1.15 }}>
        Signing you in…
      </h1>
      <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.6, color: "var(--fg-3)" }}>
        One moment, setting up your session so you land straight in your workspace.
      </p>
    </>
  );
}
