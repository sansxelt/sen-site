"use client";

import { useCallback, useEffect, useState } from "react";

type Vote = { id: string; test_id: string; voter_id: string; status: string; reject_reason: string | null; reason: string | null; time_spent_ms: number | null; created_at: string; title: string | null };
type Stats = { valid: number; rejected: number; byReason: Record<string, number> };
const FILTERS = ["rejected", "valid", "all"] as const;

export default function AdminPage() {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState<string>("rejected");
  const [forbidden, setForbidden] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoaded(false);
    const r = await fetch(`/api/v/admin/votes?status=${filter}`);
    if (r.status === 403) { setForbidden(true); setLoaded(true); return; }
    const j = await r.json();
    setVotes(j.votes || []); setStats(j.stats || null); setLoaded(true);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function override(id: string, status: "valid" | "rejected") {
    await fetch("/api/v/admin/votes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    load();
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
        <div className="empty"><div className="empty__icon">✓</div><h3>Nothing to review</h3><p>No {filter === "all" ? "" : filter} votes in the last 7 days.</p></div>
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
    </div>
  );
}
