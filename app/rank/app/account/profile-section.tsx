"use client";

// Profile card: picture (upload / replace / remove against the private avatar bucket via
// /api/v/avatar), editable display name (v_profiles.display_name), read-only email, and two
// HONEST plain-text placeholders (timezone / notifications) — no fake toggles, no dead controls.
//
// The picture flow is square-cropped CLIENT-SIDE (drag to reposition + zoom, drawn to a 512px
// canvas) before upload, so the server only ever receives a small square image. The server
// re-validates everything (magic bytes, 2 MB) and stores it in a PRIVATE bucket; the client only
// ever sees short-TTL signed URLs. Topbar sync is a window event ("vraelis:avatar").

import { useEffect, useRef, useState } from "react";
import { Ic, I } from "../../_components/icons";

const MAX_BYTES = 2 * 1024 * 1024; // keep in sync with AVATAR_MAX_BYTES (server re-enforces)
const VIEW = 260;   // crop viewport (px)
const OUT = 512;    // exported square (px)

type Msg = { kind: "ok" | "err"; text: string } | null;

function announce(url: string | null) {
  try { window.dispatchEvent(new CustomEvent("vraelis:avatar", { detail: { url } })); } catch { /* non-fatal */ }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const encode = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

export function ProfileSection({ email, initialDisplayName, planBadge }: { email: string; initialDisplayName: string | null; planBadge: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  // display name
  const [name, setName] = useState(initialDisplayName ?? "");
  const [savedName, setSavedName] = useState(initialDisplayName ?? "");
  const [nameMsg, setNameMsg] = useState<Msg>(null);
  const [savingName, setSavingName] = useState(false);

  // crop editor
  const [editing, setEditing] = useState<{ src: string; w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/v/avatar").then((r) => (r.ok ? r.json() : null)).then((j) => { if (alive && j && typeof j.url === "string") setUrl(j.url); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  // Free the object URL when the editor closes or the component unmounts.
  useEffect(() => () => { if (editing) URL.revokeObjectURL(editing.src); }, [editing]);

  const scale = editing ? (VIEW / Math.min(editing.w, editing.h)) * zoom : 1;
  const clampOff = (x: number, y: number, s: number) =>
    editing ? { x: clamp(x, VIEW - editing.w * s, 0), y: clamp(y, VIEW - editing.h * s, 0) } : { x, y };

  function openFile(f: File) {
    setMsg(null);
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setMsg({ kind: "err", text: "Choose a JPEG, PNG, or WebP image." }); return; }
    if (f.size > 12 * 1024 * 1024) { setMsg({ kind: "err", text: "That image is too large to open. Pick one under 12 MB." }); return; }
    const src = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth < 8 || img.naturalHeight < 8) { URL.revokeObjectURL(src); setMsg({ kind: "err", text: "That image could not be read." }); return; }
      const s = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
      setZoom(1);
      setOff({ x: (VIEW - img.naturalWidth * s) / 2, y: (VIEW - img.naturalHeight * s) / 2 });
      setEditing({ src, w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => { URL.revokeObjectURL(src); setMsg({ kind: "err", text: "That image could not be read." }); };
    img.src = src;
  }

  function onZoom(z: number) {
    if (!editing) return;
    const sOld = (VIEW / Math.min(editing.w, editing.h)) * zoom;
    const sNew = (VIEW / Math.min(editing.w, editing.h)) * z;
    // keep the viewport center fixed while zooming
    const cx = (VIEW / 2 - off.x) / sOld;
    const cy = (VIEW / 2 - off.y) / sOld;
    setZoom(z);
    setOff(clampOff(VIEW / 2 - cx * sNew, VIEW / 2 - cy * sNew, sNew));
  }

  async function saveCrop() {
    if (!editing || !imgRef.current || busy) return;
    setBusy(true); setMsg(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUT; canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no_canvas");
      ctx.fillStyle = "#ffffff"; // flatten transparency so JPEG fallback renders identically
      ctx.fillRect(0, 0, OUT, OUT);
      const sx = -off.x / scale, sy = -off.y / scale, sw = VIEW / scale;
      ctx.drawImage(imgRef.current, sx, sy, sw, sw, 0, 0, OUT, OUT);

      // Prefer WebP; fall back to JPEG where the browser can't encode WebP. Step quality down
      // once if needed; a 512px square virtually never exceeds 2 MB.
      let blob = await encode(canvas, "image/webp", 0.85);
      if (!blob || blob.type !== "image/webp") blob = await encode(canvas, "image/jpeg", 0.9);
      if (blob && blob.size > MAX_BYTES) blob = await encode(canvas, blob.type, 0.7);
      if (!blob) throw new Error("encode_failed");
      if (blob.size > MAX_BYTES) { setMsg({ kind: "err", text: "The cropped image is still over 2 MB. Try a smaller source image." }); return; }

      const fd = new FormData();
      fd.append("file", blob, blob.type === "image/webp" ? "avatar.webp" : "avatar.jpg");
      const res = await fetch("/api/v/avatar", { method: "POST", body: fd });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setMsg({ kind: "err", text: j?.message || "Upload failed. Try again." }); return; }
      setUrl(j.url);
      announce(j.url);
      closeEditor();
      setMsg({ kind: "ok", text: "Profile picture updated." });
    } catch {
      setMsg({ kind: "err", text: "Could not process that image in this browser. Try a different file." });
    } finally {
      setBusy(false);
    }
  }

  function closeEditor() {
    setEditing(null); // the effect above revokes the object URL
    if (fileRef.current) fileRef.current.value = "";
  }

  async function removePicture() {
    if (busy) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/v/avatar", { method: "DELETE" });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setMsg({ kind: "err", text: j?.message || "Could not remove the picture. Try again." }); return; }
      setUrl(null);
      announce(null);
      setMsg({ kind: "ok", text: "Picture removed. Your initials are shown instead." });
    } finally {
      setBusy(false);
    }
  }

  async function saveName() {
    if (savingName) return;
    setSavingName(true); setNameMsg(null);
    try {
      const res = await fetch("/api/v/avatar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name }) });
      const j = await res.json().catch(() => null);
      if (!res.ok) { setNameMsg({ kind: "err", text: j?.message || "Could not save your name. Try again." }); return; }
      const saved = (j?.displayName as string | null) ?? "";
      setName(saved); setSavedName(saved);
      setNameMsg({ kind: "ok", text: saved ? "Name saved." : "Name cleared." });
    } finally {
      setSavingName(false);
    }
  }

  const initial = (savedName || email).slice(0, 1).toUpperCase();
  const label = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 6 } as const;
  const note = (m: Msg) => m && <div role="status" style={{ fontSize: 12.5, color: m.kind === "err" ? "var(--err)" : "var(--acc-deep)", marginTop: 6 }}>{m.text}</div>;

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", gap: 22, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* picture */}
        <div style={{ flex: "none" }}>
          <div style={label}>Profile picture</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="Your profile picture" width={72} height={72} style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--line-2)", flex: "none" }} />
            ) : (
              <span aria-hidden style={{ width: 72, height: 72, borderRadius: "50%", flex: "none", background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 28 }}>{initial}</span>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button className="btn btn--ghost" style={{ padding: "8px 13px", fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 7 }} disabled={busy || !!editing} onClick={() => fileRef.current?.click()}>
                <Ic d={I.camera} size={14} sw={2} />{url ? "Replace" : "Upload photo"}
              </button>
              {url && (
                <button className="btn btn--ghost" style={{ padding: "8px 13px", fontSize: 13.5, display: "inline-flex", alignItems: "center", gap: 7, color: "var(--err)" }} disabled={busy || !!editing} onClick={removePicture}>
                  <Ic d={I.trash} size={14} sw={2} />Remove
                </button>
              )}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 8, maxWidth: 240, lineHeight: 1.5 }}>JPEG, PNG, or WebP. Cropped to a square, 2 MB max. Only you can see it via a private link.</div>
          {note(msg)}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) openFile(f); }} />
        </div>

        {/* name + email */}
        <div style={{ flex: "1 1 260px", minWidth: 240 }}>
          <div style={label}>Display name</div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={name}
              onChange={(e) => { setName(e.target.value); setNameMsg(null); }}
              placeholder="How should we address you?"
              maxLength={60}
              aria-label="Display name"
              style={{ flex: "1 1 180px", minWidth: 160, padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line-2)", background: "var(--bg-1)", fontSize: 14, color: "var(--fg-1)", fontFamily: "inherit" }}
            />
            <button className="btn" style={{ padding: "9px 15px", fontSize: 13.5 }} disabled={savingName || name.trim() === savedName.trim()} onClick={saveName}>{savingName ? "Saving..." : "Save"}</button>
          </div>
          {note(nameMsg)}

          <div style={{ ...label, marginTop: 18 }}>Email</div>
          <div style={{ fontSize: 14.5, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>
          <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 3 }}>Your sign-in identity. It cannot be changed here.</div>

          <div style={{ marginTop: 18, borderTop: "1px solid var(--line-1)", paddingTop: 12 }}>
            <div style={{ fontSize: 13, color: "var(--fg-4)", lineHeight: 1.7 }}>Timezone and notification preferences aren&apos;t configurable yet.</div>
          </div>
        </div>

        <span className="badge-now" style={{ marginLeft: "auto", flex: "none" }}>{planBadge}</span>
      </div>

      {/* crop editor */}
      {editing && (
        <div style={{ marginTop: 18, borderTop: "1px solid var(--line-1)", paddingTop: 16 }}>
          <div style={label}>Position your photo</div>
          <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div
              style={{ width: VIEW, height: VIEW, borderRadius: 16, overflow: "hidden", position: "relative", border: "1px solid var(--line-2)", background: "var(--bg-2)", cursor: "grab", touchAction: "none", flex: "none" }}
              onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
                drag.current = { x: e.clientX, y: e.clientY };
                setOff((o) => clampOff(o.x + dx, o.y + dy, scale));
              }}
              onPointerUp={() => { drag.current = null; }}
              onPointerCancel={() => { drag.current = null; }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={editing.src}
                alt="Drag to reposition your photo"
                draggable={false}
                style={{ position: "absolute", left: 0, top: 0, width: editing.w * scale, height: editing.h * scale, maxWidth: "none", transform: `translate(${off.x}px, ${off.y}px)`, userSelect: "none", pointerEvents: "none" }}
              />
              <div aria-hidden style={{ position: "absolute", inset: 0, borderRadius: 16, boxShadow: "inset 0 0 0 2px rgba(255,255,255,0.65)", pointerEvents: "none" }} />
            </div>
            <div style={{ flex: "1 1 220px", minWidth: 200, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55 }}>Drag the photo to reposition it. Use the slider to zoom. The square is exactly what gets saved.</div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--fg-3)" }}>
                Zoom
                <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => onZoom(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--acc-deep)" }} aria-label="Zoom" />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" style={{ padding: "9px 16px", fontSize: 13.5 }} disabled={busy} onClick={saveCrop}>{busy ? "Saving..." : "Save picture"}</button>
                <button className="btn btn--ghost" style={{ padding: "9px 14px", fontSize: 13.5 }} disabled={busy} onClick={closeEditor}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
