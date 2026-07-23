"use client";

import { useCallback, useEffect, useState } from "react";
import { I, EmptyIcon } from "@/app/rank/_components/icons";

type Audit = { id: string; user_id: string | null; test_id: string | null; event_type: string; actor_type: string; source: string | null; route: string | null; metadata: Record<string, unknown>; created_at: string };
type DReq = { id: string; user_id: string; request_type: string; status: string; message: string | null; admin_note: string | null; created_at: string };
const ACTORS = ["all", "owner", "admin", "api", "webhook", "system"] as const;
const DREQ_TYPE: Record<string, string> = { data_export: "Data export", data_correction: "Correction", account_deletion: "Account deletion", privacy_question: "Privacy question" };

export default function AdminPage() {
  const [forbidden, setForbidden] = useState(false);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [actor, setActor] = useState<string>("all");

  const loadAudit = useCallback(async () => {
    const r = await fetch(`/api/v/admin/audit${actor === "all" ? "" : `?actor_type=${actor}`}`);
    if (r.status === 403) { setForbidden(true); return; }
    if (r.ok) { const j = await r.json(); setAudit(j.events || []); }
  }, [actor]);

  const [dreqs, setDreqs] = useState<DReq[]>([]);
  const [dnote, setDnote] = useState<Record<string, string>>({});

  const loadDreqs = useCallback(async () => {
    const r = await fetch("/api/v/admin/data-requests");
    if (r.ok) setDreqs((await r.json()).requests || []);
  }, []);

  useEffect(() => { loadAudit(); }, [loadAudit]);
  useEffect(() => { loadDreqs(); }, [loadDreqs]);

  async function reqAction(id: string, body: object) {
    await fetch("/api/v/admin/data-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    loadDreqs();
  }

  if (forbidden) {
    return <div className="wrap" style={{ maxWidth: 640, paddingTop: 60 }}><h1 className="display" style={{ fontSize: "1.6rem" }}>Not authorized</h1><p className="lead-copy">This page is for Vraelis admins.</p></div>;
  }

  return (
    <div className="wrap" style={{ maxWidth: 1000, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="display">Admin</h1>
          <p>Review user data requests and recent audit activity.</p>
        </div>
      </div>

      {/* data requests (admin only, gated server-side by isAdmin) */}
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "0 0 12px" }}>Data requests</div>
      {dreqs.length === 0 ? (
        <div className="empty"><EmptyIcon d={I.mail} /><h3>No data requests</h3><p>Export, correction, and account-deletion requests from users appear here for manual review.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dreqs.map((d) => (
            <div key={d.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, color: "var(--fg-1)" }}>{DREQ_TYPE[d.request_type] ?? d.request_type}</span>
                <span className="pill" style={{ fontSize: 10.5, background: d.status === "completed" ? "var(--acc-soft)" : d.status === "rejected" || d.status === "cancelled" ? "var(--bg-2)" : "var(--bg-1)", color: d.status === "completed" ? "var(--acc-deep)" : "var(--fg-3)" }}>{d.status.replace(/_/g, " ")}</span>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)" }}>{d.user_id}</span>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", marginLeft: "auto" }}>{new Date(d.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </div>
              {d.message ? <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 8, lineHeight: 1.5 }}>{d.message}</div> : null}
              {d.admin_note ? <div style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 6 }}>Note: {d.admin_note}</div> : null}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                <button onClick={() => reqAction(d.id, { status: "in_review" })} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>In review</button>
                <button onClick={() => reqAction(d.id, { status: "completed" })} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>Completed</button>
                <button onClick={() => reqAction(d.id, { status: "rejected" })} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>Rejected</button>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                <input value={dnote[d.id] || ""} onChange={(e) => setDnote((n) => ({ ...n, [d.id]: e.target.value }))} placeholder="Add an admin note" style={{ flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 13, outline: "none" }} />
                <button onClick={() => { if ((dnote[d.id] || "").trim()) { reqAction(d.id, { note: dnote[d.id] }); setDnote((n) => ({ ...n, [d.id]: "" })); } }} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>Save note</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* audit activity (admin only, data is gated server-side by isAdmin) */}
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "36px 0 12px" }}>Audit activity</div>
      <div className="seg" style={{ marginBottom: 14 }}>
        {ACTORS.map((a) => <button key={a} onClick={() => setActor(a)} className={actor === a ? "on" : ""} style={{ textTransform: "capitalize" }}>{a}</button>)}
      </div>
      {audit.length === 0 ? (
        <div className="empty"><EmptyIcon d={I.clock} /><h3>No audit events</h3><p>Account, key, webhook, sharing, export, and admin actions appear here as they happen.</p></div>
      ) : (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)" }}>
          {audit.map((e, i) => {
            const meta = Object.entries(e.metadata || {}).filter(([, v]) => v !== null && v !== "").slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(", ");
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 600 }}>{e.event_type}</span>
                    <span className="pill" style={{ fontSize: 10.5 }}>{e.actor_type}</span>
                    {e.user_id ? <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)" }}>{e.user_id}</span> : null}
                  </div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", marginTop: 3 }}>{meta || (e.test_id ? `test ${e.test_id.slice(0, 8)}` : "-")}</div>
                </div>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", flex: "none" }}>{new Date(e.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
