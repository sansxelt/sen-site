"use client";

import { useEffect, useState } from "react";

const RECOMMENDED = [9, 39, 99, 299, 999];
const MIN = 5, MAX = 9999, RATE = 10;

const RULES: [string, string][] = [
  ["1 credit = 1 valid judgment", "You only pay for real human feedback."],
  ["Held when you launch", "Credits are escrowed, not spent up front."],
  ["Invalid votes filtered", "Too-fast, duplicate and spam votes are rejected."],
  ["Unused credits refunded", "If a test doesn't fill, the rest comes back."],
];

export default function CreditsPage() {
  const [amount, setAmount] = useState<number>(39);
  const [custom, setCustom] = useState("");
  const [bal, setBal] = useState<number | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    const load = () => fetch("/api/v/me").then((r) => r.json()).then((j) => { if (j.signedIn) setBal(j.balance); }).catch(() => {});
    load();
    const sid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("session_id") : null;
    if (sid) {
      setPaid(true);
      window.history.replaceState({}, "", "/app/credits");
      let tries = 0;
      const iv = setInterval(() => { tries += 1; load(); if (tries >= 6) clearInterval(iv); }, 2000);
      return () => clearInterval(iv);
    }
  }, []);

  const usingCustom = custom !== "";
  const effective = usingCustom ? Math.floor(Number(custom) || 0) : amount;
  const valid = effective >= MIN && effective <= MAX;
  const credits = (valid ? effective : 0) * RATE;

  function go() { if (valid) window.location.href = `/app/checkout?amount=${effective}`; }

  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Credits</p>
          <h1 className="display">Top up credits</h1>
          <p>$1 = 10 credits · 1 credit = 1 real human vote · credits never expire.</p>
        </div>
        {bal !== null && (
          <div className="stat" style={{ minWidth: 150 }}>
            <div className="stat__l">Balance</div>
            <div className="stat__v tnum">{bal.toLocaleString()}</div>
            <div className="stat__s">credits available</div>
          </div>
        )}
      </div>

      {paid && (
        <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)", background: "var(--acc-soft)", boxShadow: "none" }}>
          <p style={{ margin: 0, color: "var(--acc-deep)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><span className="dot dot--acc" />Payment received — your new credits will appear here within a few seconds.</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: 18, alignItems: "start" }} className="cols-stack">
        {/* picker */}
        <div className="card">
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Recommended packs</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px,1fr))", gap: 10, marginBottom: 24 }}>
            {RECOMMENDED.map((a) => {
              const on = !usingCustom && amount === a;
              return (
                <button key={a} onClick={() => { setAmount(a); setCustom(""); }} style={{ textAlign: "left", padding: "14px 16px", borderRadius: "var(--r-lg)", cursor: "pointer", border: `1.5px solid ${on ? "var(--acc-line-2)" : "var(--line-2)"}`, background: on ? "var(--acc-soft)" : "var(--bg-1)", boxShadow: on ? "0 0 0 3px var(--acc-soft)" : "var(--shadow-sm)", transition: "all .15s ease" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20, color: on ? "var(--acc-deep)" : "var(--fg-1)" }}>${a}</div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)", marginTop: 2 }}>{(a * RATE).toLocaleString()} credits</div>
                </button>
              );
            })}
          </div>

          <div className="field" style={{ maxWidth: 260 }}>
            <span className="lbl">Or a custom amount</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, color: "var(--fg-4)" }}>$</span>
              <input type="text" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ""))} placeholder="—"
                style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px 12px 30px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 20, outline: "none" }} />
            </div>
            {!valid && usingCustom && <span style={{ color: "var(--err)", fontSize: 12.5 }}>Enter an amount between ${MIN} and ${MAX.toLocaleString()}.</span>}
            <span className="hint">Min ${MIN}, max ${MAX.toLocaleString()}.</span>
          </div>
        </div>

        {/* summary */}
        <div className="card" style={{ position: "sticky", top: 84, borderColor: "var(--acc-line)" }}>
          <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>You'll receive</div>
          <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(2.2rem, 4vw, 2.8rem)", letterSpacing: "-0.03em", color: valid ? "var(--acc-deep)" : "var(--fg-4)", lineHeight: 1 }}>{credits.toLocaleString()}</div>
          <div style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 4, marginBottom: 18 }}>credits for ${valid ? effective.toLocaleString() : "—"}</div>
          <button onClick={go} disabled={!valid} className="btn btn--lg" style={{ width: "100%", justifyContent: "center", opacity: valid ? 1 : 0.55 }}>Continue to checkout <span aria-hidden>→</span></button>
          <p style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", marginTop: 12, lineHeight: 1.6 }}>Secure checkout on Vraelis (Stripe). No credits? <a href="/vote" style={{ color: "var(--acc-deep)" }}>Vote to earn →</a></p>
        </div>
      </div>

      {/* rules */}
      <div style={{ marginTop: 30 }}>
        <div style={{ fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>How credits work</div>
        <div className="tile-grid cols-4">
          {RULES.map(([t, d]) => (
            <div key={t} className="acard" style={{ gap: 6 }}>
              <div className="acard__t" style={{ fontSize: 14.5 }}>{t}</div>
              <div className="acard__d">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
