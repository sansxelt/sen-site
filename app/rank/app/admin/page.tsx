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
      <p className="eyebrow">Admin</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)", marginBottom: 6 }}>Vote review</h1>
      <p className="lead-copy" style={{ marginBottom: 22 }}>Suspicious votes are filtered automatically. Review and override here. Last 7 days.</p>

      {stats && (
        <div className="cols-3" style={{ marginBottom: 24 }}>
          <div className="card"><div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-display)" }}>{stats.valid.toLocaleString()}</div><div style={{ fontSize: 12, color: "var(--fg-4)" }}>valid votes</div></div>
          <div className="card"><div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-display)", color: "var(--money, #c0392b)" }}>{stats.rejected.toLocaleString()}</div><div style={{ fontSize: 12, color: "var(--fg-4)" }}>filtered</div></div>
          <div className="card"><div style={{ fontSize: 11, color: "var(--fg-4)", marginBottom: 6, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.06em" }}>By reason</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{Object.entries(stats.byReason).length ? Object.entries(stats.byReason).map(([k, v]) => <span key={k} className="pill" style={{ fontSize: 11 }}>{k.replace(/_/g, " ")}: {v}</span>) : <span style={{ fontSize: 12, color: "var(--fg-5)" }}>none</span>}</div>
          </div>
        </div>
      )}

      <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 999, border: "1px solid var(--line-2)", background: "var(--bg-1)", marginBottom: 18 }}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: "7px 16px", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, textTransform: "capitalize", background: filter === f ? "var(--acc)" : "transparent", color: filter === f ? "#fff" : "var(--fg-3)" }}>{f}</button>
        ))}
      </div>

      {!loaded ? <p className="lead-copy">Loading…</p> : votes.length === 0 ? <p style={{ color: "var(--fg-4)" }}>No {filter === "all" ? "" : filter} votes.</p> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {votes.map((v) => (
            <div key={v.id} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 16px" }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="pill" style={{ fontSize: 11, background: v.status === "rejected" ? "var(--acc-soft)" : "var(--bg-2)", color: v.status === "rejected" ? "var(--money, #c0392b)" : "var(--fg-3)" }}>{v.status}{v.reject_reason ? ` · ${v.reject_reason.replace(/_/g, " ")}` : ""}</span>
                  <span style={{ fontSize: 13, color: "var(--fg-1)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{v.title ?? "—"}</span>
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 4 }}>{mask(v.voter_id)} · {v.time_spent_ms != null ? `${(v.time_spent_ms / 1000).toFixed(1)}s` : "—"}{v.reason ? ` · “${v.reason.slice(0, 60)}”` : ""}</div>
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
