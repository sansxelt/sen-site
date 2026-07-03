"use client";

import { useState } from "react";
import Link from "next/link";

type OrgRole = "owner" | "admin" | "billing_admin" | "member" | "viewer";
type OrgMember = { id: string; email: string; role: OrgRole; status: "pending" | "active" | "revoked"; can_manage_billing: boolean };
type OrgDomain = { id: string; domain: string; status: "unverified" | "verified" | "rejected"; verified_at: string | null; last_checked_at?: string | null; last_check_status?: string | null; requires_reverification?: boolean };
type AuditEntry = { id: string; label: string; when: string; actor: string; context: string };
type Org = { id: string; name: string; owner_user_id: string; created_at: string };
type JoinMode = "disabled" | "request" | "auto_member";
type OrgJoinRequest = { id: string; email: string; requested_role: string; created_at: string };
type DomainAccessOption = { id: string; name: string; joinMode: JoinMode; requestStatus: "pending" | null };
type SsoType = "saml" | "oidc";
type SsoProviderSafe = { id: string; type: SsoType; status: "disabled" | "active" | "error"; domain: string; display_name: string | null; issuer: string | null; sso_url: string | null; certificate_fingerprint: string | null; metadata_url: string | null; client_id: string | null; oidc_discovery_url: string | null; hasSecret: boolean };
type SsoView = { providers: SsoProviderSafe[]; verifiedDomains: string[]; redirectUriBase: string; acsUrlBase: string; metadataUrlBase: string };
type Ctx = {
  organization: Org | null;
  myRole: OrgRole | null;
  canManage: boolean;
  isBillingAdmin: boolean;
  members: OrgMember[];
  domains: OrgDomain[];
  linkedWorkspaces: { id: string; name: string }[];
  linkableWorkspaces: { id: string; name: string }[];
  provisioning: { joinMode: JoinMode; defaultRole: "member" | "viewer" };
  joinRequests: OrgJoinRequest[];
};

const ROLE_LABEL: Record<OrgRole, string> = { owner: "Owner", admin: "Organization admin", billing_admin: "Account billing admin", member: "Member", viewer: "Viewer" };
const INVITABLE: OrgRole[] = ["admin", "billing_admin", "member", "viewer"];
const cardHead = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "30px 0 12px" } as const;
const input = { padding: "10px 13px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" } as const;
const when = (iso: string) => { const d = new Date(iso); const m = Math.round((Date.now() - d.getTime()) / 60000); if (m < 60) return `${Math.max(1, m)}m ago`; const h = Math.round(m / 60); return h < 24 ? `${h}h ago` : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); };

export function OrgClient({ email, ctx, activity, domainAccess = [], sso = null }: { email: string; ctx: Ctx; activity: AuditEntry[]; domainAccess?: DomainAccessOption[]; sso?: SsoView | null }) {
  const org = ctx.organization;
  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Account layer</p>
          <h1 className="display">Organization</h1>
          <p>Organizations let larger teams govern multiple workspaces, domains, members, billing admins, and audit trails from one account.</p>
        </div>
        {org ? <Link href="/app/audit" className="btn btn--ghost">Activity →</Link> : null}
      </div>
      {org ? <OrgView email={email} ctx={ctx} activity={activity} sso={sso} /> : domainAccess.length ? <JoinCard options={domainAccess} /> : <CreateOrg />}
    </div>
  );
}

