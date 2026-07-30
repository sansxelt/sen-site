"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Owner edit form for an application's core settings: name, deployment target URL, environment,
// description. PATCHes the owner-gated /api/preflight/apps/[id] route; the server re-validates ownership
// and the URL (SSRF string guard) and never trusts a client-supplied id. Native saving / success /
// failure states, no fake progress. On save we stay on Settings (no dashboard redirect) and refresh the
// server-rendered sections below. Changing the target shows a confirmation first (previous reports are
// never modified; the new deployment stays unverified until a Production Pass completes).

const inputStyle = {
  width: "100%", padding: "9px 12px", fontSize: 13.5,
  color: "var(--fg-1)", background: "var(--bg-1)", border: "1px solid var(--line-2)",
  borderRadius: "var(--r-sm)", outline: "none",
} as const;
const monoInput = { ...inputStyle, fontFamily: "var(--font-mono)" } as const;
const labelStyle = {
  display: "block", fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 5,
} as const;

type Initial = { name: string; appUrl: string; environment: string; description: string };

export function EditApplicationForm({ appId, initial }: { appId: string; initial: Initial }) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [appUrl, setAppUrl] = useState(initial.appUrl);
  const [environment, setEnvironment] = useState(initial.environment);
  const [description, setDescription] = useState(initial.description);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const trimmedUrl = appUrl.trim();
  const targetChanged = trimmedUrl !== initial.appUrl.trim();
  const dirty =
    name.trim() !== initial.name.trim() || targetChanged ||
    environment !== initial.environment || description.trim() !== initial.description.trim();

  function discard() {
    setName(initial.name); setAppUrl(initial.appUrl);
    setEnvironment(initial.environment); setDescription(initial.description);
    setErr(null); setOk(null); setConfirming(false);
  }

  async function save() {
    if (busy) return;
    setBusy(true); setErr(null); setOk(null); setConfirming(false);
    try {
      const res = await fetch(`/api/preflight/apps/${encodeURIComponent(appId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          app_url: trimmedUrl,
          environment: environment || null,
          description: description.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.ok) {
        setOk(j.targetChanged
          ? "Deployment updated. New deployment unverified."
          : (j.updated ? "Settings updated." : "No changes to save."));
        router.refresh();
        setBusy(false);
        return;
      }
      setErr(typeof j?.message === "string" ? j.message : "Could not save the changes. Try again.");
      setBusy(false);
    } catch {
      setErr("Network error. Nothing was saved.");
      setBusy(false);
    }
  }

  // Save handler: a target change asks for confirmation first; everything else saves straight away.
  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !dirty) return;
    if (targetChanged && !confirming) { setConfirming(true); setErr(null); setOk(null); return; }
    void save();
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: "clamp(18px, 2.4vw, 24px)", display: "grid", gap: 14 }}>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16.5, color: "var(--fg-1)", margin: 0 }}>Edit system</h2>

      <div>
        <label htmlFor="edit-name" style={labelStyle}>Name</label>
        <input id="edit-name" type="text" required maxLength={140} value={name}
          onChange={(e) => { setName(e.target.value); setOk(null); setConfirming(false); }} style={inputStyle} />
      </div>

      <div>
        <label htmlFor="edit-url" style={labelStyle}>Deployment target URL</label>
        <input id="edit-url" type="url" required value={appUrl}
          onChange={(e) => { setAppUrl(e.target.value); setOk(null); setConfirming(false); }}
          placeholder="https://my-app.example.com" style={monoInput} />
        <p style={{ fontSize: 11.5, color: "var(--fg-4)", margin: "6px 0 0", lineHeight: 1.5 }}>
          Public https URL of the deployed app under test. Private and loopback hosts are rejected.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        <div>
          <label htmlFor="edit-env" style={labelStyle}>Environment</label>
          <select id="edit-env" value={environment}
            onChange={(e) => { setEnvironment(e.target.value); setOk(null); setConfirming(false); }}
            style={{ ...inputStyle, fontFamily: "inherit" }}>
            <option value="">Not set</option>
            <option value="preview">Preview</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="edit-desc" style={labelStyle}>Description</label>
        <textarea id="edit-desc" rows={3} value={description}
          onChange={(e) => { setDescription(e.target.value); setOk(null); setConfirming(false); }}
          placeholder="A short summary of what this system does."
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
        <p style={{ fontSize: 11.5, color: "var(--fg-4)", margin: "6px 0 0", lineHeight: 1.5 }}>
          Sharpens the Production Contract Vraelis derives. Saved as the system summary.
        </p>
      </div>

      {confirming ? (
        <div role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.6, padding: "12px 14px", borderRadius: "var(--r-sm)", background: "var(--bg-2)", border: "1px solid var(--wait-line)", borderLeft: "3px solid var(--wait-line)" }}>
          Changing the deployment target does not modify previous reports. The new deployment will remain
          unverified until a verification completes.
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="btn" disabled={busy || !dirty} style={{ opacity: busy || !dirty ? 0.6 : 1 }}>
          {busy ? "Saving..." : confirming ? "Confirm and save" : "Save"}
        </button>
        <button type="button" className="btn btn--ghost" disabled={busy || !dirty} onClick={discard}
          style={{ opacity: busy || !dirty ? 0.6 : 1 }}>
          Discard
        </button>
        {ok ? <span role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--go-ink)", fontWeight: 600 }}>{ok}</span> : null}
        {err ? <span role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--err)" }}>{err}</span> : null}
      </div>
    </form>
  );
}
