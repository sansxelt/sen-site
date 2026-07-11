"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACCEPT_EXT } from "@/lib/v-attachments";
import { AttachmentPreview, type PreviewTarget } from "../attachment-preview";

// One upload area, scoped to a role (+ version for candidate outputs). Manages its own files for that
// scope: upload, list-on-mount (refresh persistence via draftKey), preview (fresh signed URL), remove,
// replace, and reorder (drag OR keyboard). Reports its items up via onItemsChange so the form can
// aggregate the summary + gate the CTA. storage_path is never seen here — the API only returns ids and
// short-lived signed URLs. Readiness is stated truthfully per file kind and NEVER claims a file was
// "analyzed" (that only happens on a completed check).

export type UIItem = {
  localId: string; serverId?: string; filename: string; size: number;
  kind?: string; pageCount?: number | null;
  status: "uploading" | "ready" | "failed"; error?: string; previewUrl?: string;
};

const KIND_ICON: Record<string, string> = { pdf: "PDF", text: "TXT", image: "IMG", office: "DOC" };
const fmtSize = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

// Truthful readiness per kind. Pre-check the UI only ever says what a file is READY for; it must not
// claim analysis happened until a completed result persists the final capability.
function readiness(kind: string | undefined, status: UIItem["status"], error?: string): { text: string; tone: "muted" | "ok" | "err" } {
  if (status === "uploading") return { text: "Validating…", tone: "muted" };
  if (status === "failed") return { text: error || "Upload failed", tone: "err" };
  if (kind === "image") return { text: "Ready for visual analysis", tone: "ok" };
  if (kind === "pdf") return { text: "Ready for text + visual analysis", tone: "ok" };
  return { text: "Ready for text analysis", tone: "ok" };
}
const toneColor = (t: "muted" | "ok" | "err") => (t === "err" ? "var(--err)" : t === "ok" ? "var(--acc-deep)" : "var(--fg-4)");