// Shown to a signed-in user with NO org of their own whose email domain matches a verified org
// domain. Exposes ONLY the org name + a request/pending state — never members, workspaces, billing,
// or audit. Joining grants org membership only; workspace/project access is managed separately.
function JoinCard({ options }: { options: DomainAccessOption[] }) {
  const [state, setState] = useState<Record<string, "idle" | "busy" | "pending" | "joined">>(Object.fromEntries(options.map((o) => [o.id, o.requestStatus === "pending" ? "pending" : "idle"])));
  async function request(o: DomainAccessOption) {
    setState((s) => ({ ...s, [o.id]: "busy" }));
    const r = await fetch("/api/v/org/join", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request", organizationId: o.id }) });
    const j = await r.json().catch(() => ({}));
    if (j.ok && j.joined) { window.location.reload(); return; }
    setState((s) => ({ ...s, [o.id]: j.ok ? "pending" : "idle" }));
  }
  return (
    <>
      <div style={cardHead}>Verified domain access</div>
      {options.map((o) => {
        const st = state[o.id];
        return (
          <div key={o.id} className="card" style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17, marginBottom: 4 }}>You may belong to {o.name}</div>
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 14px", lineHeight: 1.6, maxWidth: 560 }}>Your email domain matches a verified organization domain. {o.joinMode === "auto_member" ? "You can join this organization as a member." : "Request access to join this organization — an admin approves before access is granted."} Joining the organization does not automatically grant access to every workspace; workspace and project permissions are managed separately.</p>
            {st === "pending" ? (
              <p style={{ fontSize: 13, color: "var(--fg-2)", margin: 0 }}>Your request is pending. An organization admin needs to approve it.</p>
            ) : (
              <button onClick={() => request(o)} disabled={st === "busy"} className="btn" style={{ opacity: st === "busy" ? 0.6 : 1 }}>{st === "busy" ? "…" : o.joinMode === "auto_member" ? "Join organization" : "Request access"}</button>
            )}
          </div>
        );
      })}
      <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "4px 0 0", lineHeight: 1.6 }}>Domain-based access maps you into the organization only. Workspace and project permissions are managed separately by your organization&apos;s admins.</p>
    </>
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

