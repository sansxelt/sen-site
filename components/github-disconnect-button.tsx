"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Tiny client island so the GitHub row in the otherwise-server-rendered
// integrations page can offer a 'Disconnect' action that POSTs to the
// disconnect API and refreshes server state. Kept as its own component
// so the rest of the page stays static.
export function GithubDisconnectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    if (!confirm("Disconnect GitHub from VRAELIS? You can reconnect any time.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/github/disconnect", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Could not disconnect.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not disconnect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-red-400/40 hover:bg-red-400/10 hover:text-red-200 disabled:opacity-60"
      >
        {busy ? "Disconnecting…" : "Disconnect"}
      </button>
      {error && <span className="text-[10px] text-red-300">{error}</span>}
    </div>
  );
}
