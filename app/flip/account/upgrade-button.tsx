"use client";

import { useState, type CSSProperties } from "react";
import { signIn } from "next-auth/react";

export function UpgradeButton({
  className,
  label = "Upgrade to Pro",
  style,
  plan = "seller",
  cycle = "monthly",
}: {
  className?: string;
  label?: string;
  style?: CSSProperties;
  plan?: string;
  cycle?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  async function go() {
    if (busy) return;
    setBusy(true); setErr(false);
    try {
      const res = await fetch("/api/flip/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, cycle }),
      });
      if (res.status === 401) { signIn("google", { callbackUrl: "/account" }); return; }
      const j = await res.json();
      if (j.url) { window.location.href = j.url; return; }
      setErr(true); setBusy(false);
    } catch { setErr(true); setBusy(false); }
  }
  return (
    <button
      onClick={go}
      disabled={busy}
      className={className ?? "btn"}
      style={{ ...style, cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}
    >
      {busy ? "Opening checkout…" : err ? "Try again" : <>{label} <span aria-hidden>→</span></>}
    </button>
  );
}