function OrgView({ email, ctx, activity, sso }: { email: string; ctx: Ctx; activity: AuditEntry[]; sso: SsoView | null }) {
  const org = ctx.organization!;
  const activeCount = ctx.members.filter((m) => m.status === "active").length;
  const [domains, setDomains] = useState<OrgDomain[]>(ctx.domains);
  // Freshly-minted TXT tokens (from add/regenerate), keyed by domain id — shown once until reload.
  const [tokens, setTokens] = useState<Record<string, { name: string; value: string }>>({});

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
    const r = await fetch("/api/v/org/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", domain }) });
    const j = await r.json().catch(() => ({}));
    if (j.ok) {
      setDomains((d) => [...d, { id: j.id, domain: j.domain, status: "unverified", verified_at: null }]);
      setTokens((t) => ({ ...t, [j.id]: { name: j.txtName, value: j.txtValue } }));
      setDomain("");
    } else setDErr(j.error === "already_added" ? "That domain is already added." : j.error === "invalid_domain" ? "Enter a valid domain (e.g. acme.com)." : "Couldn't add the domain. Try again.");
    setDBusy(false);
  }
  const onVerified = (id: string) => setDomains((ds) => ds.map((d) => (d.id === id ? { ...d, status: "verified" } : d)));
  const onToken = (id: string, tok: { name: string; value: string }) => setTokens((t) => ({ ...t, [id]: tok }));
  const onRemoved = (id: string) => { setDomains((ds) => ds.filter((d) => d.id !== id)); setTokens((t) => { const c = { ...t }; delete c[id]; return c; }); };
  const onHealth = (id: string, patch: Partial<OrgDomain>) => setDomains((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  // verified-domain provisioning settings
  const [joinMode, setJoinMode] = useState<JoinMode>(ctx.provisioning.joinMode);
  const [defaultRole, setDefaultRole] = useState<"member" | "viewer">(ctx.provisioning.defaultRole);
  const [sBusy, setSBusy] = useState(false);
  const [sMsg, setSMsg] = useState("");
  async function saveProvisioning() {
    setSBusy(true); setSMsg("");
    const r = await fetch("/api/v/org/provisioning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ joinMode, defaultRole }) });
    setSBusy(false); setSMsg((await r.json().catch(() => ({}))).ok ? "Saved." : "Couldn't save. Try again.");
  }
  // domain access requests (admin)
  const [requests, setRequests] = useState<OrgJoinRequest[]>(ctx.joinRequests);
  async function decide(id: string, action: "approve" | "reject") {
    const r = await fetch("/api/v/org/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, requestId: id }) });
    if ((await r.json().catch(() => ({}))).ok) setRequests((rs) => rs.filter((x) => x.id !== id));
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
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 14px", lineHeight: 1.6 }}>Verify a domain to prepare your organization for future SSO and automated provisioning. Adding a domain does not auto-add users yet.</p>
        {domains.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: domains.length ? 16 : 0 }}>
            {domains.map((d) => (
              <DomainRow key={d.id} d={d} token={tokens[d.id]} canManage={ctx.canManage} onVerified={onVerified} onToken={onToken} onRemoved={onRemoved} onHealth={onHealth} />
            ))}
          </div>
        )}
        {ctx.canManage && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: domains.length ? 14 : 0, borderTop: domains.length ? "1px solid var(--line-1)" : "none" }}>
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" onKeyDown={(e) => { if (e.key === "Enter" && !dBusy) addDomain(); }} style={{ ...input, flex: "1 1 220px" }} />
            <button onClick={addDomain} disabled={dBusy} className="btn" style={{ opacity: dBusy ? 0.6 : 1 }}>{dBusy ? "Adding…" : "Add domain"}</button>
          </div>
        )}
        {dErr && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "10px 0 0" }}>{dErr}</p>}
      </div>

      {/* Verified domain access (provisioning) */}
      <div style={cardHead}>Verified domain access</div>
      <div className="card">
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 14px", lineHeight: 1.6 }}>People who sign in with a verified company domain can request access to this organization. {joinMode === "auto_member" ? "Auto-join is on: " : "Admins approve requests before access is granted."}{joinMode === "auto_member" ? "anyone who signs in with a verified domain email can join as a member. Workspace and project access still require separate permissions." : ""} Joining never grants workspace, project, billing, or API access — those are managed separately. Domain-based access depends on verified domain ownership; if verification becomes stale, new joins are paused for that domain until it is re-checked.</p>
        {ctx.canManage ? (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <select value={joinMode} onChange={(e) => setJoinMode(e.target.value as JoinMode)} style={input as React.CSSProperties}>
                <option value="disabled">Disabled — no domain access</option>
                <option value="request">Request — admin approves</option>
                <option value="auto_member">Auto-join as member</option>
              </select>
              <select value={defaultRole} onChange={(e) => setDefaultRole(e.target.value as "member" | "viewer")} style={input as React.CSSProperties}>
                <option value="member">Default role: Member</option>
                <option value="viewer">Default role: Viewer</option>
              </select>
              <button onClick={saveProvisioning} disabled={sBusy} className="btn" style={{ opacity: sBusy ? 0.6 : 1 }}>{sBusy ? "Saving…" : "Save"}</button>
              {sMsg && <span style={{ fontSize: 12.5, color: "var(--fg-3)" }}>{sMsg}</span>}
            </div>
            {requests.length > 0 && (
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--line-1)" }}>
                <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 10 }}>Domain access requests</div>
                {requests.map((r, i) => (
                  <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, color: "var(--fg-1)" }}>{r.email}</div>
                      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 2 }}>Requested {ROLE_LABEL[(r.requested_role as OrgRole)] ?? r.requested_role} · {when(r.created_at)}</div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => decide(r.id, "approve")} className="btn" style={{ padding: "5px 12px", fontSize: 12.5 }}>Approve</button>
                      <button onClick={() => decide(r.id, "reject")} className="btn btn--ghost" style={{ padding: "5px 12px", fontSize: 12.5, color: "var(--money)" }}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {requests.length === 0 && <p style={{ fontSize: 12, color: "var(--fg-5)", margin: "12px 0 0" }}>No pending domain access requests.</p>}
          </>
        ) : (
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>Domain access is managed by organization admins.</p>
        )}
      </div>

      {/* Enterprise SSO */}
      {ctx.canManage && sso && <SsoCard sso={sso} pausedDomains={domains.filter((d) => d.requires_reverification).map((d) => d.domain)} />}

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
            <p style={{ fontSize: 11, color: "var(--fg-5)", margin: "12px 0 0", lineHeight: 1.6 }}>Organization-wide audit export is planned. This shows account-level governance events; per-workspace activity stays in each workspace&apos;s <Link href="/app/audit" style={{ color: "var(--acc-deep)" }}>Activity</Link> log.</p>
          </div>
        </>
      )}

      {/* Enterprise / SSO readiness */}
      <div style={cardHead}>Enterprise readiness</div>
      <div className="card" style={{ background: "var(--bg-2)" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>OIDC SSO is available · SCIM is not enabled yet</div>
        <p style={{ fontSize: 13, color: "var(--fg-3)", margin: 0, lineHeight: 1.7 }}>OIDC single sign-on can be configured above for any verified domain. SAML configuration is a scaffold (assertion sign-in coming later), and SCIM provisioning is not enabled yet. SSO authenticates users into the organization only — workspace and project access stay separate. <Link href="/contact" style={{ color: "var(--acc-deep)" }}>Contact us for enterprise SSO requirements →</Link></p>
      </div>
    </>
  );
}

