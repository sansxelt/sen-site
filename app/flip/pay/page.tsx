"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

type Invoice = { id: string; usd: number; chain: string; token: string; toAddress: string; amount: string; explorer: string; plan: string };
const PLAN_LABEL: Record<string, string> = { seller: "Seller", growth: "Growth" };

const mono = { fontFamily: "var(--font-code)", fontSize: 13, color: "var(--fg-1)", wordBreak: "break-all" } as const;
const label = { fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)" } as const;

export default function PayPage() {
  const [phase, setPhase] = useState<"loading" | "pay" | "paid" | "expired" | "error">("loading");
  const [inv, setInv] = useState<Invoice | null>(null);
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const plan = q.get("plan") || "";
    const cycle = q.get("cycle") || "lifetime";
    (async () => {
      try {
        const r = await fetch("/api/flip/crypto/charge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan, cycle }) });
        if (r.status === 401) { signIn("google", { callbackUrl: window.location.href }); return; }
        const j = await r.json();
        if (!r.ok) {
          setPhase("error");
          setMsg(j.error === "crypto_unavailable" ? "Crypto checkout isn't switched on yet — check back soon." : j.error === "crypto_lifetime_only" ? "Crypto is available on the lifetime plans." : "Couldn't start the payment.");
          return;
        }
        setInv(j); setPhase("pay");
      } catch { setPhase("error"); setMsg("Network error — please retry."); }
    })();
  }, []);

  useEffect(() => {
    if (phase !== "pay" || !inv) return;
    let active = true;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/flip/crypto/status?id=${inv.id}`);
        const j = await r.json();
        if (!active) return;
        if (j.status === "paid") { setPhase("paid"); clearInterval(t); }
        else if (j.status === "expired") { setPhase("expired"); clearInterval(t); }
      } catch { /* keep polling */ }
    }, 8000);
    return () => { active = false; clearInterval(t); };
  }, [phase, inv]);

  function copy(text: string, key: string) { navigator.clipboard?.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1400); }

  return (
    <section className="section" style={{ borderBottom: "none" }}>
      <div className="wrap" style={{ maxWidth: 560 }}>
        {phase === "loading" && <p className="lead-copy" style={{ textAlign: "center" }}>Preparing your payment…</p>}

        {phase === "error" && (
          <div style={{ textAlign: "center" }}>
            <h1 className="display" style={{ fontSize: "clamp(1.8rem,3.4vw,2.6rem)", marginBottom: 14 }}>Hmm.</h1>
            <p className="lead-copy" style={{ margin: "0 auto 24px" }}>{msg}</p>
            <a href="/pricing" className="btn btn--ghost">Back to pricing</a>
          </div>
        )}

        {phase === "expired" && (
          <div style={{ textAlign: "center" }}>
            <h1 className="display" style={{ fontSize: "clamp(1.8rem,3.4vw,2.6rem)", marginBottom: 14 }}>Payment window closed</h1>
            <p className="lead-copy" style={{ margin: "0 auto 24px" }}>No charge was made. Start a fresh one whenever you&apos;re ready.</p>
            <a href="/pricing" className="btn">Back to pricing</a>
          </div>
        )}

        {phase === "paid" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", margin: "0 auto 18px", display: "grid", placeItems: "center", fontSize: 22, color: "#fff", background: "linear-gradient(158deg, var(--acc) 0%, var(--acc-deep) 100%)" }}>✓</div>
            <h1 className="display" style={{ fontSize: "clamp(2rem,4vw,3rem)", marginBottom: 14 }}>Payment <span className="em">confirmed</span>.</h1>
            <p className="lead-copy" style={{ margin: "0 auto 26px" }}>Your USDC landed and you&apos;re Pro — unlimited listings, for good.</p>
            <a href="/account" className="btn btn--lg">Go to your account <span aria-hidden>→</span></a>
          </div>
        )}

        {phase === "pay" && inv && (
          <div>
            <p className="eyebrow">Pay with USDC</p>
            <h1 className="display" style={{ fontSize: "clamp(1.9rem,3.6vw,2.8rem)", marginBottom: 10 }}>
              {PLAN_LABEL[inv.plan] || "Pro"} — <span className="em">lifetime</span>.
            </h1>
            <p style={{ color: "var(--fg-3)", fontSize: 14.5, lineHeight: 1.55, marginBottom: 22 }}>
              Send <b style={{ color: "var(--fg-1)" }}>exactly</b> the amount below in USDC on <b style={{ color: "var(--fg-1)" }}>{inv.chain}</b>, from any wallet or exchange. We confirm it on-chain automatically — keep this page open.
            </p>

            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={label}>Amount (exact)</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>{inv.amount} <span style={{ fontSize: 14, color: "var(--fg-4)" }}>USDC</span></span>
                  <button onClick={() => copy(inv.amount, "amt")} className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5 }}>{copied === "amt" ? "Copied ✓" : "Copy"}</button>
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--line-1)", paddingTop: 14 }}>
                <div style={label}>To this address · {inv.chain}</div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 }}>
                  <span style={mono}>{inv.toAddress}</span>
                  <button onClick={() => copy(inv.toAddress, "addr")} className="btn btn--ghost" style={{ padding: "6px 12px", fontSize: 12.5, whiteSpace: "nowrap" }}>{copied === "addr" ? "Copied ✓" : "Copy"}</button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)" }}>
              <span className="dot dot--acc pulse" /> Waiting for your payment…
            </div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-5)", marginTop: 14, lineHeight: 1.6 }}>
              Send the <b>exact</b> amount (the trailing digits identify your order). Only USDC on {inv.chain}. This window stays open for 60 minutes.{" "}
              <a href={`${inv.explorer}/address/${inv.toAddress}`} target="_blank" rel="noreferrer" style={{ color: "var(--acc-deep)" }}>View on explorer →</a>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
