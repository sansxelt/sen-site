"use client";

import { useEffect, useState } from "react";

type Cycle = "monthly" | "yearly";

const PLANS: { key: string; name: string; price: Record<Cycle, number>; credits: string; perks: string[]; featured?: boolean }[] = [
  { key: "free", name: "Free", price: { monthly: 0, yearly: 0 }, credits: "25 one-time", perks: ["1 active test", "Up to 4 options", "Human votes + AI report"] },
  { key: "starter", name: "Starter", price: { monthly: 19, yearly: 190 }, credits: "150 / mo", perks: ["3 active tests / mo", "Up to 5 options", "AI winner report"] },
  { key: "creator", name: "Creator", price: { monthly: 49, yearly: 490 }, credits: "500 / mo", perks: ["10 active tests / mo", "Up to 6 options", "Audience targeting"] },
  { key: "pro", name: "Pro", price: { monthly: 149, yearly: 1490 }, credits: "2,000 / mo", perks: ["30 active tests / mo", "Up to 8 options", "Targeting + Discord bot"], featured: true },
  { key: "scale", name: "Scale", price: { monthly: 399, yearly: 3990 }, credits: "7,500 / mo", perks: ["100 active tests / mo", "Public API access", "Targeting + Discord bot"] },
  { key: "enterprise", name: "Enterprise", price: { monthly: -1, yearly: -1 }, credits: "Custom", perks: ["Unlimited tests", "SSO + SLA", "Dedicated support"] },
];

const ORDER: Record<string, number> = { free: 0, starter: 1, creator: 2, pro: 3, scale: 4, enterprise: 5 };

export default function PlansPage() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [plan, setPlan] = useState<string>("free");
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState<Record<string, Record<string, { available: boolean; amount?: number }>>>({});

  useEffect(() => {
    fetch("/api/v/me").then((r) => r.json()).then((j) => { if (j.signedIn) { setSignedIn(true); setPlan(j.plan || "free"); } }).catch(() => {});
    fetch("/api/v/plans").then((r) => r.json()).then((j) => setPrices(j.plans || {})).catch(() => {});
  }, []);

  async function manageBilling() {
    setBusy(true);
    try {
      const r = await fetch("/api/v/portal", { method: "POST" });
      const j = await r.json();
      if (j.url) window.location.href = j.url;
      else alert(j.error === "no_subscription" ? "No billing account yet — subscribe to a plan first." : "Couldn't open billing.");
    } finally { setBusy(false); }
  }

  return (
    <div className="wrap" style={{ paddingTop: "clamp(24px, 3vw, 40px)", paddingBottom: 80 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <p className="eyebrow">Plans</p>
          <h1 className="display" style={{ fontSize: "clamp(1.8rem, 3.4vw, 2.6rem)" }}>Pick a plan</h1>
          <p className="lead-copy" style={{ marginTop: 4 }}>Plans refresh credits every month. Need more mid-cycle? <a href="/app/credits" style={{ color: "var(--acc-deep)" }}>Top up anytime →</a></p>
        </div>
        {signedIn && plan !== "free" && (
          <button onClick={manageBilling} disabled={busy} className="btn btn--ghost">{busy ? "Opening…" : "Manage billing"}</button>
        )}
      </div>

      {/* cycle toggle */}
      <div style={{ display: "inline-flex", gap: 4, padding: 4, borderRadius: 999, border: "1px solid var(--line-2)", background: "var(--bg-1)", margin: "22px 0 30px" }}>
        {(["monthly", "yearly"] as Cycle[]).map((c) => (
          <button key={c} onClick={() => setCycle(c)} style={{
            padding: "8px 18px", borderRadius: 999, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14,
            background: cycle === c ? "var(--acc)" : "transparent", color: cycle === c ? "#fff" : "var(--fg-3)",
          }}>{c === "monthly" ? "Monthly" : "Yearly"}</button>
        ))}
      </div>

      <div className="cols-3" style={{ alignItems: "stretch" }}>
        {PLANS.map((p) => {
          const isCurrent = signedIn && plan === p.key;
          const isEnterprise = p.key === "enterprise";
          const isFree = p.key === "free";
          const lower = signedIn && ORDER[p.key] < ORDER[plan];
          const cell = prices[p.key]?.[cycle];
          const available = isFree || isEnterprise || !!(cell?.available && cell.amount != null);
          const price = cell?.amount ?? p.price[cycle];
          return (
            <div key={p.key} className="card" style={{
              display: "flex", flexDirection: "column", gap: 12,
              border: p.featured ? "1.5px solid var(--acc)" : "1px solid var(--line-2)",
              boxShadow: p.featured ? "0 0 0 4px var(--acc-soft)" : "none", position: "relative",
            }}>
              {p.featured && <span className="pill" style={{ position: "absolute", top: -12, left: 20, background: "var(--acc)", color: "#fff", borderColor: "var(--acc)" }}>Most popular</span>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700 }}>{p.name}</h3>
                {isCurrent && <span className="pill" style={{ background: "var(--acc-soft)", color: "var(--acc-deep)", borderColor: "var(--acc)" }}>Current</span>}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                {isEnterprise ? (
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700 }}>Custom</span>
                ) : !available ? (
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--fg-4)" }}>Coming soon</span>
                ) : (
                  <>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em" }}>${price.toLocaleString()}</span>
                    <span style={{ color: "var(--fg-4)", fontSize: 14 }}>/{cycle === "yearly" ? "yr" : "mo"}</span>
                  </>
                )}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--acc-deep)", fontWeight: 600 }}>{p.credits} credits</div>
              <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 8px", display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                {p.perks.map((perk) => (
                  <li key={perk} style={{ fontSize: 13.5, color: "var(--fg-2)", display: "flex", gap: 8 }}><span style={{ color: "var(--acc)" }}>✓</span>{perk}</li>
                ))}
              </ul>
              {isCurrent ? (
                <button className="btn btn--ghost" disabled style={{ opacity: 0.6 }}>Your plan</button>
              ) : isEnterprise ? (
                <a className="btn btn--ghost" href="mailto:hello@vraelis.com?subject=Vraelis%20Enterprise">Contact sales</a>
              ) : isFree ? (
                <a className="btn btn--ghost" href="/app">Get started free</a>
              ) : !available ? (
                <button className="btn btn--ghost" disabled style={{ opacity: 0.6 }}>Coming soon</button>
              ) : (
                <a className="btn" href={`/app/checkout?plan=${p.key}&cycle=${cycle}`}>{lower ? "Switch" : "Upgrade"} to {p.name}</a>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 28, lineHeight: 1.7 }}>
        Plan credits refresh each billing cycle and don&apos;t roll over. Top-up credits you buy never expire. Cancel anytime — your plan stays active until the end of the period. 1 credit = 1 real human vote.
      </p>
    </div>
  );
}
