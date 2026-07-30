"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Ic, I } from "@/app/rank/_components/icons";

type Role = "owner" | "admin" | "editor" | "viewer" | "client_viewer";
type Member = { id: string; user_id: string | null; email: string; role: Role; status: "pending" | "active" | "revoked"; created_at: string; invite_expires_at?: string | null; can_manage_billing?: boolean };
type Shared = { workspace_id: string; name: string; role: Role; evaluations: { test_id: string; title: string; status: string }[] };
type SharedProject = { project_id: string; name: string; workspace_name: string; role: Role; evaluations: { test_id: string; title: string; status: string }[] };
type ProjRole = "editor" | "viewer" | "client_viewer";
type ProjectAccessSummary = { project_id: string; project_name: string; members: { email: string; role: ProjRole; status: string }[] };
type Workspace = { id: string; owner_user_id: string; name: string } | null;
type Ctx = { workspace: Workspace; myRole: Role; members: Member[]; shared: Shared[]; sharedProjects: SharedProject[]; projectAccess: ProjectAccessSummary[] };
type Interval = "monthly" | "yearly";
type Billing = { configured: boolean; yearlyConfigured: boolean; enforced: boolean; used: number; pendingPaid: number; limit: number | null; overLimit: boolean; status: string | null; periodEnd: string | null; hasSubscription: boolean; interval: Interval | null; billingOwnerIsCurrentOwner: boolean } | null;

// Calm, normalized billing status labels (shared shape with /billing).
const BILLING_STATUS: Record<string, string> = { active: "Active", trialing: "Trialing", past_due: "Payment issue", incomplete: "Setup incomplete", incomplete_expired: "Setup incomplete", unpaid: "Payment required", canceled: "Canceled", paused: "Paused" };
const statusLabel = (s: string | null) => (s ? BILLING_STATUS[s] ?? "Active" : "Not active");
type Pricing = { configured: boolean; yearlyConfigured: boolean; monthly: { amount: number; currency: string } | null; yearly: { amount: number; currency: string } | null };
type TransferInfo = { blocked: boolean; eligible: { id: string; email: string; role: Role }[]; workspaceName: string; pending: { id: string; status: string; toEmail: string } | null; incoming: { id: string; status: string; workspaceName: string } | null };

const INVITABLE: Role[] = ["admin", "editor", "viewer", "client_viewer"];
const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer" };
const ROLE_DESC: Record<Role, string> = {
  owner: "Full workspace control. Manages the team and owns billing.",
  admin: "Manage members and system access. See analytics and reports.",
  editor: "Author contracts and flows, and launch verifications. See analytics and reports.",
  viewer: "Read-only workspace access to systems, verifications, and reports.",
  client_viewer: "Client-safe reports only, no team, billing, API, or private internals.",
};
const PROJ_ROLE_LABEL: Record<ProjRole, string> = { editor: "Editor", viewer: "Viewer", client_viewer: "Client viewer" };

