import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Vraelis",
  description: "Three listings free. Then $19/mo for unlimited, or $190/yr. Pay by card or crypto (BTC, ETH, USDC). Cancel anytime.",
};

function Check({ text, light }: { text: string; light?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "10px 0", borderTop: `1px solid ${light ? "rgba(255,255,255,0.2)" : "var(--line-1)"}`, alignItems: "baseline" }}>
      <span style={{ color: light ? "rgba(255,255,255,0.9)" : "var(--acc-deep)", fontSize: 12 }}>✓</span>
      <span style={{ fontSize: 13.5, color: light ? "rgba(255,255,255,0.95)" : "var(--fg-2)", lineHeight: 1.45 }}>{text}</span>
    </div>
  );
}

const FREE = ["3 listings, free", "All four platform titles", "Description + price range", "Keywords + hashtags", "No card to start"];
const PRO = ["Everything in Free", "Unlimited listings", "Saved listing history", "Marketplace connections as they ship", "Pay by card or crypto", "Cancel anytime"];

const FAQ = [
  ["What counts as a listing?", "One generation — one item, up to five photos in, one finished listing out. Re-copying the result or tweaking your own price doesn't cost anything."],
  ["Can I cancel anytime?", "Yes. Pro is month-to-month (or yearly if you choose). Cancel in two clicks and you keep Pro until the period ends — no email, no retention maze."],
  ["Do you keep my photos?", "Photos are sent to the model to read the item, not published anywhere. We store the finished listing text on your account so you can come back to it; you can delete it."],
  ["Which marketplaces does it write for?", "eBay, Poshmark, Depop, and Mercari today — copy-paste ready. One-click cross-posting and Shopify are rolling out; see Marketplaces."],
  ["How does crypto checkout work?", "Pick crypto at checkout and pay Pro in BTC, ETH, or USDC. Same price, same unlimited plan — it just settles on-chain instead of a card."],
];

export default function FlipPricing() {
  return (
    <>
      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
        <div className="gridbg" />
        <div className="wrap" style={{ position: "relative", paddingTop: "clamp(40px, 6vw, 76px)", paddingBottom: "clamp(28px, 4vw, 44px)" }}>
          <div style={{ maxWidth: 680 }}>
            <p className="eyebrow">Pricing</p>
            <h1 className="display" style={{ fontSize: "clamp(2.3rem, 4.4vw, 3.6rem)", marginBottom: 18 }}>
              Pay once it <span className="em">pays for itself</span>.
            </h1>
            <p className="lead-copy">Three listings free, no card. After that it&apos;s $19/mo for unlimited — less than the profit on one decent flip. Card or crypto.</p>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="grid cols-2" style={{ maxWidth: 820, alignItems: "stretch" }}>
            {/* Free */}
            <div style={{ display: "flex", flexDirection: "column", borderRadius: "var(--r-sm)", padding: "clamp(26px, 2.5vw, 34px)", background: "var(--bg-1)", border: "1px solid var(--line-2)", boxShadow: "var(--shadow-card)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-4)" }}>Free</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 50, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1, color: "var(--fg-1)" }}>$0</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--fg-4)" }}>3 listings</span>
              </div>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", marginTop: 18, marginBottom: 22, lineHeight: 1.5 }}>Enough to list your next few finds and see the titles for yourself.</p>
              <a href="/app" className="btn btn--ghost" style={{ width: "100%", justifyContent: "center" }}>Start free</a>
              <div style={{ marginTop: 26 }}>{FREE.map((f) => <Check key={f} text={f} />)}</div>
            </div>
            {/* Pro */}
            <div style={{ display: "flex", flexDirection: "column", borderRadius: "var(--r-sm)", padding: "clamp(26px, 2.5vw, 34px)", background: "linear-gradient(158deg, var(--acc) 0%, var(--acc-deep) 100%)", border: "1.5px solid var(--acc-deep)", boxShadow: "0 34px 70px -30px rgba(14,158,108,0.45)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.82)" }}>Pro</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Unlimited</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 14 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 50, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1, color: "#fff" }}>$19</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, color: "rgba(255,255,255,0.65)" }}>/ month</span>
              </div>
              <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.88)", marginTop: 18, marginBottom: 22, lineHeight: 1.5 }}>Or $190/yr — two months free. Card or crypto, cancel anytime.</p>
              <a href="/app" style={{ width: "100%", textAlign: "center", borderRadius: "var(--r-sm)", padding: "14px 22px", fontSize: 15, fontWeight: 600, background: "#fff", color: "var(--acc-deep)", textDecoration: "none", fontFamily: "var(--font-sans)" }}>Get Pro →</a>
              <div style={{ marginTop: 26 }}>{PRO.map((f) => <Check key={f} text={f} light />)}</div>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", marginTop: 22 }}>Prices in USD. You only pay when you choose Pro — Free needs no card.</p>
        </div>
      </section>

      {/* Crypto */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(28px, 4vw, 56px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">Payments</p>
              <h2 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.8rem)", marginBottom: 16 }}>Pay how you want — including <span className="em">crypto</span>.</h2>
              <p className="lead-copy" style={{ marginBottom: 20 }}>Card and Apple Pay for the quick path, or settle Pro on-chain. Pick your method at checkout — same price either way.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {["Card", "Apple Pay", "BTC", "ETH", "USDC"].map((m) => <span key={m} className="pill">{m}</span>)}
              </div>
            </div>
            <div className="card" style={{ padding: "clamp(22px, 2.4vw, 30px)" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 14 }}>Crypto checkout</div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, paddingBottom: 14, borderBottom: "1px solid var(--line-1)" }}>
                <span style={{ fontSize: 14.5, color: "var(--fg-1)", fontWeight: 600 }}>Vraelis Pro</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--fg-1)" }}>$19<span style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-4)" }}>/mo</span></span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
                {[["Bitcoin", "BTC"], ["Ethereum", "ETH"], ["USD Coin", "USDC"]].map(([n, t]) => (
                  <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "11px 14px", borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", background: "var(--bg-1)" }}>
                    <span style={{ fontSize: 13.5, color: "var(--fg-1)" }}>{n}</span>
                    <span style={{ fontFamily: "var(--font-code)", fontSize: 12, color: "var(--fg-4)" }}>{t}</span>
                  </div>
                ))}
              </div>
              <a href="/app" className="btn" style={{ width: "100%", justifyContent: "center", marginTop: 16 }}>Start free, upgrade anytime</a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="wrap" style={{ maxWidth: 820 }}>
          <p className="eyebrow">Questions</p>
          <h2 className="display" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)", marginBottom: "clamp(24px, 3vw, 36px)" }}>Before you start.</h2>
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
