"use client";

import { useEffect } from "react";

// The delegated copy handler for every Code block (code.tsx), installed once per window. It lives in an effect, not
// in a <script> tag: React never executes a script it renders on the client, so after a client-side navigation (a
// menu link or an orbit tile into /agents, /developers, /integrations or a use case) the old inline script never ran
// and the Copy buttons did nothing. Reads the block's rendered text (which equals the source exactly) and writes it to
// the clipboard; falls back to execCommand where the async API is absent. "Copied" shows for 1.6 s (plan A5); the
// label it returns to is whatever the button read before, so a translated "Copy" comes back translated.
export function CopyWiring() {
  useEffect(() => {
    const w = window as typeof window & { __v6copy?: number };
    if (w.__v6copy) return;
    w.__v6copy = 1;
    document.addEventListener("click", (e) => {
      const t = e.target as Element | null;
      const b = t?.closest?.("[data-v6-copy]") as HTMLElement | null;
      if (!b) return;
      const code = b.closest(".v6-code")?.querySelector("code");
      if (!code) return;
      const text = code.innerText;
      const prev = b.getAttribute("data-label") || b.textContent || "";
      b.setAttribute("data-label", prev);
      const done = () => {
        b.textContent = "Copied";
        window.setTimeout(() => { b.textContent = prev; }, 1600);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => {});
        return;
      }
      try {
        const a = document.createElement("textarea");
        a.value = text;
        a.setAttribute("readonly", "");
        a.style.position = "absolute";
        a.style.left = "-9999px";
        document.body.appendChild(a);
        a.select();
        document.execCommand("copy");
        document.body.removeChild(a);
        done();
      } catch {
        // Nothing to copy with: the button keeps its label.
      }
    });
  }, []);
  return null;
}
