"use client";

import { useState } from "react";

export function ReportActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  }
  return (
    <button onClick={copy} className="btn btn--ghost" style={{ padding: "8px 14px", fontSize: 13 }}>{copied ? "Copied ✓" : "Copy decision record link"}</button>
  );
}
