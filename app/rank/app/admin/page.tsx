"use client";

import { useCallback, useEffect, useState } from "react";
import { I, EmptyIcon } from "@/app/rank/_components/icons";

type Vote = { id: string; test_id: string; voter_id: string; status: string; reject_reason: string | null; reason: string | null; time_spent_ms: number | null; created_at: string; title: string | null };
type Stats = { valid: number; rejected: number; byReason: Record<string, number> };
type Audit = { id: string; user_id: string | null; test_id: string | null; event_type: string; actor_type: string; source: string | null; route: string | null; metadata: Record<string, unknown>; created_at: string };
type DReq = { id: string; user_id: string; request_type: string; status: string; message: string | null; admin_note: string | null; created_at: string };
const FILTERS = ["rejected", "valid", "all"] as const;
const ACTORS = ["all", "owner", "admin", "api", "webhook", "system"] as const;
const DREQ_TYPE: Record<string, string> = { data_export: "Data export", data_correction: "Correction", account_deletion: "Account deletion", privacy_question: "Privacy question" };

export default function AdminPage() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<string>("rejected");
  const [forbidden, setForbidden] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [actor, setActor] = useState<string>("all");

  const load = useCallback(async () => {
    setLoaded(false);
    const r = await fetch(`/api/v/admin/votes?status=${filter}`);
    if (r.status === 403) { setForbidden(true); setLoaded(true); return; }
    const j = await r.json();
    setVotes(j.votes || []); setStats(j.stats || null); setLoaded(true);
  }, [filter]);

  const loadAudit = useCallback(async () => {
    const r = await fetch(`/api/v/admin/audit${actor === "all" ? "" : `?actor_type=${actor}`}`);
    if (r.ok) { const j = await r.json(); setAudit(j.events || []); }
  }, [actor]);

  const [dreqs, setDreqs] = useState<DReq[]>([]);
  const [dnote, setDnote] = useState<Record<string, string>>({});

  const loadDreqs = useCallback(async () => {
    const r = await fetch("/api/v/admin/data-requests");
    if (r.ok) setDreqs((await r.json()).requests || []);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAudit(); }, [loadAudit]);
  useEffect(() => { loadDreqs(); }, [loadDreqs]);

  async function override(id: string, status: "valid" | "rejected") {
    await fetch("/api/v/admin/votes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    load();
  }
  async function reqAction(id: string, body: object) {
    await fetch("/api/v/admin/data-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
    loadDreqs();
  }

  if (forbidden) {
    return <div className="wrap" style={{ maxWidth: 640, paddingTop: 60 }}><h1 className="display" style={{ fontSize: "1.6rem" }}>Not authorized</h1><p className="lead-copy">This page is for Vraelis admins.</p></div>;
  }

  const mask = (v: string) => v.startsWith("anon:") ? "anon:" + v.slice(5, 11) + "…" : (v.length > 18 ? v.slice(0, 16) + "…" : v);

  return (
    <div className="wrap" style={{ maxWidth: 1000, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Admin</p>
          <h1 className="display">Vote review</h1>
          <p>Suspicious votes are filtered automatically. Review and override here. Last 7 days.</p>
        </div>
      </div>

      {stats && (
        <div className="tile-grid cols-3" style={{ marginBottom: 22 }}>
          <div className="stat"><div className="stat__l">Valid votes</div><div className="stat__v tnum">{stats.valid.toLocaleString()}</div></div>
          <div className="stat"><div className="stat__l">Filtered</div><div className="stat__v tnum" style={{ color: "var(--money)" }}>{stats.rejected.toLocaleString()}</div></div>
          <div className="stat"><div className="stat__l">By reason</div><div className="chips" style={{ marginTop: 2 }}>{Object.entries(stats.byReason).length ? Object.entries(stats.byReason).map(([k, v]) => <span key={k} className="chip" style={{ fontSize: 12, padding: "6px 11px" }}>{k.replace(/_/g, " ")}: {v}</span>) : <span style={{ fontSize: 12, color: "var(--fg-5)" }}>none</span>}</div></div>
        </div>
      )}

      <div className="seg" style={{ marginBottom: 18 }}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={filter === f ? "on" : ""} style={{ textTransform: "capitalize" }}>{f}</button>
        ))}
      </div>

      {!loaded ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 62, borderRadius: "var(--r-lg)" }} />)}</div>
      ) : votes.length === 0 ? (
        <div className="empty"><EmptyIcon d={I.check} /><h3>Nothing to review</h3><p>No {filter === "all" ? "" : filter} votes in the last 7 days.</p></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {votes.map((v) => (
            <div key={v.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 16px" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="pill" style={{ fontSize: 11, background: v.status === "rejected" ? "var(--acc-soft)" : "var(--bg-2)", color: v.status === "rejected" ? "var(--money, #c0392b)" : "var(--fg-3)" }}>{v.status}{v.reject_reason ? `, ${v.reject_reason.replace(/_/g, " ")}` : ""}</span>
                  <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{v.title ?? "Untitled"}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 4 }}>{mask(v.voter_id)}, {v.time_spent_ms != null ? `${(v.time_spent_ms / 1000).toFixed(1)}s` : "no time"}{v.reason ? ` “${v.reason.slice(0, 60)}”` : ""}</div>
              </div>
              {v.status === "rejected"
                ? <button onClick={() => override(v.id, "valid")} className="btn btn--ghost" style={{ fontSize: 13 }}>Mark valid</button>
                : <button onClick={() => override(v.id, "rejected")} className="btn btn--ghost" style={{ fontSize: 13 }}>Reject</button>}
            </div>
          ))}
        </div>
      )}

      {/* data requests (admin only, gated server-side by isAdmin) */}
      <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", margin: "36px 0 12px" }}>Data requests</div>
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
