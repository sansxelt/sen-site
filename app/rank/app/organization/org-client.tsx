"use client";

import { useState } from "react";

type OrgRole = "owner" | "admin" | "billing_admin" | "member" | "viewer";
type OrgMember = { id: string; email: string; role: OrgRole; status: "pending" | "active" | "revoked"; can_manage_billing: boolean };
type OrgDomain = { id: string; domain: string; status: "unverified" | "verified" | "rejected"; verified_at: string | null };
type AuditEntry = { id: string; label: string; when: string; actor: string; context: string };
type Org = { id: string; name: string; owner_user_id: string; created_at: string };
type Ctx = {
  organization: Org | null;
  myRole: OrgRole | null;
  canManage: boolean;
  isBillingAdmin: boolean;
  members: OrgMember[];
  domains: OrgDomain[];
  linkedWorkspaces: { id: string; name: string }[];
  linkableWorkspaces: { id: string; name: string }[];
};

const ROLE_LABEL: Record<OrgRole, string> = { owner: "Owner", admin: "Organization admin", billing_admin: "Account billing admin", member: "Member", viewer: "Viewer" };
const INVITABLE: OrgRole[] = ["admin", "billing_admin", "member", "viewer"];
const cardHead = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "30px 0 12px" } as const;
const input = { padding: "10px 13px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" } as const;
const when = (iso: string) => { const d = new Date(iso); const m = Math.round((Date.now() - d.getTime()) / 60000); if (m < 60) return `${Math.max(1, m)}m ago`; const h = Math.round(m / 60); return h < 24 ? `${h}h ago` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

export function OrgClient({ email, ctx, activity }: { email: string; ctx: Ctx; activity: AuditEntry[] }) {
  const org = ctx.organization;
  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Account layer</p>
          <h1 className="display">Organization</h1>
          <p>Organizations let larger teams govern multiple workspaces, domains, members, billing admins, and audit trails from one account.</p>
        </div>
        {org ? <a href="/app/audit" className="btn btn--ghost">Activity →</a> : null}
      </div>
      {org ? <OrgView email={email} ctx={ctx} activity={activity} /> : <CreateOrg />}
    </div>
  );
}

function CreateOrg() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function create() {
    if (!name.trim()) return;
    setBusy(true); setErr("");
    const r = await fetch("/api/v/org/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const j = await r.json().catch(() => ({}));
    if (j.ok) { window.location.reload(); return; }
    setBusy(false); setErr(j.error === "already_exists" ? "You already have an organization." : "Couldn't create the organization. Try again.");
  }
  return (
    <div className="card">
      <div style={cardHead}>Create an organization</div>
      <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: "0 0 14px", lineHeight: 1.6, maxWidth: 560 }}>Organizations help larger teams govern multiple workspaces, domains, billing admins, and audit trails. SSO and provisioning can be added on top of this layer later. Creating one is optional — your workspaces keep working exactly as they do today.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." onKeyDown={(e) => { if (e.key === "Enter" && !busy) create(); }} style={{ ...input, flex: "1 1 240px" }} />
        <button onClick={create} disabled={busy || !name.trim()} className="btn" style={{ opacity: busy || !name.trim() ? 0.6 : 1 }}>{busy ? "Creating…" : "Create organization"}</button>
      </div>
      {err && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "10px 0 0" }}>{err}</p>}
    </div>
  );
}

