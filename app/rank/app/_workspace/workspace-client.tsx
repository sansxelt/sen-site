"use client";

import { useState } from "react";

const inputStyle = { width: "100%", boxSizing: "border-box" as const, padding: "10px 13px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, fontFamily: "var(--font-sans)", outline: "none" };

// Create a project. Collapsed to a button until clicked; on success, jumps to the
// new project's page.
export function NewProjectForm({ label = "New project", primary = false }: { label?: string; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/v/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description: desc }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.id) { window.location.href = `/projects/${j.id}`; return; }
      setErr("Couldn't create the project. Try again.");
    } catch { setErr("Network error. Try again."); }
    finally { setBusy(false); }
  }

  if (!open) return <button onClick={() => setOpen(true)} className={primary ? "btn" : "btn btn--ghost"}>{label}</button>;
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 460 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>New decision program</div>
      <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="Program name, e.g. Summer campaign" maxLength={120} autoFocus />
      <textarea style={{ ...inputStyle, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What decision workflows this program covers (optional)" rows={2} maxLength={600} />
      {err && <p style={{ color: "var(--err)", fontSize: 13, margin: 0 }}>{err}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={submit} disabled={!name.trim() || busy} className="btn" style={{ opacity: name.trim() && !busy ? 1 : 0.55 }}>{busy ? "Creating…" : "Create program"}</button>
        <button onClick={() => setOpen(false)} className="btn btn--ghost">Cancel</button>
      </div>
    </div>
  );
}

// Inline edit of a project's name + description.
export function EditProjectForm({ id, name, description }: { id: string; name: string; description: string | null }) {
  const [open, setOpen] = useState(false);
  const [nm, setNm] = useState(name);
  const [desc, setDesc] = useState(description || "");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!nm.trim() || busy) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/v/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: nm, description: desc }) });
      if (r.ok) { window.location.reload(); return; }
    } catch { /* ignore */ }
    setBusy(false);
  }

  if (!open) return <button onClick={() => setOpen(true)} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>Edit</button>;
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12, maxWidth: 480 }}>
      <input style={inputStyle} value={nm} onChange={(e) => setNm(e.target.value)} maxLength={120} />
      <textarea style={{ ...inputStyle, resize: "vertical" }} value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={600} placeholder="Description (optional)" />
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} disabled={!nm.trim() || busy} className="btn">{busy ? "Saving…" : "Save"}</button>
        <button onClick={() => { setOpen(false); setNm(name); setDesc(description || ""); }} className="btn btn--ghost">Cancel</button>
      </div>
    </div>
  );
}

// Move an evaluation between projects (or out of one). Persists immediately.
export function MoveToProject({ testId, projectId, projects }: { testId: string; projectId: string | null; projects: { id: string; name: string }[] }) {
  const [val, setVal] = useState(projectId || "");
  const [busy, setBusy] = useState(false);
  async function change(next: string) {
    setVal(next); setBusy(true);
    try { await fetch("/api/v/projects/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId, projectId: next || null }) }); }
    catch { /* ignore */ }
    setBusy(false);
  }
  return (
    <select value={val} onChange={(e) => change(e.target.value)} disabled={busy} aria-label="Move to program"
      style={{ fontSize: 12, padding: "5px 8px", borderRadius: 8, border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-3)", maxWidth: 150, outline: "none" }}>
      <option value="">No program</option>
      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
    </select>
  );
}

// Copy a public report link (only rendered when sharing is enabled).
export function CopyReportLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url = `https://vraelis.com/r/${token}`;
  return (
    <button onClick={() => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {})}
      className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>{copied ? "Copied ✓" : "Copy public link"}</button>
  );
}