function deliveryText(status: string, resend = false): string {
  if (status === "sent") return resend ? "Invite email re-sent with a fresh secure link." : "Invite saved and email sent.";
  if (status === "failed") return "Invite saved, but the email couldn't be sent. They can still sign in with the invited email to activate it.";
  return "Invite saved. Email delivery isn't connected yet, it activates when the recipient signs in with the invited email.";
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

export function TeamClient({ email, initial, billing, transfer, orgLink }: { email: string; initial: Ctx; billing: Billing; transfer: TransferInfo; orgLink?: { id: string; name: string } | null }) {
  const [ctx, setCtx] = useState<Ctx>(initial);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("viewer");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [tgt, setTgt] = useState(transfer.eligible[0]?.id ?? "");
  const [confirmName, setConfirmName] = useState("");
  const [tBusy, setTBusy] = useState(false);
  const [tMsg, setTMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [aBusy, setABusy] = useState(false);
  const [aMsg, setAMsg] = useState<string | null>(null);
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
      else setMsg({ kind: "err", text: j.error === "already_member" ? "That email is already a member." : j.error === "invalid_email" ? "Enter a valid email." : j.error === "forbidden" ? "You can't invite members." : j.error === "rate_limited" ? "You're sending invites too quickly, try again shortly." : j.error === "seat_limit" ? "You've reached your team seat limit. Add team seats below, or invite as Client viewer (free)." : "Couldn't create the invite." });
    } finally { setBusy(false); }
  }
  async function setRole(id: string, role: Role) { await fetch(`/api/v/workspace/members/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) }); refresh(); }
  async function toggleBillingAdmin(id: string, value: boolean) {
    const r = await fetch(`/api/v/workspace/members/${id}/billing-admin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ value }) });
    const j = await r.json().catch(() => ({}));
    if (j.ok) { setMsg({ kind: "ok", text: value ? "Billing admin granted." : "Billing admin removed." }); refresh(); }
    else setMsg({ kind: "err", text: j.error === "not_eligible" ? "Only active Admins, Editors, or Viewers can be billing admins." : j.error === "forbidden" ? "Only the workspace owner can change billing admins." : "Couldn't update billing admin." });
  }
  async function revoke(id: string) { await fetch(`/api/v/workspace/members/${id}`, { method: "DELETE" }); refresh(); }
  async function resend(id: string) { const r = await fetch(`/api/v/workspace/members/${id}/resend`, { method: "POST" }); const j = await r.json().catch(() => ({})); setMsg({ kind: j.ok && j.email !== "failed" ? "ok" : "err", text: j.ok ? deliveryText(j.email, true) : j.error === "rate_limited" ? "Too many resends for this invite, try again later." : "Couldn't resend the invite." }); refresh(); }
  async function teamBilling(path: string, body?: Record<string, string>) {
    const r = await fetch(`/api/v/team/${path}`, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (j.url) window.location.href = j.url;
    else setMsg({ kind: "err", text: j.error === "not_configured" ? (body?.interval === "yearly" ? "Annual team billing isn't configured yet." : "Team billing isn't configured yet.") : "Couldn't open billing. Try again." });
  }
  async function doTransfer() {
    if (!tgt || tBusy) return;
    setTBusy(true); setTMsg(null);
    try {
      const r = await fetch("/api/v/workspace/transfer-owner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspace_id: wsId, target_member_id: tgt, confirmation: confirmName }) });
      const j = await r.json().catch(() => ({}));
      if (j.ok) { setTMsg({ kind: "ok", text: j.pending ? "Transfer requested, waiting for the new owner to set up billing. Refreshing…" : "Ownership transferred. Refreshing…" }); setTimeout(() => window.location.reload(), 800); }
      else setTMsg({ kind: "err", text: j.error === "confirmation_mismatch" ? "Type the workspace name exactly to confirm." : j.error === "transfer_pending" ? "A transfer is already pending for this workspace." : j.error === "target_not_eligible" ? "That member can't become owner." : j.error === "forbidden" ? "Only the current owner can transfer." : "Couldn't transfer ownership." });
    } finally { setTBusy(false); }
  }
  async function acceptIncoming() {
    if (!transfer.incoming || aBusy) return;
    setABusy(true); setAMsg(null);
    const r = await fetch(`/api/v/workspace/ownership-transfer/${transfer.incoming.id}/accept`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    if (j.url) { window.location.href = j.url; return; }
    setABusy(false);
    setAMsg(j.error === "not_configured" ? "Team billing isn't configured yet." : j.error === "expired" ? "This transfer request has expired." : j.error === "not_eligible" ? "You're no longer eligible to accept this transfer." : "Couldn't start billing setup. Try again.");
  }
  async function cancelOutgoing() {
    if (!transfer.pending) return;
    await fetch(`/api/v/workspace/ownership-transfer/${transfer.pending.id}/cancel`, { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Workspace</p>
          <h1 className="display">Team</h1>
          <p>Run verifications with your team and share client-ready reports, without exposing private controls.</p>
        </div>
        <Link href="/activity" className="btn btn--ghost">Workspace activity →</Link>
      </div>

      <div className="card" style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16 }}>{ctx.workspace?.name ?? "Your workspace"}</div>
          <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 2 }}>{active.length} member{active.length === 1 ? "" : "s"} | You are {ROLE_LABEL[ctx.myRole]}</div>
        </div>
      </div>

      {/* Governance / enterprise readiness */}
      <div className="card" style={{ marginBottom: 18, background: "var(--bg-2)" }}>
        <div style={cardHead}>Built for governed production verification</div>
        <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "8px 18px" }}>
          {/* "Client-safe report sharing" removed: a client VIEWER ROLE exists, but sending a report by
              link to someone with no account does not. Same false claim was on /enterprise. */}
          {["Role-based workspace access", "Client viewer role", "Workspace activity log", "Billing admin separation", "Secure, expiring invite links", "Project-level access control", "Signed webhooks & API keys", "Ownership transfer with audit"].map((g) => (
            <li key={g} style={{ fontSize: 13, color: "var(--fg-2)", display: "flex", gap: 8, alignItems: "center" }}><span aria-hidden style={{ display: "inline-flex", color: "var(--acc-deep)", flex: "none" }}><Ic d={I.check} size={12} sw={2.4} /></span>{g}</li>
          ))}
        </ul>
        <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "14px 0 0", lineHeight: 1.6 }}>SSO and enterprise provisioning are planned for larger organizations. <Link href="/contact" style={{ color: "var(--acc-deep)" }}>Contact us for enterprise SSO requirements →</Link></p>
      </div>

      {/* Organization (account layer) */}
      <div className="card" style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>Organization</div>
          <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "3px 0 0", lineHeight: 1.6 }}>{orgLink ? <>This workspace is part of <strong style={{ color: "var(--fg-2)" }}>{orgLink.name}</strong>.</> : "Govern multiple workspaces, domains, and billing admins from one account layer."}</p>
        </div>
        <Link href="/organization" className="btn btn--ghost">{orgLink ? "Open organization →" : "Set up organization →"}</Link>
      </div>

      {/* Incoming ownership transfer (you are the target) */}
      {transfer.incoming && (
        <div className="card" style={{ marginBottom: 18, borderColor: "var(--acc-line-2)", background: "var(--acc-soft)" }}>
          <div style={cardHead}>Ownership transfer</div>
          <p style={{ fontSize: 14.5, color: "var(--fg-1)", margin: "0 0 6px", fontWeight: 600 }}>You&apos;ve been asked to become owner of {transfer.incoming.workspaceName}.</p>
          <p style={{ fontSize: 13, color: "var(--fg-3)", margin: "0 0 12px", lineHeight: 1.6 }}>To accept, set up team billing for this workspace. Your subscription takes over once active, and the previous owner&apos;s subscription is then canceled. Client viewers stay free.</p>
          <button onClick={acceptIncoming} disabled={aBusy} className="btn" style={{ opacity: aBusy ? 0.6 : 1 }}>{aBusy ? "Starting…" : "Accept ownership and set up billing"}</button>
          {aMsg && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "10px 0 0" }}>{aMsg}</p>}
        </div>
      )}

      {/* Team seats (owner only) */}
      {isOwner && billing && (() => {
        const sym = (c?: string) => (!c || c === "USD" ? "$" : c + " ");
        const money = (m: { amount: number; currency: string } | null | undefined) => (m ? `${sym(m.currency)}${Math.round(m.amount).toLocaleString()}` : null);
        const savings = pricing?.monthly && pricing?.yearly && pricing.monthly.amount > 0 ? Math.round((1 - pricing.yearly.amount / (pricing.monthly.amount * 12)) * 100) : null;
        const priceLabel = seatInterval === "yearly"
          ? (money(pricing?.yearly) ? `${money(pricing?.yearly)} / seat / year${savings && savings > 0 ? `, save ${savings}%` : ""}` : null)
          : (money(pricing?.monthly) ? `${money(pricing?.monthly)} / seat / month` : null);
        return (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={cardHead}>Team seats</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>{billing.used} paid seat{billing.used === 1 ? "" : "s"} used{billing.limit != null ? ` of ${billing.limit}` : ""}</div>
              <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 3 }}>Admin, Editor, and Viewer are paid seats. <strong style={{ color: "var(--fg-2)" }}>Client viewers are free</strong> and can only access client-safe reports.</div>
            </div>
            {(billing.hasSubscription || billing.status) ? <span className="pill" style={{ fontSize: 10.5, color: billing.status === "past_due" || billing.status === "unpaid" ? "var(--money)" : "var(--acc-deep)" }}>{statusLabel(billing.status)}</span> : null}
          </div>
          {billing.overLimit && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "10px 0 0", lineHeight: 1.5 }}>You&apos;re over your seat limit. Add seats to invite more internal collaborators, or change roles to Client viewer. Existing members keep their access.</p>}
          {(billing.status === "past_due" || billing.status === "unpaid") && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "10px 0 0", lineHeight: 1.5 }}>Use Manage team billing to update your payment method.</p>}
          <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "10px 0 0", lineHeight: 1.6 }}>Pending invites don&apos;t count until accepted. Team seats are for additional internal collaborators; client viewers are always free.</p>

          {billing.configured && billing.hasSubscription && (
            <p style={{ fontSize: 12, color: "var(--fg-3)", margin: "10px 0 0" }}>Billing interval: <strong style={{ color: "var(--fg-1)" }}>{billing.interval === "yearly" ? "Annual" : billing.interval === "monthly" ? "Monthly" : "-"}</strong> | {billing.billingOwnerIsCurrentOwner ? "You are the billing owner" : "Billing owner: current workspace owner"}. Change your plan, billing interval, or payment method in Manage team billing.</p>
          )}

          {billing.configured && !billing.hasSubscription && (
            <div style={{ marginTop: 14 }}>
              <div className="seg" style={{ marginBottom: 8 }}>
                <button className={seatInterval === "monthly" ? "on" : ""} onClick={() => setSeatInterval("monthly")}>Monthly</button>
                <button className={seatInterval === "yearly" ? "on" : ""} disabled={!billing.yearlyConfigured} onClick={() => billing.yearlyConfigured && setSeatInterval("yearly")} style={{ opacity: billing.yearlyConfigured ? 1 : 0.45, cursor: billing.yearlyConfigured ? "pointer" : "not-allowed" }}>Annual{savings && savings > 0 ? ` | save ${savings}%` : ""}</button>
              </div>
              {!billing.yearlyConfigured && <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "0 0 6px" }}>Annual team billing is not configured yet.</p>}
              {priceLabel && <div style={{ fontSize: 13.5, color: "var(--fg-2)", fontWeight: 500 }}>{priceLabel}</div>}
              <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "6px 0 0", lineHeight: 1.6 }}>Save with annual team seats while keeping client viewers free.</p>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12, alignItems: "center" }}>
            {billing.configured ? (
              billing.hasSubscription
                ? <>
                    <button onClick={() => teamBilling("portal")} className="btn">Manage team billing</button>
                    <button onClick={() => teamBilling("portal", { intent: "invoices" })} className="btn btn--ghost">View invoices</button>
                  </>
                : <button onClick={() => teamBilling("checkout", { interval: seatInterval })} className="btn">Add team seats, {seatInterval === "yearly" ? "Annual" : "Monthly"}</button>
            ) : <span style={{ fontSize: 12.5, color: "var(--fg-4)" }}>Team billing isn&apos;t configured yet, seat counts are informational. Client viewers are free.</span>}
          </div>
          {billing.periodEnd && billing.hasSubscription ? <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "10px 0 0" }}>Next renewal {new Date(billing.periodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p> : null}
          <p style={{ fontSize: 11, color: "var(--fg-5)", margin: "8px 0 0", lineHeight: 1.6 }}>Taxes and receipts are handled by Stripe. Your invoices are available in Manage team billing.</p>
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
              <div style={{ fontSize: 14, color: "var(--fg-1)", fontWeight: 500 }}>{m.email}{m.email === email ? " (you)" : ""}{m.can_manage_billing && m.role !== "owner" ? <span className="pill" style={{ fontSize: 9.5, marginLeft: 8, color: "var(--acc-deep)" }}>Billing admin</span> : null}</div>
              <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 2 }}>Joined {new Date(m.created_at).toLocaleDateString()}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {isOwner && m.status === "active" && (["admin", "editor", "viewer"] as Role[]).includes(m.role) && (
                <button onClick={() => toggleBillingAdmin(m.id, !m.can_manage_billing)} className="btn btn--ghost" style={{ padding: "6px 10px", fontSize: 12 }} title="Billing admins can view invoices and manage team billing, but cannot transfer ownership or access personal billing.">{m.can_manage_billing ? "Remove billing admin" : "Make billing admin"}</button>
              )}
              {m.role === "owner" || !canManage ? <RolePill role={m.role} /> : (
                <>
                  <select value={m.role} onChange={(e) => setRole(m.id, e.target.value as Role)} style={{ ...input, padding: "6px 10px", fontSize: 12.5 } as React.CSSProperties}>{INVITABLE.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
                  <button onClick={() => revoke(m.id)} className="btn btn--ghost" style={{ padding: "6px 11px", fontSize: 12.5, gap: 6 }}><Ic d={I.slash} size={12} sw={2.2} />Revoke</button>
                </>
              )}
            </div>
          </div>
        ))}
        {active.length === 1 && <div style={{ padding: "16px", fontSize: 13, color: "var(--fg-4)", borderTop: "1px solid var(--line-1)" }}>Your workspace is just you for now. Invite collaborators or clients to review your reports with you.</div>}
      </div>
      {isOwner && active.some((m) => (["admin", "editor", "viewer"] as Role[]).includes(m.role)) && (
        <p style={{ fontSize: 11.5, color: "var(--fg-5)", margin: "-8px 0 18px", lineHeight: 1.6 }}>Billing admins can view invoices and manage team billing, but cannot transfer ownership or access personal billing. Client viewers can never be billing admins.</p>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <>
          <div style={cardHead}>Pending invites</div>
          <div className="card" style={{ marginBottom: 18 }}>
            {pending.map((m, i) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
                <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>{m.email} <RolePill role={m.role} /> <span style={{ fontSize: 11.5, color: expiryLabel(m.invite_expires_at) === "expired" ? "var(--money)" : "var(--fg-5)" }}>| {expiryLabel(m.invite_expires_at) ?? "activates on sign-in"}</span></div>
                {canManage && <span style={{ display: "flex", gap: 6 }}><button onClick={() => resend(m.id)} className="btn btn--ghost" style={{ padding: "5px 10px", fontSize: 12 }}>Resend invite</button><button onClick={() => revoke(m.id)} className="btn btn--ghost" style={{ padding: "5px 10px", fontSize: 12 }}>Cancel</button></span>}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Program access overview (owner/admin) */}
      {canManage && ctx.projectAccess.length > 0 && (
        <>
          <div style={cardHead}>Program access</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
            {ctx.projectAccess.map((p) => (
              <div key={p.project_id} className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>{p.project_name}</div>
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
              <div key={p.project_id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 2 }}>{p.workspace_name} | {p.evaluations.length} report{p.evaluations.length === 1 ? "" : "s"} | project access</div>
                </div>
                <RolePill role={p.role} />
              </div>
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
                      <div key={e.test_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", color: "var(--fg-1)" }}>
                        <span style={{ fontSize: 13.5 }}>{e.title}</span>
                        <span style={{ fontSize: 11.5, color: "var(--fg-4)" }}>{e.status}</span>
                      </div>
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
            {transfer.pending ? (
              <>
                <p style={{ fontSize: 13, color: "var(--fg-2)", margin: 0, lineHeight: 1.6 }}>Waiting for <strong style={{ color: "var(--fg-1)" }}>{transfer.pending.toEmail}</strong> to accept billing responsibility{transfer.pending.status === "awaiting_billing" ? " and finish billing setup" : ""}. Ownership transfers automatically once their team billing is active.</p>
                <button onClick={cancelOutgoing} className="btn btn--ghost" style={{ marginTop: 12 }}>Cancel transfer</button>
              </>
            ) : transfer.eligible.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--fg-4)", margin: 0 }}>Invite an Admin, Editor, or Viewer and have them accept, then you can transfer ownership to them. Client viewers and pending invites aren&apos;t eligible.</p>
            ) : (
              <>
                {transfer.blocked && <div style={{ fontSize: 12.5, color: "var(--fg-2)", padding: "12px 14px", background: "var(--bg-2)", borderRadius: "var(--r-sm)", lineHeight: 1.6, marginBottom: 12 }}>This workspace has active team billing. The new owner must accept billing responsibility before ownership can transfer, they&apos;ll set up their own team seats, then your subscription is canceled.</div>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                  <select value={tgt} onChange={(e) => setTgt(e.target.value)} style={{ ...input, flex: "1 1 240px" } as React.CSSProperties}>{transfer.eligible.map((m) => <option key={m.id} value={m.id}>{m.email} ({ROLE_LABEL[m.role]})</option>)}</select>
                </div>
                <label style={{ display: "block" }}><span style={{ display: "block", fontSize: 12, color: "var(--fg-4)", marginBottom: 5 }}>Type the workspace name <strong style={{ color: "var(--fg-2)" }}>{transfer.workspaceName}</strong> to confirm</span><input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={transfer.workspaceName} style={{ ...input, width: "100%" }} /></label>
                <button onClick={doTransfer} disabled={tBusy || confirmName.trim() !== transfer.workspaceName.trim()} className="btn" style={{ marginTop: 12, opacity: tBusy || confirmName.trim() !== transfer.workspaceName.trim() ? 0.5 : 1 }}>{tBusy ? (transfer.blocked ? "Requesting…" : "Transferring…") : (transfer.blocked ? "Request transfer" : "Transfer ownership")}</button>
                {tMsg && <p style={{ fontSize: 12.5, color: tMsg.kind === "ok" ? "var(--acc-deep)" : "var(--money)", margin: "10px 0 0" }}>{tMsg.text}</p>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
