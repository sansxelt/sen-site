"use client";

import { useCallback, useEffect, useState } from "react";
import { I, EmptyIcon } from "@/app/rank/_components/icons";

type Audit = { id: string; user_id: string | null; test_id: string | null; event_type: string; actor_type: string; source: string | null; route: string | null; metadata: Record<string, unknown>; created_at: string };
type DReq = { id: string; user_id: string; request_type: string; status: string; message: string | null; admin_note: string | null; created_at: string };
type Stage = { key: string; label: string; count: number; people: number | null };
type Funnel = { stages: Stage[]; decisions: Record<string, number>; sinceIso: string; truncated: boolean };
const WINDOWS = [7, 30, 90];
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

  // The funnel. Loaded separately from the audit feed because it answers a different question: the audit
  // list is "what happened", this is "how many people made it to each step".
  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [days, setDays] = useState(30);
  const loadFunnel = useCallback(async () => {
    const r = await fetch(`/api/v/admin/funnel?days=${days}`);
    if (r.status === 403) { setForbidden(true); return; }
    if (r.ok) setFunnel(await r.json());
  }, [days]);

  const [dreqs, setDreqs] = useState<DReq[]>([]);
  const [dnote, setDnote] = useState<Record<string, string>>({});

  const loadDreqs = useCallback(async () => {
    const r = await fetch("/api/v/admin/data-requests");
    if (r.ok) setDreqs((await r.json()).requests || []);
  }, []);

  useEffect(() => { loadAudit(); }, [loadAudit]);
  useEffect(() => { loadDreqs(); }, [loadDreqs]);
  useEffect(() => { loadFunnel(); }, [loadFunnel]);

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
          <p>Where people fall out of the funnel, plus user data requests and recent audit activity.</p>
        </div>
      </div>

      {/* THE FUNNEL. First on the page because before there are customers it is the only thing here that
          answers a question worth acting on: which step people stop at. Percentages are of the STEP ABOVE,
          not of visits, so the drop that matters is the one you read directly. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "0 0 12px", flexWrap: "wrap" }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Funnel</div>
        <div className="seg" style={{ marginLeft: "auto" }}>
          {WINDOWS.map((d) => <button key={d} onClick={() => setDays(d)} className={days === d ? "on" : ""}>{d}d</button>)}
        </div>
      </div>
      {!funnel ? (
        <div className="empty"><EmptyIcon d={I.clock} /><h3>Loading</h3><p>Reading visits, signups, and verifications.</p></div>
      ) : (
        <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--bg-1)" }}>
          {funnel.stages.map((s, i) => {
            const prev = i > 0 ? funnel.stages[i - 1] : null;
            // Visits are anonymous, so people-to-people conversion only exists from signup onward; the
            // visit-to-signup step compares counts instead. Stated rather than quietly mixing the two.
            const base = prev ? (prev.people ?? prev.count) : 0;
            const mine = s.people ?? s.count;
            const pct = prev && base > 0 ? Math.round((mine / base) * 100) : null;
            return (
              <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", width: 18, flex: "none" }}>{String(i + 1).padStart(2, "0")}</span>
                <span style={{ fontSize: 13.5, color: "var(--fg-1)", fontWeight: 600, minWidth: 0 }}>{s.label}</span>
                {pct !== null ? <span className="pill" style={{ fontSize: 10.5 }}>{pct}%</span> : null}
                <span style={{ marginLeft: "auto", display: "flex", gap: 14, alignItems: "baseline", flex: "none" }}>
                  {s.people !== null && s.key !== "repeat"
                    ? <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)" }}>{s.people} {s.people === 1 ? "person" : "people"}</span>
                    : null}
                  <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "var(--fg-1)" }}>{s.count}</span>
                </span>
              </div>
            );
          })}
          {Object.keys(funnel.decisions).length > 0 ? (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", padding: "11px 16px", borderTop: "1px solid var(--line-1)", background: "var(--bg-2)" }}>
              <span style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" }}>Decisions</span>
              {Object.entries(funnel.decisions).map(([d, n]) => (
                <span key={d} style={{ fontSize: 12.5, color: "var(--fg-3)", textTransform: "capitalize" }}>{d} <b style={{ color: "var(--fg-1)" }}>{n}</b></span>
              ))}
            </div>
          ) : null}
          {funnel.truncated ? (
            <div style={{ padding: "9px 16px", borderTop: "1px solid var(--line-1)", fontSize: 12, color: "var(--fg-4)" }}>
              Row cap reached. These are floors, not totals.
            </div>
          ) : null}
        </div>
      )}

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
