import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vraelis — list a thrift find in seconds",
  description:
    "Photograph your item, get a finished resale listing — platform titles for eBay, Poshmark, Depop & Mercari, a clean description, hashtags, and a price range. Free for 3 listings.",
};

const MONO_LABEL = {
  fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.07em",
  textTransform: "uppercase", color: "var(--fg-4)",
} as const;

function PricePill({ v, k }: { v: string; k: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14, letterSpacing: "-0.02em", color: "var(--acc-deep)", background: "var(--acc-soft)", border: "1px solid var(--acc-line)", borderRadius: "var(--r-circle)", padding: "5px 11px" }}>
      {v}<span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, fontSize: 10.5, color: "var(--fg-4)" }}>{k}</span>
    </span>
  );
}

function ListingPreview() {
  return (
    <div className="win">
      <div className="win__bar">
        <div className="win__dots"><i /><i /><i /></div>
        <span className="win__addr"><span className="dot dot--acc" /> vraelis · listing</span>
        <span style={{ marginLeft: "auto" }} className="pill"><span className="dot dot--acc" />ready to post</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,0.82fr) minmax(0,1.18fr)" }} className="deep-body">
        <div style={{ borderRight: "1px solid var(--line-1)", minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)", ...MONO_LABEL }}>Your photo</div>
          <div role="img" aria-label="A gray fleece pullover photographed for resale" style={{ flex: 1, minHeight: 240, backgroundImage: "url(/flip-assets/before-sweater.jpg)", backgroundSize: "cover", backgroundPosition: "center" }} />
        </div>
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-1)", ...MONO_LABEL }}>Finished listing</div>
          <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ ...MONO_LABEL, marginBottom: 6 }}>eBay title</div>
              <div style={{ fontSize: 14.5, color: "var(--fg-1)", fontWeight: 600, lineHeight: 1.4 }}>Patagonia Better Sweater 1/4 Zip Mens M Gray Fleece Pullover EUC</div>
            </div>
            <div>
              <div style={{ ...MONO_LABEL, marginBottom: 8 }}>Price range</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <PricePill v="$48" k="fast" /><PricePill v="$62" k="market" /><PricePill v="$78" k="high" />
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
  { k: "01", t: "Photograph the item", d: "Front, the tag, any flaws — phone shots are fine. No lightbox, no editing, no light tent. Drop in up to five.", chips: ["Front", "Tag", "Flaws"] },
  { k: "02", t: "Generate the listing", d: "One tap. Vraelis reads the photos and writes four platform titles, a description, keywords, hashtags, and a fast / market / high price.", chips: ["Titles", "Description", "Price"] },
  { k: "03", t: "Copy & post", d: "Tap to copy each field straight into eBay, Poshmark, Depop, or Mercari. Set your price, hit list, move to the next piece.", chips: ["eBay", "Poshmark", "Depop", "Mercari"] },
];

const CATEGORIES = ["Clothing", "Sneakers & shoes", "Bags & accessories", "Vintage & Y2K", "Electronics & games", "Home & decor", "Toys & collectibles", "Tools & gear"];

function FeatureRow({ text, light }: { text: string; light?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "9px 0", borderTop: `1px solid ${light ? "rgba(255,255,255,0.2)" : "var(--line-1)"}`, alignItems: "baseline" }}>
      <span style={{ color: light ? "rgba(255,255,255,0.9)" : "var(--acc-deep)", fontSize: 12 }}>✓</span>
      <span style={{ fontSize: 13, color: light ? "rgba(255,255,255,0.95)" : "var(--fg-2)", lineHeight: 1.45 }}>{text}</span>
    </div>
  );
}

const FREE_FEATS = ["3 listings, free", "All four platform titles", "Description + price range", "No card to start"];
const PRO_FEATS = ["Unlimited listings", "Keywords + hashtags", "Card & Apple Pay", "Cancel anytime"];

