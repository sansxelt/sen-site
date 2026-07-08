"use client";

// Confirm-gated account-deletion REQUEST. Submitting creates a request that an
// admin reviews manually, it deletes nothing automatically.

import { useState } from "react";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    if (confirm !== "DELETE MY ACCOUNT") return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/v/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }) });
      const j = await r.json().catch(() => ({}));
      if (r.ok) { setDone(j.message || "Your account deletion request has been received and will be reviewed manually."); }
      else setErr(j.error === "confirm_required" ? "Type DELETE MY ACCOUNT exactly to confirm." : "Couldn't submit the request. Email help@vraelis.com.");
    } catch { setErr("Network error. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ borderColor: "rgba(220,38,38,0.28)" }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>Delete account</div>
      <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 2, maxWidth: 520, lineHeight: 1.5 }}>Request deletion of your account and data. Requests are reviewed manually, so this is not instant.</div>

      {done ? (
        <p style={{ fontSize: 13.5, color: "var(--acc-deep)", marginTop: 14, marginBottom: 0 }}>{done}</p>
      ) : !open ? (
        <button onClick={() => setOpen(true)} className="btn btn--ghost" style={{ marginTop: 14, color: "var(--err)", borderColor: "rgba(220,38,38,0.3)" }}>Request account deletion</button>
      ) : (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line-1)" }}>
          <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
            {["Your request is reviewed manually, deletion is not immediate.", "Some billing, security, and legal records may be retained where required.", "Public report links may be disabled while the request is processed.", "Any active subscription may need to be handled as part of review."].map((t) => (
              <li key={t} style={{ display: "flex", gap: 9, fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5 }}><span style={{ color: "var(--fg-4)", flex: "none" }}>•</span><span>{t}</span></li>
            ))}
          </ul>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)", marginBottom: 10 }}>Type <b style={{ color: "var(--fg-1)" }}>DELETE MY ACCOUNT</b> to confirm.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE MY ACCOUNT" autoComplete="off" style={{ flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" }} />
            <button onClick={submit} disabled={confirm !== "DELETE MY ACCOUNT" || busy} className="btn" style={{ background: "var(--err)", borderColor: "var(--err)", boxShadow: "none", opacity: confirm === "DELETE MY ACCOUNT" && !busy ? 1 : 0.5 }}>{busy ? "Submitting…" : "Submit request"}</button>
            <button onClick={() => { setOpen(false); setConfirm(""); setErr(""); }} className="btn btn--ghost">Cancel</button>
          </div>
          {err && <p style={{ color: "var(--err)", fontSize: 13, marginTop: 10, marginBottom: 0 }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
