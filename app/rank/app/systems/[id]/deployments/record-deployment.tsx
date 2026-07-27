"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Record a deployment by hand (V1.1 S4): URL required, commit / branch / environment optional. POSTs to
// the owner-gated deployments route (source 'manual'); the server re-validates ownership and dedupes an
// unchanged identity onto the newest row, so a double submit never inflates history. Errors render
// inline; success refreshes the server-rendered list. No fake progress, no invented fields.

const inputStyle = {
  width: "100%", padding: "9px 12px", fontSize: 13.5, fontFamily: "var(--font-mono)",
  color: "var(--fg-1)", background: "var(--bg-1)", border: "1px solid var(--line-2)",
  borderRadius: "var(--r-sm)", outline: "none",
} as const;
const labelStyle = {
  display: "block", fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 5,
} as const;

export function RecordDeploymentForm({ appId }: { appId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [commit, setCommit] = useState("");
  const [branch, setBranch] = useState("");
  const [environment, setEnvironment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr(null); setNote(null);
    try {
      const res = await fetch(`/api/preflight/apps/${encodeURIComponent(appId)}/deployments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          commit_sha: commit.trim() || undefined,
          branch: branch.trim() || undefined,
          environment: environment || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j?.id) {
        if (j.existing) setNote("Already recorded: the newest deployment has this same URL and commit.");
        else { setOpen(false); setUrl(""); setCommit(""); setBranch(""); setEnvironment(""); }
        router.refresh();
        setBusy(false);
        return;
      }
      setErr(typeof j?.message === "string" ? j.message : "Could not record the deployment. Try again.");
      setBusy(false);
    } catch {
      setErr("Network error. The deployment was not recorded.");
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn--ghost" onClick={() => { setOpen(true); setNote(null); }}>
        Record new deployment
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 12, maxWidth: 560 }}>
      <div>
        <label htmlFor="deploy-url" style={labelStyle}>Deployment URL</label>
        <input id="deploy-url" type="url" required value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://my-app-abc123.vercel.app" style={inputStyle} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        <div>
          <label htmlFor="deploy-commit" style={labelStyle}>Commit (optional)</label>
          <input id="deploy-commit" type="text" value={commit} onChange={(e) => setCommit(e.target.value)}
            placeholder="7 to 40 hex characters" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="deploy-branch" style={labelStyle}>Branch (optional)</label>
          <input id="deploy-branch" type="text" value={branch} onChange={(e) => setBranch(e.target.value)}
            placeholder="main" style={inputStyle} />
        </div>
        <div>
          <label htmlFor="deploy-env" style={labelStyle}>Environment (optional)</label>
          <select id="deploy-env" value={environment} onChange={(e) => setEnvironment(e.target.value)}
            style={{ ...inputStyle, fontFamily: "inherit" }}>
            <option value="">Not set</option>
            <option value="preview">Preview</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="btn" disabled={busy} style={{ opacity: busy ? 0.6 : 1 }}>
          {busy ? "Recording..." : "Record deployment"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => { setOpen(false); setErr(null); setNote(null); }}>Cancel</button>
      </div>
      {err ? <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--err)", margin: 0 }}>{err}</p> : null}
      {note ? <p role="status" aria-live="polite" style={{ fontSize: 12.5, color: "var(--fg-3)", margin: 0 }}>{note}</p> : null}
    </form>
  );
}
