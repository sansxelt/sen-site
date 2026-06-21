"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function del() {
    if (confirm !== "DELETE") return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/v/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }) });
      if (r.ok) { signOut({ callbackUrl: "/" }); return; }
      setErr("Couldn't delete your account. Email help@vraelis.com and we'll help.");
    } catch { setErr("Network error. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ borderColor: "rgba(220,38,38,0.28)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 15, color: "var(--fg-1)" }}>Delete account</div>
          <div style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 2, maxWidth: 480 }}>Permanently delete your account and all of your tests, reports, credits, API keys, and webhooks. This cannot be undone.</div>
        </div>
        {!open && <button onClick={() => setOpen(true)} className="btn btn--ghost" style={{ color: "var(--err)", borderColor: "rgba(220,38,38,0.3)" }}>Delete account</button>}
      </div>
      {open && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line-1)" }}>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)", marginBottom: 10 }}>Type <b style={{ color: "var(--fg-1)" }}>DELETE</b> to confirm. This is permanent and cannot be undone.</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" autoComplete="off" style={{ flex: 1, minWidth: 180, padding: "10px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, outline: "none" }} />
            <button onClick={del} disabled={confirm !== "DELETE" || busy} className="btn" style={{ background: "var(--err)", borderColor: "var(--err)", boxShadow: "none", opacity: confirm === "DELETE" && !busy ? 1 : 0.5 }}>{busy ? "Deleting…" : "Permanently delete"}</button>
            <button onClick={() => { setOpen(false); setConfirm(""); setErr(""); }} className="btn btn--ghost">Cancel</button>
          </div>
          {err && <p style={{ color: "var(--err)", fontSize: 13, marginTop: 10, marginBottom: 0 }}>{err}</p>}
        </div>
      )}
    </div>
  );
}
