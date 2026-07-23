"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Queue a new Production Pass for this application, then navigate to the new run's report. POSTs the
// approved+enabled flow ids to the owner-checked run route with a fresh idempotency key per click; the
// server re-validates ownership, contract approval, flow eligibility, and credits before anything queues.
// Errors (insufficient credits, contract not approved, concurrency cap, kill switch, daily cap) render
// inline. Stays busy after a successful queue (we are navigating away) so a double click can't fire a
// second run.

// Stable client copy for the kill switch and the daily cap; matches the server's own message strings.
const ERROR_COPY: Record<string, string> = {
  runs_paused: "New verifications are temporarily paused. Existing reports remain available.",
  daily_limit: "Daily run limit reached. Try again tomorrow or contact support.",
};

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
      if (res.status === 401) { router.push(`/signin?callbackUrl=${encodeURIComponent(`/applications/${appId}`)}`); return; }
      if ((res.ok || res.status === 409) && j?.runId) { router.push(`/applications/${appId}/passes/${j.runId}`); return; } // navigating away; keep busy
      setErr((typeof j?.error === "string" && ERROR_COPY[j.error]) || (typeof j?.message === "string" ? j.message : "Could not start the verification. Try again."));
      setBusy(false);
    } catch {
      setErr("Network error. The verification was not started.");
      setBusy(false);
    }
  }

  // The button no longer guesses a price. The old "(N credits)" suffix was the LEGACY model and is wrong
  // under pass pricing (the real cost is a free pass / dollars / a plan's monthly units). The authoritative
  // cost is shown by the PassPreview panel rendered beside this button, which calls the same gate the
  // launch takes — so the number the user sees always matches the charge.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <button type="button" className={ghost ? "btn btn--ghost" : "btn"} onClick={run} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
        {busy ? "Starting…" : label}
      </button>
      {err ? <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--err)", margin: 0, maxWidth: 360 }}>{err}</p> : null}
    </div>
  );
}
