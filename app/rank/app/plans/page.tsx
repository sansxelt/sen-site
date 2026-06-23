"use client";

import { useEffect, useState } from "react";

type Cycle = "monthly" | "yearly";

const PLANS: { key: string; name: string; price: Record<Cycle, number>; credits: string; blurb: string; perks: string[]; featured?: boolean }[] = [
  { key: "free", name: "Free", price: { monthly: 0, yearly: 0 }, credits: "25 valid judgments", blurb: "Try one small evaluation.", perks: ["Compare up to 4 candidates", "Sample decision report"] },
  { key: "starter", name: "Starter", price: { monthly: 19, yearly: 190 }, credits: "150 valid judgments / mo", blurb: "For small creative decisions.", perks: ["3 evaluations / mo", "Recommendation + reasoning report"] },
  { key: "creator", name: "Creator", price: { monthly: 49, yearly: 490 }, credits: "500 valid judgments / mo", blurb: "For ongoing creative testing.", perks: ["10 evaluations / mo", "Audience targeting", "Shareable decision reports"] },
  { key: "pro", name: "Pro", price: { monthly: 149, yearly: 1490 }, credits: "2,000 valid judgments / mo", blurb: "For teams and client work.", perks: ["30 evaluations / mo", "Client-ready reports", "Exports + webhooks"], featured: true },
  { key: "scale", name: "Scale", price: { monthly: 399, yearly: 3990 }, credits: "7,500 valid judgments / mo", blurb: "For apps and high-volume teams.", perks: ["100 evaluations / mo", "Public API + embed", "Developer analytics + webhooks"] },
  { key: "enterprise", name: "Enterprise", price: { monthly: -1, yearly: -1 }, credits: "Custom valid judgments", blurb: "For governed evaluation programs.", perks: ["Unlimited evaluations", "SSO, SLA, support", "Custom exports + workflows"] },
];

const ORDER: Record<string, number> = { free: 0, starter: 1, creator: 2, pro: 3, scale: 4, enterprise: 5 };

// Display-only whole-dollar formatting (live Stripe price may carry cents). Does
// NOT change the amount Stripe charges at checkout.
const fmtAmount = (n: number) => (Number.isInteger(n) ? n : Math.floor(n)).toLocaleString();

export default function PlansPage() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [plan, setPlan] = useState<string>("free");
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prices, setPrices] = useState<Record<string, Record<string, { available: boolean; amount?: number }>>>({});
  const [note, setNote] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    const loadMe = () => fetch("/api/v/me").then((r) => r.json()).then((j) => { if (j.signedIn) { setSignedIn(true); setPlan(j.plan || "free"); } }).catch(() => {});
    loadMe();
    fetch("/api/v/plans").then((r) => r.json()).then((j) => setPrices(j.plans || {})).catch(() => {});
    const sid = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("session_id") : null;
    if (sid) {
      setSubscribed(true);
      window.history.replaceState({}, "", "/app/plans");
      let tries = 0;
      const iv = setInterval(() => { tries += 1; loadMe(); if (tries >= 6) clearInterval(iv); }, 2000);
      return () => clearInterval(iv);
    }
  }, []);

  async function manageBilling() {
    setBusy(true); setNote("");
    try {
      const r = await fetch("/api/v/portal", { method: "POST" });
      const j = await r.json().catch(() => ({}));
      if (j.url) window.location.href = j.url;
      else setNote(j.error === "no_subscription" ? "No billing account yet. Subscribe to a plan first." : "Couldn't open billing. Try again.");
    } catch { setNote("Couldn't open billing. Try again."); } finally { setBusy(false); }
  }

  return (
    <div className="wrap" style={{ paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Plans</p>
          <h1 className="display">Pick a plan</h1>
          <p>Each plan gives you valid human signal, a recommendation with reasoning, and exportable decision reports. Credits refresh monthly — <a href="/app/credits" style={{ color: "var(--acc-deep)" }}>top up anytime →</a></p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div className="seg">
            {(["monthly", "yearly"] as Cycle[]).map((c) => (
              <button key={c} onClick={() => setCycle(c)} className={cycle === c ? "on" : ""}>{c === "monthly" ? "Monthly" : "Yearly"}</button>
            ))}
          </div>
          {signedIn && <button onClick={manageBilling} disabled={busy} className="btn btn--ghost">{busy ? "Opening…" : "Manage billing"}</button>}
        </div>
      </div>

      {subscribed && (
        <div className="card" style={{ marginBottom: 18, borderColor: "var(--acc-line)", background: "var(--acc-soft)", boxShadow: "none" }}>
          <p style={{ margin: 0, color: "var(--acc-deep)", fontSize: 14, fontWeight: 600 }}>Subscription received. Your plan and credits will activate in a few seconds.</p>
        </div>
      )}
      {note && <p style={{ color: "var(--fg-3)", fontSize: 13, marginBottom: 14 }}>{note}</p>}

      <div className="tile-grid cols-3">
        {PLANS.map((p) => {
          const isCurrent = signedIn && plan === p.key;
          const isEnterprise = p.key === "enterprise";
          const isFree = p.key === "free";
          const lower = signedIn && ORDER[p.key] < ORDER[plan];
          const cell = prices[p.key]?.[cycle];
          const available = isFree || isEnterprise || !!(cell?.available && cell.amount != null);
          const price = cell?.amount ?? p.price[cycle];
          return (
            <div key={p.key} className={`price${p.featured ? " price--hot" : ""}`}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="price__name">{p.name}</span>
                {isCurrent && <span className="badge-now">Current</span>}
              </div>
              <div>
                {isEnterprise ? <div className="price__amt">Custom</div>
                  : !available ? <div className="price__amt" style={{ color: "var(--fg-4)", fontSize: "1.6rem" }}>Coming soon</div>
                  : <div className="price__amt">${fmtAmount(price)}<small>/{cycle === "yearly" ? "yr" : "mo"}</small></div>}
                <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>{p.credits}</div>
              </div>
              <div style={{ fontSize: 13.5, color: "var(--fg-3)", marginTop: 8 }}>{p.blurb}</div>
              <ul className="price__feat">
                {p.perks.map((perk) => <li key={perk}>{perk}</li>)}
              </ul>
              {isCurrent ? <button className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center", opacity: 0.6 }} disabled>Your plan</button>
                : isEnterprise ? <a className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center" }} href="mailto:hello@vraelis.com?subject=Vraelis%20Enterprise">Contact sales</a>
                : isFree ? <a className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center" }} href="/app">Get started free</a>
                : !available ? <button className="btn btn--ghost" style={{ marginTop: "auto", justifyContent: "center", opacity: 0.6 }} disabled>Coming soon</button>
                : <a className={p.featured ? "btn" : "btn btn--ghost"} style={{ marginTop: "auto", justifyContent: "center" }} href={`/app/checkout?plan=${p.key}&cycle=${cycle}`}>{lower ? "Switch" : "Upgrade"} to {p.name}</a>}
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 28, lineHeight: 1.6, textAlign: "center", maxWidth: 620, marginInline: "auto" }}>
        Plan credits refresh each billing cycle and don&apos;t roll over. Top-up credits you buy never expire. Cancel anytime, and your plan stays active until the period ends.
      </p>
    </div>
  );
}
