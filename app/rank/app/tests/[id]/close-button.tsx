"use client";

import { useState } from "react";

export function CloseButton({ testId }: { testId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function close() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/v/tests/${testId}/close`, { method: "POST" });
      if (r.ok) { window.location.reload(); return; }
      const j = await r.json().catch(() => ({}));
      // not_active = a vote just completed it, reload to show the finished report.
      if (j.error === "not_active") { window.location.reload(); return; }
      setErr("Couldn't close. Try again."); setBusy(false);
    } catch { setErr("Couldn't close. Try again."); setBusy(false); }
  }
  return (
    <div>
      <button onClick={close} disabled={busy} className="btn btn--ghost">
        {busy ? "Closing…" : "End collection early"}
      </button>
      {err && <p style={{ color: "#d33", fontSize: 12, marginTop: 8 }}>{err}</p>}
    </div>
  );
}
