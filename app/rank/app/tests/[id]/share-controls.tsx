"use client";

import { useState } from "react";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://vraelis.com";

export function ShareControls({ testId, enabled: e0, token: t0 }: { testId: string; enabled: boolean; token: string | null }) {
  const [enabled, setEnabled] = useState(e0);
  const [shareUrl, setShareUrl] = useState(e0 && t0 ? `${SITE}/r/${t0}` : "");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = enabled ? shareUrl : "";

  async function act(action: "enable" | "disable" | "regenerate") {
    setBusy(true);
    try {
      const r = await fetch("/api/v/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId, action }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setEnabled(!!j.enabled); setShareUrl(j.url ?? (j.enabled && j.token ? `${SITE}/r/${j.token}` : "")); }
    } finally { setBusy(false); }
  }
  function copy() {
    if (url) navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  }

  return (
    <div className="card" style={{ marginBottom: 26 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Share report</span>
        <span className="pill" style={enabled ? { background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" } : { color: "var(--fg-4)" }}>{enabled ? "Public link on" : "Private"}</span>
      </div>
      {enabled && url ? (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <code style={{ flex: 1, minWidth: 200, fontFamily: "var(--font-code, monospace)", fontSize: 12.5, color: "var(--fg-1)", background: "var(--bg-2)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "9px 12px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{url}</code>
            <button onClick={copy} className="btn">{copied ? "Copied ✓" : "Copy link"}</button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => act("disable")} disabled={busy} className="btn btn--ghost" style={{ fontSize: 13 }}>Disable link</button>
            <button onClick={() => act("regenerate")} disabled={busy} className="btn btn--ghost" style={{ fontSize: 13 }}>Regenerate</button>
            <a href={url} target="_blank" rel="noopener" className="btn btn--ghost" style={{ fontSize: 13 }}>Open ↗</a>
          </div>
          <p style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 12, fontFamily: "var(--font-mono)" }}>Anyone with this link can view the report (read-only). No account, billing, or private data is exposed.</p>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginBottom: 14 }}>Publish a clean, read-only public link to share these results with clients or teammates — no Vraelis account needed to view.</p>
          <button onClick={() => act("enable")} disabled={busy} className="btn">{busy ? "Enabling…" : "Enable public sharing"}</button>
        </>
      )}
    </div>
  );
}
