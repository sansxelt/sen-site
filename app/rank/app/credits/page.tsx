"use client";

import { useEffect, useState } from "react";

const RECOMMENDED = [9, 39, 99, 299, 999];
const MIN = 5, MAX = 99999, RATE = 10;

const RULES: [string, string][] = [
  ["1 credit = 1 valid judgment", "You only pay for real human signal."],
  ["Held when you launch", "Credits are escrowed, not spent up front."],
  ["Low-quality filtered", "Too-fast, duplicate, and spam responses are rejected."],
  ["Unused credits refunded", "If an evaluation doesn't fill, the rest comes back."],
];

const eyebrow = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 } as const;
const bigNum = { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(2.1rem, 4vw, 2.7rem)", letterSpacing: "-0.03em", lineHeight: 1 } as const;

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
          <p>$1 = 10 credits. 1 credit = 1 valid judgment. Credits never expire.</p>
        </div>
      </div>

      {paid && (
        <div className="card" style={{ marginBottom: 22, borderColor: "var(--acc-line)", background: "var(--acc-soft)", boxShadow: "none" }}>
          <p style={{ margin: 0, color: "var(--acc-deep)", fontSize: 14, fontWeight: 600 }}>Payment received. Your new credits will appear here in a few seconds.</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)", gap: 18, alignItems: "start" }} className="cols-stack">
        {/* picker */}
        <div className="card">
          <div style={eyebrow}>Recommended packs</div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 26 }}>
            {RECOMMENDED.map((a) => {
              const on = !usingCustom && amount === a;
              return (
                <button key={a} onClick={() => { setAmount(a); setCustom(""); }} style={{ flex: "0 1 150px", textAlign: "center", padding: "16px 14px", borderRadius: "var(--r-lg)", cursor: "pointer", border: `1.5px solid ${on ? "var(--acc-line-2)" : "var(--line-2)"}`, background: on ? "var(--acc-soft)" : "var(--bg-1)", boxShadow: on ? "0 0 0 3px var(--acc-soft)" : "var(--shadow-sm)", transition: "all .15s ease" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 21, color: on ? "var(--acc-deep)" : "var(--fg-1)" }}>${a.toLocaleString()}</div>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)", marginTop: 3 }}>{(a * RATE).toLocaleString()} credits</div>
                </button>
              );
            })}
          </div>

          <div className="field">
            <span className="lbl">Or a custom amount</span>
            <div style={{ position: "relative", maxWidth: 440 }}>
              <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, color: "var(--fg-4)" }}>$</span>
              <input type="text" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, "").slice(0, 5))} placeholder="0"
                style={{ width: "100%", boxSizing: "border-box", padding: "16px 16px 16px 36px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, outline: "none" }} />
            </div>
            {!valid && usingCustom && <span style={{ color: "var(--err)", fontSize: 12.5 }}>Enter an amount between ${MIN} and ${MAX.toLocaleString()}.</span>}
            <span className="hint">Min ${MIN}, max ${MAX.toLocaleString()}.</span>
          </div>
        </div>

        {/* right column — balance above, you'll receive below, matched size */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="sticky-side">
          <div className="card" style={{ minHeight: 214, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={eyebrow}>Your balance</div>
              <div style={{ ...bigNum, color: "var(--fg-1)" }}>{bal !== null ? bal.toLocaleString() : "—"}</div>
              <div style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 6 }}>credits available</div>
            </div>
            <a href="/app/billing" style={{ fontSize: 12.5, color: "var(--acc-deep)", textDecoration: "none", fontWeight: 500, marginTop: 16 }}>View credit activity →</a>
          </div>

          <div className="card" style={{ minHeight: 214, borderColor: "var(--acc-line)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={eyebrow}>You&apos;ll receive</div>
              <div style={{ ...bigNum, color: valid ? "var(--acc-deep)" : "var(--fg-4)" }}>{credits.toLocaleString()}</div>
              <div style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 6 }}>credits for ${valid ? effective.toLocaleString() : "0"}</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button onClick={go} disabled={!valid} className="btn btn--lg" style={{ width: "100%", justifyContent: "center", opacity: valid ? 1 : 0.55 }}>Continue to checkout <span aria-hidden>→</span></button>
              <p style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>Secure checkout on Vraelis (Stripe). No credits? <a href="/vote" style={{ color: "var(--acc-deep)" }}>Evaluate to earn →</a></p>
            </div>
          </div>
        </div>
      </div>

      {/* rules */}
      <div style={{ marginTop: 30 }}>
        <div style={eyebrow}>How credits work</div>
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
