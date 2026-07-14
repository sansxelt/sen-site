"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ic, I } from "@/app/rank/_components/icons";

// Request cancellation of a NON-TERMINAL run. POSTs the owner-checked cancel route (which only sets
// cancel_requested_at on a run the caller owns and that is not already terminal); the worker observes the
// flag on its next heartbeat and aborts browser work in a safe state. Idempotent server-side. On success
// we refresh so the report reflects the cancelling/cancelled state (and the hold is reclaimed by the
// worker's terminal-failure refund path). Used for a stuck/queued or mis-launched run.
export function CancelRunButton({ appId, runId }: { appId: string; runId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function cancel() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/preflight/runs/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (res.status === 401) { router.push(`/signin?callbackUrl=${encodeURIComponent(`/applications/${appId}/passes/${runId}`)}`); return; }
      if (res.ok) { router.refresh(); return; }
      setErr(typeof j?.message === "string" ? j.message : "Could not cancel this run. Try again.");
      setBusy(false);
    } catch {
      setErr("Network error. The run was not cancelled.");
      setBusy(false);
    }
  }

  if (!asked) {
    return (
      <button type="button" className="btn btn--ghost" onClick={() => setAsked(true)} style={{ gap: 8, color: "var(--fg-2)" }}>
        <Ic d={I.x} size={13} sw={2.2} /> Cancel run
      </button>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn" onClick={cancel} disabled={busy} style={{ background: "var(--err)", borderColor: "var(--err)", opacity: busy ? 0.6 : 1, gap: 8 }}>
          {busy ? "Cancelling…" : "Confirm cancel"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => setAsked(false)} disabled={busy}>Keep running</button>
      </div>
      {err ? <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--err)", margin: 0, maxWidth: 360 }}>{err}</p> : null}
    </div>
  );
}