function OrgView({ email, ctx, activity }: { email: string; ctx: Ctx; activity: AuditEntry[] }) {
  const org = ctx.organization!;
  const activeCount = ctx.members.filter((m) => m.status === "active").length;
  const [domains, setDomains] = useState<OrgDomain[]>(ctx.domains);
  const [txt, setTxt] = useState<{ name: string; value: string } | null>(null);

  // members
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [mBusy, setMBusy] = useState(false);
  const [mMsg, setMMsg] = useState("");
  async function addMember() {
    if (!inviteEmail.trim()) return;
    setMBusy(true); setMMsg("");
    const r = await fetch("/api/v/org/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", email: inviteEmail, role: inviteRole }) });
    const j = await r.json().catch(() => ({}));
    if (j.ok) { window.location.reload(); return; }
    setMBusy(false); setMMsg(j.error === "already_member" ? "That email is already a member." : j.error === "invalid_email" ? "Enter a valid email." : "Couldn't add the member. Try again.");
  }
  async function revoke(id: string) {
    const r = await fetch("/api/v/org/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "revoke", memberId: id }) });
    if ((await r.json().catch(() => ({}))).ok) window.location.reload();
  }

  // workspace link
  const [linkWs, setLinkWs] = useState("");
  const [lBusy, setLBusy] = useState(false);
  async function link() {
    if (!linkWs) return;
    setLBusy(true);
    const r = await fetch("/api/v/org/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "link", workspaceId: linkWs }) });
    if ((await r.json().catch(() => ({}))).ok) { window.location.reload(); return; }
    setLBusy(false);
  }
  async function unlink(id: string) {
    const r = await fetch("/api/v/org/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unlink", workspaceId: id }) });
    if ((await r.json().catch(() => ({}))).ok) window.location.reload();
  }

  // domains
  const [domain, setDomain] = useState("");
  const [dBusy, setDBusy] = useState(false);
  const [dErr, setDErr] = useState("");
  async function addDomain() {
    if (!domain.trim()) return;
    setDBusy(true); setDErr("");
    const r = await fetch("/api/v/org/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ domain }) });
    const j = await r.json().catch(() => ({}));
    if (j.ok) {
      setDomains((d) => [...d, { id: j.domain, domain: j.domain, status: "unverified", verified_at: null }]);
      setTxt({ name: j.txtName, value: j.txtValue });
      setDomain("");
    } else setDErr(j.error === "already_added" ? "That domain is already added." : j.error === "invalid_domain" ? "Enter a valid domain (e.g. acme.com)." : "Couldn't add the domain. Try again.");
    setDBusy(false);
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18 }}>{org.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 3 }}>{activeCount} member{activeCount === 1 ? "" : "s"} · {ctx.linkedWorkspaces.length} linked workspace{ctx.linkedWorkspaces.length === 1 ? "" : "s"} · You are {ROLE_LABEL[ctx.myRole ?? "member"]}</div>
        </div>
        <span className="pill" style={{ fontSize: 10.5, color: "var(--acc-deep)" }}>{ctx.canManage ? "Manage" : "Read-only"}</span>
      </div>

      {/* Linked workspaces */}
      <div style={cardHead}>Linked workspaces</div>
      <div className="card">
        {ctx.linkedWorkspaces.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>No workspaces linked yet. Linking keeps billing workspace-level — it only groups workspaces under this organization for governance.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ctx.linkedWorkspaces.map((w) => (
              <div key={w.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{w.name}</span>
                {ctx.canManage ? <button onClick={() => unlink(w.id)} className="btn btn--ghost" style={{ padding: "5px 11px", fontSize: 12 }}>Unlink</button> : null}
              </div>
            ))}
          </div>
        )}
        {ctx.canManage && ctx.linkableWorkspaces.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-1)" }}>
            <select value={linkWs} onChange={(e) => setLinkWs(e.target.value)} style={{ ...input, flex: "1 1 220px" }}>
              <option value="">Link a workspace you own…</option>
              {ctx.linkableWorkspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <button onClick={link} disabled={lBusy || !linkWs} className="btn" style={{ opacity: lBusy || !linkWs ? 0.6 : 1 }}>{lBusy ? "Linking…" : "Link workspace"}</button>
          </div>
        )}
      </div>

      {/* Members */}
      <div style={cardHead}>Organization members</div>
      <div className="card">
        <div style={{ display: "flex", flexDirection: "column" }}>
          {ctx.members.filter((m) => m.status !== "revoked").map((m, i) => (
            <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, color: "var(--fg-1)" }}>{m.email}{m.email === email ? <span style={{ color: "var(--fg-5)" }}> (you)</span> : null}</div>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 2 }}>{m.status === "pending" ? "Pending · " : ""}{ROLE_LABEL[m.role]}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="pill" style={{ fontSize: 10, color: m.role === "owner" ? "var(--acc-deep)" : "var(--fg-4)" }}>{ROLE_LABEL[m.role]}</span>
                {ctx.canManage && m.role !== "owner" && m.email !== email ? <button onClick={() => revoke(m.id)} className="btn btn--ghost" style={{ padding: "4px 10px", fontSize: 11.5 }}>Revoke</button> : null}
              </div>
            </div>
          ))}
        </div>
        {ctx.canManage && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-1)" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="member@company.com" onKeyDown={(e) => { if (e.key === "Enter" && !mBusy) addMember(); }} style={{ ...input, flex: "1 1 220px" }} />
              <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as OrgRole)} style={input as React.CSSProperties}>{INVITABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
              <button onClick={addMember} disabled={mBusy} className="btn" style={{ opacity: mBusy ? 0.6 : 1 }}>{mBusy ? "Adding…" : "Add member"}</button>
            </div>
            {mMsg && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "8px 0 0" }}>{mMsg}</p>}
            <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "8px 0 0", lineHeight: 1.6 }}>Account billing admins can view account-level billing context but cannot open a workspace&apos;s payment portal without workspace billing permission.</p>
          </div>
        )}
      </div>

      {/* Domains */}
      <div style={cardHead}>Domains</div>
      <div className="card">
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 12px", lineHeight: 1.6 }}>Domain verification prepares this organization for future SSO and automated provisioning. Adding a domain does not auto-add users yet.</p>
        {domains.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {domains.map((d) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 13, color: "var(--fg-1)" }}>{d.domain}</span>
                <span className="pill" style={{ fontSize: 10, color: d.status === "verified" ? "var(--acc-deep)" : "var(--fg-4)" }}>{d.status === "verified" ? "Verified" : d.status === "rejected" ? "Rejected" : "Unverified"}</span>
              </div>
            ))}
          </div>
        )}
        {txt && (
          <div style={{ border: "1px solid var(--acc-line-2)", background: "var(--acc-soft)", borderRadius: "var(--r-sm)", padding: "12px 14px", marginBottom: 12 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Add this DNS TXT record to verify ownership</div>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-2)", wordBreak: "break-all" }}>Name: {txt.name}<br />Value: {txt.value}</div>
            <p style={{ fontSize: 11, color: "var(--fg-5)", margin: "8px 0 0", lineHeight: 1.6 }}>Shown once — copy it now. Verification is part of the SSO-readiness scaffold; it stays unverified until automated DNS checks ship.</p>
          </div>
        )}
        {ctx.canManage && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" onKeyDown={(e) => { if (e.key === "Enter" && !dBusy) addDomain(); }} style={{ ...input, flex: "1 1 220px" }} />
            <button onClick={addDomain} disabled={dBusy} className="btn" style={{ opacity: dBusy ? 0.6 : 1 }}>{dBusy ? "Adding…" : "Add domain"}</button>
          </div>
        )}
        {dErr && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "10px 0 0" }}>{dErr}</p>}
      </div>

      {/* Organization activity */}
      {ctx.canManage && (
        <>
          <div style={cardHead}>Organization activity</div>
          <div className="card">
            {activity.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>No organization governance activity yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {activity.map((e, i) => (
                  <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                    <div><span style={{ fontSize: 13.5, color: "var(--fg-1)" }}>{e.label}</span>{e.context ? <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)", marginLeft: 8 }}>{e.context}</span> : null}</div>
                    <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)" }}>{when(e.when)}</span>
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 11, color: "var(--fg-5)", margin: "12px 0 0", lineHeight: 1.6 }}>Organization-wide audit export is planned. This shows account-level governance events; per-workspace activity stays in each workspace&apos;s <a href="/app/audit" style={{ color: "var(--acc-deep)" }}>Activity</a> log.</p>
          </div>
        </>
      )}

      {/* Enterprise / SSO readiness */}
      <div style={cardHead}>Enterprise readiness</div>
      <div className="card" style={{ background: "var(--bg-2)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>SSO &amp; provisioning are not enabled yet</div>
        <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0, lineHeight: 1.7 }}>This organization layer prepares domain ownership, member governance, and audit trails for enterprise SSO. SSO and SCIM provisioning are planned for larger organizations and can be layered onto organizations later. <a href="mailto:nishanth.d1021@gmail.com?subject=Vraelis%20enterprise%20SSO" style={{ color: "var(--acc-deep)" }}>Contact us for enterprise SSO requirements →</a></p>
      </div>
    </>
  );
}
