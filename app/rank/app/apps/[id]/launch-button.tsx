"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Queue a new Production Pass for this application, then navigate to the new run's report. POSTs the
// approved+enabled flow ids to the owner-checked run route with a fresh idempotency key per click; the
// server re-validates ownership, contract approval, flow eligibility, and credits before anything queues.
// Errors (insufficient credits, contract not approved, concurrency cap) render inline. Stays busy after a
// successful queue (we are navigating away) so a double click can't fire a second run.
export function LaunchPassButton({ appId, flowIds, label, ghost }: { appId: string; flowIds: string[]; label: string; ghost?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/preflight/apps/${encodeURIComponent(appId)}/runs`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ flow_ids: flowIds }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) { router.push(`/signin?callbackUrl=${encodeURIComponent(`/app/apps/${appId}`)}`); return; }
      if ((res.ok || res.status === 409) && j?.runId) { router.push(`/app/apps/${appId}/runs/${j.runId}`); return; } // navigating away; keep busy
      setErr(typeof j?.message === "string" ? j.message : "Could not start the pass. Try again.");
      setBusy(false);
    } catch {
      setErr("Network error. The pass was not started.");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <button type="button" className={ghost ? "btn btn--ghost" : "btn"} onClick={run} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
        {busy ? "Starting…" : label}
      </button>
      {err ? <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--err)", margin: 0, maxWidth: 360 }}>{err}</p> : null}
    </div>
  );
}
