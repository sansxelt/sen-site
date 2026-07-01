"use client";

import { useEffect, useState, type ReactNode } from "react";

// Wraps the embed widget. STANDALONE (opened directly at /embed/vote/<id>) it gets a
// centered warm backdrop + a lifted stage card, so the widget isn't a bare form
// floating in white. FRAMED (iframed on a host site via /embed.js) it stays flat and
// transparent so it never fights the host page's own design or background.
export function EmbedStage({ children }: { children: ReactNode }) {
  // Assume framed until proven standalone, so a host iframe never flashes the backdrop.
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    try { setStandalone(window.self === window.top); } catch { setStandalone(false); }
  }, []);

  if (!standalone) {
    // Framed: minimal, transparent — the host page is the backdrop; iframe is sized to content.
    return <div style={{ maxWidth: 460, margin: "0 auto" }}>{children}</div>;
  }

  // Standalone: centered stage with soft depth on a warm backdrop.
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(120% 80% at 50% -10%, #eef7f3 0%, #FAF8F4 46%, #F1EEE7 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(20px, 5vw, 56px) 16px", boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 460 }}>{children}</div>
    </div>
  );
}
