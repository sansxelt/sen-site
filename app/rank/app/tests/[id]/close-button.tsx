"use client";

import { useState } from "react";

export function CloseButton({ testId }: { testId: string }) {
  const [busy, setBusy] = useState(false);
  async function close() {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/v/tests/${testId}/close`, { method: "POST" });
      if (r.ok) window.location.reload();
      else setBusy(false);
    } catch { setBusy(false); }
  }
  return (
    <button onClick={close} disabled={busy} className="btn">
      {busy ? "Closing…" : "Close & see results now"}
    </button>
  );
}
