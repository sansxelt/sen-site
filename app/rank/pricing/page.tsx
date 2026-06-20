"use client";

import { useEffect, useState } from "react";

type Cycle = "monthly" | "yearly";

const PLANS = [
  { key: "free", name: "Free", price: { monthly: 0, yearly: 0 }, credits: "25 one-time", blurb: "Try the loop.", perks: ["1 active test", "Up to 4 options", "Human votes + AI report"] },
  { key: "starter", name: "Starter", price: { monthly: 19, yearly: 190 }, credits: "150 / mo", blurb: "Testing occasionally.", perks: ["3 active tests / mo", "Up to 5 options", "AI winner report"] },
  { key: "creator", name: "Creator", price: { monthly: 49, yearly: 490 }, credits: "500 / mo", blurb: "Active creators & designers.", perks: ["10 active tests / mo", "Up to 6 options", "Audience targeting"] },
  { key: "pro", name: "Pro", price: { monthly: 149, yearly: 1490 }, credits: "2,000 / mo", blurb: "Brands, studios & teams.", perks: ["30 active tests / mo", "Up to 8 options", "Targeting + Discord (soon)"], featured: true },
  { key: "scale", name: "Scale", price: { monthly: 399, yearly: 3990 }, credits: "7,500 / mo", blurb: "Agencies, AI tools & platforms.", perks: ["100 active tests / mo", "Public API + embed widget", "Targeting + priority"] },
  { key: "enterprise", name: "Enterprise", price: { monthly: -1, yearly: -1 }, credits: "Custom", blurb: "High volume + compliance.", perks: ["Unlimited tests", "SSO + SLA", "Dedicated support"] },
] as { key: string; name: string; price: Record<Cycle, number>; credits: string; blurb: string; perks: string[]; featured?: boolean }[];

const ORDER: Record<string, number> = { free: 0, starter: 1, creator: 2, pro: 3, scale: 4, enterprise: 5 };

export default function PricingPage() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [signedIn, setSignedIn] = useState(false);
  const [plan, setPlan] = useState("free");
  const [prices, setPrices] = useState<Record<string, Record<string, { available: boolean; amount?: number }>>>({});

  useEffect(() => {
    fetch("/api/v/me").then((r) => r.json()).then((j) => { if (j.signedIn) { setSignedIn(true); setPlan(j.plan || "free"); } }).catch(() => {});
    fetch("/api/v/plans").then((r) => r.json()).then((j) => setPrices(j.plans || {})).catch(() => {});
  }, []);

  function cta(p: typeof PLANS[number], available: boolean) {
    if (p.key === "enterprise") return <a className="btn btn--ghost" href="mailto:hello@vraelis.com?subject=Vraelis%20Enterprise">Contact sales</a>;
    if (p.key === "free") return <a className="btn btn--ghost" href={signedIn ? "/app/new" : "/signin?callbackUrl=%2Fapp%2Fnew"}>Get started free</a>;
    if (signedIn && plan === p.key) return <button className="btn btn--ghost" disabled style={{ opacity: 0.6 }}>Your plan</button>;
    if (!available) return <button className="btn btn--ghost" disabled style={{ opacity: 0.6 }}>Coming soon</button>;
    const dest = `/app/checkout?plan=${p.key}&cycle=${cycle}`;
    const href = signedIn ? dest : `/signin?callbackUrl=${encodeURIComponent(dest)}`;
    const verb = signedIn && ORDER[p.key] < ORDER[plan] ? "Switch to" : "Choose";
    return <a className="btn" href={href}>{verb} {p.name}</a>;
  }

  return (
    <div>
      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
        <div className="gridbg" />
        <div className="wrap" style={{ position: "relative", paddingTop: "clamp(40px, 6vw, 72px)", paddingBottom: "clamp(20px, 3vw, 32px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Pricing</p>
          <h1 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 14 }}>Simple plans. <span className="em">Real</span> feedback.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 24px", textAlign: "center" }}>Every plan includes monthly credits. <strong style={{ color: "var(--fg-1)" }}>1 credit = 1 human judgment.</strong> Need more mid-cycle? Top up anytime.</p>
          <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 999, border: "1px solid var(--line-2)", background: "var(--bg-1)" }}>
            {(["monthly", "yearly"] as Cycle[]).map((c) => (
              <button key={c} onClick={() => setCycle(c)} style={{ padding: "8px 20px", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: cycle === c ? "var(--acc)" : "transparent", color: cycle === c ? "#fff" : "var(--fg-3)" }}>{c === "monthly" ? "Monthly" : "Yearly"}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ borderBottom: "none" }}>
        <div className="wrap">
          <div className="cols-3" style={{ gap: 14, alignItems: "stretch" }}>
            {PLANS.map((p) => {
              const cell = prices[p.key]?.[cycle];
              const isFreeOrEnt = p.key === "free" || p.key === "enterprise";
              const available = isFreeOrEnt || !!(cell?.available && cell.amount != null);
              const price = cell?.amount ?? p.price[cycle];
              return (
                <div key={p.key} className="card" style={{ display: "flex", flexDirection: "column", gap: 12, position: "relative", border: p.featured ? "1.5px solid var(--acc)" : undefined, boxShadow: p.featured ? "0 0 0 4px var(--acc-soft)" : undefined }}>
                  {p.featured && <span className="pill" style={{ position: "absolute", top: -12, left: 20, background: "var(--acc)", color: "#fff", borderColor: "var(--acc)" }}>Most popular</span>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>{p.name}</h3>
                    {signedIn && plan === p.key && <span className="pill" style={{ background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>Current</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    {p.key === "enterprise" ? <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700 }}>Custom</span>
                      : !available ? <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--fg-4)" }}>Coming soon</span>
                      : <><span style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>${price.toLocaleString()}</span><span style={{ color: "var(--fg-4)", fontSize: 14 }}>/{cycle === "yearly" ? "yr" : "mo"}</span></>}
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--acc-deep)", fontWeight: 600 }}>{p.credits} credits</div>
                  <div style={{ fontSize: 13, color: "var(--fg-4)" }}>{p.blurb}</div>
                  <ul style={{ listStyle: "none", padding: 0, margin: "2px 0 8px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                    {p.perks.map((perk) => <li key={perk} style={{ fontSize: 13.5, color: "var(--fg-2)", display: "flex", gap: 8 }}><span style={{ color: "var(--acc)" }}>✓</span>{perk}</li>)}
                  </ul>
                  {cta(p, available)}
                </div>
              );
            })}
          </div>

          {/* credit top-ups */}
          <div className="card" style={{ marginTop: 26, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 18, flexWrap: "wrap", background: "var(--bg-2)" }}>
            <div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Need credits without a plan?</div>
              <p style={{ fontSize: 14, color: "var(--fg-3)", margin: 0 }}>Buy custom credit top-ups — $1 = 10 credits, from $5 to $9,999. Top-up credits never expire.</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[9, 39, 99].map((a) => <span key={a} className="pill">${a} → {a * 10}</span>)}
              <a className="btn" href={signedIn ? "/app/credits" : "/signin?callbackUrl=%2Fapp%2Fcredits"}>Buy credits</a>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 18, textAlign: "center" }}>Plans renew automatically; cancel anytime — plan stays active until period end. Secure checkout on Vraelis, powered by Stripe. Cards & supported wallets.</p>
        </div>
      </section>
    </div>
  );
}
