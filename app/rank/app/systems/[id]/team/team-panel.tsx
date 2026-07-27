"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Member management for one application's team (owner/admin only — the server gates this; the panel only
// renders when canManage is true). Invite by email + role, change a member's role, remove a member. Every
// action calls the app-scoped, owner/admin-gated /api/preflight/apps/[id]/members route; the server
// re-verifies authority and enforces seat limits. Roles here mirror the workspace roles: admin can manage,
// editor can author + launch (spending the OWNER's credits), viewer/client_viewer are read-only.

type Member = { id: string; email: string; role: string; status: string; you: boolean };

// The roles an owner/admin may assign (owner is implicit and not assignable here).
const INVITE_ROLES: { value: string; label: string; blurb: string }[] = [
  { value: "admin", label: "Admin", blurb: "Manage the team, the contract, flows, and runs." },
  { value: "editor", label: "Editor", blurb: "Author the contract and flows, launch verifications." },
  { value: "viewer", label: "Viewer", blurb: "Read the contract, verifications, and reports." },
  { value: "client_viewer", label: "Client viewer", blurb: "Read shared reports only." },
];
const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer" };

const inputStyle = {
  padding: "9px 12px", fontSize: 13.5, color: "var(--fg-1)", background: "var(--bg-1)",
  border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", outline: "none",
} as const;

export function TeamPanel({ appId, initialMembers }: { appId: string; initialMembers: Member[] }) {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const base = `/api/preflight/apps/${encodeURIComponent(appId)}/members`;

  async function refresh() {
    try {
      const res = await fetch(base);
      if (!res.ok) return;
      const j = await res.json().catch(() => ({}));
      if (Array.isArray(j?.members)) setMembers(j.members as Member[]);
    } catch { /* keep the current list */ }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null); setNote(null);
    try {
      const res = await fetch(base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim(), role }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(typeof j?.message === "string" ? j.message : "Could not send the invite."); setBusy(false); return; }
      setNote(j?.email === "failed" ? "Invite recorded, but the email could not be sent. Share the invite link from your team owner if needed." : `Invited ${email.trim()} as ${ROLE_LABEL[role] ?? role}.`);
      setEmail("");
      await refresh();
    } catch { setErr("Network error. The invite was not sent."); }
    setBusy(false);
  }

  async function changeRole(memberId: string, newRole: string) {
    setErr(null); setNote(null);
    try {
      const res = await fetch(base, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId, role: newRole }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(typeof j?.message === "string" ? j.message : "Could not update the role."); return; }
      setMembers((ms) => ms.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)));
    } catch { setErr("Network error. The role was not changed."); }
  }

  async function remove(memberId: string, memberEmail: string) {
    if (!confirm(`Remove ${memberEmail} from this application's team?`)) return;
    setErr(null); setNote(null);
    try {
      const res = await fetch(`${base}?memberId=${encodeURIComponent(memberId)}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(typeof j?.message === "string" ? j.message : "Could not remove the member."); return; }
      setMembers((ms) => ms.filter((m) => m.id !== memberId));
    } catch { setErr("Network error. The member was not removed."); }
  }

  const headLbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };

  return (
    <div style={{ maxWidth: 720 }}>
      {/* Invite */}
      <div className="card" style={{ padding: "clamp(18px, 2.4vw, 24px)" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--fg-1)", margin: 0 }}>Invite a teammate</h2>
        <p style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.55, margin: "8px 0 16px" }}>
          They&apos;ll collaborate on this application&apos;s contract, flows, and reports. Runs they launch are
          billed to your account. Invites go out by email; they join the moment they sign in.
        </p>
        <form onSubmit={invite} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com" aria-label="Teammate email"
            style={{ ...inputStyle, flex: "1 1 240px", minWidth: 0 }}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role" style={{ ...inputStyle, flex: "0 0 auto", cursor: "pointer" }}>
            {INVITE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          <button type="submit" disabled={busy || !email.trim()} className="btn" style={{ flex: "0 0 auto", opacity: busy || !email.trim() ? 0.6 : 1 }}>
            {busy ? "Inviting…" : "Send invite"}
          </button>
        </form>
        <p style={{ fontSize: 12, color: "var(--fg-4)", lineHeight: 1.5, margin: "10px 0 0" }}>
          {INVITE_ROLES.find((r) => r.value === role)?.blurb}
        </p>
        {err ? <p role="alert" style={{ fontSize: 13, color: "var(--err)", margin: "10px 0 0" }}>{err}</p> : null}
        {note ? <p style={{ fontSize: 13, color: "var(--acc-deep)", margin: "10px 0 0" }}>{note}</p> : null}
      </div>

      {/* Roster */}
      <div style={{ marginTop: 22 }}>
        <div style={{ ...headLbl, marginBottom: 10 }}>Members ({members.length})</div>
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)" }}>
          {members.length === 0 ? (
            <div style={{ padding: "18px", fontSize: 13.5, color: "var(--fg-4)" }}>No members yet. Invite your first teammate above.</div>
          ) : members.map((m, i) => {
            const isOwner = m.role === "owner";
            return (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
                <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, color: "var(--fg-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}{m.you ? " (you)" : ""}</span>
                  {m.status === "pending" ? <span className="pill" style={{ fontSize: 9.5, color: "var(--fg-4)" }}>Pending</span> : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "0 0 auto" }}>
                  {isOwner || m.you ? (
                    <span className="pill" style={{ fontSize: 10.5, color: "var(--fg-4)" }}>{ROLE_LABEL[m.role] ?? m.role}</span>
                  ) : (
                    <>
                      <select value={m.role} onChange={(e) => changeRole(m.id, e.target.value)} aria-label={`Role for ${m.email}`} style={{ ...inputStyle, padding: "5px 8px", fontSize: 12.5, cursor: "pointer" }}>
                        {INVITE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                      <button type="button" onClick={() => remove(m.id, m.email)} className="btn btn--ghost" style={{ fontSize: 12, padding: "5px 10px", color: "var(--err)", borderColor: "var(--line-2)" }}>Remove</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 12, color: "var(--fg-5)", lineHeight: 1.6, margin: "12px 0 0" }}>
          Paid seats (admin, editor, viewer) count against your plan&apos;s seat limit; client viewers are free.
          The owner can&apos;t be changed here.
        </p>
      </div>
    </div>
  );
}
