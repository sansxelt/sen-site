"use client";

import { useState } from "react";
import { UpgradeButton } from "../account/upgrade-button";

type Cycle = "monthly" | "yearly" | "lifetime";

type Plan = {
  key: "free" | "seller" | "growth" | "operator";
  name: string;
  who: string;
  featured?: boolean;
  price: Record<Cycle, number | null>; // null => "Talk to us"
  unit: Record<Cycle, string>;
  cta: string;
  feats: string[];
};

const PLANS: Plan[] = [
  {
    key: "free", name: "Free", who: "Kick the tires on your next few items.",
    price: { monthly: 0, yearly: 0, lifetime: 0 },
    unit: { monthly: "3 listings", yearly: "3 listings", lifetime: "3 listings" },
    cta: "Start free",
    feats: ["3 listings to start", "All four platform titles", "Description + price range", "Keywords + hashtags"],
  },
  {
    key: "seller", name: "Seller", who: "For the solo reseller clearing a closet or a corner of the garage.",
    price: { monthly: 19, yearly: 190, lifetime: 290 },
    unit: { monthly: "/ mo", yearly: "/ yr", lifetime: "once" },
    cta: "Get Seller",
    feats: ["Unlimited listings", "Saved listing history", "Bulk export to eBay & Shopify", "2 marketplace connections", "Card & Apple Pay"],
  },
  {
    key: "growth", name: "Growth", who: "For sellers running real volume across every channel.", featured: true,
    price: { monthly: 49, yearly: 490, lifetime: 790 },
    unit: { monthly: "/ mo", yearly: "/ yr", lifetime: "once" },
    cta: "Get Growth",
    feats: ["Everything in Seller", "Auto-post to every connected marketplace", "One-click cross-listing", "Bulk-generate many items at once", "Up to 6 connections", "Priority generation"],
  },
  {
    key: "operator", name: "Operator", who: "For high-volume sellers, suppliers, middlemen, and teams.",
    price: { monthly: 149, yearly: 1490, lifetime: null },
    unit: { monthly: "/ mo", yearly: "/ yr", lifetime: "custom" },
    cta: "Get Operator",
    feats: ["Everything in Growth", "Multiple stores & accounts", "Team seats (3 included)", "Supplier / wholesale bulk import", "API access", "Priority support"],
  },
];

const ADDONS = [
  { name: "Extra marketplace connection", price: "$5 / mo", note: "Beyond your plan's included channels." },
  { name: "Extra team seat", price: "$12 / mo", note: "Add a teammate to your workspace." },
  { name: "Volume & API boost", price: "Custom", note: "Higher throughput + API limits for operators." },
];

const CYCLES: { key: Cycle; label: string; note?: string }[] = [
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly", note: "2 months free" },
  { key: "lifetime", label: "Lifetime", note: "one-time" },
];

function money(n: number) { return "$" + n.toLocaleString(); }

