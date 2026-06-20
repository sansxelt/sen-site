"use client";

import { useEffect, useState } from "react";

const RECOMMENDED = [9, 39, 99, 299, 999];
const MIN = 5, MAX = 9999, RATE = 10;

export default function CreditsPage() {
  const [amount, setAmount] = useState<number>(39);
  const [custom, setCustom] = useState("");
  const [bal, setBal] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/v/me").then((r) => r.json()).then((j) => { if (j.signedIn) setBal(j.balance); }).catch(() => {});
  }, []);

  const usingCustom = custom !== "";
  const effective = usingCustom ? Math.floor(Number(custom) || 0) : amount;
  const valid = effective >= MIN && effective <= MAX;
  const credits = (valid ? effective : 0) * RATE;

  function go() {
    if (!valid) return;
    window.location.href = `/app/checkout?amount=${effective}`;
  }

  const pill = (active: boolean) => ({
    padding: "12px 18px", borderRadius: "var(--r-sm)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18,
    border: `1.5px solid ${active ? "var(--acc)" : "var(--line-2)"}`, background: active ? "var(--acc-soft)" : "var(--bg-1)",
    color: active ? "var(--acc-deep)" : "var(--fg-1)", cursor: "pointer", boxShadow: active ? "0 0 0 3px var(--acc-soft)" : "none",
  } as const);

  return (
    <div className="wrap" style={{ maxWidth: 680, paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 6 }}>
        <div>
          <p className="eyebrow">Credits</p>
          <h1 className="display" style={{ fontSize: "clamp(1.7rem, 3vw, 2.3rem)" }}>Top up credits</h1>
        </div>
        {bal !== null && <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--fg-1)" }}>{bal.toLocaleString()}<span style={{ fontSize: 13, color: "var(--fg-4)", fontWeight: 500, marginLeft: 6 }}>credits</span></span>}
      </div>
      <p className="lead-copy" style={{ marginBottom: 28 }}>$1 = 10 credits. 1 credit = 1 real human vote. Credits don&apos;t expire.</p>

      {/* recommended */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Recommended</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 26 }}>
        {RECOMMENDED.map((a) => (
          <button key={a} onClick={() => { setAmount(a); setCustom(""); }} style={pill(!usingCustom && amount === a)}>${a}</button>
        ))}
      </div>

      {/* custom */}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 }}>Custom amount</div>
      <div style={{ position: "relative", maxWidth: 240, marginBottom: 24 }}>
        <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, color: "var(--fg-4)" }}>$</span>
        <input
          type="text" inputMode="numeric" value={custom}
          onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); setCustom(v); }}
          placeholder="—"
          style={{ width: "100%", boxSizing: "border-box", padding: "12px 14px 12px 30px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, outline: "none" }}
        />
      </div>

      {/* live credits */}
      <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginBottom: 22 }}>
        <span style={{ fontSize: 14, color: "var(--fg-3)" }}>You&apos;ll receive</span>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: valid ? "var(--acc-deep)" : "var(--fg-4)" }}>{credits.toLocaleString()}<span style={{ fontSize: 14, color: "var(--fg-4)", fontWeight: 500, marginLeft: 8 }}>credits</span></span>
      </div>

      {!valid && usingCustom && <p style={{ color: "var(--err)", fontSize: 13, marginBottom: 14 }}>Enter an amount between ${MIN} and ${MAX.toLocaleString()}.</p>}

      <button onClick={go} disabled={!valid} className="btn btn--lg" style={{ width: "100%", justifyContent: "center", opacity: valid ? 1 : 0.55 }}>
        Continue to checkout <span aria-hidden>→</span>
      </button>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 14, lineHeight: 1.6 }}>
        Min ${MIN}, max ${MAX.toLocaleString()}. Secure checkout on Vraelis (Stripe). Out of credits and don&apos;t want to pay? <a href="/vote" style={{ color: "var(--acc-deep)" }}>Vote to earn them →</a>
      </p>
    </div>
  );
}
