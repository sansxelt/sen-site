"use client";

import { useState } from "react";

type Phase = "ready" | "approving" | "approved" | "error";

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

      // Hand off to the desktop via the sansxel:// URL scheme. The
      // browser will prompt the user to open the desktop app, then
      // the desktop redeems the approved request for a session token.
      if (data.callback) {
        window.location.href = data.callback;
      }
    } catch (err) {
      setPhase("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-7">
      <div className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
        sansxel desktop
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
        Sign in on this device?
      </h1>
      <p className="mt-3 text-sm leading-6 text-neutral-300">
        The sansxel desktop app is asking to sign in as
        <span className="text-white"> {email}</span>
        {deviceLabel ? <> on <span className="text-white">{deviceLabel}</span></> : null}
        .
      </p>

      <div className="mt-5 rounded-2xl border border-amber-500/15 bg-amber-500/[0.06] p-3 text-xs leading-5 text-amber-200/80">
        Only approve if you just clicked “Sign in” inside your sansxel desktop
        app. If you did not, close this tab and ignore.
      </div>

      {phase === "approved" ? (
        <div className="mt-6 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] p-4 text-sm text-emerald-100">
          Approved. Returning you to the desktop app — you can close this tab.
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleApprove}
            disabled={phase === "approving"}
            className="sansxel-white-button rounded-2xl bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-60"
          >
            {phase === "approving" ? "Approving…" : "Approve"}
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
