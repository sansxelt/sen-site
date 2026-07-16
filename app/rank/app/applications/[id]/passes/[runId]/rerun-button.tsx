"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ic, I } from "@/app/rank/_components/icons";

// Queue a rerun of this run's flows, then navigate to the new run's report. POSTs the selected scope
// ('failed' re-runs only the failed/blocked flows; 'all' re-runs everything; 'critical' runs every
// currently approved critical flow — the full verification a repair-verified run still needs) to the
// owner-checked rerun route; the server derives the app, contract, deployment target, and flow ids from
// the parent run — the client sends only the scope. Stays busy after a successful queue (we are navigating
// away) so a double click can't fire a second rerun.
//
// A targeted rerun is always PAYG-priced ($3 per selected failed flow) — never covered by the lifetime free
// pass (the free pass covers a fresh full pass only). `priceNote` is the pre-click cost/balance line and MUST
// render inside this same card so it can never appear as a floating error detached from the button it governs.
export function RerunButton({ appId, runId, scope, label, priceNote }: { appId: string; runId: string; scope: "failed" | "all" | "critical"; label: string; priceNote?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/preflight/runs/${encodeURIComponent(runId)}/rerun`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) { router.push(`/signin?callbackUrl=${encodeURIComponent(`/applications/${appId}/passes/${runId}`)}`); return; }
      if ((res.ok || res.status === 409) && j?.runId) { router.push(`/applications/${appId}/passes/${j.runId}`); return; } // navigating away; keep busy
      setErr(typeof j?.message === "string" ? j.message : "Could not start the rerun. Try again.");
      setBusy(false);
    } catch {
      setErr("Network error. The rerun was not started.");
      setBusy(false);
    }
  }

  // The button and its price/error note are one self-contained card: the note is a child of the same
  // bordered block, so it is always visually bound to the button and can never wrap away into a detached
  // floating line (the bug this card fixes). A post-click 402 error replaces the neutral price note in place.
  return (
    <div
      data-testid="rerun-card"
      style={{ display: "inline-flex", flexDirection: "column", gap: 8, alignItems: "flex-start", border: "1px solid var(--line-2)", borderRadius: "var(--r-md, 12px)", background: "var(--bg-1)", padding: "12px 14px", maxWidth: 380 }}
    >
      <button type="button" className="btn" onClick={run} disabled={busy} style={{ opacity: busy ? 0.6 : 1, gap: 8 }}>
        {busy ? "Starting…" : <><Ic d={I.retry} size={14} sw={2} />{label}</>}
      </button>
      {err ? (
        <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--err)", margin: 0, lineHeight: 1.45 }}>{err}</p>
      ) : priceNote ? (
        <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.45 }}>{priceNote}</p>
      ) : null}
    </div>
  );
}
