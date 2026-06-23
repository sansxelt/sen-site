"use client";

import { useEffect, useRef, useState } from "react";

const ACC = "#0E9E6C", LINE = "#e3e8e5";
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
type Opt = { id: string; position: number; asset_url: string | null; label: string | null };

export function EmbedVote({ testId, title, options }: { testId: string; title: string; options: Opt[] }) {
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [phase, setPhase] = useState<"vote" | "done" | "dup">("vote");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const startRef = useRef(Date.now());

  // Tell the host page how tall to make the iframe (the embed.js loader listens).
  useEffect(() => {
    const h = (ref.current?.scrollHeight ?? 400) + 64;
    window.parent?.postMessage({ type: "vraelis:height", test: testId, height: h }, "*");
  });

  function anonId() {
    try {
      let id = localStorage.getItem("vraelis_anon");
      if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem("vraelis_anon", id); }
      return id;
    } catch { return "s" + Date.now().toString(36); }
  }

  async function submit() {
    if (!selected || busy) return;
    setBusy(true); setErr("");
    try {
      // Capture campaign source from this page's own URL (set by collection links),
      // and whether we're rendered inside a widget iframe. Server re-derives + sanitizes.
      let utm_source, utm_campaign, framed = false;
      try {
        const q = new URLSearchParams(window.location.search);
        utm_source = q.get("utm_source") || undefined;
        utm_campaign = q.get("utm_campaign") || undefined;
        framed = window.self !== window.top;
      } catch { /* ignore */ }
      const r = await fetch("/api/embed/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId, optionId: selected, reason, voterId: anonId(), timeSpentMs: Date.now() - startRef.current, utm_source, utm_campaign, framed }) });
      if (r.status === 409) { setPhase("dup"); return; }
      if (r.ok) { setPhase("done"); return; }
      setErr("Couldn't save your response — try again.");
    } catch { setErr("Couldn't save your response — try again."); }
    finally { setBusy(false); }
  }

  if (phase === "done" || phase === "dup") {
    return (
      <div ref={ref} style={{ textAlign: "center", padding: "28px 12px" }}>
        <div style={{ width: 44, height: 44, borderRadius: "50%", background: ACC, color: "#fff", display: "grid", placeItems: "center", margin: "0 auto 12px", fontSize: 22 }}>✓</div>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{phase === "done" ? "Thanks for evaluating!" : "You've already evaluated this."}</div>
        <p style={{ color: "#5b6b63", fontSize: 13, marginTop: 6 }}>Your judgment helps decide what gets made.</p>
      </div>
    );
  }

  return (
    <div ref={ref}>
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>{title}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
        {options.map((o) => {
          const sel = selected === o.id;
          return (
            <button key={o.id} onClick={() => setSelected(o.id)} style={{ position: "relative", border: `2px solid ${sel ? ACC : LINE}`, borderRadius: 12, overflow: "hidden", background: "#fff", cursor: "pointer", padding: 0, boxShadow: sel ? `0 0 0 3px ${ACC}22` : "none" }}>
              {o.asset_url
                ? <div style={{ aspectRatio: "1/1", backgroundImage: `url(${o.asset_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                : <div style={{ aspectRatio: "1/1", display: "grid", placeItems: "center", padding: 12, fontWeight: 700, fontSize: 17, textAlign: "center", color: "#0d1411" }}>{o.label}</div>}
              <span style={{ position: "absolute", top: 6, left: 6, width: 22, height: 22, borderRadius: "50%", background: sel ? ACC : "rgba(0,0,0,.5)", color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>{LETTERS[o.position]}</span>
            </button>
          );
        })}
      </div>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? (optional)" style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${LINE}`, fontSize: 13, boxSizing: "border-box", marginBottom: 10, outline: "none" }} />
      {err && <p style={{ color: "#d33", fontSize: 12, marginBottom: 8 }}>{err}</p>}
      <button onClick={submit} disabled={!selected || busy} style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: !selected || busy ? "#9bcabb" : ACC, color: "#fff", fontWeight: 700, fontSize: 14, cursor: !selected || busy ? "default" : "pointer" }}>{busy ? "Saving…" : "Submit judgment"}</button>
    </div>
  );
}
