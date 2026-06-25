"use client";

import { useEffect, useState } from "react";

type Cycle = "monthly" | "yearly";

// Cards lead with the outcome (blurb), then the value unit (valid judgments), then
// what you can do. Credits stay the unit (1 credit = 1 valid judgment); decisions
// are what you're buying.
const PLANS = [
  { key: "free", name: "Free", price: { monthly: 0, yearly: 0 }, credits: "25 valid judgments", blurb: "Try one small evaluation.", perks: ["Compare up to 4 candidates", "Sample decision report"] },
  { key: "starter", name: "Starter", price: { monthly: 19, yearly: 190 }, credits: "150 valid judgments / mo", blurb: "For small creative decisions.", perks: ["3 evaluations / mo", "Recommendation + reasoning report"] },
  { key: "creator", name: "Creator", price: { monthly: 49, yearly: 490 }, credits: "500 valid judgments / mo", blurb: "For ongoing creative testing.", perks: ["10 evaluations / mo", "Audience targeting", "Shareable decision reports"] },
  { key: "pro", name: "Pro", price: { monthly: 149, yearly: 1490 }, credits: "2,000 valid judgments / mo", blurb: "For teams and client work.", perks: ["30 evaluations / mo", "Client-ready reports", "Exports + webhooks"], featured: true },
  { key: "scale", name: "Scale", price: { monthly: 399, yearly: 3990 }, credits: "7,500 valid judgments / mo", blurb: "For apps and high-volume teams.", perks: ["100 evaluations / mo", "Public API + embed", "Developer analytics + webhooks"] },
  { key: "enterprise", name: "Enterprise", price: { monthly: -1, yearly: -1 }, credits: "Custom valid judgments", blurb: "For governed evaluation programs.", perks: ["Unlimited evaluations", "Organization governance + audit", "SSO for verified domains · SLA · support"] },
] as { key: string; name: string; price: Record<Cycle, number>; credits: string; blurb: string; perks: string[]; featured?: boolean }[];

// Display-only: round to the nearest whole dollar (the live Stripe price may carry
// cents, e.g. 1499.99 → "1,500"). Rounds rather than truncates so the shown price
// is never below the checkout total. Does NOT change what Stripe charges.
const fmtAmount = (n: number) => Math.round(n).toLocaleString();

const ORDER: Record<string, number> = { free: 0, starter: 1, creator: 2, pro: 3, scale: 4, enterprise: 5 };

const CREDIT_RULES: [string, string][] = [
  ["1 credit = 1 valid judgment", "The unit you spend. What you buy is the decision."],
  ["Held when you launch", "Credits are escrowed, not spent up front."],
  ["Low-quality filtered", "Too-fast, duplicate, and spam responses are rejected."],
  ["Unused credits refunded", "If an evaluation doesn't fill, the rest comes back."],
];

type TeamPricing = { configured: boolean; yearlyConfigured: boolean; monthly: { amount: number; currency: string } | null; yearly: { amount: number; currency: string } | null };

export default function PricingPage() {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [signedIn, setSignedIn] = useState(false);
  const [plan, setPlan] = useState("free");
  const [prices, setPrices] = useState<Record<string, Record<string, { available: boolean; amount?: number }>>>({});
  const [team, setTeam] = useState<TeamPricing | null>(null);

  useEffect(() => {
    fetch("/api/v/me").then((r) => r.json()).then((j) => { if (j.signedIn) { setSignedIn(true); setPlan(j.plan || "free"); } }).catch(() => {});
    fetch("/api/v/plans").then((r) => r.json()).then((j) => setPrices(j.plans || {})).catch(() => {});
    fetch("/api/v/team/pricing").then((r) => r.json()).then(setTeam).catch(() => {});
  }, []);

  const seatSym = (c?: string) => (!c || c === "USD" ? "$" : c + " ");
  const seatMoney = (m: { amount: number; currency: string } | null | undefined) => (m ? `${seatSym(m.currency)}${fmtAmount(m.amount)}` : null);

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
          <h1 className="display" style={{ fontSize: "clamp(2.2rem, 4.6vw, 3.6rem)", marginBottom: 16 }}>Pay for <span className="em">decisions</span>, not raw counts.</h1>
          <p className="lead-copy" style={{ margin: "0 auto 26px", textAlign: "center" }}>Credits are the unit — <strong style={{ color: "var(--fg-1)" }}>1 credit = 1 valid human judgment</strong> — but plans are sized by what you can decide: how many evaluations, how strong the reports, and whether you can share, export, or use the API. Top up anytime.</p>
          <div className="seg">
            {(["monthly", "yearly"] as Cycle[]).map((c) => (
              <button key={c} onClick={() => setCycle(c)} className={cycle === c ? "on" : ""}>{c === "monthly" ? "Monthly" : "Yearly"}</button>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "clamp(28px, 3vw, 40px)" }}>
        <div className="wrap">
          <p style={{ textAlign: "center", maxWidth: 660, margin: "0 auto clamp(22px, 3vw, 32px)", fontSize: 14.5, color: "var(--fg-2)", lineHeight: 1.55 }}>You&apos;re not paying for raw counts — you&apos;re paying for a clearer decision before you spend, ship, or present the wrong creative. Every plan includes valid human signal, a recommendation with reasoning, and exportable decision reports.</p>
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
                      : <div className="price__amt">${fmtAmount(price)}<small>/{cycle === "yearly" ? "yr" : "mo"}</small></div>}
                    <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600, marginTop: 6 }}>{p.credits}</div>
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

          {/* team seats */}
          <div className="card" style={{ marginTop: 18, background: "var(--bg-2)", borderRadius: "var(--r-xl)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
              <div style={{ maxWidth: 560 }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 18, marginBottom: 4 }}>Working with a team?</div>
                <p style={{ fontSize: 14, color: "var(--fg-3)", margin: 0, lineHeight: 1.6 }}>Team seats are for internal collaborators — Admins, Editors, and Viewers who run evaluations and read analytics with you. <strong style={{ color: "var(--fg-1)" }}>Client viewers are free</strong>: invite clients to read client-safe decision reports without a paid seat.</p>
              </div>
              {team?.monthly && (
                <div style={{ textAlign: "right", minWidth: 180 }}>
                  <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--acc-deep)", fontWeight: 600 }}>{seatMoney(team.monthly)}/seat/month</div>
                  {team.yearly && <div style={{ fontFamily: "var(--font-code)", fontSize: 12.5, color: "var(--fg-3)", marginTop: 4 }}>or {seatMoney(team.yearly)}/seat/year</div>}
                  <div style={{ fontSize: 11.5, color: "var(--fg-5)", marginTop: 6 }}>Manage seats in your workspace</div>
                </div>
              )}
            </div>
          </div>

          <p style={{ fontSize: 13, color: "var(--fg-4)", marginTop: 20, textAlign: "center", lineHeight: 1.6, maxWidth: 620, marginInline: "auto" }}>Plans renew automatically. Cancel anytime, and your plan stays active until the period ends. Secure checkout on Vraelis, powered by Stripe.</p>
        </div>
      </section>
    </div>
  );
}
