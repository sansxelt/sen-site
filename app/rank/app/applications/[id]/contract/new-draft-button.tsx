"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "Create new draft" on the approved (read-only) contract view. POSTs to the draft-revision route, then
// refreshes the server page so the new draft renders as the current version. The route is idempotent for
// a double click (it returns the existing next-version draft), so no client-side lock beyond `busy`.
export function NewDraftButton({ appId }: { appId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    if (busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/preflight/apps/${appId}/contract/draft`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(typeof j?.message === "string" ? j.message : "Could not create a draft. Try again.");
        return;
      }
      router.refresh();
    } catch {
      setErr("Network error. No draft was created.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "none" }}>
      <button type="button" className="btn btn--ghost" onClick={create} disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
        {busy ? "Creating draft…" : "Create new draft"}
      </button>
      {err ? <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--err)", margin: 0 }}>{err}</p> : null}
    </div>
  );
}
