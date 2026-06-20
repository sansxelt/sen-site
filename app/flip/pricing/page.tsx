import type { Metadata } from "next";
import { PricingTable } from "./pricing-table";

export const metadata: Metadata = {
  title: "Pricing — Vraelis",
  description: "Free to try. Then Seller, Growth, or Operator — monthly, yearly, or one-time lifetime. Card or Apple Pay. Built for sellers, suppliers, and teams.",
};

const FAQ = [
  ["What's the difference between the plans?", "Free is for trying it. Seller gives a solo reseller unlimited listings and bulk export. Growth adds auto-posting and one-click cross-listing across every channel you connect. Operator is for high-volume sellers, suppliers, and teams — multiple accounts, team seats, supplier bulk import, and API access."],
  ["Monthly, yearly, or lifetime?", "Monthly is flexible. Yearly bills once and saves you two months. Lifetime is a single one-time payment — no subscription, you own the plan. Switch the toggle at the top of the page to compare."],
  ["Can I cancel?", "Recurring plans cancel in two clicks and stay active until the period ends. Lifetime is one-time, so there's nothing to cancel."],
  ["Do you keep my photos?", "Photos are sent to the model to read the item, not published anywhere. We store the finished listing on your account so you can come back to it; you can delete it."],
  ["How do I pay?", "Card or Apple Pay, securely through Stripe. Pick a plan, pick monthly / yearly / lifetime, and you're set."],
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
            <p className="lead-copy">From a solo closet-clearer to a supplier moving pallets — pick the level of automation you need. Monthly, yearly, or a one-time lifetime.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap"><PricingTable /></div>
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
