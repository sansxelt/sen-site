"use client";

// Shared manual-connection metadata forms, extracted from the connect workspace so the connection
// management page reuses the SAME components (never duplicates): the validated GitHub form and the
// generic field-list form, plus the input/label styles they are drawn with. Metadata only — no field
// here ever accepts a secret, and the copy next to free text says so where it matters.

import { useState } from "react";

export const input = { width: "100%", padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box" as const };
export const lab = { fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: "var(--fg-4)", display: "block", marginBottom: 7 };
export const help = { fontSize: 12, color: "var(--fg-4)", margin: "6px 0 0", lineHeight: 1.5 };

export type Conn = Record<string, string>;

// busy: true while the caller's submit is in flight; the save button disables so a double-click can
// never fire two requests (the cause of duplicate creation and the misleading 409-after-success).
export function GithubForm({ value, onSave, saveLabel = "Save connection", busy = false }: { value: Conn | null; onSave: (v: Conn) => void; saveLabel?: string; busy?: boolean }) {
  const [repo, setRepo] = useState(value?.repo ?? "");
  const [branch, setBranch] = useState(value?.branch ?? "");
  const [commit, setCommit] = useState(value?.commit ?? "");
  const repoOk = /^[\w.-]+\/[\w.-]+$/.test(repo.trim());
  const commitOk = !commit.trim() || /^[0-9a-f]{7,40}$/i.test(commit.trim());
  const canSave = repoOk && commitOk && !busy;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div><label style={lab}>Repository (owner/name)</label><input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="acme/dashboard" style={input} />{repo && !repoOk ? <p style={{ ...help, color: "var(--err)" }}>Use the owner/name form, e.g. acme/dashboard.</p> : null}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><label style={lab}>Branch (optional)</label><input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="main" style={input} /></div>
        <div><label style={lab}>Commit SHA (optional)</label><input value={commit} onChange={(e) => setCommit(e.target.value)} placeholder="7-40 hex chars" style={input} />{commit && !commitOk ? <p style={{ ...help, color: "var(--err)" }}>A commit SHA is 7-40 hex characters.</p> : null}</div>
      </div>
      <p style={help}>Manual connection: metadata only. To authorize GitHub with a read-only token, use Connect GitHub on the system&apos;s Connections tab after setup.</p>
      <button type="button" className="btn" disabled={!canSave} style={{ justifySelf: "start", opacity: canSave ? 1 : 0.55 }}
        onClick={() => onSave({ repo: repo.trim(), ...(branch.trim() ? { branch: branch.trim() } : {}), ...(commit.trim() ? { commit: commit.trim().toLowerCase() } : {}) })}>{busy ? "Saving" : saveLabel}</button>
    </div>
  );
}

// Generic small metadata form for manual connections: [key, label, placeholder][].
export function TwoFieldForm({ fields, value, onSave, requiredKey, saveLabel = "Save connection", busy = false }: { fields: [string, string, string][]; value: Conn | null; onSave: (v: Conn) => void; requiredKey?: string; saveLabel?: string; busy?: boolean }) {
  const [vals, setVals] = useState<Conn>(() => {
    const init: Conn = {};
    for (const [k] of fields) init[k] = value?.[k] ?? "";
    return init;
  });
  // busy disables the save button while a submit is in flight (see GithubForm above).
  const ok = (!requiredKey || (vals[requiredKey] ?? "").trim().length > 0) && !busy;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {fields.map(([k, l, ph]) => (
        <div key={k}><label style={lab}>{l}</label><input value={vals[k] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [k]: e.target.value }))} placeholder={ph} style={input} maxLength={300} /></div>
      ))}
      <button type="button" className="btn" disabled={!ok} style={{ justifySelf: "start", opacity: ok ? 1 : 0.55 }}
        onClick={() => { const out: Conn = {}; for (const [k] of fields) { const v = (vals[k] ?? "").trim(); if (v) out[k] = v; } onSave(out); }}>{busy ? "Saving" : saveLabel}</button>
    </div>
  );
}
