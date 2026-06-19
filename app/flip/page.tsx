import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Flip Engine — list a thrift find in seconds",
  description:
    "Snap your item, get a finished resale listing — platform titles for eBay, Poshmark, Depop & Mercari, a clean description, hashtags, and a price range. Free for 3 listings.",
};

const MONO_LABEL = {
  fontFamily: "var(--font-mono)",
  fontSize: 9.5,
  letterSpacing: "0.07em",
  textTransform: "uppercase",
  color: "var(--fg-4)",
} as const;

function PricePill({ v, k }: { v: string; k: string }) {
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "baseline", gap: 5,
        fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "-0.02em",
        color: "var(--acc-deep)", background: "var(--acc-soft)", border: "1px solid var(--acc-line)",
        borderRadius: "var(--r-circle)", padding: "5px 11px",
      }}
    >
      {v}
      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 10.5, color: "var(--fg-4)" }}>{k}</span>
    </span>
  );
}

// The "after": a window-chrome preview of a finished listing — the same .win
// the marketing site uses for its dashboard mock.
function ListingPreview() {
  return (
    <div className="win">
      <div className="win__bar">
        <div className="win__dots"><i /><i /><i /></div>
        <span className="win__addr"><span className="dot dot--acc" /> flip-engine · listing</span>
        <span style={{ marginLeft: "auto" }} className="pill"><span className="dot dot--acc" />ready to post</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.82fr) minmax(0,1.18fr)" }} className="deep-body">
        <div style={{ borderRight: "1px solid var(--line-1)", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)", ...MONO_LABEL }}>Your photo</div>
          <div
            role="img"
            aria-label="A gray fleece pullover photographed for resale"
            style={{
              flex: 1, minHeight: 230,
              backgroundImage: "url(/flip-assets/before-sweater.jpg)",
              backgroundSize: "cover", backgroundPosition: "center",
            }}
          />
        </div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)", ...MONO_LABEL }}>Finished listing</div>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ ...MONO_LABEL, marginBottom: 6 }}>eBay title</div>
              <div style={{ fontSize: 14.5, color: "var(--fg-1)", fontWeight: 600, lineHeight: 1.4 }}>
                Patagonia Better Sweater 1/4 Zip Mens M Gray Fleece Pullover EUC
              </div>
            </div>
            <div>
              <div style={{ ...MONO_LABEL, marginBottom: 8 }}>Price range</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <PricePill v="$48" k="fast" />
                <PricePill v="$62" k="market" />
                <PricePill v="$78" k="high" />
              </div>
            </div>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", paddingTop: 2 }}>
              <span className="pill st-won"><span className="dot" />Excellent</span>
              <span className="pill">Men&apos;s · M</span>
              <span className="pill">Outerwear</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  { k: "01", t: "Upload 1–5 photos", d: "Drag in phone shots of your item — front, the tag, any flaws. No lightbox, no editing.", chips: ["Front", "Tag", "Flaws"] },
  { k: "02", t: "Generate the listing", d: "One click. You get four platform titles, a clean description, keywords, hashtags, and a fast / market / high price range.", chips: ["Titles", "Description", "Price"] },
  { k: "03", t: "Copy & post", d: "Tap to copy each field straight into eBay, Poshmark, Depop, or Mercari. Set your price and you're listed.", chips: ["eBay", "Poshmark", "Depop", "Mercari"] },
];

const FREE_FEATS = ["3 listings, free", "All four platform titles", "Description + price range", "No card to start"];
const PRO_FEATS = ["Unlimited listings", "All four platform titles", "Keywords + hashtags", "Cancel anytime"];

function FeatureRow({ text, light }: { text: string; light?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: `1px solid ${light ? "rgba(255,255,255,0.2)" : "var(--line-1)"}`, alignItems: "baseline" }}>
      <span style={{ color: light ? "rgba(255,255,255,0.9)" : "var(--acc-deep)", fontSize: 12 }}>✓</span>
      <span style={{ fontSize: 13, color: light ? "rgba(255,255,255,0.95)" : "var(--fg-2)", lineHeight: 1.45 }}>{text}</span>
    </div>
  );
}

