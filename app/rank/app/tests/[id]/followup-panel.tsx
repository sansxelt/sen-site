"use client";

import { useState } from "react";
import Link from "next/link";

type Plan = { type: string; actionLabel: string; reason: string; creates: string } | null;

// Owner/editor-only decision-action panel. When readiness isn't "ready", offers a
// one-click confirmation round; otherwise confirms no round is needed.
export function FollowupPanel({ testId, plan, defaultTarget, balance }: { testId: string; plan: Plan; defaultTarget: number; balance: number }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (!plan || busy) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`/api/v/tests/${testId}/follow-up`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: plan.type }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok && j.url) { window.location.href = j.url; return; }
      setErr(j.error === "insufficient_credits" ? "Not enough credits for this round. Top up to launch it." : j.error === "plan_limit" ? "You've hit your plan's active-evaluation limit this month." : j.error === "forbidden" ? "You don't have edit access to run a follow-up." : "Couldn't create the confirmation round. Try again.");
    } finally { setBusy(false); }
  }

  if (!plan) {
    return (
      <div className="card" style={{ marginBottom: 22, background: "var(--bg-2)", borderColor: "var(--acc-line)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", marginBottom: 4 }}>Decision is ready, no confirmation round needed.</div>
        <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0, lineHeight: 1.55 }}>Ship the recommended output, share it as a client-ready decision report, or export it. You can still run a fresh round any time from the New evaluation page.</p>
      </div>
    );
  }

  const lowCredits = balance < defaultTarget;
  return (
    <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>Next step, confirmation round</div>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)", marginBottom: 4 }}>{plan.actionLabel}</div>
      <p style={{ fontSize: 13.5, color: "var(--fg-2)", margin: "0 0 6px", lineHeight: 1.55 }}>{plan.reason}</p>
      <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 14px", lineHeight: 1.55 }}>{plan.creates}</p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={create} disabled={busy} className="btn" style={{ opacity: busy ? 0.6 : 1 }}>{busy ? "Launching…" : `${plan.actionLabel}, ~${defaultTarget} judgments`}</button>
        {lowCredits ? <Link href="/credits" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Top up credits</Link> : null}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)" }}>≈ {defaultTarget} credits | balance {balance.toLocaleString()}</span>
      </div>
      {err && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "10px 0 0" }}>{err}</p>}
    </div>
  );
}
