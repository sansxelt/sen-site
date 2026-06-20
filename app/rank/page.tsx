import { PLAN_CATALOG } from "@/lib/v-plans";
import { ogMeta } from "@/lib/og-meta";

export const metadata = ogMeta({
  title: "Vraelis — test generated content with real users",
  description: "A feedback network for AI apps and creative teams. Test generated options with real users, get clear reports on what wins, and turn feedback into revenue.",
  path: "/",
});

const STEPS = [
  { k: "01", t: "Upload or send creative options", d: "Drop in 2–8 versions from your tool or pipeline — generated images, ads, thumbnails, landing pages, brand assets, UI concepts, copy variations.", tag: "Web · API · embed" },
  { k: "02", t: "Real users choose, rank & explain", d: "Vraelis routes your test to real people who pick what they prefer and tell you why. Quality-filtered — bots, rushers and spam are rejected automatically.", tag: "Real humans · quality-gated" },
  { k: "03", t: "Get a clear report", d: "The winner, the vote breakdown, confidence, the reasons, an AI analysis of what to improve, and the valid-vs-filtered vote quality.", tag: "Winner · why · what next" },
  { k: "04", t: "Turn feedback into revenue", d: "For AI apps, user preference activity becomes a new data layer — learn what people choose, improve your model, and unlock a feedback-driven revenue stream.", tag: "Data revenue layer" },
];

const AUDIENCE = [
  { t: "AI apps", d: "Test generated outputs with real users in-product." },
  { t: "Creative tools", d: "Let users pick the best variation before export." },
  { t: "Brands & agencies", d: "Validate campaigns and creative before spend." },
  { t: "Creators & studios", d: "Know which thumbnail, cover or cut wins." },
];

const TESTABLE = ["Generated creative", "Campaign concepts", "Product visuals", "Landing pages", "Brand assets", "UI concepts", "Content variations", "Thumbnails & covers"];

const SUPPORTS: [string, string][] = [
  ["Real-user voting", "Quality-filtered humans, not bots."],
  ["Valid vs filtered quality", "Too-fast, duplicate & spam votes are rejected."],
  ["Public shareable reports", "Send a read-only verdict to clients."],
  ["Embeddable tests", "Collect votes on any site with one line."],
  ["API for external apps", "Send options, get a ranked result."],
  ["Credit-based pricing", "1 credit = 1 valid human judgment."],
  ["On-site checkout", "Cards & wallets — never leave Vraelis."],
  ["Storage-backed assets", "Fast, CDN-served creative."],
];