export function PricingTable() {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <div>
      {/* cycle toggle */}
      <div style={{ display: "flex", gap: "clamp(18px,3vw,32px)", borderBottom: "1px solid var(--line-2)", marginBottom: "clamp(28px,3.5vw,44px)", flexWrap: "wrap" }}>
        {CYCLES.map((c) => {
          const on = cycle === c.key;
          return (
            <button key={c.key} type="button" onClick={() => setCycle(c.key)}
              style={{ border: "none", background: "none", cursor: "pointer", padding: "0 1px 13px", marginBottom: -1, fontFamily: "var(--font-mono)", fontSize: 13.5, letterSpacing: "0.01em", color: on ? "var(--fg-1)" : "var(--fg-4)", fontWeight: on ? 600 : 500, borderBottom: `2px solid ${on ? "var(--acc)" : "transparent"}` }}>
              {c.label}{c.note && <span style={{ marginLeft: 7, fontSize: 11, color: on ? "var(--acc-deep)" : "var(--fg-5)" }}>{c.note}</span>}
            </button>
          );
        })}
      </div>

      {/* plan cards */}
      <div className="grid cols-4" style={{ alignItems: "stretch" }}>
        {PLANS.map((p) => {
          const ink = !!p.featured;
          const val = p.price[cycle];
          const c = ink
            ? { name: "rgba(255,255,255,0.82)", price: "#fff", unit: "rgba(255,255,255,0.65)", who: "rgba(255,255,255,0.88)", rule: "rgba(255,255,255,0.2)", feat: "rgba(255,255,255,0.95)", tick: "rgba(255,255,255,0.9)" }
            : { name: "var(--fg-4)", price: "var(--fg-1)", unit: "var(--fg-4)", who: "var(--fg-3)", rule: "var(--line-1)", feat: "var(--fg-2)", tick: "var(--acc-deep)" };
          return (
            <div key={p.key} style={{ display: "flex", flexDirection: "column", borderRadius: "var(--r-sm)", padding: "clamp(22px,2vw,28px)", background: ink ? "linear-gradient(158deg, var(--acc) 0%, var(--acc-deep) 100%)" : "var(--bg-1)", border: ink ? "1.5px solid var(--acc-deep)" : "1px solid var(--line-2)", boxShadow: ink ? "0 34px 70px -30px rgba(14,158,108,0.45)" : "var(--shadow-card)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: c.name }}>{p.name}</span>
                {ink && <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Popular</span>}
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 14, minHeight: 50 }}>
                {val === null ? (
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1, color: c.price }}>Talk to us</span>
                ) : (
                  <>
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 42, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1, color: c.price }}>{money(val)}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: c.unit }}>{p.unit[cycle]}</span>
                  </>
                )}
              </div>
              <p style={{ fontSize: 13, color: c.who, marginTop: 14, marginBottom: 20, lineHeight: 1.5, minHeight: 56 }}>{p.who}</p>

              {p.key === "free" ? (
                <a href="/app" className="btn btn--ghost" style={{ width: "100%", justifyContent: "center" }}>{p.cta}</a>
              ) : val === null ? (
                <a href="/contact" className={ink ? undefined : "btn btn--ghost"} style={ink ? { width: "100%", textAlign: "center", borderRadius: "var(--r-sm)", padding: "12px 20px", fontSize: 14.5, fontWeight: 600, background: "#fff", color: "var(--acc-deep)", textDecoration: "none", fontFamily: "var(--font-sans)" } : { width: "100%", justifyContent: "center" }}>Talk to us</a>
              ) : (
                <UpgradeButton
                  label={p.cta}
                  plan={p.key}
                  cycle={cycle}
                  className={ink ? "" : "btn"}
                  style={ink
                    ? { width: "100%", textAlign: "center", borderRadius: "var(--r-sm)", padding: "12px 20px", fontSize: 14.5, fontWeight: 600, background: "#fff", color: "var(--acc-deep)", border: "none", fontFamily: "var(--font-sans)" }
                    : { width: "100%", justifyContent: "center" }}
                />
              )}

              <div style={{ marginTop: 22 }}>
                {p.feats.map((f) => (
                  <div key={f} style={{ display: "flex", gap: 9, padding: "8px 0", borderTop: `1px solid ${c.rule}`, alignItems: "baseline" }}>
                    <span style={{ color: c.tick, fontSize: 12 }}>✓</span>
                    <span style={{ fontSize: 12.5, color: c.feat, lineHeight: 1.45 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* add-ons */}
      <div style={{ marginTop: "clamp(36px,4vw,56px)" }}>
        <p className="eyebrow eyebrow--mut">Add-ons</p>
        <div className="grid cols-3">
          {ADDONS.map((a) => (
            <div key={a.name} className="card" style={{ padding: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-1)" }}>{a.name}</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 700, color: "var(--acc-deep)", whiteSpace: "nowrap" }}>{a.price}</span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5 }}>{a.note}</p>
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", marginTop: 22 }}>
        Prices in USD. Yearly is billed once a year (two months off). Lifetime is a one-time payment. Cancel recurring plans anytime.
      </p>
    </div>
  );
}
