"use client";

import { useState } from "react";

export function EmbedSnippet({ testId }: { testId: string }) {
  const [copied, setCopied] = useState(false);
  const snippet = `<script async src="https://vraelis.com/embed.js" data-vraelis-test="${testId}"></script>`;
  const link = `https://vraelis.com/embed/vote/${testId}`;

  function copy() {
    navigator.clipboard?.writeText(snippet).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  return (
    <div className="card" style={{ marginTop: 26 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 8 }}>Collect votes anywhere</div>
      <p style={{ fontSize: 13.5, color: "var(--fg-2)", marginBottom: 12 }}>Embed this test on your site, Notion, or anywhere. Every vote counts toward your result.</p>
      <code style={{ display: "block", fontFamily: "var(--font-code, monospace)", fontSize: 12, color: "var(--fg-1)", background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: 8, padding: "10px 12px", wordBreak: "break-all", marginBottom: 12 }}>{snippet}</code>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={copy} className="btn btn--ghost">{copied ? "Copied ✓" : "Copy embed code"}</button>
        <a href={link} target="_blank" rel="noopener" className="btn btn--ghost">Open vote link ↗</a>
      </div>
    </div>
  );
}
