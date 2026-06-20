import type { Metadata } from "next";
import { PricingTable } from "./pricing-table";
import { UpgradeButton } from "../account/upgrade-button";

export const metadata: Metadata = {
  title: "Pricing — Vraelis",
  description: "Free to try. Then Seller, Growth, or Operator — monthly, yearly, or one-time lifetime. Pay by card or crypto. Built for sellers, suppliers, and teams.",
};

const FAQ = [
  ["What's the difference between the plans?", "Free is for trying it. Seller gives a solo reseller unlimited listings and bulk export. Growth adds auto-posting and one-click cross-listing across every channel you connect. Operator is for high-volume sellers, suppliers, and teams — multiple accounts, team seats, supplier bulk import, and API access."],
  ["Monthly, yearly, or lifetime?", "Monthly is flexible. Yearly bills once and saves you two months. Lifetime is a single one-time payment — no subscription, you own the plan. Switch the toggle at the top of the page to compare."],
  ["Can I cancel?", "Recurring plans cancel in two clicks and stay active until the period ends. Lifetime is one-time, so there's nothing to cancel."],
  ["Do you keep my photos?", "Photos are sent to the model to read the item, not published anywhere. We store the finished listing on your account so you can come back to it; you can delete it."],
  ["How does crypto checkout work?", "Pick crypto at checkout and pay in BTC, ETH, or a stablecoin (USDC) — same price as card. It's handled through Stripe alongside cards and Apple Pay."],
];

export default function FlipPricing() {
  return (
    <>
      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
        <div className="gridbg" />
        <div className="wrap" style={{ position: "relative", paddingTop: "clamp(40px, 6vw, 76px)", paddingBottom: "clamp(28px, 4vw, 44px)" }}>
          <div style={{ maxWidth: 700 }}>
            <p className="eyebrow">Pricing</p>
            <h1 className="display" style={{ fontSize: "clamp(2.3rem, 4.4vw, 3.6rem)", marginBottom: 18 }}>
              Start free. Scale when it <span className="em">runs your selling</span>.
            </h1>
            <p className="lead-copy">From a solo closet-clearer to a supplier moving pallets — pick the level of automation you need. Monthly, yearly, or a one-time lifetime. Card or crypto.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap"><PricingTable /></div>
      </section>

      {/* Crypto */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(28px, 4vw, 56px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">Payments</p>
              <h2 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.8rem)", marginBottom: 16 }}>Pay how you want — including <span className="em">crypto</span>.</h2>
              <p className="lead-copy" style={{ marginBottom: 20 }}>Card and Apple Pay for the quick path, or settle on-chain. Pick your method at checkout — same price either way.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["Card", "Apple Pay", "BTC", "ETH", "USDC"].map((m) => <span key={m} className="pill">{m}</span>)}
              </div>
            </div>
            <div className="card" style={{ padding: "clamp(22px, 2.4vw, 30px)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>Crypto checkout</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[["Bitcoin", "BTC"], ["Ethereum", "ETH"], ["USD Coin", "USDC"]].map(([n, t]) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)" }}>
                    <span style={{ fontSize: 13.5, color: "var(--fg-1)" }}>{n}</span>
                    <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)" }}>{t}</span>
                  </div>
                ))}
              </div>
              <UpgradeButton label="Get Growth" plan="growth" cycle="monthly" className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <p className="eyebrow">Questions</p>
          <h2 className="display" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)", marginBottom: "clamp(24px, 3vw, 36px)" }}>Before you pick a plan.</h2>
          <div>
            {FAQ.map(([q, a]) => (
              <div key={q} style={{ padding: "20px 0", borderTop: "1px solid var(--line-1)" }}>
                <h3 style={{ fontSize: 16.5, color: "var(--fg-1)", marginBottom: 8 }}>{q}</h3>
                <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.6, maxWidth: 660 }}>{a}</p>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--line-1)" }} />
          </div>
          <div style={{ marginTop: 36, display: "flex", gap: 14, flexWrap: "wrap" }}>
            <a href="/app" className="btn btn--lg">Try it free <span aria-hidden>→</span></a>
            <a href="/connections" className="btn btn--ghost btn--lg">See marketplaces</a>
          </div>
        </div>
      </section>
    </>
  );
}
