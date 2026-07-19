"use client";

// Per-app link picker: for each account-level connection the owner has, this app chooses to USE it and
// (where relevant) sets a per-app selection — the Vercel project or GitHub repo this app points at. The
// token stays at the account level; only the pointer + selection live here. A linked Vercel project makes a
// run resolve the LIVE production URL instead of a stored one.

import { useState } from "react";
import { useRouter } from "next/navigation";

type AccountConn = { id: string; provider: string; label: string };
type Link = { provider: string; accountConnectionId: string; selection: Record<string, unknown> };

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub", vercel: "Vercel", supabase: "Supabase", stripe_test: "Stripe", sentry: "Sentry",
};
// The per-app selection field each provider needs (empty = link-only, no selection).
const SELECTION_FIELD: Record<string, { key: string; label: string; placeholder: string } | null> = {
  vercel: { key: "project", label: "Vercel project", placeholder: "my-app" },
  github: { key: "repo", label: "Repository", placeholder: "owner/name" },
  supabase: null, stripe_test: null, sentry: null,
};

const headLbl = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };
const input = { width: "100%", padding: "9px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", fontSize: 13.5, color: "var(--fg-1)", outline: "none" } as const;

export function AppConnectionLinks({ appId, accountConnections, links, canManage }: {
  appId: string; accountConnections: AccountConn[]; links: Link[]; canManage: boolean;
}) {
  const router = useRouter();
  const linkByProvider = new Map(links.map((l) => [l.provider, l]));
  const base = `/api/preflight/apps/${encodeURIComponent(appId)}/connections/link`;

  return (
    <section aria-label="Account connections for this app" style={{ marginBottom: 26 }}>
      <div style={{ ...headLbl, marginBottom: 8 }}>This app uses</div>
      <div style={{ display: "grid", gap: 10 }}>
        {accountConnections.map((c) => (
          <LinkRow key={c.id} conn={c} link={linkByProvider.get(c.provider)} base={base} canManage={canManage} onDone={() => router.refresh()} />
        ))}
      </div>
    </section>
  );
}

function LinkRow({ conn, link, base, canManage, onDone }: {
  conn: AccountConn; link?: Link; base: string; canManage: boolean; onDone: () => void;
}) {
  const field = SELECTION_FIELD[conn.provider];
  const linked = !!link;
  const [sel, setSel] = useState<string>(field && link ? String(link.selection[field.key] ?? "") : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const label = PROVIDER_LABELS[conn.provider] ?? conn.provider;

  async function save() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(base, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: conn.provider, accountConnectionId: conn.id, selection: field && sel.trim() ? { [field.key]: sel.trim() } : {} }),
      });
      if (res.ok) onDone(); else setErr("Could not link. Try again.");
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }
  async function remove() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`${base}?provider=${encodeURIComponent(conn.provider)}`, { method: "DELETE" });
      if (res.ok) onDone(); else setErr("Could not unlink.");
    } catch { setErr("Network error."); } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderColor: linked ? "var(--acc-line)" : "var(--line-2)" }}>
      <div style={{ minWidth: 140, flex: "0 0 auto" }}>
        <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14, color: "var(--fg-1)" }}>{label}</div>
        <div style={{ fontSize: 11.5, color: "var(--fg-4)" }}>{conn.label !== conn.provider ? conn.label : "account connection"}</div>
      </div>
      {field ? (
        <div style={{ flex: "1 1 200px", minWidth: 0 }}>
          <label style={{ fontSize: 11, color: "var(--fg-4)" }}>{field.label}</label>
          <input value={sel} onChange={(e) => setSel(e.target.value)} placeholder={field.placeholder} disabled={!canManage || busy} style={input} />
        </div>
      ) : (
        <div style={{ flex: 1, fontSize: 12.5, color: "var(--fg-4)" }}>{linked ? "Used by this app." : "Not used by this app yet."}</div>
      )}
      {canManage ? (
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          {linked ? <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void remove()} style={{ padding: "7px 12px", fontSize: 12.5 }}>Unlink</button> : null}
          <button type="button" className="btn" disabled={busy || (!!field && !sel.trim())} onClick={() => void save()} style={{ padding: "7px 12px", fontSize: 12.5, opacity: busy || (!!field && !sel.trim()) ? 0.6 : 1 }}>
            {busy ? "Saving…" : linked ? "Update" : "Use"}
          </button>
        </div>
      ) : null}
      {err ? <span role="alert" style={{ fontSize: 12, color: "var(--err)", flexBasis: "100%" }}>{err}</span> : null}
    </div>
  );
}
