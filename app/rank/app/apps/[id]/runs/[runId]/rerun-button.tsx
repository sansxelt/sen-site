"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Queue a rerun of this run's flows, then navigate to the new run's report. POSTs the selected scope
// ('failed' re-runs only the failed/blocked flows; 'all' re-runs everything; 'critical' runs every
// currently approved critical flow — the full verification a repair-verified run still needs) to the
// owner-checked rerun route; the server derives the app, contract, deployment target, and flow ids from
// the parent run — the client sends only the scope. Stays busy after a successful queue (we are navigating
// away) so a double click can't fire a second rerun.
export function RerunButton({ appId, runId, scope, label }: { appId: string; runId: string; scope: "failed" | "all" | "critical"; label: string }) {
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
      if (res.status === 401) { router.push(`/signin?callbackUrl=${encodeURIComponent(`/app/apps/${appId}/runs/${runId}`)}`); return; }
      if ((res.ok || res.status === 409) && j?.runId) { router.push(`/app/apps/${appId}/runs/${j.runId}`); return; } // navigating away; keep busy
      setErr(typeof j?.message === "string" ? j.message : "Could not start the rerun. Try again.");
      setBusy(false);
    } catch {
      setErr("Network error. The rerun was not started.");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <button type="button" className="btn" onClick={run} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
        {busy ? "Starting…" : label}
      </button>
      {err ? <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--err)", margin: 0, maxWidth: 360 }}>{err}</p> : null}
    </div>
  );
}
