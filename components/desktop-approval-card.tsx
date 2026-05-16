"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";
import { getSignInPath } from "../lib/auth-ui";

type Phase =
  | "ready"
  | "approving"
  | "approved"
  | "switching-account"
  | "error";

export function DesktopApprovalCard({
  requestId,
  email,
  deviceLabel,
}: {
  requestId: string;
  email: string;
  deviceLabel: string | null;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const switchAccountRedirect = getSignInPath(
    `/desktop-auth?request_id=${encodeURIComponent(requestId)}`,
  );

  async function handleApprove() {
    setPhase("approving");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/desktop/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_id: requestId }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Approval failed.");
      }

      const data = (await res.json()) as { callback?: string };
      setPhase("approved");

      // Hand off to the desktop via the vraelis:// URL scheme. The
      // browser prompts the user to open the desktop app, then the
      // desktop redeems the approved request for a session token.
      if (data.callback) {
        window.location.href = data.callback;
      }

      // Browsers will not close tabs they did not open. We still try,
      // and if it fails the fallback UI already explains what to do.
      setTimeout(() => {
        try {
          window.close();
        } catch {
          // Ignore close failures.
        }
      }, 800);
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleUseDifferentAccount() {
    setPhase("switching-account");
    setErrorMsg(null);

    try {
      await signOut({
        redirectTo: switchAccountRedirect,
      });
    } catch (err) {
      setPhase("error");
      setErrorMsg(
        err instanceof Error ? err.message : "Could not switch accounts.",
      );
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
      <div className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
        vraelis desktop
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
        Sign in on this device?
      </h1>
      <p className="mt-3 text-sm leading-6 text-neutral-300">
        The vraelis desktop app is asking to sign in as
        <span className="text-white"> {email}</span>
        {deviceLabel ? (
          <>
            {" "}
            on <span className="text-white">{deviceLabel}</span>
          </>
        ) : null}
        .
      </p>
      <p className="mt-2 text-sm leading-6 text-neutral-400">
        Not the right account? Switch accounts here and come straight back to
        finish desktop sign-in.
      </p>

      <div className="mt-5 rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-3 text-xs leading-5 text-amber-200/80">
        Only approve if you just clicked &quot;Sign in&quot; inside your
        vraelis desktop app. If you did not, close this tab and ignore it.
      </div>

      {phase === "approved" ? (
        <div className="mt-6 space-y-3">
          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100">
            All done - vraelis desktop is signed in. Switch back to the app to
            keep going.
          </div>
          <p className="text-center text-xs text-neutral-500">
            You can close this tab.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void handleApprove()}
            disabled={phase === "approving" || phase === "switching-account"}
            className="VRAELIS-white-button rounded-2xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
          >
            {phase === "approving" ? "Approving..." : "Approve"}
          </button>
          <button
            type="button"
            onClick={() => void handleUseDifferentAccount()}
            disabled={phase === "approving" || phase === "switching-account"}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
          >
            {phase === "switching-account"
              ? "Switching account..."
              : "Use different account"}
          </button>
          <a
            href="/account"
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Cancel
          </a>
        </div>
      )}

      {phase === "error" && errorMsg && (
        <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
