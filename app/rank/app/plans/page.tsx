"use client";

import { useEffect, useState } from "react";

type Cycle = "monthly" | "yearly";

const PLANS: { key: string; name: string; price: Record<Cycle, number>; credits: string; perks: string[]; featured?: boolean }[] = [
  { key: "free", name: "Free", price: { monthly: 0, yearly: 0 }, credits: "25 one-time", perks: ["1 active test", "Up to 4 options", "Human votes + AI report"] },
  { key: "starter", name: "Starter", price: { monthly: 19, yearly: 190 }, credits: "150 / mo", perks: ["3 active tests / mo", "Up to 5 options", "AI winner report"] },
  { key: "creator", name: "Creator", price: { monthly: 49, yearly: 490 }, credits: "500 / mo", perks: ["10 active tests / mo", "Up to 6 options", "Audience targeting"] },
  { key: "pro", name: "Pro", price: { monthly: 149, yearly: 1490 }, credits: "2,000 / mo", perks: ["30 active tests / mo", "Up to 8 options", "Webhooks + exports"], featured: true },
  { key: "scale", name: "Scale", price: { monthly: 399, yearly: 3990 }, credits: "7,500 / mo", perks: ["100 active tests / mo", "Public API + embed", "Webhooks + exports"] },
  { key: "enterprise", name: "Enterprise", price: { monthly: -1, yearly: -1 }, credits: "Custom", perks: ["Unlimited tests", "SSO + SLA", "Dedicated support"] },
];

const ORDER: Record<string, number> = { free: 0, starter: 1, creator: 2, pro: 3, scale: 4, enterprise: 5 };

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
      else setNote(j.error === "no_subscription" ? "No billing account yet — subscribe to a plan first." : "Couldn't open billing — please try again.");
    } catch { setNote("Couldn't open billing — please try again."); } finally { setBusy(false); }
  }

  return (
    <div className="wrap" style={{ paddingTop: "clamp(24px, 3vw, 38px)", paddingBottom: 80 }}>
      <div className="phead">
        <div>
          <p className="eyebrow">Plans</p>
          <h1 className="display">Pick a plan</h1>
          <p>Plans refresh credits every month. Need more mid-cycle? <a href="/app/credits" style={{ color: "var(--acc-deep)" }}>Top up anytime →</a></p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div className="seg">
            {(["monthly", "yearly"] as Cycle[]).map((c) => (
              <button key={c} onClick={() => setCycle(c)} className={cycle === c ? "on" : ""}>{c === "monthly" ? "Monthly" : "Yearly"}{c === "yearly" ? <span className="seg__save">2 mo free</span> : null}</button>
            ))}
          </div>
          {signedIn && <button onClick={manageBilling} disabled={busy} className="btn btn--ghost">{busy ? "Opening…" : "Manage billing"}</button>}
        </div>
      </div>

      {subscribed && (
        <div className="card" style={{ marginBottom: 18, borderColor: "var(--acc-line)", background: "var(--acc-soft)", boxShadow: "none" }}>
          <p style={{ margin: 0, color: "var(--acc-deep)", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}><span className="dot dot--acc" />Subscription received — your plan and monthly credits will activate within a few seconds.</p>
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
                  : <div className="price__amt">${price.toLocaleString()}<small>/{cycle === "yearly" ? "yr" : "mo"}</small></div>}
                <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>{p.credits} credits</div>
              </div>
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

      <p style={{ fontFamily: "var(--font-code)", fontSize: 11.5, color: "var(--fg-5)", marginTop: 26, lineHeight: 1.7 }}>
        Plan credits refresh each billing cycle and don&apos;t roll over. Top-up credits you buy never expire. Cancel anytime — your plan stays active until the period ends.
      </p>
    </div>
  );
}
