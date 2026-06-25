"use client";

import { useEffect, useState } from "react";

type Billing = { configured: boolean; used: number; limit: number | null; overLimit: boolean; status: string | null; periodEnd: string | null; hasSubscription: boolean; interval: "monthly" | "yearly" | null; billingOwnerIsCurrentOwner: boolean };
type Invoice = { date: string; status: string; amountPaid: number; amountDue: number; currency: string; hostedUrl: string | null; pdfUrl: string | null; periodStart: string | null; periodEnd: string | null };

const BILLING_STATUS: Record<string, string> = { active: "Active", trialing: "Trialing", past_due: "Payment issue", incomplete: "Setup incomplete", incomplete_expired: "Setup incomplete", unpaid: "Payment required", canceled: "Canceled", paused: "Paused" };
const statusLabel = (s: string | null) => (s ? BILLING_STATUS[s] ?? "Active" : "Not active");
const INV_STATUS: Record<string, string> = { paid: "Paid", open: "Open", draft: "Draft", void: "Void", uncollectible: "Uncollectible" };
const money = (amt: number, cur: string) => `${cur === "USD" ? "$" : cur + " "}${amt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Owner / billing-admin team-seat transparency + native invoice list. The portal/invoice
// routes resolve the manageable workspace from the vws cookie, so no ids are passed here.
export function TeamBillingPanel({ workspaceName, billing, canManage = true }: { workspaceName: string; billing: Billing; canManage?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  useEffect(() => { if (billing.hasSubscription) fetch("/api/v/team/invoices").then((r) => (r.ok ? r.json() : { invoices: [] })).then((j) => setInvoices(j.invoices ?? [])).catch(() => setInvoices([])); }, [billing.hasSubscription]);
  async function open(path: string, body?: Record<string, string>) {
    setBusy(true); setErr(null);
    const r = await fetch(`/api/v/team/${path}`, { method: "POST", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (j.url) { window.location.href = j.url; return; }
    setBusy(false);
    setErr(j.error === "not_configured" ? "Team billing isn't configured yet." : j.error === "forbidden" ? "You don't have access to this workspace's billing." : "Couldn't open the billing portal. Try again.");
  }
  function openInvoice(inv: Invoice) {
    if (!inv.hostedUrl) return;
    fetch("/api/v/team/invoices", { method: "POST" }).catch(() => {}); // safe open event (no URL logged)
    window.open(inv.hostedUrl, "_blank", "noopener,noreferrer");
  }
  const payIssue = billing.status === "past_due" || billing.status === "unpaid";
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 17 }}>{workspaceName}</div>
          <div style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 3 }}>{billing.used} paid seat{billing.used === 1 ? "" : "s"}{billing.limit != null ? ` of ${billing.limit}` : ""} · Admin, Editor, Viewer are paid. <strong style={{ color: "var(--fg-2)" }}>Client viewers are free.</strong></div>
        </div>
        {(billing.hasSubscription || billing.status) ? <span className="pill" style={{ fontSize: 10.5, color: payIssue ? "var(--money)" : "var(--acc-deep)" }}>{statusLabel(billing.status)}</span> : null}
      </div>

      {!billing.configured ? (
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "12px 0 0" }}>Team billing isn&apos;t configured yet — seat counts are informational. Client viewers are free.</p>
      ) : billing.hasSubscription ? (
        <>
          <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: "12px 0 0", lineHeight: 1.6 }}>Interval: <strong style={{ color: "var(--fg-1)" }}>{billing.interval === "yearly" ? "Annual" : billing.interval === "monthly" ? "Monthly" : "—"}</strong>{billing.periodEnd ? ` · Next renewal ${new Date(billing.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}` : ""} · {billing.billingOwnerIsCurrentOwner ? "You are the billing owner" : "Billing owner: current workspace owner"}.</p>
          {billing.overLimit && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "8px 0 0" }}>You&apos;re over your seat limit. Existing members keep access.</p>}
          {payIssue && (
            <div style={{ border: "1px solid var(--money)", background: "color-mix(in srgb, var(--money) 7%, transparent)", borderRadius: "var(--r-sm)", padding: "11px 13px", margin: "12px 0 0" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--money)" }}>Payment needs attention</div>
              <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: "4px 0 0", lineHeight: 1.6 }}>Your last team-seat charge didn&apos;t go through. Members keep access for now, but seats can be suspended if it stays unpaid. Update your payment method to keep your team active.</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            <button onClick={() => open("portal")} disabled={busy} className="btn" style={{ opacity: busy ? 0.6 : 1 }}>{payIssue ? "Update payment method" : "Manage billing"}</button>
            <button onClick={() => open("portal", { intent: "invoices" })} disabled={busy} className="btn btn--ghost">Change billing details</button>
          </div>

          {/* Native invoice list */}
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", margin: "20px 0 8px" }}>Invoices</div>
          {invoices === null ? (
            <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>Loading invoices…</p>
          ) : invoices.length === 0 ? (
            <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: 0 }}>No invoices yet. They&apos;ll appear here after your first charge.</p>
          ) : (
            <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--bg-1)" }}>
              {invoices.map((inv, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 13px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 500 }}>{dateLabel(inv.date)} · {money(inv.status === "paid" ? inv.amountPaid : inv.amountDue, inv.currency)}</div>
                    <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, color: "var(--fg-4)", marginTop: 1 }}>{INV_STATUS[inv.status] ?? inv.status}{inv.periodStart && inv.periodEnd ? ` · ${dateLabel(inv.periodStart)}–${dateLabel(inv.periodEnd)}` : ""}</div>
                  </div>
                  {inv.hostedUrl ? <button onClick={() => openInvoice(inv)} className="btn btn--ghost" style={{ padding: "5px 11px", fontSize: 12 }}>View invoice</button> : null}
                </div>
              ))}
            </div>
          )}
        </>
      ) : canManage ? (
        <div style={{ marginTop: 14 }}>
          <a href="/app/team" className="btn">Set up team seats →</a>
        </div>
      ) : (
        <p style={{ fontSize: 12.5, color: "var(--fg-4)", margin: "12px 0 0" }}>Team billing hasn&apos;t been set up by the workspace owner yet.</p>
      )}
      {err && <p style={{ fontSize: 12.5, color: "var(--money)", margin: "10px 0 0" }}>{err}</p>}
      <p style={{ fontSize: 11, color: "var(--fg-5)", margin: "12px 0 0", lineHeight: 1.6 }}>Payments are securely processed by Stripe. Your billing overview — plan, seats, renewal, and invoices — stays here in Vraelis. The secure portal is used only to update your card, taxes, or billing details.</p>
    </div>
  );
}