function DomainRow({ d, token, canManage, onVerified, onToken, onRemoved, onHealth }: {
  d: OrgDomain;
  token?: { name: string; value: string };
  canManage: boolean;
  onVerified: (id: string) => void;
  onToken: (id: string, tok: { name: string; value: string }) => void;
  onRemoved: (id: string) => void;
  onHealth: (id: string, patch: Partial<OrgDomain>) => void;
}) {
  const [busy, setBusy] = useState<"" | "verify" | "regen" | "remove" | "recheck">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err" | "info"; text: string } | null>(null);
  const verified = d.status === "verified";

  async function call(action: string) {
    return (await fetch("/api/v/org/domains", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, domainId: d.id }) }).then((r) => r.json()).catch(() => ({}))) as { ok?: boolean; verified?: boolean; reason?: string; error?: string; txtName?: string; txtValue?: string; status?: string; requiresReverification?: boolean };
  }
  async function recheck() {
    setBusy("recheck"); setMsg(null);
    const j = await call("recheck");
    setBusy("");
    if (j.ok) {
      onHealth(d.id, { last_check_status: j.status ?? null, requires_reverification: !!j.requiresReverification, last_checked_at: new Date().toISOString() });
      setMsg(j.status === "ok" ? { kind: "ok", text: "Domain re-verified — the DNS TXT record is present." } : { kind: "err", text: "Vraelis could not confirm the DNS TXT record. Restore the record and re-check DNS to keep SSO and automatic provisioning active for new users." });
    } else setMsg({ kind: "err", text: "Couldn't re-check DNS. Try again." });
  }
  async function verify() {
    setBusy("verify"); setMsg(null);
    const j = await call("verify");
    setBusy("");
    if (j.ok && j.verified) { onVerified(d.id); setMsg({ kind: "ok", text: "Domain verified. This organization is now prepared for future SSO and automated provisioning." }); }
    else if (j.ok && !j.verified) setMsg({ kind: "info", text: "TXT record not found yet. DNS changes can take a few minutes to propagate." });
    else setMsg({ kind: "err", text: j.error === "no_token" ? "Regenerate a token first." : "Couldn't check DNS. Try again." });
  }
  async function regen() {
    setBusy("regen"); setMsg(null);
    const j = await call("regenerate");
    setBusy("");
    if (j.ok && j.txtName && j.txtValue) { onToken(d.id, { name: j.txtName, value: j.txtValue }); setMsg({ kind: "info", text: "New TXT token generated — copy it now. The previous token no longer works." }); }
    else setMsg({ kind: "err", text: j.error === "already_verified" ? "This domain is already verified." : "Couldn't regenerate the token. Try again." });
  }
  async function remove() {
    setBusy("remove");
    const j = await call("remove");
    if (j.ok) { onRemoved(d.id); return; }
    setBusy(""); setMsg({ kind: "err", text: "Couldn't remove the domain. Try again." });
  }

  return (
    <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", padding: "13px 15px", background: "var(--bg-1)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--font-code)", fontSize: 13.5, color: "var(--fg-1)", fontWeight: 600 }}>{d.domain}</span>
        <span className="pill" style={{ fontSize: 10, color: verified ? "var(--acc-deep)" : "var(--fg-4)" }}>{verified ? "Verified" : "Unverified"}</span>
      </div>

      {!verified && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--fg-5)", marginBottom: 5 }}>DNS TXT record</div>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-2)", wordBreak: "break-all", lineHeight: 1.7 }}>
            Name: {token?.name ?? `_vraelis-challenge.${d.domain}`}<br />
            Value: {token ? token.value : <span style={{ color: "var(--fg-5)" }}>Token hidden for security. Regenerate a new token if you lost it.</span>}
          </div>
          {token && <p style={{ fontSize: 10.5, color: "var(--fg-5)", margin: "6px 0 0" }}>Shown once — copy it now.</p>}
        </div>
      )}
      {verified && (() => {
        const reverif = d.requires_reverification === true;
        const ls = d.last_check_status;
        const healthLabel = reverif ? "Needs attention" : ls === "missing_txt" ? "TXT record missing" : ls === "dns_error" || ls === "timeout" ? "Could not check DNS" : ls === "mismatch" ? "Record mismatch" : "Healthy";
        const healthBad = reverif || (!!ls && ls !== "ok");
        return (
          <div style={{ marginTop: 8 }}>
            <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>{reverif ? "Verified — but Vraelis could not confirm the DNS TXT record on recent checks." : "Domain verified and recently checked. SSO and provisioning rules can use this domain."}</p>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 5, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span className="pill" style={{ fontSize: 9.5, color: healthBad ? "var(--money)" : "var(--acc-deep)" }}>{healthLabel}</span>
              {d.last_checked_at ? <span>Last checked {when(d.last_checked_at)}</span> : <span>Not checked yet</span>}
            </div>
            {reverif && <p style={{ fontSize: 11.5, color: "var(--money)", margin: "6px 0 0", lineHeight: 1.6 }}>SSO and automatic provisioning are paused for NEW users on this domain until it is re-checked. Existing members keep access.</p>}
          </div>
        );
      })()}

      {canManage && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {!verified && <button onClick={verify} disabled={!!busy} className="btn" style={{ padding: "6px 13px", fontSize: 12.5, opacity: busy ? 0.6 : 1 }}>{busy === "verify" ? "Checking DNS…" : "Verify DNS"}</button>}
          {!verified && <button onClick={regen} disabled={!!busy} className="btn btn--ghost" style={{ padding: "6px 13px", fontSize: 12.5 }}>{busy === "regen" ? "…" : "Regenerate token"}</button>}
          {verified && <button onClick={recheck} disabled={!!busy} className="btn" style={{ padding: "6px 13px", fontSize: 12.5, opacity: busy ? 0.6 : 1 }}>{busy === "recheck" ? "Re-checking…" : "Re-check DNS"}</button>}
          <button onClick={remove} disabled={!!busy} className="btn btn--ghost" style={{ padding: "6px 13px", fontSize: 12.5, color: "var(--money)" }}>{busy === "remove" ? "…" : "Remove"}</button>
        </div>
      )}
      {!verified && canManage && <p style={{ fontSize: 10.5, color: "var(--fg-5)", margin: "8px 0 0", lineHeight: 1.6 }}>Regenerate only if you lost the original DNS value — it invalidates the previous token.</p>}
      {msg && <p style={{ fontSize: 12, color: msg.kind === "ok" ? "var(--acc-deep)" : msg.kind === "err" ? "var(--money)" : "var(--fg-3)", margin: "10px 0 0", lineHeight: 1.6 }}>{msg.text}</p>}
    </div>
  );
}