export default function FlipLanding() {
  return (
    <>
      {/* ── Hero (two columns, fills the width) ── */}
      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
        <div className="gridbg" />
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 60% 50% at 70% 0%, var(--acc-soft) 0%, transparent 70%)" }} />
        <div className="wrap" style={{ position: "relative", paddingTop: "clamp(44px, 7vw, 80px)", paddingBottom: "clamp(40px, 6vw, 72px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.05fr)", gap: "clamp(32px, 5vw, 64px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow rise" data-d="1">AI commerce automation</p>
              <h1 className="display rise" data-d="2" style={{ fontSize: "clamp(2.4rem, 4.6vw, 3.7rem)", marginBottom: 20 }}>
                List anything you sell, in <span className="em">seconds</span>.
              </h1>
              <p className="rise" data-d="3" style={{ fontSize: "clamp(1.05rem, 1.4vw, 1.22rem)", color: "var(--fg-2)", maxWidth: 540, marginBottom: 16, lineHeight: 1.5 }}>
                Snap your inventory — Vraelis writes the whole listing for every marketplace, prices it, then
                helps you post and keep it in sync. For resellers, store owners, and suppliers alike.
              </p>
              <p className="rise" data-d="3" style={{ fontSize: "clamp(1rem, 1.2vw, 1.1rem)", fontWeight: 600, color: "var(--fg-1)", maxWidth: 540, marginBottom: 28, lineHeight: 1.45 }}>
                Free for your first 3 listings. No card to start.
              </p>
              <div className="rise" data-d="4" style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
                <a href="/app" className="btn btn--lg">Try it free <span aria-hidden>→</span></a>
                <a href="/#how" className="btn btn--ghost btn--lg">How it works</a>
              </div>
              <div className="rise" data-d="5" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ ...MONO_LABEL, marginRight: 2 }}>Lists to</span>
                {["eBay", "Poshmark", "Depop", "Mercari"].map((p) => <span key={p} className="pill">{p}</span>)}
              </div>
            </div>
            <div className="rise" data-d="4">
              <ListingPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat band ── */}
      <section style={{ background: "var(--bg-2)", borderBottom: "1px solid var(--line-1)" }}>
        <div className="wrap metric-strip" style={{ paddingBlock: "clamp(28px, 3.5vw, 44px)", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {[["~15s", "to a finished listing"], ["4", "platform titles per item"], ["3", "free listings to start"], ["$0", "to try — no card"]].map(([n, l]) => (
            <div key={l as string} style={{ borderRight: "1px solid var(--line-1)", paddingRight: 16 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)", fontWeight: 700, letterSpacing: "-0.03em", color: "var(--fg-1)", lineHeight: 1 }}>{n}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-4)", marginTop: 8 }}>{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── What you get (bento) ── */}
      <section className="section">
        <div className="wrap">
          <div style={{ maxWidth: 660, marginBottom: "clamp(32px, 4vw, 52px)" }}>
            <p className="eyebrow">What you get</p>
            <h2 className="display" style={{ fontSize: "clamp(2rem, 3.6vw, 3.2rem)" }}>
              The whole listing, <span className="em">written for you</span>.
            </h2>
            <p className="lead-copy" style={{ marginTop: 14 }}>Not a caption. Everything you&apos;d normally type by hand for each platform — done in one pass.</p>
          </div>
          <div className="bento">
            <div className="tile tile--accent span3">
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, opacity: 0.85 }}>four at once</div>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "clamp(2.4rem,5vw,3.4rem)", lineHeight: 1, letterSpacing: "-0.03em" }}>Titles</div>
              <h3 style={{ fontSize: 17 }}>Platform titles</h3>
              <p style={{ fontSize: 14, lineHeight: 1.5 }}>eBay stuffed with keywords; Poshmark and Depop in their own voice; Mercari kept short. Each fits that platform&apos;s limits.</p>
            </div>
            <div className="tile span3">
              <h3 style={{ fontSize: 17 }}>Description that sells</h3>
              <p style={{ fontSize: 14, color: "var(--fg-3)", lineHeight: 1.5 }}>Condition, fit, fabric, and the "check photos" line — written like a seller, not a spec sheet. Flaws called out honestly.</p>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: "auto" }}>
                <span className="pill st-won"><span className="dot" />Condition</span>
                <span className="pill">Measurements to add</span>
              </div>
            </div>
            <div className="tile span2">
              <h3 style={{ fontSize: 16 }}>Price range</h3>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>Fast / market / high, with a confidence read — so you price to move or price to max.</p>
            </div>
            <div className="tile span2">
              <h3 style={{ fontSize: 16 }}>Keywords &amp; hashtags</h3>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>Search terms for eBay, plus ready Poshmark and Depop hashtag sets to copy in.</p>
            </div>
            <div className="tile span2">
              <h3 style={{ fontSize: 16 }}>Honest about gaps</h3>
              <p style={{ fontSize: 13.5, color: "var(--fg-3)", lineHeight: 1.5 }}>Can&apos;t see the size tag? It says <b style={{ color: "var(--fg-1)" }}>unknown</b> and tells you to add it — it won&apos;t invent a brand.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Works on anything (image band) ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: "clamp(28px, 4vw, 56px)", alignItems: "center" }} className="cols-stack">
            <div role="img" aria-label="A rack of secondhand clothing" style={{ borderRadius: "var(--r-sm)", border: "1px solid var(--line-2)", boxShadow: "var(--shadow-card)", minHeight: 320, backgroundImage: "url(/flip-assets/thrift-rack.jpg)", backgroundSize: "cover", backgroundPosition: "center" }} />
            <div>
              <p className="eyebrow">Whatever you sourced</p>
              <h2 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 3rem)", marginBottom: 16 }}>
                If you can flip it, it can <span className="em">list it</span>.
              </h2>
              <p className="lead-copy" style={{ marginBottom: 22 }}>Clothing is just the start. Point it at the rest of your haul and it figures out what the item is and what it&apos;s worth.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CATEGORIES.map((c) => <span key={c} className="pill">{c}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="section">
        <div className="wrap">
          <div style={{ maxWidth: 640, marginBottom: "clamp(36px, 5vw, 60px)" }}>
            <p className="eyebrow">How it works</p>
            <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)" }}>From shelf to sold, <span className="em">three steps</span>.</h2>
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
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>{s.chips.map((c) => <span key={c} className="pill">{c}</span>)}</div>
                </div>
              </div>
            ))}
            <div style={{ borderTop: "1px solid var(--line-1)" }} />
          </div>
        </div>
      </section>

      {/* ── Marketplaces teaser ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap", marginBottom: "clamp(28px, 3vw, 40px)" }}>
            <div style={{ maxWidth: 560 }}>
              <p className="eyebrow">Marketplaces</p>
              <h2 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.8rem)" }}>Copy-paste today. <span className="em">One-click soon</span>.</h2>
            </div>
            <a href="/connections" className="btn btn--ghost">See marketplaces</a>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {[["eBay", "live"], ["Poshmark", "live"], ["Depop", "live"], ["Mercari", "live"], ["Shopify", "soon"]].map(([m, s]) => (
              <div key={m as string} className="card" style={{ flex: "1 1 180px", minWidth: 160, padding: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <span style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--fg-1)" }}>{m}</span>
                <span className={`pill ${s === "live" ? "st-won" : ""}`} style={s === "soon" ? { color: "var(--fg-4)" } : undefined}><span className="dot" />{s === "live" ? "ready" : "soon"}</span>
              </div>
            ))}
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
            <div style={{ display: "flex", flexDirection: "column", borderRadius: "var(--r-sm)", padding: "clamp(24px, 2.3vw, 30px)", background: "var(--bg-1)", border: "1px solid var(--line-2)", boxShadow: "var(--shadow-card)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--fg-4)" }}>Free</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 14 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1, color: "var(--fg-1)" }}>$0</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>3 listings</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--fg-3)", marginTop: 18, marginBottom: 22, lineHeight: 1.5 }}>Try it on your next few finds — no card.</p>
              <a href="/app" className="btn btn--ghost" style={{ width: "100%", justifyContent: "center" }}>Start free</a>
              <div style={{ marginTop: 24 }}>{FREE_FEATS.map((f) => <FeatureRow key={f} text={f} />)}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", borderRadius: "var(--r-sm)", padding: "clamp(24px, 2.3vw, 30px)", background: "linear-gradient(158deg, var(--acc) 0%, var(--acc-deep) 100%)", border: "1.5px solid var(--acc-deep)", boxShadow: "0 34px 70px -30px rgba(14,158,108,0.45)" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(255,255,255,0.82)" }}>Pro</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.7)" }}>Most popular</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 7, marginTop: 14 }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: 44, fontWeight: 700, letterSpacing: "-0.045em", lineHeight: 1, color: "#fff" }}>$19</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "rgba(255,255,255,0.65)" }}>/ month</span>
              </div>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.88)", marginTop: 18, marginBottom: 22, lineHeight: 1.5 }}>Unlimited listings. Cancel anytime.</p>
              <a href="/pricing" style={{ width: "100%", textAlign: "center", borderRadius: "var(--r-sm)", padding: "13px 22px", fontSize: 15, fontWeight: 600, background: "#fff", color: "var(--acc-deep)", textDecoration: "none", fontFamily: "var(--font-sans)" }}>See Pro &amp; checkout →</a>
              <div style={{ marginTop: 24 }}>{PRO_FEATS.map((f) => <FeatureRow key={f} text={f} light />)}</div>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)", marginTop: 24 }}>
            Full plans and annual pricing on the <a href="/pricing" style={{ color: "var(--acc-deep)" }}>pricing page →</a>
          </p>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="section" style={{ position: "relative", overflow: "hidden", textAlign: "center", borderBottom: "none" }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 50% 60% at 50% 45%, rgba(14,158,108,0.10) 0%, transparent 65%)" }} />
        <div className="wrap" style={{ position: "relative", maxWidth: 820 }}>
          <h2 className="display" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", marginBottom: 22 }}>Your next flip, <span className="em">already listed</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 34px", textAlign: "center" }}>Photograph one item and watch the finished listing come back — title, description, and price for every platform.</p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app" className="btn btn--lg">Try it free <span aria-hidden>→</span></a>
          </div>
        </div>
      </section>
    </>
  );
}
