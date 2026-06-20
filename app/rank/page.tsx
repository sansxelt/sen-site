import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vraelis — test which creative real people prefer before you launch",
  description:
    "Upload your options. Real people vote. Vraelis tells you what to launch. A/B testing for creative decisions — thumbnails, ads, logos, icons, designs — powered by real human feedback.",
};

const STEPS = [
  { k: "01", t: "Upload your options", d: "Drop in 2–8 versions — thumbnails, ads, logos, icons, UI, product shots, AI images, even brand names.", chips: ["2–8 options", "Any creative"] },
  { k: "02", t: "Real people vote", d: "Vraelis routes your test to real voters who pick the one they prefer and tell you why — not bots, not your friends.", chips: ["Real humans", "+ reasons"] },
  { k: "03", t: "Get the verdict", d: "A clear report: the winner, the vote breakdown, the reasons it won, and what to fix before you launch.", chips: ["Winner", "Why", "Fixes"] },
];

const CATS = ["YouTube thumbnails", "TikTok hooks", "ads", "logos", "game icons", "app icons", "UI designs", "landing pages", "product images", "AI images", "brand names", "banners"];

export default function RankLanding() {
  return (
    <>
      {/* Hero */}
      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
        <div className="gridbg" />
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 55% 45% at 50% 6%, var(--acc-soft) 0%, transparent 68%)" }} />
        <div className="wrap" style={{ position: "relative", paddingTop: "clamp(48px, 8vw, 96px)", paddingBottom: "clamp(40px, 6vw, 72px)", textAlign: "center" }}>
          <p className="eyebrow rise" data-d="1" style={{ justifyContent: "center" }}>A human preference engine for creative content</p>
          <h1 className="display rise" data-d="2" style={{ fontSize: "clamp(2.4rem, 5.4vw, 4.2rem)", margin: "0 auto 22px", maxWidth: 980 }}>
            Test which creative real people <span className="em">prefer</span>.
          </h1>
          <p className="rise" data-d="3" style={{ fontSize: "clamp(1.05rem, 1.5vw, 1.3rem)", color: "var(--fg-2)", maxWidth: 620, margin: "0 auto 30px", lineHeight: 1.5 }}>
            Upload your options. Real people vote. Vraelis tells you what to launch — before you spend a dollar on the wrong one.
          </p>
          <div className="rise" data-d="4" style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 }}>
            <a href="/app/new" className="btn btn--lg">Start a test <span aria-hidden>→</span></a>
            <a href="/vote" className="btn btn--ghost btn--lg">Vote &amp; earn credits</a>
          </div>
          <div className="rise" data-d="5" style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 760, margin: "0 auto" }}>
            {CATS.map((c) => <span key={c} className="pill">{c}</span>)}
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ maxWidth: 640, marginBottom: "clamp(40px, 5vw, 64px)" }}>
            <p className="eyebrow">How it works</p>
            <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4vw, 3.4rem)" }}>From guess to <span className="em">verdict</span>, three steps.</h2>
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

      {/* CTA */}
      <section className="section" style={{ textAlign: "center", borderBottom: "none", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 50% 60% at 50% 45%, rgba(14,158,108,0.10) 0%, transparent 65%)" }} />
        <div className="wrap" style={{ position: "relative", maxWidth: 820 }}>
          <h2 className="display" style={{ fontSize: "clamp(2.4rem, 5vw, 4rem)", marginBottom: 22 }}>Stop guessing. <span className="em">Ask real people</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 30px", textAlign: "center" }}>You get 25 free credits to run your first test. One credit = one real human judgment.</p>
          <a href="/app/new" className="btn btn--lg">Start a test free <span aria-hidden>→</span></a>
        </div>
      </section>
    </>
  );
}
