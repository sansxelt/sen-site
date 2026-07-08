"use client";

import { useEffect, useState } from "react";

type Role = "editor" | "viewer" | "client_viewer";
type Member = { id: string; user_id: string | null; email: string; role: Role; status: "pending" | "active" | "revoked"; created_at: string; invite_expires_at?: string | null };

const ROLES: Role[] = ["editor", "viewer", "client_viewer"];
const ROLE_LABEL: Record<Role, string> = { editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer" };
const ROLE_DESC: Record<Role, string> = {
  editor: "Collaborate on this program, manage workflows, view decision records and readiness.",
  viewer: "View this program's workflows and decision records (read-only).",
  client_viewer: "Decision records and readiness only, no proprietary details or team access.",
};
const input = { padding: "10px 13px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" } as const;

function deliveryText(status: string, resend = false): string {
  if (status === "sent") return resend ? "Invite email re-sent with a fresh secure link." : "Invite saved and email sent.";
  if (status === "failed") return "Invite saved, but the email couldn't be sent. They can still sign in with the invited email.";
  return "Invite saved. Email delivery isn't connected yet, access activates when they sign in with the invited email.";
}
function expiryLabel(iso?: string | null): string | null {
  if (!iso) return null;
  if (new Date(iso).getTime() < Date.now()) return "expired";
  return "expires " + new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProjectAccess({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("client_viewer");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function load() {
    const r = await fetch(`/api/v/projects/${projectId}/members`);
    if (r.ok) { const j = await r.json(); setMembers(j.members || []); } else setMembers([]);
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function invite() {
    if (!email.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/v/projects/${projectId}/members`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), role }) });
      const j = await r.json();
      if (j.ok) { setEmail(""); setMsg({ kind: "ok", text: deliveryText(j.email) }); load(); }
      else setMsg({ kind: "err", text: j.error === "already_member" ? "That email already has access." : j.error === "invalid_email" ? "Enter a valid email." : j.error === "forbidden" ? "You can't manage access for this project." : j.error === "rate_limited" ? "You're sending invites too quickly, try again shortly." : "Couldn't create the invite." });
    } finally { setBusy(false); }
  }
  async function setMemberRole(id: string, r: Role) { await fetch(`/api/v/projects/${projectId}/members/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: r }) }); load(); }
  async function revoke(id: string) { await fetch(`/api/v/projects/${projectId}/members/${id}`, { method: "DELETE" }); load(); }
  async function resend(id: string) { const r = await fetch(`/api/v/projects/${projectId}/members/${id}/resend`, { method: "POST" }); const j = await r.json().catch(() => ({})); setMsg({ kind: j.ok && j.email !== "failed" ? "ok" : "err", text: j.ok ? deliveryText(j.email, true) : j.error === "rate_limited" ? "Too many resends for this invite, try again later." : "Couldn't resend the invite." }); load(); }

  if (members === null) return null; // not a manager / loading
  const activeM = members.filter((m) => m.status === "active");
  const pending = members.filter((m) => m.status === "pending");

  return (
    <div style={{ marginTop: 34 }}>
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Program access &amp; governance</div>
      <div className="card">
        <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 14px" }}>Invite clients or collaborators to this program, they see decision records and readiness, but not your full workspace or pricing.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@company.com" onKeyDown={(e) => { if (e.key === "Enter" && !busy) invite(); }} style={{ ...input, flex: "1 1 240px" }} />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} style={input as React.CSSProperties}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          <button onClick={invite} disabled={busy} className="btn" style={{ opacity: busy ? 0.6 : 1 }}>{busy ? "Inviting…" : "Invite"}</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--fg-5)", margin: "10px 0 0", lineHeight: 1.55 }}>{ROLE_DESC[role]}</p>
        <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "8px 0 0" }}>Invite links expire after 7 days; resending creates a new secure link. Invitees also gain access after signing in with the invited email.</p>
        {msg && <p style={{ fontSize: 12.5, color: msg.kind === "ok" ? "var(--acc-deep)" : "var(--money)", margin: "10px 0 0" }}>{msg.text}</p>}

        {activeM.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {activeM.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 0", borderTop: i === 0 ? "1px solid var(--line-1)" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13.5, color: "var(--fg-1)" }}>{m.email} <span className="pill" style={{ fontSize: 10, color: "var(--fg-4)" }}>{ROLE_LABEL[m.role]}</span></div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={m.role} onChange={(e) => setMemberRole(m.id, e.target.value as Role)} style={{ ...input, padding: "6px 10px", fontSize: 12.5 } as React.CSSProperties}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
                  <button onClick={() => revoke(m.id)} className="btn btn--ghost" style={{ padding: "6px 11px", fontSize: 12.5 }}>Revoke</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {pending.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {pending.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line-1)", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: "var(--fg-3)" }}>{m.email} <span className="pill" style={{ fontSize: 10, color: "var(--fg-4)" }}>{ROLE_LABEL[m.role]}</span> <span style={{ fontSize: 11.5, color: expiryLabel(m.invite_expires_at) === "expired" ? "var(--money)" : "var(--fg-5)" }}>| {expiryLabel(m.invite_expires_at) ?? "activates on sign-in"}</span></div>
                <span style={{ display: "flex", gap: 6 }}><button onClick={() => resend(m.id)} className="btn btn--ghost" style={{ padding: "5px 10px", fontSize: 12 }}>Resend invite</button><button onClick={() => revoke(m.id)} className="btn btn--ghost" style={{ padding: "5px 10px", fontSize: 12 }}>Cancel</button></span>
              </div>
            ))}
          </div>
        )}
        {activeM.length === 0 && pending.length === 0 && <p style={{ fontSize: 13, color: "var(--fg-4)", margin: "16px 0 0" }}>No program-specific members yet.</p>}
      </div>
    </div>
  );
}
