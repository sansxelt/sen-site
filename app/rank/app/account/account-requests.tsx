"use client";

import { useEffect, useState } from "react";

type Req = { id: string; request_type: string; status: string; message: string | null; created_at: string };

const TYPE_LABEL: Record<string, string> = {
  data_export: "Data export", data_correction: "Correction", account_deletion: "Account deletion", privacy_question: "Privacy question",
};

export function AccountRequests() {
  const [reqs, setReqs] = useState<Req[]>([]);
  const [correction, setCorrection] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    const r = await fetch("/api/v/data-requests");
    if (r.ok) setReqs((await r.json()).requests || []);
  }
  useEffect(() => { load(); }, []);

  async function submit(type: string, message: string) {
    setBusy(type); setMsg("");
    const r = await fetch("/api/v/data-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, message }) });
    setBusy("");
    if (r.ok) { setMsg("Request submitted. We review these manually and follow up by email."); if (type === "data_correction") setCorrection(""); load(); }
    else setMsg("Couldn't submit. Try again, or email privacy@vraelis.com.");
  }

  const lbl = { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" } as const;
  const desc = { fontSize: 13, color: "var(--fg-3)", marginTop: 2, marginBottom: 12, maxWidth: 520 } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={lbl}>Request a data export</div>
          <div style={{ ...desc, marginBottom: 0 }}>Get a copy of your account data. Reviewed manually; we follow up by email.</div>
        </div>
        <button onClick={() => submit("data_export", "")} disabled={busy === "data_export"} className="btn btn--ghost" style={{ whiteSpace: "nowrap" }}>{busy === "data_export" ? "Submitting…" : "Request export"}</button>
      </div>

      <div className="card">
        <div style={lbl}>Request a correction</div>
        <div style={desc}>Tell us what is inaccurate and we will review it.</div>
        <textarea value={correction} onChange={(e) => setCorrection(e.target.value)} placeholder="What should be corrected?" rows={2} maxLength={1000} style={{ width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, fontFamily: "var(--font-sans)", outline: "none", resize: "vertical", marginBottom: 10 }} />
        <button onClick={() => submit("data_correction", correction)} disabled={!correction.trim() || busy === "data_correction"} className="btn btn--ghost" style={{ opacity: correction.trim() ? 1 : 0.55 }}>{busy === "data_correction" ? "Submitting…" : "Submit correction request"}</button>
      </div>

      {msg && <p style={{ fontSize: 13, color: "var(--acc-deep)", margin: 0 }}>{msg}</p>}

      {reqs.length > 0 && (
        <div className="card" style={{ padding: "6px 18px" }}>
          {reqs.map((r, i) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--line-1)" }}>
              <span style={{ fontSize: 13.5, color: "var(--fg-1)" }}>{TYPE_LABEL[r.request_type] ?? r.request_type}</span>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span className="pill" style={{ fontSize: 10.5, background: r.status === "completed" ? "var(--acc-soft)" : "var(--bg-2)", color: r.status === "completed" ? "var(--acc-deep)" : "var(--fg-3)" }}>{r.status.replace(/_/g, " ")}</span>
                <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)" }}>{new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