export default function RankLanding() {
  return (
    <>
      {/* ── Hero ── */}
      <section style={{ position: "relative", overflow: "hidden", borderBottom: "1px solid var(--line-1)" }}>
        <div className="gridbg" />
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 55% 42% at 50% 4%, var(--acc-soft) 0%, transparent 66%)" }} />
        <div className="wrap" style={{ position: "relative", paddingTop: "clamp(40px, 6vw, 80px)", paddingBottom: "clamp(36px, 5vw, 64px)", textAlign: "center" }}>
          <p className="eyebrow rise" data-d="1" style={{ justifyContent: "center" }}>A feedback network for AI apps & creative teams</p>
          <h1 className="display rise" data-d="2" style={{ fontSize: "clamp(2.3rem, 5.2vw, 4rem)", margin: "0 auto 20px", maxWidth: 940 }}>
            Test generated content with <span className="em">real users</span>.
          </h1>
          <p className="rise" data-d="3" style={{ fontSize: "clamp(1.05rem, 1.4vw, 1.28rem)", color: "var(--fg-2)", maxWidth: 660, margin: "0 auto 28px", lineHeight: 1.5 }}>
            Vraelis helps AI apps and creative teams learn what people prefer, generate clear feedback reports, and turn feedback into revenue.
          </p>
          <div className="rise" data-d="4" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/new" className="btn btn--lg">Start a test <span aria-hidden>→</span></a>
            <a href="/pricing" className="btn btn--ghost btn--lg">View pricing</a>
            <a href="/developers" className="btn btn--ghost btn--lg">Developers</a>
          </div>
          <p className="rise" data-d="5" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-5)", marginTop: 22, letterSpacing: "0.02em" }}>
            25 free credits to start · 1 credit = 1 real human judgment
          </p>
        </div>
      </section>

      {/* ── Who uses Vraelis ── */}
      <section style={{ borderBottom: "1px solid var(--line-1)", background: "var(--bg-2)" }}>
        <div className="wrap" style={{ padding: "clamp(28px, 3.5vw, 44px) var(--gutter)" }}>
          <div className="cols-4" style={{ gap: 14 }}>
            {AUDIENCE.map((a) => (
              <div key={a.t}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 16, color: "var(--fg-1)", marginBottom: 4 }}>{a.t}</div>
                <div style={{ fontSize: 13, color: "var(--fg-3)", lineHeight: 1.5 }}>{a.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how" className="section">
        <div className="wrap">
          <div style={{ maxWidth: 640, marginBottom: "clamp(28px, 4vw, 44px)" }}>
            <p className="eyebrow">How it works</p>
            <h2 className="display" style={{ fontSize: "clamp(1.9rem, 3.6vw, 3rem)" }}>From a pile of options to a <span className="em">clear decision</span>.</h2>
          </div>
          <div className="cols-2" style={{ gap: 16 }}>
            {STEPS.map((s) => (
              <div key={s.k} className="card" style={{ display: "flex", gap: 18 }}>
                <div className="bignum bignum--ghost" style={{ fontSize: "clamp(2rem, 3.4vw, 2.8rem)", flex: "none" }}>{s.k}</div>
                <div>
                  <h3 style={{ fontSize: "clamp(1.15rem, 1.8vw, 1.4rem)", marginBottom: 8 }}>{s.t}</h3>
                  <p style={{ fontSize: 14.5, color: "var(--fg-3)", lineHeight: 1.55, marginBottom: 10 }}>{s.d}</p>
                  <span className="pill">{s.tag}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Report preview (the product) ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1.15fr)", gap: "clamp(24px, 4vw, 56px)", alignItems: "center" }} className="cols-stack">
            <div>
              <p className="eyebrow">The report</p>
              <h2 className="display" style={{ fontSize: "clamp(1.9rem, 3.4vw, 2.8rem)", marginBottom: 16 }}>Feedback you can <span className="em">act on</span>.</h2>
              <p className="lead-copy" style={{ marginBottom: 18 }}>Every test returns a clean report — not raw votes. You see exactly what won, how confident the result is, and what to change next.</p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                {["The winner + vote breakdown", "Confidence + valid-vs-filtered quality", "Real comments on why people chose", "AI analysis: why it won, what to improve"].map((x) => (
                  <li key={x} style={{ display: "flex", gap: 9, fontSize: 14.5, color: "var(--fg-2)" }}><span style={{ color: "var(--acc)" }}>✓</span>{x}</li>
                ))}
              </ul>
            </div>
            {/* mock report window */}
            <div className="win">
              <div className="win__bar"><div className="win__dots"><i /><i /><i /></div><span className="win__addr">vraelis.com/app/tests/·/report</span></div>
              <div style={{ padding: 20 }}>
                <div className="card card--acc" style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, boxShadow: "none" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 10, background: "linear-gradient(135deg, var(--acc), var(--acc-deep))", flex: "none" }} />
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acc-deep)" }}>Winner</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color: "var(--fg-1)" }}>Option B — 61%</div>
                  </div>
                  <span className="pill" style={{ marginLeft: "auto", background: "var(--bg-1)", color: "var(--acc-deep)", borderColor: "var(--acc-line)" }}>high confidence</span>
                </div>
                {[["A", 39], ["B", 61], ["C", 22]].map(([l, p]) => (
                  <div key={l as string} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
                    <span style={{ width: 18, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-4)" }}>{l}</span>
                    <div style={{ flex: 1, height: 10, borderRadius: 99, background: "var(--bg-2)", overflow: "hidden" }}><div style={{ height: "100%", width: `${p}%`, background: (l === "B") ? "var(--acc)" : "var(--line-3)" }} /></div>
                    <span style={{ width: 34, textAlign: "right", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)" }}>{p}%</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--bg-2)", border: "1px solid var(--line-1)" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)", marginBottom: 5 }}>Vraelis analysis</div>
                  <p style={{ fontSize: 12.5, color: "var(--fg-2)", lineHeight: 1.5, margin: 0 }}>B won on clarity and contrast. Voters found A too busy. Try B with a bolder focal subject to push past 70%.</p>
                </div>
                <div style={{ marginTop: 12, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-4)" }}>122 valid votes · 14 filtered</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── What teams test ── */}
      <section className="section">
        <div className="wrap">
          <div style={{ maxWidth: 640, marginBottom: "clamp(24px, 3vw, 36px)" }}>
            <p className="eyebrow">What teams test</p>
            <h2 className="display" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)" }}>If people will judge it, you can test it.</h2>
          </div>
          <div className="cols-4" style={{ gap: 12 }}>
            {TESTABLE.map((t) => (
              <div key={t} className="card card--hover" style={{ padding: "16px 18px", fontSize: 14.5, fontWeight: 600, color: "var(--fg-1)", fontFamily: "var(--font-display)" }}>{t}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── For AI apps ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div className="bento">
            <div className="tile tile--accent span4" style={{ justifyContent: "center" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.85, margin: 0 }}>For AI apps</p>
              <h3 style={{ fontSize: "clamp(1.5rem, 2.6vw, 2.1rem)", fontFamily: "var(--font-display)", lineHeight: 1.1 }}>Turn user preferences into a data revenue layer.</h3>
              <p style={{ fontSize: 15, lineHeight: 1.55, maxWidth: 520 }}>Plug Vraelis into your product. Your users test generated outputs, you learn what they prefer, and that feedback becomes a stream you own — to improve your model and unlock new revenue.</p>
              <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                <a href="/developers" className="btn" style={{ background: "#fff", color: "var(--acc-deep)", borderColor: "#fff" }}>See the API</a>
                <a href="/developers#embed" className="btn btn--ghost" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.5)" }}>Embed widget</a>
              </div>
            </div>
            <div className="tile span2"><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Plug in</div><h3 style={{ fontSize: 17 }}>One API call</h3><p style={{ fontSize: 13.5, color: "var(--fg-3)" }}>Send options, get a ranked result. Or drop in the embeddable “Test with Vraelis” widget.</p></div>
            <div className="tile span2"><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Learn</div><h3 style={{ fontSize: 17 }}>What users prefer</h3><p style={{ fontSize: 13.5, color: "var(--fg-3)" }}>Real preference signal on your generated outputs, quality-filtered.</p></div>
            <div className="tile span2"><div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--fg-4)" }}>Earn</div><h3 style={{ fontSize: 17 }}>Feedback → revenue</h3><p style={{ fontSize: 13.5, color: "var(--fg-3)" }}>Make user feedback a product surface, not a cost center.</p></div>
          </div>
        </div>
      </section>

      {/* ── Pricing preview ── */}
      <section className="section">
        <div className="wrap">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: "clamp(20px, 3vw, 32px)" }}>
            <div style={{ maxWidth: 560 }}>
              <p className="eyebrow">Pricing</p>
              <h2 className="display" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)" }}>Plans that include credits. Top up anytime.</h2>
            </div>
            <a href="/pricing" className="btn btn--ghost">View full pricing →</a>
          </div>
          <div className="cols-3" style={{ gap: 12 }}>
            <div className="card"><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>Free</div><div style={{ fontSize: 13, color: "var(--fg-4)" }}>25 one-time credits</div></div>
            {PLAN_CATALOG.map((p) => (
              <div key={p.plan} className="card card--hover">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>{p.name}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--fg-3)" }}>${p.price.monthly}/mo</div>
                </div>
                <div style={{ fontSize: 13, color: "var(--acc-deep)", fontWeight: 600, marginTop: 4 }}>{p.monthlyCredits.toLocaleString()} credits/mo</div>
              </div>
            ))}
            <div className="card"><div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>Enterprise</div><div style={{ fontSize: 13, color: "var(--fg-4)" }}>Custom volume + SLA</div></div>
          </div>
        </div>
      </section>

      {/* ── What Vraelis supports ── */}
      <section className="section" style={{ background: "var(--bg-2)" }}>
        <div className="wrap">
          <div style={{ maxWidth: 660, marginBottom: "clamp(24px, 3vw, 36px)" }}>
            <p className="eyebrow">What Vraelis supports today</p>
            <h2 className="display" style={{ fontSize: "clamp(1.8rem, 3.2vw, 2.6rem)" }}>A complete loop, <span className="em">already live</span>.</h2>
            <p className="lead-copy" style={{ marginTop: 8 }}>Built for AI apps, creators, and creative teams — from upload to verdict to a shareable report.</p>
          </div>
          <div className="cols-4" style={{ gap: 12 }}>
            {SUPPORTS.map(([t, d]) => (
              <div key={t} className="card" style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ color: "var(--acc)" }}>✓</span><span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 14.5 }}>{t}</span></div>
                <div style={{ fontSize: 12.5, color: "var(--fg-3)", lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="section" style={{ textAlign: "center", borderBottom: "none", position: "relative", overflow: "hidden" }}>
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 50% 60% at 50% 45%, rgba(14,158,108,0.10) 0%, transparent 65%)" }} />
        <div className="wrap" style={{ position: "relative", maxWidth: 760 }}>
          <h2 className="display" style={{ fontSize: "clamp(2.1rem, 4.4vw, 3.4rem)", marginBottom: 18 }}>Stop guessing. <span className="em">Ask real people</span>.</h2>
          <p className="lead-copy" style={{ margin: "0 auto 26px", textAlign: "center" }}>Run your first test free with 25 credits. One credit = one real human judgment.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/app/new" className="btn btn--lg">Start a test free <span aria-hidden>→</span></a>
            <a href="/vote" className="btn btn--ghost btn--lg">Vote & earn credits</a>
          </div>
        </div>
      </section>
    </>
  );
}