export function UploadZone({ draftKey, role, versionKey, onItemsChange }: {
  draftKey: string;
  role: "candidate_output" | "supporting_context";
  versionKey?: string;
  onItemsChange?: (items: UIItem[]) => void;
}) {
  const [items, setItems] = useState<UIItem[]>([]);
  const [drag, setDrag] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewTarget | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replacingRef = useRef<UIItem | null>(null);
  const roleLabel = role === "candidate_output" ? "Output attachment" : "Supporting context";

  // Report items up via a ref so the effect depends only on `items` (a fresh onItemsChange each parent
  // render must NOT re-fire this, or the parent setState below would loop).
  const cbRef = useRef(onItemsChange);
  useEffect(() => { cbRef.current = onItemsChange; });
  useEffect(() => { cbRef.current?.(items); }, [items]);

  const loadPreview = useCallback(async (serverId: string) => {
    try {
      const j = await (await fetch(`/api/v/check-upload?id=${serverId}&signed=1`)).json();
      if (j?.url) setItems((xs) => xs.map((x) => (x.serverId === serverId ? { ...x, previewUrl: j.url } : x)));
    } catch { /* thumbnail is best-effort */ }
  }, []);

  // Refresh persistence: re-list this scope's uploads on mount, preserving the persisted order.
  useEffect(() => {
    if (!draftKey) return;
    let off = false;
    fetch(`/api/v/check-upload?draftKey=${encodeURIComponent(draftKey)}`).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (off || !j?.attachments) return;
      const mine = (j.attachments as Array<Record<string, unknown>>)
        .filter((a) => a.role === role && (role === "supporting_context" || a.version_key === versionKey))
        .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0));
      setItems(mine.map((a) => ({ localId: String(a.id), serverId: String(a.id), filename: String(a.filename), size: Number(a.size_bytes), kind: String(a.kind), pageCount: (a.page_count as number) ?? null, status: "ready" as const })));
      mine.filter((a) => a.kind === "image").forEach((a) => loadPreview(String(a.id)));
    }).catch(() => {});
    return () => { off = true; };
  }, [draftKey, role, versionKey, loadPreview]);

  async function upload(files: File[], replaceItem?: UIItem) {
    for (const f of files) {
      const localId = crypto.randomUUID();
      setItems((xs) => [...xs, { localId, filename: f.name, size: f.size, status: "uploading" }]);
      const fd = new FormData();
      fd.append("file", f); fd.append("role", role); fd.append("draftKey", draftKey);
      if (versionKey) fd.append("versionKey", versionKey);
      try {
        const res = await fetch("/api/v/check-upload", { method: "POST", body: fd });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { setItems((xs) => xs.map((x) => (x.localId === localId ? { ...x, status: "failed", error: j.message || "We could not process this file." } : x))); continue; }
        const a = j.attachment;
        setItems((xs) => xs.map((x) => (x.localId === localId ? { ...x, serverId: a.id, kind: a.kind, pageCount: a.page_count, size: a.size_bytes, status: "ready" } : x)));
        if (a.kind === "image") loadPreview(a.id);
        if (replaceItem) removeItem(replaceItem); // swap in the new file only once its upload succeeds
      } catch { setItems((xs) => xs.map((x) => (x.localId === localId ? { ...x, status: "failed", error: "Network error. Try again." } : x))); }
    }
  }

  function removeItem(it: UIItem) {
    setItems((xs) => { const n = xs.filter((x) => x.localId !== it.localId); persistOrder(n); return n; });
    if (it.serverId) fetch(`/api/v/check-upload?id=${it.serverId}`, { method: "DELETE" }).catch(() => {});
  }
  function retry(it: UIItem) { removeItem(it); inputRef.current?.click(); } // failed -> clear + reopen picker
  function startReplace(it: UIItem) { replacingRef.current = it; replaceRef.current?.click(); }

  async function openPreview(it: UIItem) {
    if (!it.serverId || !it.kind) return;
    setPreview({ id: it.serverId, filename: it.filename, kind: it.kind as PreviewTarget["kind"], sourceLabel: roleLabel });
  }

  function persistOrder(list: UIItem[]) {
    const ids = list.filter((x) => x.serverId).map((x) => x.serverId as string);
    if (ids.length > 1) fetch("/api/v/check-upload", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ draftKey, orderedIds: ids }) }).catch(() => {});
  }
  function move(localId: string, dir: -1 | 1) {
    setItems((xs) => {
      const from = xs.findIndex((x) => x.localId === localId);
      const to = from + dir;
      if (from < 0 || to < 0 || to >= xs.length) return xs;
      const n = [...xs]; const [m] = n.splice(from, 1); n.splice(to, 0, m); persistOrder(n); return n;
    });
  }
  function onDropRow(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    setItems((xs) => {
      const from = xs.findIndex((x) => x.localId === dragId), to = xs.findIndex((x) => x.localId === targetId);
      if (from < 0 || to < 0) return xs;
      const n = [...xs]; const [m] = n.splice(from, 1); n.splice(to, 0, m); persistOrder(n); return n;
    });
    setDragId(null);
  }

  const imageCount = items.filter((i) => i.kind === "image").length;
  const reorderable = imageCount > 1;
  let imgSeen = 0;
  return (
    <div>
      <div
        role="button" tabIndex={0} aria-label={`Add ${roleLabel.toLowerCase()} files`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) upload(Array.from(e.dataTransfer.files)); }}
        style={{ border: `1.5px dashed ${drag ? "var(--acc)" : "var(--line-2)"}`, background: drag ? "var(--acc-soft)" : "var(--bg-2)", borderRadius: "var(--r-sm)", padding: "14px 12px", textAlign: "center", cursor: "pointer", outline: "none" }}
      >
        <input ref={inputRef} type="file" multiple accept={ACCEPT_EXT.join(",")} style={{ display: "none" }} onChange={(e) => { if (e.target.files?.length) upload(Array.from(e.target.files)); e.target.value = ""; }} />
        <input ref={replaceRef} type="file" accept={ACCEPT_EXT.join(",")} style={{ display: "none" }} onChange={(e) => { const it = replacingRef.current; replacingRef.current = null; if (it && e.target.files?.[0]) upload([e.target.files[0]], it); e.target.value = ""; }} />
        <div style={{ fontSize: 12.5, color: "var(--fg-2)", fontWeight: 500 }}>Drop screenshots or files here, or <span style={{ color: "var(--acc-deep)" }}>choose files</span></div>
        <div style={{ fontSize: 11, color: "var(--fg-5)", marginTop: 3 }}>PNG, JPG, WEBP, PDF, TXT, MD · up to 20 MB each</div>
      </div>

      {items.length ? (
        <ul style={{ display: "grid", gap: 8, marginTop: 10, listStyle: "none", padding: 0, margin: "10px 0 0" }}>
          {items.map((it) => {
            const r = readiness(it.kind, it.status, it.error);
            const isImage = it.kind === "image";
            const shotNo = isImage ? ++imgSeen : 0;
            const canReorder = reorderable && isImage && it.status === "ready";
            const from = items.findIndex((x) => x.localId === it.localId);
            const label = isImage ? `Screenshot ${shotNo}` : it.filename;
            return (
              <li key={it.localId} data-testid="attachment-row" data-kind={it.kind} data-status={it.status}
                draggable={canReorder}
                onDragStart={() => canReorder && setDragId(it.localId)}
                onDragOver={(e) => { if (dragId) e.preventDefault(); }}
                onDrop={() => onDropRow(it.localId)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: "var(--r-sm)", border: `1px solid ${dragId === it.localId ? "var(--acc)" : "var(--line-1)"}`, background: "var(--bg-1)", opacity: it.status === "uploading" ? 0.75 : 1 }}>
                <div aria-hidden style={{ width: 40, height: 40, flex: "none", borderRadius: 7, overflow: "hidden", background: "var(--bg-2)", border: "1px solid var(--line-1)", display: "grid", placeItems: "center", cursor: canReorder ? "grab" : "default" }}>
                  {it.previewUrl ? <div style={{ width: "100%", height: "100%", backgroundImage: `url(${it.previewUrl})`, backgroundSize: "cover", backgroundPosition: "center" }} /> : <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-4)" }}>{KIND_ICON[it.kind || "text"] || "FILE"}</span>}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: "var(--fg-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={it.filename}>
                    {isImage ? <><span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-4)", marginRight: 6 }}>{label}</span>{it.filename}</> : it.filename}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-4)", marginTop: 1 }}>
                    {fmtSize(it.size)}{it.pageCount ? ` · ${it.pageCount} page${it.pageCount === 1 ? "" : "s"}` : ""} · <span style={{ color: toneColor(r.tone), fontWeight: r.tone === "err" ? 600 : 400 }}>{r.text}</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flex: "none", alignItems: "center" }}>
                  {canReorder ? (
                    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
                      <button type="button" onClick={() => move(it.localId, -1)} disabled={from === 0} aria-label={`Move ${label} up`} style={{ ...arrowBtn, opacity: from === 0 ? 0.4 : 1 }}>↑</button>
                      <button type="button" onClick={() => move(it.localId, 1)} disabled={from === items.length - 1} aria-label={`Move ${label} down`} style={{ ...arrowBtn, opacity: from === items.length - 1 ? 0.4 : 1 }}>↓</button>
                    </span>
                  ) : null}
                  {it.status === "ready" ? <button type="button" onClick={() => openPreview(it)} aria-label={`Preview ${label}`} style={miniBtn}>Preview</button> : null}
                  {it.status === "ready" ? <button type="button" onClick={() => startReplace(it)} aria-label={`Replace ${label}`} style={miniBtn}>Replace</button> : null}
                  {it.status === "failed" ? <button type="button" onClick={() => retry(it)} aria-label={`Retry ${it.filename}`} style={miniBtn}>Retry</button> : null}
                  <button type="button" onClick={() => removeItem(it)} aria-label={`Remove ${label}`} style={{ ...miniBtn, width: 26, padding: 0 }}>×</button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {preview ? <AttachmentPreview key={preview.id} target={preview} onClose={() => setPreview(null)} /> : null}
    </div>
  );
}

const miniBtn = { border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-3)", borderRadius: 6, fontSize: 11.5, padding: "3px 9px", cursor: "pointer", fontFamily: "inherit", height: 26 } as const;
const arrowBtn = { border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-3)", borderRadius: 4, fontSize: 9, lineHeight: 1, padding: 0, width: 18, height: 12, cursor: "pointer", display: "grid", placeItems: "center" } as const;
