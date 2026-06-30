"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

type Opt = { id: string; position: number; asset_url: string | null; label: string | null };
type Test = { id: string; title: string; context: string | null; category: string };
type SQ = { id: string; question: string; options: string[]; is_required: boolean };
type Ctx = { signedIn: boolean; balance?: number; earnedToday?: number; rewardCap?: number };
const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export default function VotePage() {
  const [test, setTest] = useState<Test | null>(null);
  const [options, setOptions] = useState<Opt[]>([]);
  const [screening, setScreening] = useState<SQ[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<"loading" | "vote" | "empty" | "signin" | "error">("loading");
  const [selected, setSelected] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ctx, setCtx] = useState<Ctx>({ signedIn: false, rewardCap: 30 });
  const [showIntro, setShowIntro] = useState(false);
  const startRef = useRef(0);
  const submittingRef = useRef(false);

  useEffect(() => { try { if (!localStorage.getItem("vraelis_vote_intro")) setShowIntro(true); } catch { /* ignore */ } }, []);
  useEffect(() => { fetch("/api/v/vote-context").then((r) => r.json()).then(setCtx).catch(() => {}); }, []);
  function dismissIntro() { setShowIntro(false); try { localStorage.setItem("vraelis_vote_intro", "1"); } catch { /* ignore */ } }

  const fetchNext = useCallback(async () => {
    setPhase("loading"); setSelected(""); setReason(""); setErr("");
    try {
      const r = await fetch("/api/v/vote/next");
      if (r.status === 401) { setPhase("signin"); return; }
      if (!r.ok) { setPhase("error"); return; }
      const j = await r.json();
      if (!j.test) { setPhase("empty"); return; }
      setTest(j.test); setOptions(j.options); setScreening(j.screening || []); setAnswers({}); startRef.current = Date.now(); setPhase("vote");
    } catch { setPhase("error"); }
  }, []);
  useEffect(() => { fetchNext(); }, [fetchNext]);

  async function submit() {
    // Synchronous guard: React's setBusy is async, so two fast clicks can both pass a
    // `busy` state check before it commits. A ref flips immediately and blocks the double.
    if (!test || !selected || busy || submittingRef.current) return;
    submittingRef.current = true;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/v/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ testId: test.id, optionId: selected, reason, timeSpentMs: Date.now() - startRef.current, screeningAnswers: answers }) });
      if (r.status === 401) { setPhase("signin"); return; }
      const j = await r.json().catch(() => ({}));
      if (j.disqualified) { fetchNext(); return; } // didn't match the target audience — move on
      if (r.ok) {
        if (j.earned) setCtx((c) => ({ ...c, earnedToday: (c.earnedToday ?? 0) + 1, balance: (c.balance ?? 0) + 1 }));
        fetchNext();
      } else if (r.status === 409 || r.status === 400) {
        fetchNext(); // already voted / test just filled or closed — move on
      } else {
        setErr("Couldn't save your judgment. Try again.");
      }
    } catch {
      setErr("Network error. Try again.");
    } finally { setBusy(false); submittingRef.current = false; }
  }

  const cap = ctx.rewardCap ?? 30;
  const earned = ctx.earnedToday ?? 0;
  const capReached = ctx.signedIn && earned >= cap;

  return (
    <div className="wrap" style={{ maxWidth: 720, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <p className="eyebrow">Evaluate &amp; earn</p>
      <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3.2vw, 2.3rem)", marginBottom: 10 }}>Help evaluate <span className="em">creative options</span>.</h1>
      <p style={{ fontSize: 15, color: "var(--fg-3)", marginBottom: 20, maxWidth: 520, lineHeight: 1.55 }}>Evaluate real creative options and earn a credit for every valid judgment. Spend them on your own evaluations.</p>

      {ctx.signedIn && (
        <div className="card" style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap", marginBottom: 18, padding: "14px 18px" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Balance</div>
            <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20 }}>{(ctx.balance ?? 0).toLocaleString()}<span style={{ fontSize: 12, color: "var(--fg-4)", fontWeight: 500, marginLeft: 5 }}>credits</span></div>
          </div>
          <div style={{ width: 1, height: 30, background: "var(--line-2)" }} />
          <div style={{ flex: 1, minWidth: 170 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Earned today</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: capReached ? "var(--money)" : "var(--acc-deep)", fontWeight: 600 }}>{earned} / {cap}</span>
            </div>
            <div style={{ height: 6, borderRadius: 99, background: "var(--bg-2)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, (earned / cap) * 100)}%`, background: capReached ? "var(--money)" : "linear-gradient(90deg, var(--acc), var(--acc-deep))" }} />
            </div>
            {capReached && <div style={{ fontSize: 11, color: "var(--money)", marginTop: 5 }}>Daily earning cap reached. Your judgments still count.</div>}
          </div>
        </div>
      )}

      {showIntro && phase !== "signin" && (
        <div className="card" style={{ marginBottom: 18, background: "var(--bg-2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>How it works</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {["Compare real options — AI outputs, copy, and creative — from teams", "Earn 1 credit per valid judgment (up to a daily cap)", "Low-quality, too-fast, or spam responses don't count", "Your honest judgment powers the Decision Packages teams rely on"].map((x) => (
                  <li key={x} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--fg-2)" }}><span style={{ color: "var(--acc)" }}>✓</span>{x}</li>
                ))}
              </ul>
            </div>
            <button onClick={dismissIntro} aria-label="Dismiss" style={{ border: "none", background: "transparent", color: "var(--fg-4)", cursor: "pointer", fontSize: 18, lineHeight: 1, flex: "none" }}>×</button>
          </div>
        </div>
      )}

      {phase === "loading" && (
        <div className="card">
          <div className="skel" style={{ height: 14, width: "55%", marginBottom: 16 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="skel" style={{ aspectRatio: "1/1" }} />
            <div className="skel" style={{ aspectRatio: "1/1" }} />
          </div>
        </div>
      )}

      {phase === "signin" && (
        <div className="card" style={{ textAlign: "center", padding: "clamp(28px, 4vw, 48px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, marginBottom: 8 }}>Sign in to evaluate &amp; earn</div>
          <p style={{ fontSize: 14, color: "var(--fg-3)", maxWidth: 380, margin: "0 auto 20px" }}>Compare real options — AI outputs, copy, and creative — and earn 1 credit per valid judgment. Spend them on your own evaluations.</p>
          <button onClick={() => signIn("google", { callbackUrl: "/vote" })} className="btn btn--lg">Continue with Google</button>
        </div>
      )}

      {phase === "empty" && (
        <div className="card" style={{ textAlign: "center", padding: "clamp(32px, 5vw, 56px)" }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 700, marginBottom: 8 }}>You&apos;re all caught up</div>
          <p style={{ fontSize: 14, color: "var(--fg-3)", maxWidth: 380, margin: "0 auto 20px" }}>No evaluations need your judgment right now. Check back soon, or start your own.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/new" className="btn">Create an evaluation</a>
            <a href="/app" className="btn btn--ghost">Dashboard</a>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div className="card" style={{ textAlign: "center", padding: "clamp(28px, 4vw, 44px)" }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Something went wrong</div>
          <p style={{ fontSize: 14, color: "var(--fg-3)", marginBottom: 18 }}>We couldn&apos;t load a test. Try again.</p>
          <button onClick={fetchNext} className="btn">Retry</button>
        </div>
      )}

      {phase === "vote" && test && (
        <div>
          <div style={{ marginBottom: 4, fontSize: 16, color: "var(--fg-1)", fontWeight: 700, fontFamily: "var(--font-display)" }}>{test.title}</div>
          {test.context && <div style={{ fontSize: 13, color: "var(--fg-4)", marginBottom: 14 }}>{test.context}</div>}
          {screening.length > 0 && (
            <div className="card" style={{ marginBottom: 16, marginTop: 14, display: "flex", flexDirection: "column", gap: 14, background: "var(--bg-2)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>A few quick questions first</div>
              {screening.map((q) => (
                <div key={q.id}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)", marginBottom: 8 }}>{q.question}{q.is_required ? "" : <span style={{ color: "var(--fg-5)", fontWeight: 400 }}> (optional)</span>}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {q.options.map((opt) => {
                      const sel = answers[q.id] === opt;
                      return <button key={opt} onClick={() => setAnswers((a) => ({ ...a, [q.id]: opt }))} className="chip" style={{ cursor: "pointer", ...(sel ? { borderColor: "var(--acc)", color: "var(--acc-deep)", background: "var(--acc-soft)" } : {}) }}>{opt}</button>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {(() => {
            const isText = options.every((o) => !o.asset_url);
            return (
              <div style={{ display: "grid", gridTemplateColumns: isText ? "repeat(auto-fit, minmax(260px,1fr))" : "repeat(auto-fit, minmax(150px,1fr))", gap: 12, marginBottom: 16, marginTop: 14 }}>
                {options.map((o) => {
                  const sel = selected === o.id;
                  return (
                    <button key={o.id} onClick={() => setSelected(o.id)} style={{ position: "relative", textAlign: "left", border: `2px solid ${sel ? "var(--acc)" : "var(--line-2)"}`, borderRadius: "var(--r-sm)", overflow: "hidden", background: "var(--bg-1)", cursor: "pointer", padding: 0, boxShadow: sel ? "0 0 0 3px var(--acc-soft)" : "none", transform: sel ? "translateY(-2px)" : "none", transition: "border-color .15s ease, box-shadow .15s ease, transform .15s ease" }}>
                      {o.asset_url
                        ? <div style={{ aspectRatio: "1/1", backgroundImage: `url(${o.asset_url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                        : <div style={{ padding: "34px 16px 16px", fontSize: 14.5, lineHeight: 1.55, color: "var(--fg-1)", fontFamily: "var(--font-sans)", whiteSpace: "pre-wrap", maxHeight: 260, overflowY: "auto" }}>{o.label}</div>}
                      <span style={{ position: "absolute", top: 8, left: 8, width: 24, height: 24, borderRadius: "50%", background: sel ? "var(--acc)" : (o.asset_url ? "rgba(0,0,0,0.5)" : "var(--bg-2)"), color: o.asset_url || sel ? "#fff" : "var(--fg-3)", display: "grid", placeItems: "center", fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, border: o.asset_url ? "none" : "1px solid var(--line-2)" }}>{LETTERS[o.position]}</span>
                      {sel && <span style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%", background: "var(--acc)", color: "#fff", display: "grid", placeItems: "center", fontSize: 13 }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            );
          })()}
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why did you pick it? (optional, helps the report)" rows={2} style={{ width: "100%", padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontSize: 14, fontFamily: "var(--font-sans)", outline: "none", boxSizing: "border-box", marginBottom: 12, resize: "vertical" }} />
          {err && <p style={{ color: "var(--err)", fontSize: 13, marginBottom: 10 }}>{err}</p>}
          {(() => {
            const screenReady = screening.every((q) => !q.is_required || answers[q.id]);
            const ready = !!selected && screenReady && !busy;
            return <button onClick={submit} disabled={!ready} className="btn btn--lg" style={{ justifyContent: "center", width: "100%", opacity: ready ? 1 : 0.55 }}>{busy ? "Saving…" : "Submit & next →"}</button>;
          })()}
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", marginTop: 12, lineHeight: 1.6 }}>Only valid human judgments count. Very fast, duplicate, or spammy responses may be filtered. Helpful reasons improve the decision report.</p>
        </div>
      )}
    </div>
  );
}
