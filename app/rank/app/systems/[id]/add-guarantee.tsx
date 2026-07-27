"use client";

// The "define a guarantee" affordance on the Systems page. Creates the guarantee (plan_state 'draft') then
// routes to its detail page, where the human derives and approves its proof plan. Editor+ only (the server
// route enforces the same); a viewer never sees this control.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddGuarantee({ appId }: { appId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [scope, setScope] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/preflight/apps/${appId}/guarantees`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), scope: scope.trim() }),
      });
      const j = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) { setErr((j as { message?: string })?.message || "Could not define the guarantee."); setBusy(false); return; }
      const gid = (j as { guarantee?: { id?: string } })?.guarantee?.id;
      // Straight to the new guarantee to derive and approve its proof plan.
      if (gid) router.push(`/systems/${appId}/guarantees/${gid}`);
      else { setOpen(false); setTitle(""); setScope(""); setBusy(false); router.refresh(); }
    } catch { setErr("Network error. Try again."); setBusy(false); }
  }

  if (!open) {
    return <button className="btn" style={{ fontSize: 13, padding: "8px 14px" }} onClick={() => setOpen(true)}>+ Add a guarantee</button>;
  }

  return (
    <div style={{ border: "1px solid var(--line-2)", borderRadius: "var(--r-sm)", background: "var(--bg-1)", padding: "16px 18px", display: "grid", gap: 12 }}>
      <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14.5, color: "var(--fg-1)" }}>Define a guarantee</div>
      <div className="field">
        <label className="lbl" htmlFor="g-title">What must always be true</label>
        <input id="g-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={busy}
          placeholder="A customer can upgrade to Pro and receive access immediately." />
        <span className="hint">One sentence, about the business outcome, not the steps to reach it.</span>
      </div>
      <div className="field">
        <label className="lbl" htmlFor="g-scope">Scope <span style={{ color: "var(--fg-4)", fontWeight: 400 }}>(optional)</span></label>
        <textarea id="g-scope" value={scope} onChange={(e) => setScope(e.target.value)} rows={2} disabled={busy}
          placeholder="What this proves, and what it does not." />
      </div>
      {err ? <p style={{ fontSize: 12.5, color: "var(--err)", margin: 0 }}>{err}</p> : null}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button className="btn" disabled={busy || title.trim().length < 12} onClick={submit}>{busy ? "Defining…" : "Define guarantee"}</button>
        <button className="btn btn--ghost" disabled={busy} onClick={() => { setOpen(false); setErr(null); }}>Cancel</button>
      </div>
    </div>
  );
}
