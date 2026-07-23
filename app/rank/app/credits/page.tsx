"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const RECOMMENDED = [9, 39, 99, 299, 999];
// $999,999 is the hard ceiling for a single Stripe charge; it's the default max.
const MIN = 5, DEFAULT_MAX = 999999, RATE = 10;

const RULES: [string, string][] = [
  ["Pays for validation runs", "Your balance covers verifying your app before it ships. Each verification draws from it and settles only when it actually executes."],
  ["Nothing ran, nothing charged", "If a run cannot start or no flow executes, the hold is returned automatically."],
  ["Early access pricing", "Per-verification pricing ($10 per verification, 5 flows included) is rolling out. Your balance keeps its full purchase value through the change."],
  ["Larger volumes", "Invoicing is available for teams that need more than a single top-up."],
];

const eyebrow = { fontFamily: "var(--font-code)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 12 } as const;
const bigNum = { fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "clamp(2.1rem, 4vw, 2.7rem)", letterSpacing: "-0.03em", lineHeight: 1 } as const;

export default function CreditsPage() {
  const [amount, setAmount] = useState<number>(39);
  const [custom, setCustom] = useState("");
  const [bal, setBal] = useState<number | null>(null);
  const [paid, setPaid] = useState(false);
  const [MAX, setMAX] = useState(DEFAULT_MAX);
  const [elevated, setElevated] = useState(false);
  const [plan, setPlan] = useState<string>("free");

  useEffect(() => {
    const load = () => fetch("/api/v/me").then((r) => r.json()).then((j) => { if (j.signedIn) { setBal(j.balance); if (typeof j.topupMax === "number") setMAX(j.topupMax); setElevated(!!j.elevatedTopup); if (j.plan) setPlan(j.plan); } }).catch(() => {});
    load();
    // Stripe returns with session_id; a PayPal credit top-up returns with paypal=1. Both
    // credit via webhook/capture, so poll the balance until it lands.
    const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
    if (params && (params.get("session_id") || params.get("paypal"))) {
      setPaid(true);
      window.history.replaceState({}, "", "/credits");
      let tries = 0;
      const iv = setInterval(() => { tries += 1; load(); if (tries >= 8) clearInterval(iv); }, 2000);
      return () => clearInterval(iv);
    }
  }, []);

  const usingCustom = custom !== "";
  const effective = usingCustom ? Math.floor(Number(custom) || 0) : amount;
  const valid = effective >= MIN && effective <= MAX;
  const credits = (valid ? effective : 0) * RATE;

  function go() { if (valid) window.location.href = `/checkout?amount=${effective}`; }

  return (
    <div className="wrap" style={{ maxWidth: 880, paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Credits</p>
          <h1 className="display">Top up credits</h1>
          <p>Your balance pays for validating your AI-built app before it ships. Each verification draws from it and only settles when it actually executes. Per-verification pricing is rolling out; your balance keeps its full purchase value through the change.</p>
        </div>
      </div>

      {plan !== "free" && (
        <div className="card" style={{ marginBottom: 22, background: "var(--bg-2)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>You&apos;re on the <strong style={{ color: "var(--fg-1)", textTransform: "capitalize" }}>{plan}</strong> plan, your monthly credits refresh automatically. Top up here only if you want extra beyond your plan.</div>
          <Link href="/plans" style={{ fontSize: 13, color: "var(--acc-deep)", whiteSpace: "nowrap" }}>Manage plan →</Link>
        </div>
      )}

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
              <input type="text" inputMode="numeric" value={custom} onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} placeholder="0"
                style={{ width: "100%", boxSizing: "border-box", padding: "16px 16px 16px 36px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)", color: "var(--fg-1)", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 24, outline: "none" }} />
            </div>
            {!valid && usingCustom && <span style={{ color: "var(--err)", fontSize: 12.5 }}>Enter an amount between ${MIN} and ${MAX.toLocaleString()}.</span>}
            <span className="hint">Min ${MIN}, max ${MAX.toLocaleString()} per top-up.</span>
            {elevated && (
              <p style={{ fontSize: 12, color: "var(--fg-4)", marginTop: 8, lineHeight: 1.55 }}>Need more than ${MAX.toLocaleString()} in one go? A single payment tops out here, but we can invoice you for larger volumes (including unlimited credit for enterprise programs). <Link href="/contact" style={{ color: "var(--acc-deep)" }}>Contact us for an invoice →</Link></p>
            )}
          </div>
        </div>

        {/* right column, balance above, you'll receive below, matched size */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }} className="sticky-side">
          <div className="card" style={{ minHeight: 214, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={eyebrow}>Your balance</div>
              <div style={{ ...bigNum, color: "var(--fg-1)" }}>{bal !== null ? bal.toLocaleString() : "-"}</div>
              <div style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 6 }}>credits available</div>
            </div>
            <Link href="/billing" style={{ fontSize: 12.5, color: "var(--acc-deep)", textDecoration: "none", fontWeight: 500, marginTop: 16 }}>View credit activity →</Link>
          </div>

          <div className="card" style={{ minHeight: 214, borderColor: "var(--acc-line)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={eyebrow}>You&apos;ll receive</div>
              <div style={{ ...bigNum, color: valid ? "var(--acc-deep)" : "var(--fg-4)" }}>{credits.toLocaleString()}</div>
              <div style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 6 }}>credits for ${valid ? effective.toLocaleString() : "0"}</div>
            </div>
            <div style={{ marginTop: 16 }}>
              <button onClick={go} disabled={!valid} className="btn btn--lg" style={{ width: "100%", justifyContent: "center", opacity: valid ? 1 : 0.55 }}>Continue to checkout <span aria-hidden>→</span></button>
              <p style={{ fontFamily: "var(--font-code)", fontSize: 11, color: "var(--fg-5)", marginTop: 12, marginBottom: 0, lineHeight: 1.6 }}>Secure checkout on Vraelis, payments processed by Stripe.</p>
            </div>
          </div>
        </div>
      </div>

      {/* rules */}
      <div style={{ marginTop: 30 }}>
        <div style={eyebrow}>How your balance works</div>
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