export default function FlipLanding() {
  return (
    <>
      {/* ── Hero ── */}
      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
        <div className="gridbg" />
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 55% 45% at 50% 8%, var(--acc-soft) 0%, transparent 68%)" }} />
        <div className="wrap" style={{ position: "relative", paddingTop: "clamp(48px, 8vw, 92px)", paddingBottom: "clamp(40px, 6vw, 72px)" }}>
          <div style={{ maxWidth: 880 }}>
            <p className="eyebrow rise" data-d="1">For resellers — by the photo</p>
            <h1 className="display rise" data-d="2" style={{ marginBottom: 22, maxWidth: 940 }}>
              List a thrift find in <span className="em">seconds</span>.
            </h1>
            <p className="rise" data-d="3" style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.3rem)", color: "var(--fg-2)", maxWidth: 620, marginBottom: 16, lineHeight: 1.5 }}>
              Snap your item. Flip Engine writes the whole listing — keyword-tuned titles for eBay, Poshmark,
              Depop &amp; Mercari, a clean description, hashtags, and a fast / market / high price range.
            </p>
            <p className="rise" data-d="3" style={{ fontSize: "clamp(1rem, 1.3vw, 1.15rem)", fontWeight: 600, color: "var(--fg-1)", maxWidth: 620, marginBottom: 30, lineHeight: 1.45 }}>
              Free for your first 3 listings. No card to start.
            </p>
            <div className="rise" data-d="4" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
              <a href="/flip/app" className="btn btn--lg">Try it free <span aria-hidden>→</span></a>
              <a href="/flip#how" className="btn btn--ghost btn--lg">How it works</a>
            </div>
            <div className="rise" data-d="5" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ ...MONO_LABEL, marginRight: 2 }}>Lists to</span>
              {["eBay", "Poshmark", "Depop", "Mercari"].map((p) => <span key={p} className="pill">{p}</span>)}
            </div>
          </div>
          <div className="rise" data-d="6" style={{ marginTop: "clamp(36px, 5vw, 56px)" }}>
            <ListingPreview />
            <div style={{ display: "flex", alignItems: "center", gap: 9, justifyContent: "center", marginTop: 16, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)", letterSpacing: "0.04em" }}>
              <span className="dot dot--acc" /> One photo in, a finished listing out — titles, description, and price for every platform
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ maxWidth: 640, marginBottom: "clamp(40px, 5vw, 64px)" }}>
            <p className="eyebrow">How it works</p>
            <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)" }}>
              From shelf to sold, <span className="em">three steps</span>.
            </h2>
          </div>
          <div>
            {STEPS.map((s) => (
              <div key={s.k} className="erow" style={{ padding: "clamp(24px, 3vw, 38px) 0" }}>
                <div className="bignum bignum--ghost">{s.k}</div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: "clamp(16px, 3vw, 48px)", alignItems: "center" }} className="cols-stack">
                  <div>
                    <h3 style={{ fontSize: "clamp(1.3rem, 2.2vw, 1.7rem)", marginBottom: 10 }}>{s.t}</h3>
                    <p style={{ fontSize: 15, color: "var(--fg-3)", lineHeight: 1.55, maxWidth: 560 }}>{s.d}</p>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {s.chips.map((c) => <span key={c} className="pill">{c}</span>)}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--line-1)" }} />
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="section">
        <div className="wrap">
          <div style={{ maxWidth: 660, marginBottom: "clamp(28px, 4vw, 44px)" }}>
            <p className="eyebrow">Pricing</p>
            <h2 className="display" style={{ fontSize: "clamp(2rem, 3.6vw, 3.2rem)", marginBottom: 16 }}>
              Start free. Go Pro when it <span className="em">pays for itself</span>.
            </h2>
            <p className="lead-copy">Three listings free. After that, unlimited for less than the profit on a single flip.</p>
          </div>
          <div className="grid cols-2" style={{ maxWidth: 720, alignItems: "stretch" }}>
            {/* Free */}
            <div style={{ display: "flex", flexDirection: "column", borderRadius: "var(--r-sm)", padding: "clamp(24px, 2.3vw, 30px)", background: "var(--bg-1)", border: "1px solid var(--line-2)", boxShadow: "var(--shadow-card)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-4)" }}>Free</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 14 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1, color: "var(--fg-1)" }}>$0</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>3 listings</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 18, marginBottom: 22, lineHeight: 1.5 }}>Try it on your next few finds — no card.</p>
              <a href="/flip/app" className="btn btn--ghost" style={{ width: "100%", justifyContent: "center" }}>Start free</a>
              <div style={{ marginTop: 24 }}>{FREE_FEATS.map((f) => <FeatureRow key={f} text={f} />)}</div>
            </div>
            {/* Pro */}
            <div style={{ display: "flex", flexDirection: "column", borderRadius: "var(--r-sm)", padding: "clamp(24px, 2.3vw, 30px)", background: "linear-gradient(158deg, var(--acc) 0%, var(--acc-deep) 100%)", border: "1.5px solid var(--acc-deep)", boxShadow: "0 34px 70px -30px rgba(14,158,108,0.45)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.82)" }}>Pro</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Most popular</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 14 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1, color: "#fff" }}>$19</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(255,255,255,0.65)" }}>/ month</span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", marginTop: 18, marginBottom: 22, lineHeight: 1.5 }}>Unlimited listings for serious resellers.</p>
              <a href="/flip/app" style={{ width: "100%", textAlign: "center", borderRadius: "var(--r-sm)", padding: "13px 22px", fontSize: 15, fontWeight: 600, background: "#fff", color: "var(--acc-deep)", textDecoration: "none", fontFamily: "var(--font-sans)" }}>Get Pro →</a>
              <div style={{ marginTop: 24 }}>{PRO_FEATS.map((f) => <FeatureRow key={f} text={f} light />)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="section" style={{ position: "relative", overflow: "hidden", textAlign: "center", borderBottom: "none" }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 50% 60% at 50% 45%, rgba(14,158,108,0.10) 0%, transparent 65%)" }} />
        <div className="wrap" style={{ position: "relative", maxWidth: 820 }}>
          <h2 className="display" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", marginBottom: 22 }}>
            Your next flip, <span className="em">already listed</span>.
          </h2>
          <p className="lead-copy" style={{ margin: "0 auto 34px", textAlign: "center" }}>
            Photograph one item and watch the finished listing come back — title, description, and price for every platform.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/flip/app" className="btn btn--lg">Try it free <span aria-hidden>→</span></a>
          </div>
        </div>
      </section>
    </>
  );
}
