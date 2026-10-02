"use client";

// The label over a code sample, with a Copy button (console audit P2-7: the CLI page's commands had none,
// so installing meant selecting text by hand). Copies the sample exactly as shown.
import { useState } from "react";

export function CodeBar({ label, text }: { label: string; text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* clipboard refused: the text is still selectable */ }
  };
  return (
    <div className="codebar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <span>{label}</span>
      <button type="button" onClick={() => void copy()} aria-label={`Copy: ${label}`}
        style={{ font: "500 11.5px var(--font-sans, inherit)", color: done ? "var(--fg-1)" : "var(--fg-3)", background: "transparent",
          border: "1px solid var(--line-2)", borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}>
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
