"use client";

import { useEffect, useState } from "react";

type Cycle = "monthly" | "yearly";

const PLANS = [
  { key: "free", name: "Free", price: { monthly: 0, yearly: 0 }, credits: "25 one-time", blurb: "Try a full evaluation.", perks: ["1 active evaluation", "Up to 4 options", "Human signal + AI report"] },
  { key: "starter", name: "Starter", price: { monthly: 19, yearly: 190 }, credits: "150 / mo", blurb: "Evaluate now and then.", perks: ["3 active evaluations / mo", "Up to 5 options", "AI decision report", "Shareable report links"] },
  { key: "creator", name: "Creator", price: { monthly: 49, yearly: 490 }, credits: "500 / mo", blurb: "Active creators & designers.", perks: ["10 active tests / mo", "Up to 6 options", "Audience targeting", "Embeddable tests"] },
  { key: "pro", name: "Pro", price: { monthly: 149, yearly: 1490 }, credits: "2,000 / mo", blurb: "Brands, studios & teams.", perks: ["30 active tests / mo", "Up to 8 options", "Targeting + priority", "Webhooks + exports"], featured: true },
  { key: "scale", name: "Scale", price: { monthly: 399, yearly: 3990 }, credits: "7,500 / mo", blurb: "Agencies, AI tools & platforms.", perks: ["100 active tests / mo", "Public API + embed widget", "Webhooks + JSON/CSV exports", "Priority routing"] },
  { key: "enterprise", name: "Enterprise", price: { monthly: -1, yearly: -1 }, credits: "Custom", blurb: "High volume + compliance.", perks: ["Unlimited tests", "SSO + SLA", "Dedicated support"] },
] as { key: string; name: string; price: Record<Cycle, number>; credits: string; blurb: string; perks: string[]; featured?: boolean }[];

const ORDER: Record<string, number> = { free: 0, starter: 1, creator: 2, pro: 3, scale: 4, enterprise: 5 };

const CREDIT_RULES: [string, string][] = [
  ["1 credit = 1 valid judgment", "You only pay for real human feedback."],
  ["Held when you launch", "Credits are escrowed, not spent up front."],
  ["Invalid votes filtered", "Too-fast, duplicate and spam votes are rejected."],
  ["Unused credits refunded", "If a test doesn't fill, the rest comes back."],
];

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
    const base = { marginTop: "auto", justifyContent: "center" } as const;
    if (p.key === "enterprise") return <a className="btn btn--ghost" style={base} href="mailto:hello@vraelis.com?subject=Vraelis%20Enterprise">Contact sales</a>;
    if (p.key === "free") return <a className="btn btn--ghost" style={base} href={signedIn ? "/app/new" : "/signin?callbackUrl=%2Fapp%2Fnew"}>Get started free</a>;
    if (signedIn && plan === p.key) return <button className="btn btn--ghost" style={{ ...base, opacity: 0.6 }} disabled>Your current plan</button>;
    if (!available) return <button className="btn btn--ghost" style={{ ...base, opacity: 0.6 }} disabled>Coming soon</button>;
    const dest = `/app/checkout?plan=${p.key}&cycle=${cycle}`;
    const href = signedIn ? dest : `/signin?callbackUrl=${encodeURIComponent(dest)}`;
    const verb = signedIn && ORDER[p.key] < ORDER[plan] ? "Switch to" : "Choose";
    return <a className={p.featured ? "btn" : "btn btn--ghost"} style={base} href={href}>{verb} {p.name}</a>;
  }

  return (
    <div>
      <section style={{ position: "relative" }}>
        <div className="glow glow--soft glow--bleed" />
        <div className="wrap" style={{ position: "relative", zIndex: 1, paddingTop: "clamp(44px, 6vw, 84px)", paddingBottom: "clamp(20px, 3vw, 30px)", textAlign: "center" }}>
          <p className="eyebrow" style={{ justifyContent: "center" }}>Pricing</p>
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.6rem)", marginBottom: 16 }}>Simple plans. <span className="em">Real</span> evaluation.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 26px", textAlign: "center" }}>Every plan includes monthly credits. <strong style={{ color: "var(--fg-1)" }}>1 credit = 1 valid human judgment.</strong> Need more mid-cycle? Top up anytime.</p>
          <div className="seg">
            {(["monthly", "yearly"] as Cycle[]).map((c) => (
              <button key={c} onClick={() => setCycle(c)} className={cycle === c ? "on" : ""}>{c === "monthly" ? "Monthly" : "Yearly"}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(28px, 3vw, 40px)" }}>
        <div className="wrap">
          <div className="tile-grid cols-3">
            {PLANS.map((p) => {
              const cell = prices[p.key]?.[cycle];
              const isFreeOrEnt = p.key === "free" || p.key === "enterprise";
              const available = isFreeOrEnt || !!(cell?.available && cell.amount != null);
              const price = cell?.amount ?? p.price[cycle];
              return (
                <div key={p.key} className={`price${p.featured ? " price--hot" : ""}`}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="price__name">{p.name}</span>
                    {signedIn && plan === p.key && <span className="badge-now">Current</span>}
                  </div>
                  <div>
                    {p.key === "enterprise" ? <div className="price__amt">Custom</div>
                      : !available ? <div className="price__amt" style={{ color: "var(--fg-4)", fontSize: "1.6rem" }}>Coming soon</div>
                      : <div className="price__amt">${price.toLocaleString()}<small>/{cycle === "yearly" ? "yr" : "mo"}</small></div>}
                    <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>{p.credits} credits</div>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--fg-3)" }}>{p.blurb}</div>
                  <ul className="price__feat">
                    {p.perks.map((perk) => <li key={perk}>{perk}</li>)}
                  </ul>
                  {cta(p, available)}
                </div>
              );
            })}
          </div>

          {/* credit rules */}
          <div style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
            <div className="sec-head sec-head--center" style={{ marginBottom: 24 }}>
              <p className="eyebrow">How credits work</p>
              <h2 className="display" style={{ fontSize: "clamp(1.5rem, 2.6vw, 2rem)" }}>Pay for valid human judgments, not noise.</h2>
            </div>
            <div className="tile-grid cols-4">
              {CREDIT_RULES.map(([t, d]) => (
                <div key={t} className="acard" style={{ gap: 6 }}>
                  <div className="acard__t" style={{ fontSize: 15 }}>{t}</div>
                  <div className="acard__d">{d}</div>
                </div>
              ))}
            </div>
          </div>

          {/* top-ups */}
          <div className="card" style={{ marginTop: 22, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap", background: "var(--bg-2)", borderRadius: "var(--r-xl)" }}>
            <div style={{ maxWidth: 520 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Need credits without a plan?</div>
              <p style={{ fontSize: 14, color: "var(--fg-3)", margin: 0, lineHeight: 1.55 }}>Buy custom top-ups from $5 to $99,999. Every $1 adds 10 credits, and they never expire.</p>
            </div>
            <a className="btn btn--lg" href={signedIn ? "/app/credits" : "/signin?callbackUrl=%2Fapp%2Fcredits"}>Buy credits</a>
          </div>
          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 20, textAlign: "center", lineHeight: 1.6, maxWidth: 620, marginInline: "auto" }}>Plans renew automatically. Cancel anytime, and your plan stays active until the period ends. Secure checkout on Vraelis, powered by Stripe.</p>
        </div>
      </section>
    </div>
  );
}
