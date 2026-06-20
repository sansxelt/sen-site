"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

type Opt = { id: string; position: number; asset_url: string | null; label: string | null };
type Test = { id: string; title: string; context: string | null; category: string };
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export default function VotePage() {
  const [test, setTest] = useState<Test | null>(null);
  const [options, setOptions] = useState<Opt[]>([]);
  const [phase, setPhase] = useState<"loading" | "vote" | "empty" | "signin">("loading");
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [earned, setEarned] = useState(0);
  const startRef = useRef(0);

  const fetchNext = useCallback(async () => {
    setPhase("loading"); setSelected(""); setReason("");
    try {
      const r = await fetch("/api/v/vote/next");
      if (r.status === 401) { setPhase("signin"); return; }
      const j = await r.json();
      if (!j.test) { setPhase("empty"); return; }
      setTest(j.test); setOptions(j.options); startRef.current = Date.now(); setPhase("vote");
    } catch { setPhase("empty"); }
  }, []);

  useEffect(() => { fetchNext(); }, [fetchNext]);

  async function submit() {
    if (!test || !selected || busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/v/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId: test.id, optionId: selected, reason, timeSpentMs: Date.now() - startRef.current }) });
      if (r.status === 401) { setPhase("signin"); return; }
      if (r.ok) { setEarned((e) => e + 1); fetchNext(); }
    } finally { setBusy(false); }
  }

  return (
    <div className="wrap" style={{ maxWidth: 760, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <div>
          <p className="eyebrow">Vote &amp; earn</p>
          <h1 className="display" style={{ fontSize: "clamp(1.6rem, 3vw, 2.1rem)" }}>Which do you prefer?</h1>
        </div>
        {earned > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--acc-deep)", fontWeight: 600 }}>+{earned} credits earned</span>}
      </div>

      {phase === "loading" && <p className="lead-copy">Finding a test…</p>}

      {phase === "signin" && (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="lead-copy" style={{ margin: "0 auto 16px" }}>Sign in to vote and earn credits.</p>
          <button onClick={() => signIn("google", { callbackUrl: "/vote" })} className="btn">Continue with Google</button>
        </div>
      )}

      {phase === "empty" && (
        <div className="card" style={{ textAlign: "center", padding: "clamp(32px, 5vw, 56px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600, color: "var(--fg-1)", marginBottom: 8 }}>No tests right now</div>
          <p style={{ fontSize: 14, color: "var(--fg-3)", marginBottom: 20 }}>Check back soon — or start your own.</p>
          <a href="/app/new" className="btn btn--ghost">Create a test</a>
        </div>
      )}

      {phase === "vote" && test && (
        <div>
          <div style={{ marginBottom: 6, fontSize: 15, color: "var(--fg-1)", fontWeight: 600 }}>{test.title}</div>
          {test.context && <div style={{ fontSize: 13, color: "var(--fg-4)", marginBottom: 16 }}>{test.context}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginBottom: 18, marginTop: 12 }}>
            {options.map((o) => {
              const sel = selected === o.id;
              return (
                <button key={o.id} onClick={() => setSelected(o.id)} style={{ position: "relative", border: `2px solid ${sel ? "var(--acc)" : "var(--line-2)"}`, borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--bg-1)", cursor: "pointer", padding: 0, boxShadow: sel ? "0 0 0 3px var(--acc-soft)" : "none", transition: "border-color .12s ease" }}>
                  {o.asset_url
                    ? <div style={{ aspectRatio: "1/1", backgroundImage: `url(${o.asset_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                    : <div style={{ aspectRatio: "1/1", display: "grid", placeItems: "center", padding: 14, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "var(--fg-1)", textAlign: "center" }}>{o.label}</div>}
                  <span style={{ position: "absolute", top: 8, left: 8, width: 24, height: 24, borderRadius: "50%", background: sel ? "var(--acc)" : "rgba(0,0,0,0.5)", color: "#fff", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>{LETTERS[o.position]}</span>
                </button>
              );
            })}
          </div>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why? (optional — one line)" rows={2} style={{ width: "100%", padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box", marginBottom: 14, resize: "vertical" }} />
          <button onClick={submit} disabled={!selected || busy} className="btn btn--lg" style={{ justifyContent: "center", width: "100%", opacity: !selected || busy ? 0.55 : 1 }}>{busy ? "Saving…" : "Submit & next →"}</button>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", marginTop: 12 }}>You earn 1 credit per vote. Be honest — quality is checked.</p>
        </div>
      )}
    </div>
  );
}
