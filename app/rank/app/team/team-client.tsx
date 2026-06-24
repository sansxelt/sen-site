"use client";

import { useEffect, useState } from "react";

type Role = "owner" | "admin" | "editor" | "viewer" | "client_viewer";
type Member = { id: string; user_id: string | null; email: string; role: Role; status: "pending" | "active" | "revoked"; created_at: string; invite_expires_at?: string | null };
type Shared = { workspace_id: string; name: string; role: Role; evaluations: { test_id: string; title: string; status: string }[] };
type SharedProject = { project_id: string; name: string; workspace_name: string; role: Role; evaluations: { test_id: string; title: string; status: string }[] };
type ProjRole = "editor" | "viewer" | "client_viewer";
type ProjectAccessSummary = { project_id: string; project_name: string; members: { email: string; role: ProjRole; status: string }[] };
type Workspace = { id: string; owner_user_id: string; name: string } | null;
type Ctx = { workspace: Workspace; myRole: Role; members: Member[]; shared: Shared[]; sharedProjects: SharedProject[]; projectAccess: ProjectAccessSummary[] };
type Interval = "monthly" | "yearly";
type Billing = { configured: boolean; yearlyConfigured: boolean; enforced: boolean; used: number; pendingPaid: number; limit: number | null; overLimit: boolean; status: string | null; periodEnd: string | null; hasSubscription: boolean; interval: Interval | null } | null;
type Pricing = { configured: boolean; yearlyConfigured: boolean; monthly: { amount: number; currency: string } | null; yearly: { amount: number; currency: string } | null };
type TransferInfo = { blocked: boolean; eligible: { id: string; email: string; role: Role }[]; workspaceName: string };

