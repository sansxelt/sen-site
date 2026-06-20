"use client";

import { useState, type CSSProperties } from "react";
import { signIn } from "next-auth/react";

export function UpgradeButton({
  className,
  label = "Upgrade to Pro",
  style,
}: {
  className?: string;
  label?: string;
  style?: CSSProperties;
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/flip/checkout", { method: "POST" });
      if (res.status === 401) { signIn("google", { callbackUrl: "/account" }); return; }
      const j = await res.json();
      if (j.url) window.location.href = j.url;
      else setBusy(false);
    } catch { setBusy(false); }
  }
  return (
    <button
      onClick={go}
      disabled={busy}
      className={className ?? "btn"}
      style={{ ...style, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
    >
      {busy ? "Opening checkout…" : <>{label} <span aria-hidden>→</span></>}
    </button>
  );
}
