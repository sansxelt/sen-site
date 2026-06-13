"use client";

import { useState, type CSSProperties } from "react";

// Primary header CTA for an inbound product: copies the shareable agent link
// so the user's loudest next action is "put this in your bio," not a test or
// an outbound cold-call tool. Falls back silently if the clipboard is blocked.
export function CopyLinkButton({
  value,
  label = "Copy your link",
  copiedLabel = "Copied. Paste it in your bio",
  className = "btn",
  style,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={className}
      style={{ whiteSpace: "nowrap", padding: "9px 16px", fontSize: 13, ...style }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1800);
        } catch {
          /* clipboard blocked — ignore */
        }
      }}
    >
      {copied ? copiedLabel : `${label} →`}
    </button>
  );
}
