"use client";

import { useState } from "react";

// Display-only consolidation: the recommended version with every applicable fix already applied,
// as one copy-pasteable block. Built server-side in finalizeEvaluation (assembly of fixes already
// generated, verbatim-substring enforced); this only renders it and offers a copy button.
export function CorrectedBlock({ text, label, multi }: { text: string; label: string; multi: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };
  return (
    <div style={{ border: "1px solid var(--acc-line)", borderRadius: "var(--r-md)", background: "var(--acc-soft)", padding: "clamp(16px, 2.4vw, 22px)", marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)", fontWeight: 600 }}>Corrected version{multi ? ` (Version ${label})` : ""}</div>
        <button type="button" onClick={copy} className="btn btn--ghost" style={{ marginLeft: "auto", fontSize: 12, padding: "5px 12px" }} aria-live="polite">{copied ? "Copied" : "Copy"}</button>
      </div>
      <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 10px" }}>The recommended version with every applicable fix already applied. Diagnosis above, cure here.</p>
      <p style={{ fontSize: 13.5, color: "var(--fg-1)", lineHeight: 1.6, margin: "0 0 10px", whiteSpace: "pre-wrap", padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--bg-1)", border: "1px solid var(--line-1)" }}>{text}</p>
      <p style={{ fontSize: 11.5, color: "var(--fg-4)", lineHeight: 1.55, margin: 0 }}>A suggested rewrite you should still read before shipping, an AI assessment, not a guarantee. Only lines flagged above were changed; the scores and the pass or fail gate are unchanged.</p>
    </div>
  );
}
