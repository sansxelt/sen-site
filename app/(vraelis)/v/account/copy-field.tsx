"use client";

import { useState, type CSSProperties } from "react";

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const boxStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    fontFamily: "var(--font-code)",
    fontSize: 12,
    color: "var(--fg-2)",
    background: "var(--bg-2)",
    border: "1px solid var(--line-1)",
    borderRadius: "var(--r-xs)",
    padding: "9px 11px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={boxStyle} title={value}>{value}</span>
        <button
          type="button"
          onClick={copy}
          className="btn btn--ghost"
          style={{ padding: "8px 12px", fontSize: 12, whiteSpace: "nowrap" }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
