"use client";

import { useState } from "react";

export function BillingActions({ canceling, hasSub }: { canceling: boolean; hasSub: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function setCancel(resume: boolean) {
    setBusy(true); setMsg("");
    const r = await fetch("/api/v/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: resume ? "resume" : "cancel" }) });
    const j = await r.json().catch(() => ({}));
    if (j.ok) { window.location.reload(); return; }
    setBusy(false); setMsg(j.error === "no_subscription" ? "No active subscription." : "Couldn't update. Try again.");
  }

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      <a href="/app/plans" className="btn">Change plan</a>
      {hasSub && (canceling
        ? <button onClick={() => setCancel(true)} disabled={busy} className="btn btn--ghost">{busy ? "…" : "Resume subscription"}</button>
        : <button onClick={() => setCancel(false)} disabled={busy} className="btn btn--ghost">{busy ? "…" : "Cancel subscription"}</button>)}
      {msg && <span style={{ fontSize: 13, color: "var(--fg-3)" }}>{msg}</span>}
    </div>
  );
}

// Opens the Stripe-hosted portal to add/update a card and view invoices. Works
// for everyone — the portal route creates a customer on first use.
export function PaymentMethodButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function open() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/v/portal", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (j.url) { window.location.href = j.url; return; }
    setBusy(false); setMsg("Couldn't open the card manager. Try again.");
  }

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <button onClick={open} disabled={busy} className="btn">{busy ? "Opening…" : "Update payment method"}</button>
      {msg && <span style={{ fontSize: 13, color: "var(--fg-3)" }}>{msg}</span>}
    </div>
  );
}
