"use client";

import { useEffect, useState } from "react";
import { CHANNEL_PRESETS, channelLabel } from "@/lib/v-sources";

type Stats = { total: number; valid: number; filtered: number; filterRate: number; lastAt: string | null };
type Link = { id: string; label: string; source: string; is_active: boolean; created_at: string; url: string; stats: Stats };

const inputStyle = { padding: "9px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, fontFamily: "var(--font-sans)", outline: "none" } as const;

export function CollectionLinks({ testId }: { testId: string }) {
  const [links, setLinks] = useState<Link[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [source, setSource] = useState("instagram");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");

  async function load() {
    const r = await fetch(`/api/v/collection-links?testId=${encodeURIComponent(testId)}`);
    if (r.ok) setLinks((await r.json()).links || []);
    setLoaded(true);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function create() {
    if (!label.trim() || busy) return;
    setBusy(true);
    try { await fetch("/api/v/collection-links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId, label, source }) }); } catch { /* ignore */ }
    setBusy(false); setLabel(""); setOpen(false); load();
  }
  async function toggle(id: string, isActive: boolean) {
    try { await fetch(`/api/v/collection-links/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) }); } catch { /* ignore */ }
    load();
  }
  function copy(url: string, id: string) { navigator.clipboard?.writeText(url).then(() => { setCopied(id); setTimeout(() => setCopied(""), 1500); }).catch(() => {}); }

  const head = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--fg-4)" };
  const withResp = links.filter((l) => l.stats.total > 0);
  const cleanest = withResp.length ? [...withResp].sort((a, b) => a.stats.filterRate - b.stats.filterRate || b.stats.valid - a.stats.valid)[0] : null;
  const biggest = withResp.length ? [...withResp].sort((a, b) => b.stats.valid - a.stats.valid)[0] : null;
  const noisy = withResp.find((l) => l.stats.total >= 10 && l.stats.filterRate >= 25);

  return (
    <div className="card" style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <div style={head}>Collection links</div>
        {!open && <button onClick={() => setOpen(true)} className="btn btn--ghost" style={{ fontSize: 12.5, padding: "6px 12px" }}>New link</button>}
      </div>

      {open && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
          <input style={{ ...inputStyle, flex: "1 1 200px" }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Link name, e.g. Instagram bio" maxLength={80} autoFocus />
          <select style={inputStyle} value={source} onChange={(e) => setSource(e.target.value)}>
            {CHANNEL_PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button onClick={create} disabled={!label.trim() || busy} className="btn" style={{ opacity: label.trim() && !busy ? 1 : 0.55 }}>{busy ? "Creating…" : "Create link"}</button>
          <button onClick={() => { setOpen(false); setLabel(""); }} className="btn btn--ghost">Cancel</button>
        </div>
      )}

      {!loaded ? null : links.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--fg-3)", margin: 0, lineHeight: 1.55 }}>Create collection links to compare signal quality across Instagram, Discord, email, embed, and other channels, then see which source produced the cleanest decision signal.</p>
      ) : (
        <>
          {(cleanest || biggest) && (
            <p style={{ fontSize: 12.5, color: "var(--fg-3)", margin: "0 0 14px", lineHeight: 1.5 }}>
              {biggest && cleanest && biggest.id !== cleanest.id ? <><strong style={{ color: "var(--fg-1)" }}>{biggest.label}</strong> produced the most valid judgments, but <strong style={{ color: "var(--fg-1)" }}>{cleanest.label}</strong> had the cleanest signal ({cleanest.stats.filterRate}% filtered).</>
                : cleanest ? <><strong style={{ color: "var(--fg-1)" }}>{cleanest.label}</strong> has the cleanest signal so far ({cleanest.stats.filterRate}% filtered).</> : null}
              {noisy ? <span style={{ color: "var(--money)" }}> {" "}{noisy.label} has a high filter rate ({noisy.stats.filterRate}%), consider another channel.</span> : null}
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {links.map((l) => (
              <div key={l.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "11px 0", borderTop: "1px solid var(--line-1)", opacity: l.is_active ? 1 : 0.55 }}>
                <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--fg-1)" }}>{l.label} <span style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-4)", fontWeight: 400 }}>{channelLabel(l.source)}</span></div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 3 }}>
                    {l.stats.total > 0 ? <>{l.stats.valid} valid | {l.stats.filtered} filtered | {l.stats.filterRate}% rate</> : "No responses yet"}
                  </div>
                </div>
                <button onClick={() => copy(l.url, l.id)} className="btn btn--ghost" style={{ fontSize: 12, padding: "5px 10px" }}>{copied === l.id ? "Copied ✓" : "Copy link"}</button>
                <button onClick={() => toggle(l.id, !l.is_active)} className="btn btn--ghost" style={{ fontSize: 12, padding: "5px 10px", color: "var(--fg-4)" }}>{l.is_active ? "Disable" : "Enable"}</button>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--fg-5)", marginTop: 12, marginBottom: 0 }}>Each link tracks its channel privacy-safely. Share a link to start measuring source quality.</p>
        </>
      )}
    </div>
  );
}
