"use client";

import { useState } from "react";

// Copy a repair prompt (or any text) to the clipboard, with a brief "Copied" confirmation. Falls back to a
// hidden-textarea execCommand copy when the async Clipboard API is unavailable (older / non-secure contexts).
export function CopyButton({ text, label = "Copy repair prompt" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }

  return (
    <button type="button" className="btn btn--ghost" onClick={copy} style={{ fontSize: 12.5, padding: "7px 13px" }}>
      {copied ? "Copied" : label}
    </button>
  );
}
