"use client";

import { useState } from "react";

export function ExportControls({ testId }: { testId: string }) {
  const [copied, setCopied] = useState(false);
  const base = `https://vraelis.com/api/v/tests/${testId}/export`;
  function copy() {
    navigator.clipboard?.writeText(`${base}?format=json`).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  }
  return (
    <div className="card" style={{ marginBottom: 26 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>Export data</div>
      <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginBottom: 14 }}>Export vote data, comments, and the analysis as JSON or CSV. No private account data is included.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href={`${base}?format=json`} download className="btn btn--ghost">Download JSON</a>
        <a href={`${base}?format=csv`} download className="btn btn--ghost">Download CSV</a>
        <button onClick={copy} className="btn btn--ghost">{copied ? "Endpoint copied ✓" : "Copy API endpoint"}</button>
      </div>
    </div>
  );
}