const INVITABLE: Role[] = ["admin", "editor", "viewer", "client_viewer"];
const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer" };
const ROLE_DESC: Record<Role, string> = {
  owner: "Full workspace control. Manages the team and owns billing.",
  admin: "Manage members and project access. See analytics and reports.",
  editor: "Create and edit evaluations and projects. See analytics and reports.",
  viewer: "Read-only workspace access to projects, evaluations, and reports.",
  client_viewer: "Client-safe reports only — no team, billing, API, or private internals.",
};
const PROJ_ROLE_LABEL: Record<ProjRole, string> = { editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer" };

function deliveryText(status: string, resend = false): string {
  if (status === "sent") return resend ? "Invite email re-sent with a fresh secure link." : "Invite saved and email sent.";
  if (status === "failed") return "Invite saved, but the email couldn't be sent. They can still sign in with the invited email to activate it.";
  return "Invite saved. Email delivery isn't connected yet — it activates when the recipient signs in with the invited email.";
}
function expiryLabel(iso?: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (t < Date.now()) return "expired";
  return "expires " + new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const cardHead = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "30px 0 12px" } as const;
const input = { padding: "10px 13px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" } as const;

function RolePill({ role }: { role: Role }) {
  const c = role === "owner" ? "var(--acc-deep)" : role === "client_viewer" ? "var(--fg-4)" : "var(--fg-2)";
  return <span className="pill" style={{ fontSize: 10.5, color: c, borderColor: "var(--line-2)" }}>{ROLE_LABEL[role]}</span>;
}

export function TeamClient({ email, initial, billing, transfer }: { email: string; initial: Ctx; billing: Billing; transfer: TransferInfo }) {
  const [ctx, setCtx] = useState<Ctx>(initial);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [tgt, setTgt] = useState(transfer.eligible[0]?.id ?? "");
  const [confirmName, setConfirmName] = useState("");
  const [tBusy, setTBusy] = useState(false);
  const [tMsg, setTMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [seatInterval, setSeatInterval] = useState<Interval>(billing?.interval ?? "monthly");
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const wsId = ctx.workspace?.id;

  const isOwner = ctx.workspace?.owner_user_id === email;
  const canManage = isOwner || ctx.myRole === "admin";

  useEffect(() => {
    if (isOwner && billing?.configured) fetch("/api/v/team/pricing").then((r) => r.json()).then(setPricing).catch(() => {});
  }, [isOwner, billing?.configured]);
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
      const r = await fetch("/api/v/workspace/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, workspace_id: wsId }) });
      const j = await r.json();
      if (j.ok) { setInviteEmail(""); setMsg({ kind: "ok", text: deliveryText(j.email) }); refresh(); }
      else setMsg({ kind: "err", text: j.error === "already_member" ? "That email is already a member." : j.error === "invalid_email" ? "Enter a valid email." : j.error === "forbidden" ? "You can't invite members." : j.error === "rate_limited" ? "You're sending invites too quickly — try again shortly." : j.error === "seat_limit" ? "You've reached your team seat limit. Add team seats below, or invite as Client viewer (free)." : "Couldn't create the invite." });
    } finally { setBusy(false); }
  }
  async function setRole(id: string, role: Role) { await fetch(`/api/v/workspace/members/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }); refresh(); }
  async function revoke(id: string) { await fetch(`/api/v/workspace/members/${id}`, { method: "DELETE" }); refresh(); }
  async function resend(id: string) { const r = await fetch(`/api/v/workspace/members/${id}/resend`, { method: "POST" }); const j = await r.json().catch(() => ({})); setMsg({ kind: j.ok && j.email !== "failed" ? "ok" : "err", text: j.ok ? deliveryText(j.email, true) : j.error === "rate_limited" ? "Too many resends for this invite — try again later." : "Couldn't resend the invite." }); refresh(); }
  async function teamBilling(path: string, interval?: Interval) {
    const r = await fetch(`/api/v/team/${path}`, { method: "POST", headers: interval ? { "Content-Type": "application/json" } : undefined, body: interval ? JSON.stringify({ interval }) : undefined });
    const j = await r.json().catch(() => ({}));
    if (j.url) window.location.href = j.url;
    else setMsg({ kind: "err", text: j.error === "not_configured" ? (interval === "yearly" ? "Annual team billing isn't configured yet." : "Team billing isn't configured yet.") : "Couldn't open billing. Try again." });
  }
  async function doTransfer() {
    if (!tgt || tBusy) return;
    setTBusy(true); setTMsg(null);
    try {
      const r = await fetch("/api/v/workspace/transfer-owner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: wsId, target_member_id: tgt, confirmation: confirmName }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) { setTMsg({ kind: "ok", text: "Ownership transferred. Refreshing…" }); setTimeout(() => window.location.reload(), 700); }
      else setTMsg({ kind: "err", text: j.error === "confirmation_mismatch" ? "Type the workspace name exactly to confirm." : j.error === "billing_active" ? "Blocked while team billing is active." : j.error === "target_not_eligible" ? "That member can't become owner." : j.error === "forbidden" ? "Only the current owner can transfer." : "Couldn't transfer ownership." });
    } finally { setTBusy(false); }
  }

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
      </div>

      {/* Team seats (owner only) */}
      {isOwner && billing && (() => {
        const sym = (c?: string) => (!c || c === "USD" ? "$" : c + " ");
        const money = (m: { amount: number; currency: string } | null | undefined) => (m ? `${sym(m.currency)}${Math.round(m.amount).toLocaleString()}` : null);
        const savings = pricing?.monthly && pricing?.yearly && pricing.monthly.amount > 0 ? Math.round((1 - pricing.yearly.amount / (pricing.monthly.amount * 12)) * 100) : null;
        const priceLabel = seatInterval === "yearly"
          ? (money(pricing?.yearly) ? `${money(pricing?.yearly)} / seat / year${savings && savings > 0 ? ` — save ${savings}%` : ""}` : null)
          : (money(pricing?.monthly) ? `${money(pricing?.monthly)} / seat / month` : null);
        return (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={cardHead}>Team seats</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>{billing.used} paid seat{billing.used === 1 ? "" : "s"} used{billing.limit != null ? ` of ${billing.limit}` : ""}</div>
              <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 3 }}>Admin, Editor, and Viewer are paid seats. <strong style={{ color: "var(--fg-2)" }}>Client viewers are free</strong> and can only access client-safe reports.</div>
            </div>
            {billing.status ? <span className="pill" style={{ fontSize: 10.5, color: "var(--acc-deep)" }}>{billing.status}</span> : null}
          </div>
          {billing.overLimit && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "10px 0 0", lineHeight: 1.5 }}>You&apos;re over your seat limit. Add seats to invite more internal collaborators, or change roles to Client viewer. Existing members keep their access.</p>}
          <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "10px 0 0", lineHeight: 1.6 }}>Pending invites don&apos;t count until accepted. Team seats are for additional internal collaborators; client viewers are always free.</p>

          {billing.configured && billing.hasSubscription && (
            <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "10px 0 0" }}>Billing interval: <strong style={{ color: "var(--fg-1)" }}>{billing.interval === "yearly" ? "Annual" : billing.interval === "monthly" ? "Monthly" : "—"}</strong>. Change your plan or interval from the billing portal.</p>
          )}

          {billing.configured && !billing.hasSubscription && (
            <div style={{ marginTop: 14 }}>
              <div className="seg" style={{ marginBottom: 8 }}>
                <button className={seatInterval === "monthly" ? "on" : ""} onClick={() => setSeatInterval("monthly")}>Monthly</button>
                <button className={seatInterval === "yearly" ? "on" : ""} disabled={!billing.yearlyConfigured} onClick={() => billing.yearlyConfigured && setSeatInterval("yearly")} style={{ opacity: billing.yearlyConfigured ? 1 : 0.45, cursor: billing.yearlyConfigured ? "pointer" : "not-allowed" }}>Annual{savings && savings > 0 ? ` · save ${savings}%` : ""}</button>
              </div>
              {!billing.yearlyConfigured && <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "0 0 6px" }}>Annual team billing is not configured yet.</p>}
              {priceLabel && <div style={{ fontSize: 13.5, color: "var(--fg-2)", fontWeight: 500 }}>{priceLabel}</div>}
              <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "6px 0 0", lineHeight: 1.6 }}>Save with annual team seats while keeping client viewers free.</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            {billing.configured ? (
              billing.hasSubscription
                ? <button onClick={() => teamBilling("portal")} className="btn">Manage team billing</button>
                : <button onClick={() => teamBilling("checkout", seatInterval)} className="btn">Add team seats — {seatInterval === "yearly" ? "Annual" : "Monthly"}</button>
            ) : <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>Team billing isn&apos;t configured yet — seat counts are informational. Client viewers are free.</span>}
          </div>
          {billing.periodEnd && billing.hasSubscription ? <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "10px 0 0" }}>Renews {new Date(billing.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p> : null}
        </div>
        );
      })()}

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
            <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "8px 0 0" }}>Invite links expire after 7 days; resending creates a new secure link. Invites also activate when the recipient signs in with the invited email.</p>
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
                <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>{m.email} <RolePill role={m.role} /> <span style={{ fontSize: 11.5, color: expiryLabel(m.invite_expires_at) === "expired" ? "var(--money)" : "var(--fg-5)" }}>· {expiryLabel(m.invite_expires_at) ?? "activates on sign-in"}</span></div>
                {canManage && <span style={{ display: "flex", gap: 6 }}><button onClick={() => resend(m.id)} className="btn btn--ghost" style={{ padding: "5px 10px", fontSize: 12 }}>Resend invite</button><button onClick={() => revoke(m.id)} className="btn btn--ghost" style={{ padding: "5px 10px", fontSize: 12 }}>Cancel</button></span>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Project access overview (owner/admin) */}
      {canManage && ctx.projectAccess.length > 0 && (
        <>
          <div style={cardHead}>Project access</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
            {ctx.projectAccess.map((p) => (
              <div key={p.project_id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>{p.project_name}</div>
                  <a href={`/app/projects/${p.project_id}`} style={{ fontSize: 12.5, color: "var(--acc-deep)", textDecoration: "none" }}>Manage project access →</a>
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {p.members.map((m, i) => (
                    <div key={m.email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "7px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, color: "var(--fg-2)" }}>{m.email}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="pill" style={{ fontSize: 10, color: "var(--fg-4)" }}>{PROJ_ROLE_LABEL[m.role]}</span>{m.status === "pending" ? <span style={{ fontSize: 11, color: "var(--fg-5)" }}>pending</span> : null}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Project-level shares */}
      {ctx.sharedProjects.length > 0 && (
        <>
          <div style={cardHead}>Projects shared with you</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
            {ctx.sharedProjects.map((p) => (
              <a key={p.project_id} href={`/app/shared/projects/${p.project_id}`} className="card" style={{ textDecoration: "none", color: "inherit", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 2 }}>{p.workspace_name} · {p.evaluations.length} report{p.evaluations.length === 1 ? "" : "s"} · project access</div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><RolePill role={p.role} /><span style={{ fontSize: 12.5, color: "var(--acc-deep)" }}>Open →</span></span>
              </a>
            ))}
          </div>
        </>
      )}

      {/* Shared with you (workspace-level) */}
      {ctx.shared.length > 0 && (
        <>
          <div style={cardHead}>Workspaces shared with you</div>
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

      {/* Transfer ownership (owner only) */}
      {isOwner && (
        <>
          <div style={{ ...cardHead, marginTop: 30 }}>Transfer ownership</div>
          <div className="card" style={{ borderColor: "var(--line-2)" }}>
            <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 12px", lineHeight: 1.6 }}>Transfer ownership of <strong style={{ color: "var(--fg-1)" }}>{transfer.workspaceName}</strong> to another active internal member. They become Owner; you become Admin. Billing, API keys, and client data are not exposed.</p>
            {transfer.blocked ? (
              <div style={{ fontSize: 12.5, color: "var(--money)", padding: "12px 14px", background: "var(--bg-2)", borderRadius: "var(--r-sm)", lineHeight: 1.6 }}>Ownership transfer is blocked while team billing is active. Billing ownership transfer is not supported yet — cancel or move billing before transferring workspace ownership.</div>
            ) : transfer.eligible.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>Invite an Admin, Editor, or Viewer and have them accept, then you can transfer ownership to them. Client viewers and pending invites aren&apos;t eligible.</p>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <select value={tgt} onChange={(e) => setTgt(e.target.value)} style={{ ...input, flex: "1 1 240px" } as React.CSSProperties}>{transfer.eligible.map((m) => <option key={m.id} value={m.id}>{m.email} ({ROLE_LABEL[m.role]})</option>)}</select>
                </div>
                <label style={{ display: "block" }}><span style={{ display: "block", fontSize: 12, color: "var(--fg-4)", marginBottom: 5 }}>Type the workspace name <strong style={{ color: "var(--fg-2)" }}>{transfer.workspaceName}</strong> to confirm</span><input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={transfer.workspaceName} style={{ ...input, width: "100%" }} /></label>
                <button onClick={doTransfer} disabled={tBusy || confirmName.trim() !== transfer.workspaceName.trim()} className="btn" style={{ marginTop: 12, opacity: tBusy || confirmName.trim() !== transfer.workspaceName.trim() ? 0.5 : 1 }}>{tBusy ? "Transferring…" : "Transfer ownership"}</button>
                {tMsg && <p style={{ fontSize: 12.5, color: tMsg.kind === "ok" ? "var(--acc-deep)" : "var(--money)", margin: "10px 0 0" }}>{tMsg.text}</p>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
