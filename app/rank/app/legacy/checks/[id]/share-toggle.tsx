"use client";

import { useState } from "react";

// Owner control for a check's public share link. Toggling calls the owner-scoped
// /api/v/checks/[id]/share route; the public report lives at the returned URL only while
// enabled. Read-only for viewers, revocable here at any time.
export function ShareToggle({ checkId, initialEnabled, initialUrl }: { checkId: string; initialEnabled: boolean; initialUrl: string | null }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState("");

  async function toggle(next: boolean) {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/v/checks/${checkId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr("Couldn't update sharing. Try again."); }
      else { setEnabled(!!j.enabled); setUrl(j.url ?? null); }
    } catch { setErr("Request failed. Try again."); } finally { setBusy(false); }
  }

  const copy = () => { if (url) { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1400); } };

  return (
    <div className="card" style={{ marginBottom: 18, padding: "clamp(14px, 2vw, 18px)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px" }}>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>Share this report</div>
          <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: "3px 0 0", lineHeight: 1.5 }}>
            {enabled
              ? "Anyone with the link can view this report, read-only, including the output text you pasted. Turn it off to disable the link (re-sharing later creates a new one)."
              : "Create a public, read-only link. Anyone with it can view this report, including the output text you pasted. No sign-in needed, and you can turn it off anytime."}
          </p>
        </div>
        <button onClick={() => toggle(!enabled)} disabled={busy} className={enabled ? "btn btn--ghost" : "btn"} style={{ opacity: busy ? 0.6 : 1, whiteSpace: "nowrap" }}>
          {busy ? "…" : enabled ? "Turn off link" : "Create share link"}
        </button>
      </div>
      {enabled && url && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} style={{ flex: "1 1 260px", padding: "9px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-2)", color: "var(--fg-2)", fontSize: 13, fontFamily: "var(--font-code)" }} />
          <button onClick={copy} className="btn btn--ghost" style={{ fontSize: 12.5 }}>{copied ? "Copied ✓" : "Copy link"}</button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn--ghost" style={{ fontSize: 12.5 }}>Open ↗</a>
        </div>
      )}
      {err && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "10px 0 0" }}>{err}</p>}
    </div>
  );
}
