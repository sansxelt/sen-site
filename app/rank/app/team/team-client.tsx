"use client";

import { useState } from "react";

type Role = "owner" | "admin" | "editor" | "viewer" | "client_viewer";
type Member = { id: string; user_id: string | null; email: string; role: Role; status: "pending" | "active" | "revoked"; created_at: string };
type Shared = { workspace_id: string; name: string; role: Role; evaluations: { test_id: string; title: string; status: string }[] };
type Workspace = { id: string; owner_user_id: string; name: string } | null;
type Ctx = { workspace: Workspace; myRole: Role; members: Member[]; shared: Shared[] };

const INVITABLE: Role[] = ["admin", "editor", "viewer", "client_viewer"];
const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer" };
const ROLE_DESC: Record<Role, string> = {
  owner: "Full access. Manages the team and owns billing.",
  admin: "Manage projects, evaluations, and members. See analytics and reports.",
  editor: "Create and manage projects and evaluations. See analytics and reports.",
  viewer: "Read-only access to projects, evaluations, and reports.",
  client_viewer: "Read-only access to shared decision reports only — no team, billing, API, or private internals.",
};

const cardHead = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "30px 0 12px" } as const;
const input = { padding: "10px 13px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" } as const;

function RolePill({ role }: { role: Role }) {
  const c = role === "owner" ? "var(--acc-deep)" : role === "client_viewer" ? "var(--fg-4)" : "var(--fg-2)";
  return <span className="pill" style={{ fontSize: 10.5, color: c, borderColor: "var(--line-2)" }}>{ROLE_LABEL[role]}</span>;
}

export function TeamClient({ email, initial }: { email: string; initial: Ctx }) {
  const [ctx, setCtx] = useState<Ctx>(initial);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const isOwner = ctx.workspace?.owner_user_id === email;
  const canManage = isOwner || ctx.myRole === "admin";
  const active = ctx.members.filter((m) => m.status === "active");
  const pending = ctx.members.filter((m) => m.status === "pending");

  async function refresh() {
    const r = await fetch("/api/v/workspace");
    if (r.ok) setCtx(await r.json());
  }
  async function invite() {
    if (!inviteEmail.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/v/workspace/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }) });
      const j = await r.json();
      if (j.ok) { setInviteEmail(""); setMsg({ kind: "ok", text: "Invite created. They get access when they sign in with this email." }); refresh(); }
      else setMsg({ kind: "err", text: j.error === "already_member" ? "That email is already a member." : j.error === "invalid_email" ? "Enter a valid email." : j.error === "forbidden" ? "You can't invite members." : "Couldn't create the invite." });
    } finally { setBusy(false); }
  }
  async function setRole(id: string, role: Role) { await fetch(`/api/v/workspace/members/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }); refresh(); }
  async function revoke(id: string) { await fetch(`/api/v/workspace/members/${id}`, { method: "DELETE" }); refresh(); }

  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="display">Team</h1>
          <p>Run evaluations with your team and share client-ready decision reports — without exposing private controls.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>{ctx.workspace?.name ?? "Your workspace"}</div>
          <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 2 }}>{active.length} member{active.length === 1 ? "" : "s"} · You are {ROLE_LABEL[ctx.myRole]}</div>
        </div>
        <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-4)" }}>Seat billing not enabled yet</span>
      </div>

      {/* Invite */}
      {canManage && (
        <>
          <div style={cardHead}>Invite a member or client</div>
          <div className="card" style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="teammate@company.com" onKeyDown={(e) => { if (e.key === "Enter" && !busy) invite(); }} style={{ ...input, flex: "1 1 240px" }} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Role)} style={input as React.CSSProperties}>{INVITABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
              <button onClick={invite} disabled={busy} className="btn" style={{ opacity: busy ? 0.6 : 1 }}>{busy ? "Inviting…" : "Invite"}</button>
            </div>
            <p style={{ fontSize: 12, color: "var(--fg-5)", margin: "10px 0 0", lineHeight: 1.55 }}>{ROLE_DESC[inviteRole]}</p>
            <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "8px 0 0" }}>Email delivery is not connected yet. The invite is stored as pending — share access manually and it activates automatically when they sign in with this email.</p>
            {msg && <p style={{ fontSize: 12.5, color: msg.kind === "ok" ? "var(--acc-deep)" : "var(--money)", margin: "10px 0 0" }}>{msg.text}</p>}
          </div>
        </>
      )}

      {/* Members */}
      <div style={cardHead}>Members</div>
      <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)", marginBottom: 18 }}>
        {active.map((m, i) => (
          <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "13px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 500 }}>{m.email}{m.email === email ? " (you)" : ""}</div>
              <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 2 }}>Joined {new Date(m.created_at).toLocaleDateString()}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {m.role === "owner" || !canManage ? <RolePill role={m.role} /> : (
                <>
                  <select value={m.role} onChange={(e) => setRole(m.id, e.target.value as Role)} style={{ ...input, padding: "6px 10px", fontSize: 12.5 } as React.CSSProperties}>{INVITABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
                  <button onClick={() => revoke(m.id)} className="btn btn--ghost" style={{ padding: "6px 11px", fontSize: 12.5 }}>Revoke</button>
                </>
              )}
            </div>
          </div>
        ))}
        {active.length === 1 && <div style={{ padding: "16px", fontSize: 13, color: "var(--fg-4)", borderTop: "1px solid var(--line-1)" }}>Your workspace is just you for now. Invite collaborators or clients to review decision reports with you.</div>}
      </div>

      {/* Pending */}
      {pending.length > 0 && (
        <>
          <div style={cardHead}>Pending invites</div>
          <div className="card" style={{ marginBottom: 18 }}>
            {pending.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>{m.email} <RolePill role={m.role} /> <span style={{ fontSize: 11.5, color: "var(--fg-5)" }}>· activates on sign-in</span></div>
                {canManage && <button onClick={() => revoke(m.id)} className="btn btn--ghost" style={{ padding: "5px 10px", fontSize: 12 }}>Cancel</button>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Shared with you */}
      {ctx.shared.length > 0 && (
        <>
          <div style={cardHead}>Shared with you</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
            {ctx.shared.map((w) => (
              <div key={w.workspace_id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: w.evaluations.length ? 10 : 0, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>{w.name}</div>
                  <RolePill role={w.role} />
                </div>
                {w.evaluations.length === 0 ? (
                  <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>You have access to selected reports shared with you. No reports here yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {w.evaluations.map((e, i) => (
                      <a key={e.test_id} href={`/app/shared/${e.test_id}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", textDecoration: "none", color: "var(--fg-1)" }}>
                        <span style={{ fontSize: 13.5 }}>{e.title}</span>
                        <span style={{ fontSize: 11.5, color: "var(--acc-deep)" }}>{e.status === "complete" ? "View report →" : e.status}</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Roles legend */}
      <div style={cardHead}>Roles</div>
      <div className="card" style={{ background: "var(--bg-2)" }}>
        {(["owner", "admin", "editor", "viewer", "client_viewer"] as Role[]).map((r, i) => (
          <div key={r} style={{ display: "flex", gap: 12, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", alignItems: "baseline" }}>
            <span style={{ minWidth: 104 }}><RolePill role={r} /></span>
            <span style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5 }}>{ROLE_DESC[r]}</span>
          </div>
        ))}
        <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "12px 0 0", lineHeight: 1.6 }}>Team seats are collaboration access, not paid seat billing. Billing stays with the workspace owner. Client viewers never see billing, API keys, webhooks, screening, source details, or collection-link management.</p>
      </div>
    </div>
  );
}
