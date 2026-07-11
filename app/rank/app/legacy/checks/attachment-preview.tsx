"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shared, focus-trapped attachment preview dialog. Used by both the upload zone (pre-check) and the
// report's evidence viewer (post-check). It ALWAYS fetches a fresh short-lived signed URL through the
// owner-checked route at open time and never persists it: no storage path, no reused/expired URL, no
// signed URL in any parent state. For a PDF with a validated page reference it appends #page=N and also
// states the page in text, since a cross-origin viewer may not honor the fragment.

export type PreviewTarget = {
  id: string;
  filename: string;
  kind: "image" | "pdf" | "text" | "office";
  sourceLabel?: string; // e.g. "Output · Screenshot 2" or "Context · brand-guide.pdf"
  page?: number;        // validated 1-indexed PDF page
};

export function AttachmentPreview({ target, onClose }: { target: PreviewTarget; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<Element | null>(null);

  // Fetch a FRESH signed URL every open. Never cached, never surfaced outside this component. The parent
  // keys this dialog by attachment id, so a new target is a fresh mount (initial loading/null state).
  useEffect(() => {
    let off = false;
    fetch(`/api/v/check-upload?id=${encodeURIComponent(target.id)}&signed=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (off) return; if (j?.url) { setUrl(j.url); setState("ready"); } else setState("error"); })
      .catch(() => { if (!off) setState("error"); });
    return () => { off = true; };
  }, [target.id]);

  // Focus management: remember the trigger, move focus into the dialog, restore on close.
  useEffect(() => {
    restoreRef.current = document.activeElement;
    closeRef.current?.focus();
    return () => { (restoreRef.current as HTMLElement | null)?.focus?.(); };
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    // Trap focus within the dialog.
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),iframe,[tabindex]:not([tabindex="-1"])');
    if (!focusable || !focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }, [onClose]);

  const src = url ? (target.kind === "pdf" && target.page ? `${url}#page=${target.page}` : url) : null;

  return (
    <div
      role="dialog" aria-modal="true" aria-label={`Preview: ${target.filename}`}
      onKeyDown={onKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,.55)", display: "grid", placeItems: "center", padding: "clamp(12px, 3vw, 40px)" }}
    >
      <div ref={dialogRef} style={{ background: "var(--bg-1)", border: "1px solid var(--line-2)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-lg)", width: "min(920px, 100%)", maxHeight: "90vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderBottom: "1px solid var(--line-1)" }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {target.sourceLabel ? <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-4)" }}>{target.sourceLabel}</div> : null}
            <div style={{ fontSize: 13.5, color: "var(--fg-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={target.filename}>{target.filename}</div>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close preview"
            style={{ flex: "none", width: 30, height: 30, borderRadius: 8, border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-3)", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>×</button>
        </div>

        {target.kind === "pdf" && target.page ? (
          <div style={{ padding: "8px 16px", fontSize: 12.5, color: "var(--fg-3)", borderBottom: "1px solid var(--line-1)", background: "var(--bg-2)" }}>Referenced page: <strong style={{ color: "var(--fg-1)" }}>{target.page}</strong></div>
        ) : null}

        <div style={{ flex: 1, minHeight: 260, overflow: "auto", background: "var(--bg-2)", display: "grid", placeItems: "center" }}>
          {state === "loading" ? <p style={{ fontSize: 13, color: "var(--fg-4)" }} aria-live="polite">Loading preview…</p> : null}
          {state === "error" ? <p style={{ fontSize: 13, color: "var(--err)" }} aria-live="polite">This attachment is no longer available.</p> : null}
          {state === "ready" && src ? (
            target.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt={target.filename} style={{ maxWidth: "100%", maxHeight: "82vh", objectFit: "contain" }} />
            ) : target.kind === "office" ? (
              <p style={{ fontSize: 13, color: "var(--fg-4)", padding: 24 }}>This file type can&apos;t be previewed here.</p>
            ) : (
              <iframe title={target.filename} src={src} style={{ width: "100%", height: "78vh", border: "none", background: "#fff" }} />
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