function SsoCard({ sso, pausedDomains = [] }: { sso: SsoView; pausedDomains?: string[] }) {
  const paused = new Set(pausedDomains);
  const [type, setType] = useState<SsoType>("oidc");
  const [domain, setDomain] = useState(sso.verifiedDomains[0] ?? "");
  const [displayName, setDisplayName] = useState("");
  const [discoveryUrl, setDiscoveryUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [issuer, setIssuer] = useState("");
  const [ssoUrl, setSsoUrl] = useState("");
  const [cert, setCert] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const hasDomain = sso.verifiedDomains.length > 0;

  async function call(body: Record<string, unknown>) {
    return fetch("/api/v/sso/providers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json()).catch(() => ({ error: "network" }));
  }
  async function save() {
    if (!domain) { setMsg({ kind: "err", text: "Select a verified domain." }); return; }
    setBusy(true); setMsg(null);
    const j = await call({ action: "save", provider: { type, domain, displayName, oidcDiscoveryUrl: discoveryUrl, clientId, clientSecret, issuer, ssoUrl: ssoUrl, certificateFingerprint: cert } });
    setBusy(false);
    if (j.ok) { window.location.reload(); return; }
    setMsg({ kind: "err", text: j.error === "domain_not_verified" ? "That domain isn't verified." : j.error === "invalid_discovery_url" ? "Enter a valid OIDC discovery URL (https)." : "Couldn't save the provider." });
  }
  async function act(action: string, providerId: string) {
    const j = await call({ action, providerId });
    if (j.ok) { window.location.reload(); return; }
    setMsg({ kind: "err", text: j.error === "saml_not_enabled" ? "SAML assertion sign-in isn't enabled yet — use OIDC." : j.error === "incomplete_config" ? "Complete the OIDC config before enabling." : "Action failed." });
  }
  const lbl = { fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase" as const, color: "var(--fg-5)", display: "block", margin: "10px 0 4px" };

  return (
    <>
      <div style={cardHead}>Enterprise SSO</div>
      <div className="card">
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "0 0 14px", lineHeight: 1.6 }}>Configure SSO for verified organization domains. Users who authenticate through your identity provider are mapped into the organization according to your provisioning settings. <strong style={{ color: "var(--fg-2)" }}>SSO authenticates users into the organization. Workspace and project permissions remain separate.</strong></p>

        {sso.providers.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {sso.providers.map((p) => (
              <div key={p.id} style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", padding: "12px 14px", background: "var(--bg-1)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{p.type.toUpperCase()} · {p.domain}</span>
                  <span className="pill" style={{ fontSize: 10, color: p.status === "active" ? "var(--acc-deep)" : "var(--fg-4)" }}>{p.status === "active" ? "Active" : p.status === "error" ? "Error" : "Disabled"}</span>
                </div>
                {paused.has(p.domain) && <p style={{ fontSize: 11.5, color: "var(--money)", margin: "8px 0 0", lineHeight: 1.6 }}>SSO for this domain is paused for new sign-ins until domain ownership is re-confirmed. Re-check DNS for this domain above to restore it.</p>}
                {p.type === "oidc" ? (
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 6, wordBreak: "break-all", lineHeight: 1.7 }}>Redirect URI: {sso.redirectUriBase}/{p.id}/callback<br />Client ID: {p.client_id ?? "—"} · Secret: {p.hasSecret ? "stored ✓" : "missing"}</div>
                ) : (
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 6, wordBreak: "break-all", lineHeight: 1.7 }}>SP metadata: {sso.metadataUrlBase}/{p.id}/metadata<br /><span style={{ color: "var(--fg-5)" }}>SAML assertion sign-in is a configuration scaffold — not enabled in this version.</span></div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  {p.status !== "active" ? <button onClick={() => act("enable", p.id)} className="btn" style={{ padding: "5px 12px", fontSize: 12 }} disabled={p.type === "saml"}>Enable</button> : <button onClick={() => act("disable", p.id)} className="btn btn--ghost" style={{ padding: "5px 12px", fontSize: 12 }}>Disable</button>}
                  <button onClick={() => act("delete", p.id)} className="btn btn--ghost" style={{ padding: "5px 12px", fontSize: 12, color: "var(--money)" }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasDomain ? (
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>Add and verify a domain above before configuring SSO.</p>
        ) : (
          <div style={{ paddingTop: sso.providers.length ? 14 : 0, borderTop: sso.providers.length ? "1px solid var(--line-1)" : "none" }}>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 8 }}>Add or update a provider</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={type} onChange={(e) => setType(e.target.value as SsoType)} style={input as React.CSSProperties}>
                <option value="oidc">OIDC (live)</option>
                <option value="saml">SAML (scaffold)</option>
              </select>
              <select value={domain} onChange={(e) => setDomain(e.target.value)} style={input as React.CSSProperties}>
                {sso.verifiedDomains.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name (optional)" style={{ ...input, flex: "1 1 180px" }} />
            </div>
            {type === "oidc" ? (
              <>
                <label style={lbl}>OIDC discovery URL</label>
                <input value={discoveryUrl} onChange={(e) => setDiscoveryUrl(e.target.value)} placeholder="https://idp.example.com/.well-known/openid-configuration" style={{ ...input, width: "100%", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="Client ID" style={{ ...input, flex: "1 1 200px" }} />
                  <input value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder="Client secret (write-only)" type="password" style={{ ...input, flex: "1 1 200px" }} />
                </div>
              </>
            ) : (
              <>
                <label style={lbl}>IdP issuer / entity ID</label>
                <input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="https://idp.example.com/saml/metadata" style={{ ...input, width: "100%", boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  <input value={ssoUrl} onChange={(e) => setSsoUrl(e.target.value)} placeholder="IdP SSO URL" style={{ ...input, flex: "1 1 200px" }} />
                  <input value={cert} onChange={(e) => setCert(e.target.value)} placeholder="Certificate fingerprint (SHA-256)" style={{ ...input, flex: "1 1 200px" }} />
                </div>
              </>
            )}
            <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={save} disabled={busy} className="btn" style={{ opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save provider"}</button>
              <span style={{ fontSize: 11.5, color: "var(--fg-5)" }}>Saving keeps the provider disabled until you enable it. Set domain access to request or auto-join for SSO users to be provisioned.</span>
            </div>
          </div>
        )}
        {msg && <p style={{ fontSize: 12.5, color: msg.kind === "ok" ? "var(--acc-deep)" : "var(--money)", margin: "12px 0 0" }}>{msg.text}</p>}
      </div>
    </>
  );
}
