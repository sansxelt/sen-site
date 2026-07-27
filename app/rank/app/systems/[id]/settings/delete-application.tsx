"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Owner delete for an application. Calls the owner-gated DELETE /api/preflight/apps?id=... route; the
// server re-derives the owner from the session and deleteApplication() is owner-scoped (a zero-row delete
// returns 404, never a false success), so a client-supplied id can never remove another owner's app. This
// is a destructive, irreversible action, so it requires a typed confirmation (the app's name) before the
// button enables. On success we leave the (now-gone) app and return to the applications list.

const inputStyle = {
  width: "100%", padding: "9px 12px", fontSize: 13.5,
  color: "var(--fg-1)", background: "var(--bg-1)", border: "1px solid var(--line-2)",
  borderRadius: "var(--r-sm)", outline: "none",
} as const;

export function DeleteApplication({ appId, appName }: { appId: string; appName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const matches = confirmText.trim() === appName.trim();

  async function doDelete() {
    if (busy || !matches) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/preflight/apps?id=${encodeURIComponent(appId)}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j?.message === "string" ? j.message : "Could not delete this application. Try again, or contact support if it persists.");
        setBusy(false);
        return;
      }
      // Gone. Leave Settings for the applications list (a full navigation so no stale app state lingers).
      router.push("/systems");
      router.refresh();
    } catch {
      setErr("Network error. The application was not deleted.");
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ padding: "clamp(18px, 2.4vw, 24px)", background: "var(--bg-2)", marginTop: 26, border: "1px solid var(--line-2)" }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)", margin: 0 }}>Delete application</h2>
      <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "8px 0 0" }}>
        Permanently removes <strong style={{ color: "var(--fg-1)" }}>{appName}</strong> and its contract, flows,
        connections, and run history. This cannot be undone. Your billing records are kept.
      </p>

      {!open ? (
        <button
          type="button"
          onClick={() => { setOpen(true); setErr(null); }}
          className="btn btn--ghost"
          style={{ marginTop: 14, color: "var(--err)", borderColor: "var(--err)" }}
        >
          Delete this application
        </button>
      ) : (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
          <label style={{ fontSize: 12.5, color: "var(--fg-2)" }}>
            Type the application name <strong style={{ color: "var(--fg-1)" }}>{appName}</strong> to confirm.
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={appName}
            aria-label="Type the application name to confirm deletion"
            style={inputStyle}
            autoFocus
          />
          {err ? <p role="alert" style={{ fontSize: 13, color: "var(--err)", margin: 0 }}>{err}</p> : null}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              type="button"
              onClick={doDelete}
              disabled={!matches || busy}
              className="btn"
              style={{ background: "var(--err)", borderColor: "var(--err)", opacity: !matches || busy ? 0.5 : 1 }}
            >
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setConfirmText(""); setErr(null); }} disabled={busy} className="btn btn--ghost">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
