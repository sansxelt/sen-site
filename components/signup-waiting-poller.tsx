"use client";

import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type Status = "waiting" | "signing-in";

/**
 * Client companion to /auth/verify-email's "check your inbox" screen.
 *
 * Polls /api/auth/check-signup-status every few seconds.  The endpoint
 * trusts the signed claim cookie this browser got from /api/auth/register
 * and returns a one-shot auto-signin token the moment the verification
 * actually happens (whether on this device or another).  We then call
 * NextAuth's credentials sign-in with the token in place of a password
 * and drop the user straight into /account, no "now go sign in"
 * interstitial, even for the device that started signup.
 *
 * Stops polling once a signed-in response comes back; the endpoint also
 * clears the claim cookie so subsequent refreshes of the page don't
 * thrash the API.
 */
export function SignupWaitingPoller() {
  const [status, setStatus] = useState<Status>("waiting");
  const firedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (cancelled || firedRef.current) return;
      try {
        const res = await fetch("/api/auth/check-signup-status", {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          verified?:         boolean;
          email?:            string;
          autoSigninToken?:  string;
        };
        if (!data.verified || !data.email || !data.autoSigninToken) return;

        firedRef.current = true;
        setStatus("signing-in");
        await signIn("credentials", {
          email:           data.email,
          autoSigninToken: data.autoSigninToken,
          redirect:        false,
        });
        window.location.href = "/account";
      } catch {
        // Network hiccup, try again next tick. Don't surface anything.
      }
    }

    tick(); // hit once immediately so fast verifications don't wait 3s
    const interval = setInterval(tick, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div style={{ marginTop: 18, display: "inline-flex", alignItems: "center", gap: 9, fontSize: 12.5, color: "var(--fg-3)" }}>
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: "var(--acc)", opacity: 0.55 }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--acc)" }} />
      </span>
      {status === "waiting"
        ? "Waiting for you to click the link, you'll be signed in automatically."
        : "Signing you in…"}
    </div>
  );
}
